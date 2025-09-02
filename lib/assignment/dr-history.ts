import prisma from "@/prisma/prisma";
import type { DRAssignmentHistory, ConsecutiveDRAssignmentHistory, LastGlobalDRAssignment, DRPolicy } from "@/types/assignment";

/**
 * Get the most recent DR assignment globally before a given time
 * Returns information about the last DR assignment to determine consecutive assignments
 */
export async function getLastGlobalDRAssignment(
  before: Date,
  opts?: {
    drType?: string;
    includePending?: boolean;
    fairnessWindowDays?: number;
  }
): Promise<LastGlobalDRAssignment> {
  try {
    // Calculate fairness window start if provided
    let timeConstraint: { lt: Date; gte?: Date } = { lt: before };
    if (opts?.fairnessWindowDays) {
      const windowStart = new Date(before);
      windowStart.setDate(windowStart.getDate() - opts.fairnessWindowDays);
      timeConstraint = {
        lt: before,
        gte: windowStart
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      meetingType: "DR",
      timeStart: timeConstraint,
      ...(opts?.drType && { drType: opts.drType }),
      ...(opts?.includePending
        ? { bookingStatus: { in: ["approve", "waiting"] } }
        : { bookingStatus: "approve" }
      )
    };

    const lastDR = await prisma.bookingPlan.findFirst({
      where: whereClause,
      select: {
        bookingId: true,
        timeStart: true,
        drType: true,
        interpreterEmpCode: true
      },
      orderBy: {
        timeStart: 'desc'
      }
    });

    if (!lastDR) {
      return {
        interpreterEmpCode: null
      };
    }

    return {
      interpreterEmpCode: lastDR.interpreterEmpCode,
      bookingId: lastDR.bookingId,
      timeStart: lastDR.timeStart,
      drType: lastDR.drType || undefined
    };
  } catch (error) {
    console.error(`Error getting last global DR assignment before ${before}:`, error);
    return {
      interpreterEmpCode: null
    };
  }
}

/**
 * Check DR assignment history for an interpreter using consecutive-aware logic
 * Returns information about consecutive DR assignments and whether penalties should be applied
 */
export async function checkDRAssignmentHistory(
  interpreterId: string,
  fairnessWindowDays: number,
  params?: {
    bookingTimeStart?: Date;
    drType?: string;
    lastGlobalDR?: LastGlobalDRAssignment;
    includePendingInGlobal?: boolean;
    drPolicy?: DRPolicy;
  }
): Promise<ConsecutiveDRAssignmentHistory> {
  try {
    // If we have the new consecutive-aware parameters, use the new logic
    if (params?.bookingTimeStart && params?.drPolicy) {
      return await checkConsecutiveDRAssignmentHistory(interpreterId, {
        bookingTimeStart: params.bookingTimeStart,
        drType: params.drType,
        lastGlobalDR: params.lastGlobalDR,
        includePendingInGlobal: params.includePendingInGlobal,
        drPolicy: params.drPolicy,
        fairnessWindowDays
      });
    }

    // Fallback to original logic for backward compatibility
    return await checkLegacyDRAssignmentHistory(interpreterId, fairnessWindowDays);
  } catch (error) {
    console.error(`Error checking DR history for ${interpreterId}:`, error);
    // Return safe default - no history means no penalty
    return {
      interpreterId,
      consecutiveDRCount: 0,
      lastDRAssignments: [],
      isBlocked: false,
      penaltyApplied: false,
      isConsecutiveGlobal: false
    };
  }
}

/**
 * New consecutive-aware DR assignment history check
 */
async function checkConsecutiveDRAssignmentHistory(
  interpreterId: string,
  params: {
    bookingTimeStart: Date;
    drType?: string;
    lastGlobalDR?: LastGlobalDRAssignment;
    includePendingInGlobal?: boolean;
    drPolicy: DRPolicy;
    fairnessWindowDays: number;
  }
): Promise<ConsecutiveDRAssignmentHistory> {
  const { bookingTimeStart, drType, lastGlobalDR, drPolicy, fairnessWindowDays } = params;

  // Determine if this interpreter is consecutive to the last global DR
  const isConsecutiveGlobal = lastGlobalDR?.interpreterEmpCode === interpreterId;

  // Get recent DR assignments for this interpreter within the fairness window
  const cutoffDate = new Date(bookingTimeStart);
  cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

  const drAssignments = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      meetingType: "DR",
      timeStart: {
        gte: cutoffDate,
        lt: bookingTimeStart // Only look at assignments before this booking
      },
      bookingStatus: "approve"
    },
    select: {
      bookingId: true,
      timeStart: true,
      drType: true
    },
    orderBy: {
      timeStart: 'desc'
    },
    take: 10 // Get enough for analysis within the window
  });

  // Apply DR policy rules to determine blocking and penalties
  const { applyDRPolicyRules, canOverrideDRPolicy } = await import('./policy');
  const policyResult = applyDRPolicyRules(isConsecutiveGlobal, drPolicy, {
    isCriticalCoverage: false, // Will be set by calling function if needed
    noAlternativesAvailable: false, // Will be set by calling function if needed
    systemLoad: 'MEDIUM' // Default system load
  });
  const overrideCheck = canOverrideDRPolicy(drPolicy);

  const isBlocked = policyResult.isBlocked;
  const penaltyApplied = policyResult.penaltyApplied;

  return {
    interpreterId,
    consecutiveDRCount: isConsecutiveGlobal ? 1 : 0,
    lastDRAssignments: drAssignments.map(assignment => ({
      bookingId: assignment.bookingId,
      timeStart: assignment.timeStart,
      drType: assignment.drType || "Unknown"
    })),
    isBlocked,
    penaltyApplied,
    isConsecutiveGlobal,
    lastGlobalDR,
    policyResult: {
      isBlocked: policyResult.isBlocked,
      penaltyApplied: policyResult.penaltyApplied,
      penaltyAmount: policyResult.penaltyAmount,
      overrideApplied: policyResult.overrideApplied,
      reason: policyResult.reason,
      policyDescription: (drPolicy as any).description || "Standard DR policy",
      canOverride: overrideCheck.canOverride
    }
  };
}

/**
 * Legacy DR assignment history check (for backward compatibility)
 */
async function checkLegacyDRAssignmentHistory(
  interpreterId: string,
  fairnessWindowDays: number
): Promise<ConsecutiveDRAssignmentHistory> {
  // Get the two most recent DR assignments for this interpreter within the fairness window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

  //find DR assignments history for this interpreter within the fairness window
  const drAssignments = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      meetingType: "DR",
      timeStart: {
        gte: cutoffDate
      },
      bookingStatus: "approve" // Only count completed/approved assignments
    },
    select: {
      bookingId: true,
      timeStart: true,
      drType: true
    },
    orderBy: {
      timeStart: 'desc'
    },
    take: 2
  });

  const consecutiveDRCount = drAssignments.length;
  const isBlocked = consecutiveDRCount >= 2; // Block if 2 or more consecutive DR assignments
  const penaltyApplied = consecutiveDRCount === 1; // Apply penalty if 1 consecutive DR assignment

  return {
    interpreterId,
    consecutiveDRCount,
    lastDRAssignments: drAssignments.map(assignment => ({
      bookingId: assignment.bookingId,
      timeStart: assignment.timeStart,
      drType: assignment.drType || "Unknown"
    })),
    isBlocked,
    penaltyApplied,
    isConsecutiveGlobal: false // Legacy logic doesn't use global consecutive check
  };
}

/**
 * Check if a booking is a DR meeting
 */
export function isDRMeeting(meetingType: string): boolean {
  return meetingType === "DR";
}

/**
 * Apply DR consecutive assignment penalty to a score
 */
export function applyDRPenalty(
  baseScore: number,
  penalty: number,
  penaltyApplied: boolean
): number {
  if (!penaltyApplied) {
    return baseScore;
  }

  return Math.max(0, baseScore + penalty); // Ensure score doesn't go below 0
}

/**
 * Adjust fairness calculations for dynamic interpreter pools
 * Handles new interpreters and removed interpreters to maintain fair assignment distribution
 */
export async function adjustForDynamicPool(
  interpreterPool: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<{
  newInterpreters: string[];
  adjustmentFactor: number;
  poolChangeDetected: boolean;
}> {
  try {
    // Calculate the start of the fairness window
    const windowStart = new Date(referenceDate);
    windowStart.setDate(windowStart.getDate() - fairnessWindowDays);

    // Find interpreters who have had assignments within the fairness window
    const interpretersWithHistory = await prisma.bookingPlan.findMany({
      where: {
        interpreterEmpCode: { in: interpreterPool },
        timeStart: {
          gte: windowStart,
          lt: referenceDate
        },
        bookingStatus: "approve"
      },
      select: {
        interpreterEmpCode: true
      },
      distinct: ['interpreterEmpCode']
    });

    const interpretersWithHistorySet = new Set(
      interpretersWithHistory.map(b => b.interpreterEmpCode).filter(Boolean)
    );

    // Identify new interpreters (in current pool but no history in window)
    const newInterpreters = interpreterPool.filter(
      interpreterId => !interpretersWithHistorySet.has(interpreterId)
    );

    // Calculate adjustment factor based on pool composition
    const totalInterpreters = interpreterPool.length;
    const newInterpreterCount = newInterpreters.length;
    const poolChangeDetected = newInterpreterCount > 0;

    // Adjustment factor: reduces bias against new interpreters
    // Higher factor when more new interpreters are present
    const adjustmentFactor = poolChangeDetected
      ? Math.min(1.5, 1 + (newInterpreterCount / totalInterpreters) * 0.5)
      : 1.0;

    console.log(`🔄 Dynamic pool analysis: ${newInterpreterCount} new interpreters out of ${totalInterpreters} total (adjustment factor: ${adjustmentFactor.toFixed(2)})`);

    return {
      newInterpreters,
      adjustmentFactor,
      poolChangeDetected
    };

  } catch (error) {
    console.error("Error adjusting for dynamic pool:", error);
    return {
      newInterpreters: [],
      adjustmentFactor: 1.0,
      poolChangeDetected: false
    };
  }
}

/**
 * Get fairness-adjusted DR history that accounts for dynamic interpreter pools
 */
export async function getFairnessAdjustedDRHistory(
  interpreterId: string,
  fairnessWindowDays: number,
  interpreterPool: string[],
  referenceDate: Date = new Date()
): Promise<{
  drHistory: ConsecutiveDRAssignmentHistory;
  isNewInterpreter: boolean;
  adjustmentApplied: boolean;
}> {
  try {
    // Get dynamic pool adjustment information
    const poolAdjustment = await adjustForDynamicPool(
      interpreterPool,
      fairnessWindowDays,
      referenceDate
    );

    const isNewInterpreter = poolAdjustment.newInterpreters.includes(interpreterId);

    // Get standard DR history
    const drHistory = await checkLegacyDRAssignmentHistory(interpreterId, fairnessWindowDays);

    // Apply adjustment for new interpreters
    let adjustmentApplied = false;
    if (isNewInterpreter && poolAdjustment.poolChangeDetected) {
      // Reduce penalties for new interpreters to prevent bias
      drHistory.penaltyApplied = false;
      drHistory.isBlocked = false;
      adjustmentApplied = true;

      console.log(`🆕 Applied new interpreter adjustment for ${interpreterId}`);
    }

    return {
      drHistory,
      isNewInterpreter,
      adjustmentApplied
    };

  } catch (error) {
    console.error(`Error getting fairness-adjusted DR history for ${interpreterId}:`, error);

    // Return safe defaults
    const defaultHistory: ConsecutiveDRAssignmentHistory = {
      interpreterId,
      consecutiveDRCount: 0,
      lastDRAssignments: [],
      isBlocked: false,
      penaltyApplied: false,
      isConsecutiveGlobal: false
    };

    return {
      drHistory: defaultHistory,
      isNewInterpreter: false,
      adjustmentApplied: false
    };
  }
}

/**
 * Check DR assignment with override options for critical coverage
 */
export async function checkDRAssignmentWithOverride(
  interpreterId: string,
  fairnessWindowDays: number,
  params: {
    bookingTimeStart: Date;
    drType?: string;
    lastGlobalDR?: LastGlobalDRAssignment;
    includePendingInGlobal?: boolean;
    drPolicy: DRPolicy;
    isCriticalCoverage?: boolean;
    noAlternativesAvailable?: boolean;
  }
): Promise<ConsecutiveDRAssignmentHistory> {
  const baseResult = await checkConsecutiveDRAssignmentHistory(interpreterId, {
    ...params,
    fairnessWindowDays
  });

  // If not blocked, return as-is
  if (!baseResult.isBlocked) {
    return baseResult;
  }

  // Check if override should be applied with enhanced policy logic
  const { applyDRPolicyRules } = await import('./policy');
  const overrideResult = applyDRPolicyRules(
    baseResult.isConsecutiveGlobal,
    params.drPolicy,
    {
      isCriticalCoverage: params.isCriticalCoverage,
      noAlternativesAvailable: params.noAlternativesAvailable,
      systemLoad: 'MEDIUM', // Could be passed as parameter in future
      interpreterPoolSize: 0 // Could be calculated from available interpreters
    }
  );

  // Update result with override information
  return {
    ...baseResult,
    isBlocked: overrideResult.isBlocked,
    penaltyApplied: overrideResult.penaltyApplied,
    policyResult: {
      ...baseResult.policyResult!,
      isBlocked: overrideResult.isBlocked,
      penaltyApplied: overrideResult.penaltyApplied,
      penaltyAmount: overrideResult.penaltyAmount,
      overrideApplied: overrideResult.overrideApplied,
      reason: overrideResult.reason
    }
  };
}

/**
 * Get default DR policy configuration
 */
export function getDefaultDRPolicy(): DRPolicy {
  return {
    scope: "GLOBAL",
    forbidConsecutive: false,
    consecutivePenalty: -0.7,
    includePendingInGlobal: false
  };
}
