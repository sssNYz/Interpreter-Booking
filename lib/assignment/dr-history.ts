import prisma from "@/prisma/prisma";
import type { DRAssignmentHistory } from "@/types/assignment";

/**
 * Check DR assignment history for an interpreter
 * Returns information about consecutive DR assignments and whether penalties should be applied
 */
export async function checkDRAssignmentHistory(
  interpreterId: string,
  fairnessWindowDays: number
): Promise<DRAssignmentHistory> {
  try {
    // Get the two most recent DR assignments for this interpreter within the fairness window
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

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
      penaltyApplied
    };
  } catch (error) {
    console.error(`Error checking DR history for ${interpreterId}:`, error);
    // Return safe default - no history means no penalty
    return {
      interpreterId,
      consecutiveDRCount: 0,
      lastDRAssignments: [],
      isBlocked: false,
      penaltyApplied: false
    };
  }
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
