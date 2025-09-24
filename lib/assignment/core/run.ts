import prisma from "@/prisma/prisma";
import type { RunResult, CandidateResult, AssignmentPolicy } from "@/types/assignment";
import { loadPolicy, getDRPolicy } from "../config/policy";
import { getEffectivePolicyForEnvironment } from "../config/env-policy";
import { getActiveInterpreters, getInterpreterHours } from "../scoring/fairness";
import { computeEnhancedUrgencyScore, shouldAssignImmediately } from "../scoring/urgency";
import { rankByScore } from "../scoring/scoring";
import { isDRMeeting } from "../utils/dr-history";
import { centerPart } from "@/utils/users";
import {
  filterAvailableInterpreters,
  validateAssignmentSafety,
  getInterpreterAvailabilityDetails
} from "../utils/conflict-detection";
import {
  getAssignmentLogger,
  type ConflictDetectionLogData,
  type DRPolicyLogData
} from "../logging/logging";
import { getAssignmentMonitor, logSystemError } from "../logging/monitoring";
import {
  manageDynamicPool,
  detectInterpreterListChanges,
  type DynamicPoolAdjustment,
  type FairnessAdjustment
} from "../utils/dynamic-pool";

/**
 * Check for dynamic pool changes and adjust fairness if needed
 */
async function checkAndAdjustDynamicPool(policy: AssignmentPolicy): Promise<{
  poolAdjustment: DynamicPoolAdjustment;
  fairnessAdjustments: FairnessAdjustment[];
  shouldRecalculate: boolean;
}> {
  try {
    // Get current active interpreters from DB
    const interpreters = await getActiveInterpreters();
    // transform the interpreters array to an array of empCode
    const currentInterpreterList = interpreters.map(i => i.empCode);

    // Detect interpreter pool changes
    const poolAdjustment = await detectInterpreterListChanges(
      currentInterpreterList,
      policy.fairnessWindowDays
    );

    // If significant changes detected, perform comprehensive management
    if (poolAdjustment.significantChange) {
      console.log(`🔄 Significant Interpreter List changes detected, performing comprehensive dynamic pool management...`);

      const comprehensiveResult = await manageDynamicPool(
        currentInterpreterList,
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
      const { adjustFairnessForNewInterpreters } = await import('../utils/dynamic-pool');
      const fairnessAdjustments = await adjustFairnessForNewInterpreters(
        currentInterpreterList,
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
        meetingDetail: true,
        employee: { select: { deptPath: true } }
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

  // Determine environment of this booking (first forward target if any)
  const forward = await prisma.bookingForwardTarget.findFirst({
    where: { bookingId },
    select: { environmentId: true },
    orderBy: { createdAt: 'desc' }
  });
  let environmentId = forward?.environmentId ?? null;
  if (environmentId == null) {
    const center = centerPart(booking.employee?.deptPath ?? null);
    if (center) {
      const envCenter = await prisma.environmentCenter.findUnique({ where: { center }, select: { environmentId: true } });
      environmentId = envCenter?.environmentId ?? null;
    }
  }

  // Load effective policy: per-environment if available, else global fallback
  const effectivePolicy: AssignmentPolicy = environmentId != null
    ? await getEffectivePolicyForEnvironment(environmentId)
    : await loadPolicy();

  // Respect environment auto-assign toggle
  if (!effectivePolicy.autoAssignEnabled) {
    console.log("❌ Auto-assignment is disabled for this environment");
    return {
      status: "escalated",
      reason: "auto-assign disabled"
    };
  }

  // Urgent-only approval: assign only if within urgent threshold; otherwise skip (manual)
  const isUrgent = await shouldAssignImmediately(booking.timeStart, booking.meetingType, environmentId ?? undefined);

    if (!isUrgent) {
      console.log(`⏸️ Booking ${bookingId} is not urgent. Skipping auto-assign (no pool).`);
      return {
        status: "escalated",
        reason: "not urgent — pending manual approval"
      };
    }

    // Proceed with immediate assignment
    console.log(`⚡ Booking ${bookingId} is urgent !!!, proceeding with immediate assignment`);

    // Optional dynamic recalibration remains for fairness only (not booking pool)
  const poolManagement = await checkAndAdjustDynamicPool(effectivePolicy);
    if (poolManagement.shouldRecalculate) {
      console.log(`🔄 Interpreter list changes require fairness recalculation for assignment`);
    }
  return await performAssignment(booking, effectivePolicy, poolManagement, isUrgent, environmentId);

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

// Pool processing removed. System now performs immediate assignment only for urgent bookings.

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
}, isUrgent: boolean = false, environmentId: number | null = null): Promise<RunResult> {
  const startTime = Date.now();
  const logger = getAssignmentLogger();
  const monitor = getAssignmentMonitor();
  const isDR = isDRMeeting(booking.meetingType);

  // Get active interpreters
  let interpreters = await getActiveInterpreters();

  // Rule: auto-assign can choose interpreters only inside the booking owner's environment
  if (environmentId != null) {
    const envLinks = await prisma.environmentInterpreter.findMany({
      where: { environmentId },
      select: { interpreterEmpCode: true }
    });
    const allowedSet = new Set(envLinks.map((l) => l.interpreterEmpCode));
    interpreters = interpreters.filter((i) => allowedSet.has(i.empCode));

    if (interpreters.length === 0) {
      console.log("⏸️ No interpreters linked to user's environment; skipping auto-assign");
      return {
        status: "escalated",
        reason: "no interpreters in user's environment — suggest forward"
      };
    }
  }
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

  // Get interpreter hours in window days
  const preHoursSnapshot = await getInterpreterHours(interpreters, policy.fairnessWindowDays);

  // Compute urgency score using enhanced algorithm
  const urgencyScore = await computeEnhancedUrgencyScore(
    booking.timeStart,
    booking.meetingType
  );

  console.log(`📊 Urgency score for ${booking.meetingType}: ${urgencyScore.toFixed(3)}`);

  // Simulate assignment to each AVAILABLE interpreter to check fairness
  // For urgent bookings, relax fairness constraints
  const effectiveMaxGapHours = isUrgent ? policy.maxGapHours * 2 : policy.maxGapHours;
  const fairnessMode = isUrgent ? 'RELAXED' : 'STRICT';
  
  console.log(`🔍 Fairness check mode: ${fairnessMode} (maxGap: ${effectiveMaxGapHours}h)`);
  
  //Hard filter for fairness
  const eligibleIds: string[] = [];
  
  // Calculate real booking duration for accurate simulation
  const bookingDuration = (booking.timeEnd.getTime() - booking.timeStart.getTime()) / (1000 * 60 * 60);
  console.log(`🔍 Hard filter: Using real booking duration ${bookingDuration.toFixed(2)} hours`);
  
  for (const interpreter of availableInterpreters) {
    const simulatedHours = { ...preHoursSnapshot };
    const currentHours = simulatedHours[interpreter.empCode] || 0;
    simulatedHours[interpreter.empCode] = currentHours + bookingDuration; // Use real booking duration

    const hours = Object.values(simulatedHours);
    const gap = Math.max(...hours) - Math.min(...hours);
    
    console.log(`🔍 Hard filter for ${interpreter.empCode}: current=${currentHours.toFixed(1)}h, after=${(currentHours + bookingDuration).toFixed(1)}h, gap=${gap.toFixed(1)}h, maxGap=${effectiveMaxGapHours}h`);

    if (gap <= effectiveMaxGapHours) {
      eligibleIds.push(interpreter.empCode);
      console.log(`✅ ${interpreter.empCode} PASSED hard filter (gap ${gap.toFixed(1)}h <= ${effectiveMaxGapHours}h)`);
    } else {
      console.log(`❌ ${interpreter.empCode} FAILED hard filter (gap ${gap.toFixed(1)}h > ${effectiveMaxGapHours}h)`);
    }
  }

  if (eligibleIds.length === 0) {
    if (isUrgent) {
      console.log(`⚠️ Urgent booking: No interpreters meet relaxed fairness criteria (${effectiveMaxGapHours}h), bypassing fairness for coverage`);
      // For urgent bookings, if even relaxed fairness fails, use all available interpreters
      eligibleIds.push(...availableInterpreters.map(i => i.empCode));
    } else {
      console.log(`❌ No available interpreters meet fairness criteria under max gap ${policy.maxGapHours}h`);
    }
  }

  if (eligibleIds.length === 0) {
    console.log(`❌ No available interpreters meet fairness criteria under max gap ${effectiveMaxGapHours}h`);

    // Log enhanced assignment failure
    await logger.logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: undefined,
      status: "escalated",
      reason: `no available interpreters under maxGapHours ${effectiveMaxGapHours} (${fairnessMode} mode)`,
      preHoursSnapshot,
      postHoursSnapshot: {},
      maxGapHours: effectiveMaxGapHours,
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
      reason: `no available interpreters under maxGapHours (${fairnessMode} mode)`
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
    const { getLastGlobalDRAssignment, checkDRAssignmentHistory } = await import('../utils/dr-history');

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
 * Legacy function for backward compatibility
 */
export async function run(bookingId: number): Promise<RunResult> {
  return runAssignment(bookingId);
}
