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
    includePending?: boolean 
  }
): Promise<LastGlobalDRAssignment> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      meetingType: "DR",
      timeStart: {
        lt: before
      },
      ...(opts?.drType && { drType: opts.drType }),
      ...(opts?.includePending 
        ? { bookingStatus: { in: ["approve", "pending"] } }
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
        drPolicy: params.drPolicy
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
  }
): Promise<ConsecutiveDRAssignmentHistory> {
  const { bookingTimeStart, drType, lastGlobalDR, drPolicy } = params;

  // Determine if this interpreter is consecutive to the last global DR
  const isConsecutiveGlobal = lastGlobalDR?.interpreterEmpCode === interpreterId;

  // Get recent DR assignments for this interpreter (for analytics/logging)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Use 30 days for analytics

  const drAssignments = await prisma.bookingPlan.findMany({
    where: {
      interpreterEmpCode: interpreterId,
      meetingType: "DR",
      timeStart: {
        gte: cutoffDate
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
    take: 5 // Get more for analytics
  });

  // Determine if blocked or penalized based on policy
  let isBlocked = false;
  let penaltyApplied = false;

  if (isConsecutiveGlobal) {
    if (drPolicy.forbidConsecutive) {
      isBlocked = true;
    } else {
      penaltyApplied = true;
    }
  }

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
    lastGlobalDR
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
