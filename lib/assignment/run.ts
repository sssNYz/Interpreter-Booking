import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import type { RunResult, CandidateResult, HoursSnapshot, AssignmentLogData, AssignmentPolicy } from "@/types/assignment";
import { loadPolicy } from "./policy";
import { getActiveInterpreters, getInterpreterHours } from "./fairness";
import { computeEnhancedUrgencyScore } from "./urgency";
import { rankByScore } from "./scoring";
import { isDRMeeting } from "./dr-history";
import { shouldAssignImmediately, bookingPool, processPoolEntries } from "./pool";

/**
 * Main assignment function for a single booking
 */
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

    // Check if booking should be assigned immediately or sent to pool
    const isUrgent = await shouldAssignImmediately(booking.timeStart, booking.meetingType);
    
    if (!isUrgent) {
      console.log(`📥 Booking ${bookingId} is not urgent, adding to pool`);
      
      const poolEntry = await bookingPool.addToPool(
        booking.bookingId,
        booking.meetingType,
        booking.timeStart,
        booking.timeEnd
      );
      
      return {
        status: "pooled",
        reason: `Non-urgent booking added to pool (decision window: ${poolEntry.decisionWindowTime.toISOString()})`,
        poolEntry
      };
    }

    // Proceed with immediate assignment
    console.log(`⚡ Booking ${bookingId} is urgent, proceeding with immediate assignment`);
    
    return await performAssignment(booking, policy);
    
  } catch (error) {
    console.error(`❌ Error in assignment for booking ${bookingId}:`, error);
    return {
      status: "escalated",
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process all pool entries that are ready for assignment
 */
export async function processPool(): Promise<RunResult[]> {
  console.log("🔄 Processing booking pool...");
  
  const readyEntries = await processPoolEntries();
  const results: RunResult[] = [];
  
  if (readyEntries.length === 0) {
    console.log("📭 No pool entries ready for assignment");
    return [];
  }
  
  // Load current policy
  const policy = await loadPolicy();
  
  for (const entry of readyEntries) {
    try {
      console.log(`🔄 Processing pool entry for booking ${entry.bookingId}`);
      
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
        results.push({
          status: "escalated",
          reason: "booking not found in database"
        });
        continue;
      }
      
      // Check if already assigned
      if (booking.interpreterEmpCode) {
        console.log(`✅ Pool entry ${entry.bookingId} already assigned, removing from pool`);
        bookingPool.removeFromPool(entry.bookingId);
        results.push({
          status: "assigned",
          interpreterId: booking.interpreterEmpCode,
          reason: "already assigned"
        });
        continue;
      }
      
      // Perform assignment
      const result = await performAssignment(booking, policy);
      
      // Remove from pool if assignment was successful
      if (result.status === "assigned") {
        bookingPool.removeFromPool(entry.bookingId);
      }
      
      results.push(result);
      
    } catch (error) {
      console.error(`❌ Error processing pool entry ${entry.bookingId}:`, error);
      results.push({
        status: "escalated",
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  return results;
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
}, policy: AssignmentPolicy): Promise<RunResult> {
  const isDR = isDRMeeting(booking.meetingType);
  
  // Get active interpreters
  const interpreters = await getActiveInterpreters();
  if (interpreters.length === 0) {
    console.log("❌ No active interpreters found");
    return {
      status: "escalated",
      reason: "no active interpreters found"
    };
  }

  // Get current hour distribution
  const preHoursSnapshot = await getInterpreterHours(interpreters, policy.fairnessWindowDays);
  
  // Compute urgency score using enhanced algorithm
  const urgencyScore = await computeEnhancedUrgencyScore(
    booking.timeStart,
    booking.meetingType,
    policy.minAdvanceDays
  );
  
  console.log(`📊 Urgency score for ${booking.meetingType}: ${urgencyScore.toFixed(3)}`);

  // Simulate assignment to each interpreter to check fairness
  const eligibleIds: string[] = [];
  for (const interpreter of interpreters) {
    const simulatedHours = { ...preHoursSnapshot };
    simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1; // assume 1 hour
    
    const hours = Object.values(simulatedHours);
    const gap = Math.max(...hours) - Math.min(...hours);
    
    if (gap <= policy.maxGapHours) {
      eligibleIds.push(interpreter.empCode);
    }
  }

  if (eligibleIds.length === 0) {
    console.log(`❌ No eligible interpreters under max gap ${policy.maxGapHours}h`);
    return {
      status: "escalated",
      reason: `no eligible under maxGapHours`
    };
  }

  // Rank candidates by score
  const candidates = interpreters.map(interpreter => ({
    empCode: interpreter.empCode,
    currentHours: preHoursSnapshot[interpreter.empCode] || 0,
    daysSinceLastAssignment: 0 // Will be computed in rankByScore
  }));
  
  const rankedResults = await rankByScore(
    candidates,
    preHoursSnapshot,
    urgencyScore,
    policy.mode,
    policy.fairnessWindowDays,
    policy.maxGapHours,
    isDR,
    policy.drConsecutivePenalty,
    policy.mode === 'CUSTOM' ? { w_fair: policy.w_fair, w_urgency: policy.w_urgency, w_lrs: policy.w_lrs } : undefined
  );

  // Get top candidate
  const topCandidate = rankedResults[0];
  if (!topCandidate || !topCandidate.eligible) {
    console.log("❌ No eligible candidates after scoring");
    return {
      status: "escalated",
      reason: "no eligible candidates after scoring"
    };
  }

  // Assign interpreter
  try {
    await prisma.bookingPlan.update({
      where: { bookingId: booking.bookingId },
      data: { 
        interpreterEmpCode: topCandidate.empCode,
        bookingStatus: 'approve' // Auto-approve when interpreter is assigned
      }
    });

    // Get post-assignment hour snapshot
    const postHoursSnapshot = await getInterpreterHours(interpreters, policy.fairnessWindowDays);

    // Log assignment
    await logAssignment({
      bookingId: booking.bookingId,
      interpreterEmpCode: topCandidate.empCode,
      status: "assigned",
      reason: `Assigned to ${topCandidate.empCode} (score: ${topCandidate.scores.total.toFixed(3)})`,
      preHoursSnapshot,
      postHoursSnapshot,
      scoreBreakdown: topCandidate.scores,
      maxGapHours: policy.maxGapHours,
      fairnessWindowDays: policy.fairnessWindowDays,
      mode: policy.mode
    });

    console.log(`✅ Successfully assigned booking ${booking.bookingId} to ${topCandidate.empCode}`);
    console.log(`📊 Final scores: Fairness=${topCandidate.scores.fairness.toFixed(3)}, Urgency=${topCandidate.scores.urgency.toFixed(3)}, LRS=${topCandidate.scores.lrs.toFixed(3)}, Total=${topCandidate.scores.total.toFixed(3)}`);

    return {
      status: "assigned",
      interpreterId: topCandidate.empCode,
      breakdown: rankedResults,
      note: `Assigned using ${policy.mode} mode`
    };

  } catch (error) {
    console.error(`❌ Error updating booking ${booking.bookingId}:`, error);
    return {
      status: "escalated",
      reason: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Log assignment decision
 */
async function logAssignment(logData: AssignmentLogData): Promise<void> {
  try {
    await prisma.assignmentLog.create({
      data: {
        bookingId: logData.bookingId,
        interpreterEmpCode: logData.interpreterEmpCode,
        status: logData.status,
        reason: logData.reason,
        preHoursSnapshot: logData.preHoursSnapshot as Prisma.InputJsonValue,
        postHoursSnapshot: logData.postHoursSnapshot as Prisma.InputJsonValue,
        scoreBreakdown: logData.scoreBreakdown as unknown as Prisma.InputJsonValue,
        maxGapHours: logData.maxGapHours,
        fairnessWindowDays: logData.fairnessWindowDays
      }
    });
  } catch (error) {
    console.error("❌ Error logging assignment:", error);
  }
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
