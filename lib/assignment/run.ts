import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import type { RunResult, CandidateResult, HoursSnapshot, AssignmentLogData, AssignmentPolicy } from "@/types/assignment";
import { loadPolicy, getDRPolicy } from "./policy";
import { getActiveInterpreters, getInterpreterHours } from "./fairness";
import { computeEnhancedUrgencyScore } from "./urgency";
import { rankByScore } from "./scoring";
import { isDRMeeting } from "./dr-history";
import { shouldAssignImmediately, bookingPool, processPoolEntries, processPoolEntriesWithBatchResults } from "./pool";
import {
  filterAvailableInterpreters,
  validateAssignmentSafety,
  getInterpreterAvailabilityDetails
} from "./conflict-detection";
import {
  getAssignmentLogger,
  type EnhancedAssignmentLogData,
  type ConflictDetectionLogData,
  type DRPolicyLogData,
  type PoolProcessingLogData
} from "./logging";
import { getAssignmentMonitor, logSystemError } from "./monitoring";
import {
  manageDynamicPool,
  detectPoolSizeChanges,
  type DynamicPoolAdjustment,
  type FairnessAdjustment
} from "./dynamic-pool";

/**
 * Check for dynamic pool changes and adjust fairness if needed
 */
async function checkAndAdjustDynamicPool(policy: AssignmentPolicy): Promise<{
  poolAdjustment: DynamicPoolAdjustment;
  fairnessAdjustments: FairnessAdjustment[];
  shouldRecalculate: boolean;
}> {
  try {
    // Get current active interpreters
    const interpreters = await getActiveInterpreters();
    const currentInterpreterPool = interpreters.map(i => i.empCode);

    // Detect pool changes
    const poolAdjustment = await detectPoolSizeChanges(
      currentInterpreterPool,
      policy.fairnessWindowDays
    );

    // If significant changes detected, perform comprehensive management
    if (poolAdjustment.significantChange) {
      console.log(`🔄 Significant pool changes detected, performing comprehensive dynamic pool management...`);

      const comprehensiveResult = await manageDynamicPool(
        currentInterpreterPool,
        policy.fairnessWindowDays
      );

      return {
        poolAdjustment: comprehensiveResult.poolAdjustment,
        fairnessAdjustments: comprehensiveResult.fairnessAdjustments,
        shouldRecalculate: true
      };
    } else if (poolAdjustment.poolChangeDetected) {
      console.log(`📊 Minor pool changes detected, applying basic fairness adjustments...`);

      // For minor changes, just get fairness adjustments
      const { adjustFairnessForNewInterpreters } = await import('./dynamic-pool');
      const fairnessAdjustments = await adjustFairnessForNewInterpreters(
        currentInterpreterPool,
        policy.fairnessWindowDays
      );

      return {
        poolAdjustment,
        fairnessAdjustments,
        shouldRecalculate: poolAdjustment.newInterpreters.length > 0
      };
    }

    // No significant changes
    return {
      poolAdjustment,
      fairnessAdjustments: [],
      shouldRecalculate: false
    };

  } catch (error) {
    console.error('❌ Error checking dynamic pool changes:', error);
    // Return safe defaults to continue assignment
    return {
      poolAdjustment: {
        newInterpreters: [],
        removedInterpreters: [],
        adjustmentFactor: 1.0,
        poolChangeDetected: false,
        poolSizeChange: 0,
        significantChange: false
      },
      fairnessAdjustments: [],
      shouldRecalculate: false
    };
  }
}

// Main assignment function for a single booking -->> its start here
export async function runAssignment(bookingId: number): Promise<RunResult> {
  console.log(`🚀 Starting assignment for booking ${bookingId}`);

  try {
    // Load current policy
    const policy = await loadPolicy();

    if (!policy.autoAssignEnabled) {
      console.log("❌ Auto-assignment is disabled");
      return {
        status: "escalated",
        reason: "auto-assign disabled"
      };
    }

    // Get booking details
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        timeStart: true,
        timeEnd: true,
        meetingType: true,
        interpreterEmpCode: true,
        meetingDetail: true
      }
    });

    if (!booking) {
      console.log(`❌ Booking ${bookingId} not found`);
      return {
        status: "escalated",
        reason: "booking not found"
      };
    }

    // Check if already assigned
    if (booking.interpreterEmpCode) {
      console.log(`✅ Booking ${bookingId} already has interpreter ${booking.interpreterEmpCode}`);
      return {
        status: "assigned",
        interpreterId: booking.interpreterEmpCode,
        reason: "already assigned"
      };
    }

    // Check if booking should be assigned immediately or sent to pool based on mode
    const isUrgent = await shouldAssignImmediately(booking.timeStart, booking.meetingType, policy.mode);

    if (!isUrgent) {
      console.log(`📥 Booking ${bookingId} is not urgent, adding to pool (mode: ${policy.mode})`);

      const poolEntry = await bookingPool.addToPoolEnhanced(
        booking.bookingId,
        booking.meetingType,
        booking.timeStart,
        booking.timeEnd,
        policy.mode
      );

      return {
        status: "pooled",
        reason: `Non-urgent booking added to pool (mode: ${policy.mode}, threshold: ${poolEntry.thresholdDays} days, deadline: ${poolEntry.deadlineTime.toISOString()})`,
        poolEntry
      };
    }

    // Proceed with immediate assignment
    console.log(`⚡ Booking ${bookingId} is urgent, proceeding with immediate assignment`);

    // Check for dynamic pool changes before assignment
    const poolManagement = await checkAndAdjustDynamicPool(policy);

    if (poolManagement.shouldRecalculate) {
      console.log(`🔄 Pool changes require fairness recalculation for assignment`);
    }

    return await performAssignment(booking, policy, poolManagement);

  } catch (error) {
    console.error(`❌ Error in assignment for booking ${bookingId}:`, error);

    // Log error with system state capture
    if (error instanceof Error) {
      await logSystemError(error, {
        operation: 'runAssignment',
        bookingId,
        additionalData: {
          policyMode: (await loadPolicy()).mode
        }
      });
    }

    return {
      status: "escalated",
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process all pool entries that are ready for assignment with enhanced batch processing
 */
export async function processPool(): Promise<RunResult[]> {
  console.log("🔄 Processing booking pool with enhanced mode-specific logic...");

  const logger = getAssignmentLogger();
  const processingStartTime = new Date();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Load current policy
  const policy = await loadPolicy();

  // Check for dynamic pool changes before processing
  const poolManagement = await checkAndAdjustDynamicPool(policy);

  if (poolManagement.shouldRecalculate) {
    console.log(`🔄 Dynamic pool changes detected, adjusting batch processing for fairness`);
    console.log(`   - New interpreters: ${poolManagement.poolAdjustment.newInterpreters.length}`);
    console.log(`   - Removed interpreters: ${poolManagement.poolAdjustment.removedInterpreters.length}`);
    console.log(`   - Adjustment factor: ${poolManagement.poolAdjustment.adjustmentFactor.toFixed(2)}`);
  }

  // Get enhanced processing results with batch information
  const processingResult = await processPoolEntriesWithBatchResults(policy.mode);
  const { entries: readyEntries, batchResults, summary } = processingResult;

  if (readyEntries.length === 0) {
    console.log("📭 No pool entries ready for assignment");
    return [];
  }

  console.log(`📊 Pool processing summary (${policy.mode} mode): ${summary.totalProcessed} processed, ${summary.totalAssigned} assigned, ${summary.totalEscalated} escalated`);

  if (batchResults && batchResults.length > 0) {
    console.log(`⚖️ Batch processing results: ${batchResults.length} batches, fairness improvement: ${summary.fairnessImprovement?.toFixed(2) || 'N/A'}`);
  }

  const results: RunResult[] = [];
  const errors: Array<{ bookingId: number; error: string; timestamp: Date }> = [];
  let assignedCount = 0;
  let escalatedCount = 0;
  let failedCount = 0;

  const batchProcessingStart = Date.now();

  for (const entry of readyEntries) {
    const entryStartTime = Date.now();

    try {
      console.log(`🔄 Processing pool entry for booking ${entry.bookingId} (mode: ${entry.mode}, priority: ${entry.processingPriority})`);

      // Get current booking details
      const booking = await prisma.bookingPlan.findUnique({
        where: { bookingId: entry.bookingId },
        select: {
          bookingId: true,
          timeStart: true,
          timeEnd: true,
          meetingType: true,
          interpreterEmpCode: true,
          meetingDetail: true
        }
      });

      if (!booking) {
        console.log(`❌ Pool entry ${entry.bookingId} not found in database, removing from pool`);
        bookingPool.removeFromPool(entry.bookingId);

        const error = "booking not found in database";
        errors.push({
          bookingId: entry.bookingId,
          error,
          timestamp: new Date()
        });
        failedCount++;

        results.push({
          status: "escalated",
          reason: error
        });
        continue;
      }

      // Check if already assigned
      if (booking.interpreterEmpCode) {
        console.log(`✅ Pool entry ${entry.bookingId} already assigned, removing from pool`);
        bookingPool.removeFromPool(entry.bookingId);
        assignedCount++;

        results.push({
          status: "assigned",
          interpreterId: booking.interpreterEmpCode,
          reason: "already assigned"
        });
        continue;
      }

      // Perform assignment with pool processing context
      const result = await performAssignmentWithPoolContext(booking, policy, {
        batchId,
        poolMode: entry.mode,
        processingPriority: entry.processingPriority,
        thresholdDays: entry.thresholdDays,
        deadlineTime: entry.deadlineTime,
        fairnessImprovement: summary.fairnessImprovement
      }, poolManagement);

      // Remove from pool if assignment was successful
      if (result.status === "assigned") {
        bookingPool.removeFromPool(entry.bookingId);
        assignedCount++;
      } else if (result.status === "escalated") {
        escalatedCount++;
      }

      results.push(result);

    } catch (error) {
      console.error(`❌ Error processing pool entry ${entry.bookingId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        bookingId: entry.bookingId,
        error: errorMessage,
        timestamp: new Date()
      });
      failedCount++;

      results.push({
        status: "escalated",
        reason: `Error: ${errorMessage}`
      });
    }
  }

  const processingEndTime = new Date();
  const totalProcessingTime = processingEndTime.getTime() - processingStartTime.getTime();
  const averageProcessingTime = readyEntries.length > 0 ? totalProcessingTime / readyEntries.length : 0;

  // Determine system load based on processing performance and results
  const systemLoad: 'HIGH' | 'MEDIUM' | 'LOW' =
    failedCount > readyEntries.length * 0.3 ? 'HIGH' :
      escalatedCount > readyEntries.length * 0.2 ? 'MEDIUM' : 'LOW';

  // Log pool processing batch results
  const poolLogData: PoolProcessingLogData = {
    batchId,
    processingType: 'POOL_PROCESSING',
    mode: policy.mode,
    processingStartTime,
    processingEndTime,
    totalEntries: readyEntries.length,
    processedEntries: readyEntries.length,
    assignedEntries: assignedCount,
    escalatedEntries: escalatedCount,
    failedEntries: failedCount,
    fairnessImprovement: summary.fairnessImprovement,
    averageProcessingTimeMs: averageProcessingTime,
    systemLoad,
    errors,
    performance: {
      conflictDetectionTimeMs: 0, // Will be aggregated from individual assignments
      scoringTimeMs: 0, // Will be aggregated from individual assignments
      dbOperationTimeMs: 0, // Will be aggregated from individual assignments
      totalTimeMs: totalProcessingTime
    }
  };

  await logger.logPoolProcessing(poolLogData);

  return results;
}

/**
 * Perform assignment with pool processing context for enhanced logging
 */
async function performAssignmentWithPoolContext(
  booking: {
    bookingId: number;
    timeStart: Date;
    timeEnd: Date;
    meetingType: string;
    interpreterEmpCode: string | null;
    meetingDetail: string | null;
  },
  policy: AssignmentPolicy,
  poolContext: {
    batchId: string;
    poolMode: string;
    processingPriority: number;
    thresholdDays: number;
    deadlineTime: Date;
    fairnessImprovement?: number;
  },
  poolManagement?: {
    poolAdjustment: DynamicPoolAdjustment;
    fairnessAdjustments: FairnessAdjustment[];
    shouldRecalculate: boolean;
  }
): Promise<RunResult> {
  // Call the regular performAssignment but with pool context and dynamic pool management
  const result = await performAssignment(booking, policy, poolManagement);

  // The enhanced logging in performAssignment will automatically include pool context
  // if we modify the logger calls to accept pool context

  return result;
}

/**
 * Perform the actual assignment logic
 */
async function performAssignment(booking: {
  bookingId: number;
  timeStart: Date;
  timeEnd: Date;
  meetingType: string;
  interpreterEmpCode: string | null;
  meetingDetail: string | null;
}, policy: AssignmentPolicy, poolManagement?: {
  poolAdjustment: DynamicPoolAdjustment;
  fairnessAdjustments: FairnessAdjustment[];
  shouldRecalculate: boolean;
}): Promise<RunResult> {
  const startTime = Date.now();
  const logger = getAssignmentLogger();
  const monitor = getAssignmentMonitor();
  const isDR = isDRMeeting(booking.meetingType);

  // Get active interpreters
  const interpreters = await getActiveInterpreters();
  if (interpreters.length === 0) {
    console.log("❌ No active interpreters found");

    // Log enhanced assignment failure
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: "no active interpreters found",
      preHoursSnapshot: {},
      postHoursSnapshot: {},
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      systemState: {
        activeInterpreters: 0,
        poolSize: 0,
        systemLoad: 'LOW'
      },
      performance: {
        totalProcessingTimeMs: Date.now() - startTime,
        conflictCheckTimeMs: 0,
        scoringTimeMs: 0,
        dbOperationTimeMs: 0
      }
    });

    return {
      status: "escalated",
      reason: "no active interpreters found"
    };
  }

  // CONFLICT DETECTION: Filter out interpreters with time conflicts
  console.log(`🔍 Checking availability for ${interpreters.length} interpreters...`);
  const conflictCheckStart = Date.now();
  const interpreterIds = interpreters.map(i => i.empCode);
  const availableInterpreterIds = await filterAvailableInterpreters(
    interpreterIds,
    booking.timeStart,
    booking.timeEnd
  );
  const conflictCheckTime = Date.now() - conflictCheckStart;

  // Get detailed conflict information for logging
  const availabilityDetails = await getInterpreterAvailabilityDetails(
    interpreterIds,
    booking.timeStart,
    booking.timeEnd
  );

  // Record conflict detection metrics for monitoring
  monitor.recordConflictStats(interpreters.length, interpreters.length - availableInterpreterIds.length);

  // Log conflict detection details
  const conflictLogData: ConflictDetectionLogData = {
    timestamp: new Date(),
    bookingId: booking.bookingId,
    requestedTimeStart: booking.timeStart,
    requestedTimeEnd: booking.timeEnd,
    totalInterpretersChecked: interpreters.length,
    availableInterpreters: availableInterpreterIds.length,
    conflictedInterpreters: interpreters.length - availableInterpreterIds.length,
    conflicts: availabilityDetails
      .filter(detail => !detail.isAvailable)
      .flatMap(detail =>
        detail.conflicts.map(conflict => ({
          interpreterId: detail.interpreterId,
          conflictingBookingId: conflict.conflictingBookingId,
          conflictType: conflict.conflictType,
          conflictStart: conflict.conflictStart,
          conflictEnd: conflict.conflictEnd,
          meetingType: conflict.conflictingMeetingType
        }))
      ),
    processingTimeMs: conflictCheckTime,
    resolutionStrategy: availableInterpreterIds.length > 0 ? 'FILTER_CONFLICTS' : 'ESCALATE',
    outcome: availableInterpreterIds.length > 0 ? 'SUCCESS' : 'FAILURE'
  };

  await logger.logConflictDetection(conflictLogData);

  if (availableInterpreterIds.length === 0) {
    console.log("❌ No interpreters available due to time conflicts");

    const conflictSummary = availabilityDetails
      .filter(detail => !detail.isAvailable)
      .map(detail => `${detail.interpreterId}: ${detail.conflicts.length} conflicts`)
      .join(', ');

    // Log enhanced assignment failure with conflict details
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: `All interpreters have time conflicts: ${conflictSummary}`,
      preHoursSnapshot: {},
      postHoursSnapshot: {},
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      conflictDetection: {
        totalInterpretersChecked: interpreters.length,
        availableInterpreters: 0,
        conflictedInterpreters: interpreters.length,
        conflictDetails: availabilityDetails
          .filter(detail => !detail.isAvailable)
          .map(detail => ({
            interpreterId: detail.interpreterId,
            conflictCount: detail.conflicts.length,
            conflictTypes: detail.conflicts.map(c => c.conflictType)
          })),
        processingTimeMs: conflictCheckTime
      },
      systemState: {
        activeInterpreters: interpreters.length,
        poolSize: 0, // Will be updated if pool info available
        systemLoad: 'HIGH' // High load indicated by all conflicts
      },
      performance: {
        totalProcessingTimeMs: Date.now() - startTime,
        conflictCheckTimeMs: conflictCheckTime,
        scoringTimeMs: 0,
        dbOperationTimeMs: 0
      }
    });

    return {
      status: "escalated",
      reason: `All interpreters have time conflicts: ${conflictSummary}`
    };
  }

  // Filter interpreters to only include available ones
  const availableInterpreters = interpreters.filter(i =>
    availableInterpreterIds.includes(i.empCode)
  );

  console.log(`✅ ${availableInterpreters.length} of ${interpreters.length} interpreters are available`);

  // Get current hour distribution
  const preHoursSnapshot = await getInterpreterHours(interpreters, policy.fairnessWindowDays);

  // Compute urgency score using enhanced algorithm
  const urgencyScore = await computeEnhancedUrgencyScore(
    booking.timeStart,
    booking.meetingType
  );

  console.log(`📊 Urgency score for ${booking.meetingType}: ${urgencyScore.toFixed(3)}`);

  // Simulate assignment to each AVAILABLE interpreter to check fairness
  //Hard filter for fairness
  const eligibleIds: string[] = [];
  for (const interpreter of availableInterpreters) {
    const simulatedHours = { ...preHoursSnapshot };
    simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1; // assume 1 hour

    const hours = Object.values(simulatedHours);
    const gap = Math.max(...hours) - Math.min(...hours);

    if (gap <= policy.maxGapHours) {
      eligibleIds.push(interpreter.empCode);
    }
  }

  if (eligibleIds.length === 0) {
    console.log(`❌ No available interpreters meet fairness criteria under max gap ${policy.maxGapHours}h`);

    // Log enhanced assignment failure
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: `no available interpreters under maxGapHours ${policy.maxGapHours}`,
      preHoursSnapshot,
      postHoursSnapshot: {},
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      conflictDetection: {
        totalInterpretersChecked: interpreters.length,
        availableInterpreters: availableInterpreters.length,
        conflictedInterpreters: interpreters.length - availableInterpreters.length,
        conflictDetails: availabilityDetails
          .filter(detail => !detail.isAvailable)
          .map(detail => ({
            interpreterId: detail.interpreterId,
            conflictCount: detail.conflicts.length,
            conflictTypes: detail.conflicts.map(c => c.conflictType)
          })),
        processingTimeMs: conflictCheckTime
      },
      systemState: {
        activeInterpreters: interpreters.length,
        poolSize: 0,
        systemLoad: 'MEDIUM'
      },
      performance: {
        totalProcessingTimeMs: Date.now() - startTime,
        conflictCheckTimeMs: conflictCheckTime,
        scoringTimeMs: 0,
        dbOperationTimeMs: 0
      }
    });

    return {
      status: "escalated",
      reason: `no available interpreters under maxGapHours`
    };
  }

  // Rank candidates by score (only available interpreters)
  const scoringStart = Date.now();
  const candidates = availableInterpreters.map(interpreter => ({
    empCode: interpreter.empCode,
    currentHours: preHoursSnapshot[interpreter.empCode] || 0,
    daysSinceLastAssignment: 0 // Will be computed in rankByScore
  }));

  // Apply dynamic pool adjustments to scoring if available
  let adjustedPolicy = policy;
  if (poolManagement?.shouldRecalculate && poolManagement.poolAdjustment.adjustmentFactor !== 1.0) {
    console.log(`🎯 Applying dynamic pool adjustment factor: ${poolManagement.poolAdjustment.adjustmentFactor.toFixed(2)}`);

    // Create adjusted policy with modified fairness weighting for new interpreters
    adjustedPolicy = {
      ...policy,
      // Boost fairness weight when new interpreters are present to encourage their selection
      w_fair: policy.mode === 'CUSTOM' ?
        policy.w_fair * poolManagement.poolAdjustment.adjustmentFactor :
        policy.w_fair
    };
  }

  const rankedResults = await rankByScore(
    candidates,
    preHoursSnapshot,
    urgencyScore,
    adjustedPolicy.mode,
    adjustedPolicy.fairnessWindowDays,
    adjustedPolicy.maxGapHours,
    isDR,
    adjustedPolicy.drConsecutivePenalty,
    adjustedPolicy.mode === 'CUSTOM' ? {
      w_fair: adjustedPolicy.w_fair,
      w_urgency: adjustedPolicy.w_urgency,
      w_lrs: adjustedPolicy.w_lrs
    } : undefined,
    booking.timeStart,
    booking.meetingDetail || undefined // drType will be extracted from booking.meetingDetail if needed
  );
  const scoringTime = Date.now() - scoringStart;

  // Get top candidate
  const topCandidate = rankedResults[0];
  if (!topCandidate || !topCandidate.eligible) {
    console.log("❌ No eligible candidates after scoring");

    // Log enhanced assignment failure
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: "no eligible candidates after scoring",
      preHoursSnapshot,
      postHoursSnapshot: {},
      scoreBreakdown: rankedResults.length > 0 ? rankedResults[0].scores : undefined,
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      conflictDetection: {
        totalInterpretersChecked: interpreters.length,
        availableInterpreters: availableInterpreters.length,
        conflictedInterpreters: interpreters.length - availableInterpreters.length,
        conflictDetails: availabilityDetails
          .filter(detail => !detail.isAvailable)
          .map(detail => ({
            interpreterId: detail.interpreterId,
            conflictCount: detail.conflicts.length,
            conflictTypes: detail.conflicts.map(c => c.conflictType)
          })),
        processingTimeMs: conflictCheckTime
      },
      systemState: {
        activeInterpreters: interpreters.length,
        poolSize: 0,
        systemLoad: 'MEDIUM'
      },
      performance: {
        totalProcessingTimeMs: Date.now() - startTime,
        conflictCheckTimeMs: conflictCheckTime,
        scoringTimeMs: scoringTime,
        dbOperationTimeMs: 0
      }
    });

    return {
      status: "escalated",
      reason: "no eligible candidates after scoring"
    };
  }

  // Log DR policy decision if this is a DR meeting
  if (isDR) {
    // Get DR policy information for logging
    const { getLastGlobalDRAssignment, checkDRAssignmentHistory } = await import('./dr-history');

    const drPolicy = getDRPolicy(policy.mode, policy);
    const lastGlobalDR = await getLastGlobalDRAssignment(booking.timeStart, {
      fairnessWindowDays: policy.fairnessWindowDays
    });

    // Log DR policy decision for the top candidate
    const drHistory = await checkDRAssignmentHistory(
      topCandidate.empCode,
      policy.fairnessWindowDays,
      {
        bookingTimeStart: booking.timeStart,
        drType: booking.meetingDetail || undefined,
        lastGlobalDR,
        drPolicy
      }
    );

    const drPolicyLogData: DRPolicyLogData = {
      timestamp: new Date(),
      bookingId: booking.bookingId,
      interpreterId: topCandidate.empCode,
      isDRMeeting: true,
      drType: booking.meetingDetail || undefined,
      mode: policy.mode,
      policyApplied: drPolicy,
      lastGlobalDR: lastGlobalDR.interpreterEmpCode ? {
        interpreterId: lastGlobalDR.interpreterEmpCode,
        timeStart: lastGlobalDR.timeStart,
        bookingId: lastGlobalDR.bookingId
      } : undefined,
      drHistory: {
        consecutiveCount: drHistory.consecutiveDRCount,
        isBlocked: drHistory.isBlocked,
        penaltyApplied: drHistory.penaltyApplied,
        penaltyAmount: drHistory.policyResult?.penaltyAmount || 0,
        overrideApplied: drHistory.policyResult?.overrideApplied || false,
        overrideReason: drHistory.policyResult?.reason,
        policyDecisionReason: drHistory.policyResult?.reason || "Standard DR policy applied"
      },
      alternativeInterpreters: rankedResults.filter(r => r.eligible).length - 1,
      finalDecision: drHistory.isBlocked ? 'BLOCKED' :
        drHistory.penaltyApplied ? 'PENALIZED' : 'ASSIGNED',
      decisionRationale: `DR policy (${policy.mode} mode): ${drHistory.policyResult?.reason || 'Standard assignment'}`
    };

    await logger.logDRPolicyDecision(drPolicyLogData);
  }

  // Attempt assignment with conflict detection and retry logic
  console.log(`🎯 Attempting to assign booking ${booking.bookingId} with conflict detection...`);

  const dbOperationStart = Date.now();
  const assignmentResult = await attemptAssignmentWithRetry(
    booking,
    rankedResults,
    availableInterpreterIds
  );
  const dbOperationTime = Date.now() - dbOperationStart;

  if (!assignmentResult.success) {
    console.log("❌ Assignment failed after trying all candidates with retries");

    // Log enhanced assignment failure
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: assignmentResult.error || "Assignment failed with conflict detection",
      preHoursSnapshot,
      postHoursSnapshot: {},
      scoreBreakdown: topCandidate.scores,
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      conflictDetection: {
        totalInterpretersChecked: interpreters.length,
        availableInterpreters: availableInterpreters.length,
        conflictedInterpreters: interpreters.length - availableInterpreters.length,
        conflictDetails: availabilityDetails
          .filter(detail => !detail.isAvailable)
          .map(detail => ({
            interpreterId: detail.interpreterId,
            conflictCount: detail.conflicts.length,
            conflictTypes: detail.conflicts.map(c => c.conflictType)
          })),
        processingTimeMs: conflictCheckTime
      },
      drPolicyDecision: isDR ? {
        isDRMeeting: true,
        drType: booking.meetingDetail || undefined,
        policyApplied: getDRPolicy(policy.mode, policy),
        policyDecisionReason: "Assignment failed during conflict resolution"
      } : undefined,
      systemState: {
        activeInterpreters: interpreters.length,
        poolSize: 0,
        systemLoad: 'HIGH'
      },
      performance: {
        totalProcessingTimeMs: Date.now() - startTime,
        conflictCheckTimeMs: conflictCheckTime,
        scoringTimeMs: scoringTime,
        dbOperationTimeMs: dbOperationTime,
        retryAttempts: 3 // Max retries attempted
      }
    });

    return {
      status: "escalated",
      reason: assignmentResult.error || "Assignment failed with conflict detection"
    };
  }

  const assignedCandidate = assignmentResult.assignedCandidate!;

  // Get post-assignment hour snapshot
  const postHoursSnapshot = await getInterpreterHours(interpreters, policy.fairnessWindowDays);

  // Log enhanced assignment success
  await logger.logAssignment({
    bookingId: booking.bookingId,
    interpreterEmpCode: assignedCandidate.empCode,
    status: "assigned",
    reason: `Assigned to ${assignedCandidate.empCode} (score: ${assignedCandidate.scores.total.toFixed(3)}) with conflict detection${poolManagement?.shouldRecalculate ? ' and dynamic pool adjustments' : ''}`,
    preHoursSnapshot,
    postHoursSnapshot,
    scoreBreakdown: assignedCandidate.scores,
    maxGapHours: policy.maxGapHours,
    fairnessWindowDays: policy.fairnessWindowDays,
    dynamicPoolManagement: poolManagement ? {
      poolChangeDetected: poolManagement.poolAdjustment.poolChangeDetected,
      significantChange: poolManagement.poolAdjustment.significantChange,
      newInterpreters: poolManagement.poolAdjustment.newInterpreters.length,
      removedInterpreters: poolManagement.poolAdjustment.removedInterpreters.length,
      adjustmentFactor: poolManagement.poolAdjustment.adjustmentFactor,
      fairnessAdjustmentsApplied: poolManagement.fairnessAdjustments.length,
      shouldRecalculate: poolManagement.shouldRecalculate
    } : undefined,
    conflictDetection: {
      totalInterpretersChecked: interpreters.length,
      availableInterpreters: availableInterpreters.length,
      conflictedInterpreters: interpreters.length - availableInterpreters.length,
      conflictDetails: availabilityDetails
        .filter(detail => !detail.isAvailable)
        .map(detail => ({
          interpreterId: detail.interpreterId,
          conflictCount: detail.conflicts.length,
          conflictTypes: detail.conflicts.map(c => c.conflictType)
        })),
      processingTimeMs: conflictCheckTime
    },
    drPolicyDecision: isDR ? {
      isDRMeeting: true,
      drType: booking.meetingDetail || undefined,
      policyApplied: getDRPolicy(policy.mode, policy),
      interpreterDRHistory: {
        interpreterId: assignedCandidate.empCode,
        consecutiveCount: 0, // Will be updated with actual DR history
        isBlocked: false,
        penaltyApplied: assignedCandidate.scores.drPenalty !== undefined,
        penaltyAmount: assignedCandidate.scores.drPenalty || 0
      },
      policyDecisionReason: `DR assignment successful with ${policy.mode} mode policy`
    } : undefined,
    systemState: {
      activeInterpreters: interpreters.length,
      poolSize: 0, // Will be updated if pool info available
      systemLoad: interpreters.length < 3 ? 'HIGH' :
        interpreters.length < 6 ? 'MEDIUM' : 'LOW'
    },
    performance: {
      totalProcessingTimeMs: Date.now() - startTime,
      conflictCheckTimeMs: conflictCheckTime,
      scoringTimeMs: scoringTime,
      dbOperationTimeMs: dbOperationTime
    }
  });

  // Record processing time for monitoring
  const totalProcessingTime = Date.now() - startTime;
  monitor.recordProcessingTime(booking.bookingId, totalProcessingTime);

  console.log(`✅ Successfully assigned booking ${booking.bookingId} to ${assignedCandidate.empCode}`);
  console.log(`📊 Final scores: Fairness=${assignedCandidate.scores.fairness.toFixed(3)}, Urgency=${assignedCandidate.scores.urgency.toFixed(3)}, LRS=${assignedCandidate.scores.lrs.toFixed(3)}, Total=${assignedCandidate.scores.total.toFixed(3)}`);

  return {
    status: "assigned",
    interpreterId: assignedCandidate.empCode,
    breakdown: rankedResults,
    note: `Assigned using ${policy.mode} mode with conflict detection`
  };
}

/**
 * Attempt to assign an interpreter with conflict detection and retry logic
 */
async function attemptAssignmentWithRetry(
  booking: { bookingId: number; timeStart: Date; timeEnd: Date },
  candidates: CandidateResult[],
  availableInterpreterIds: string[],
  maxRetries: number = 3
): Promise<{ success: boolean; assignedCandidate?: CandidateResult; error?: string }> {

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const candidate = candidates[candidateIndex];

    if (!candidate.eligible || !availableInterpreterIds.includes(candidate.empCode)) {
      continue; // Skip ineligible or unavailable candidates
    }

    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
      try {
        // Validate assignment safety
        const isSafe = await validateAssignmentSafety(
          candidate.empCode,
          booking.timeStart,
          booking.timeEnd,
          booking.bookingId
        );

        if (!isSafe) {
          console.log(`⚠️ Conflict detected for ${candidate.empCode}, trying next candidate...`);
          break; // Try next candidate
        }

        // Perform assignment within transaction
        await prisma.$transaction(async (tx) => {
          // Double-check booking hasn't been assigned
          const currentBooking = await tx.bookingPlan.findUnique({
            where: { bookingId: booking.bookingId },
            select: { interpreterEmpCode: true }
          });

          if (currentBooking?.interpreterEmpCode) {
            throw new Error(`Booking already assigned to ${currentBooking.interpreterEmpCode}`);
          }

          // Final safety check within transaction
          const finalCheck = await validateAssignmentSafety(
            candidate.empCode,
            booking.timeStart,
            booking.timeEnd,
            booking.bookingId
          );

          if (!finalCheck) {
            throw new Error(`Final conflict check failed for ${candidate.empCode}`);
          }

          // Perform assignment
          await tx.bookingPlan.update({
            where: { bookingId: booking.bookingId },
            data: {
              interpreterEmpCode: candidate.empCode,
              bookingStatus: 'approve'
            }
          });
        });

        return { success: true, assignedCandidate: candidate };

      } catch (error) {
        console.log(`⚠️ Assignment attempt ${retryCount + 1} failed for ${candidate.empCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        if (retryCount < maxRetries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
        }
      }
    }
  }

  return {
    success: false,
    error: "No suitable candidates could be assigned after conflict resolution and retries"
  };
}



/**
 * Get pool status for monitoring
 */
export async function getPoolStatus() {
  const { getPoolStatus } = await import("./pool");
  return getPoolStatus();
}

/**
 * Legacy function for backward compatibility
 */
export async function run(bookingId: number): Promise<RunResult> {
  return runAssignment(bookingId);
}
