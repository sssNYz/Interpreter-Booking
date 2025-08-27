import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import { loadPolicy } from "./policy";
import { 
  getRollingHours, 
  applyHardGapFilter, 
  snapshotHours, 
  projectPostHours 
} from "./fairness";
import { computeUrgencyScore } from "./urgency";
import { getDaysSinceLastAssignment } from "./lrs";
import { createCandidateResults } from "./scoring";
import type { RunResult, AssignmentLogData, HoursSnapshot } from "@/types/assignment";

/**
 * Main orchestrator for auto-assignment
 */
export async function run(bookingId: number): Promise<RunResult> {
  try {
    // 1. Load policy configuration
    const cfg = await loadPolicy();
    if (!cfg.autoAssignEnabled) {
      return { 
        status: "escalated", 
        reason: "auto-assign disabled" 
      };
    }

    // 2. Load booking details
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: {
        timeStart: true,
        timeEnd: true,
        interpreterEmpCode: true,
        bookingStatus: true
      }
    });

    if (!booking) {
      return { 
        status: "escalated", 
        reason: "booking not found" 
      };
    }

    // Check if already assigned
    if (booking.interpreterEmpCode) {
      return { 
        status: "assigned", 
        interpreterId: booking.interpreterEmpCode,
        note: "already assigned" 
      };
    }

    // 3. Get active interpreters
    const interpreters = await prisma.employee.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            roleCode: "INTERPRETER"
          }
        }
      },
      select: {
        empCode: true
      }
    });

    if (interpreters.length === 0) {
      return { 
        status: "escalated", 
        reason: "no active interpreters found" 
      };
    }

    // 4. Calculate booking duration
    const startTime = new Date(booking.timeStart);
    const endTime = new Date(booking.timeEnd);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // 5. Get rolling hours and apply hard filter
    const hours = await getRollingHours(cfg.fairnessWindowDays);
    const interpreterIds = interpreters.map(i => i.empCode);
    const eligible = applyHardGapFilter(
      interpreterIds,
      hours,
      durationHours,
      cfg.maxGapHours
    );

    // 6. Create pre-snapshot for logging
    const preSnapshot = snapshotHours(hours, interpreterIds);

    if (eligible.length === 0) {
      // No eligible candidates - escalate
      const logData: AssignmentLogData = {
        bookingId,
        status: "escalated",
        reason: "no eligible under maxGapHours",
        preHoursSnapshot: preSnapshot,
        maxGapHours: cfg.maxGapHours,
        fairnessWindowDays: cfg.fairnessWindowDays
      };

      await logAssignment(logData);
      return { 
        status: "escalated", 
        reason: "no eligible under maxGapHours" 
      };
    }

    // 7. Compute urgency score
    const urgencyScore = computeUrgencyScore(startTime, cfg.minAdvanceDays);

    // 8. Create candidate results with full breakdown
    const allCandidates = interpreterIds.map(id => ({
      empCode: id,
      currentHours: hours[id] || 0
    }));

    const breakdown = await createCandidateResults(
      allCandidates,
      eligible,
      hours,
      urgencyScore,
      cfg,
      cfg.fairnessWindowDays,
      cfg.maxGapHours
    );

    // 9. Select winner (highest scoring eligible candidate)
    const eligibleCandidates = breakdown.filter(c => c.eligible);
    if (eligibleCandidates.length === 0) {
      return { 
        status: "escalated", 
        reason: "no eligible candidates found" 
      };
    }
    
    // Sort by total score (highest first)
    eligibleCandidates.sort((a, b) => b.scores.total - a.scores.total);
    const winner = eligibleCandidates[0];
    
    console.log(`🏆 Winner selected: ${winner.empCode} with score ${winner.scores.total.toFixed(3)}`);

    // 10. Transaction: assign interpreter and log
    return await prisma.$transaction(async (tx) => {
      // Re-check booking is still unassigned
      const fresh = await tx.bookingPlan.findUnique({
        where: { bookingId },
        select: { interpreterEmpCode: true }
      });

      if (fresh?.interpreterEmpCode) {
        return { 
          status: "assigned", 
          interpreterId: fresh.interpreterEmpCode, 
          note: "already assigned" 
        };
      }

      // Assign interpreter and update status to approve
      // Business Rule: When interpreterEmpCode is assigned, bookingStatus must be "approve"
      await tx.bookingPlan.update({
        where: { bookingId },
        data: { 
          interpreterEmpCode: winner.empCode,
          bookingStatus: "approve"
        }
      });

      // Create post-snapshot
      const postSnapshot = projectPostHours(preSnapshot, winner.empCode, durationHours);

      // Log assignment
      const logData: AssignmentLogData = {
        bookingId,
        interpreterEmpCode: winner.empCode,
        status: "assigned",
        preHoursSnapshot: preSnapshot,
        postHoursSnapshot: postSnapshot,
        scoreBreakdown: winner.scores,
        maxGapHours: cfg.maxGapHours,
        fairnessWindowDays: cfg.fairnessWindowDays
      };

      await logAssignment(logData, tx);

      return { 
        status: "assigned", 
        interpreterId: winner.empCode, 
        breakdown 
      };
    });

  } catch (error) {
    console.error("Error in auto-assignment:", error);
    return { 
      status: "escalated", 
      reason: `error: ${error instanceof Error ? error.message : 'unknown error'}` 
    };
  }
}

/**
 * Log assignment decision
 */
async function logAssignment(
  logData: AssignmentLogData, 
  tx?: Prisma.TransactionClient
): Promise<void> {
  const prismaClient = tx || prisma;
  
  try {
    await prismaClient.assignmentLog.create({
      data: {
        bookingId: logData.bookingId,
        interpreterEmpCode: logData.interpreterEmpCode,
        status: logData.status,
        reason: logData.reason,
        preHoursSnapshot: logData.preHoursSnapshot,
        postHoursSnapshot: logData.postHoursSnapshot,
        scoreBreakdown: logData.scoreBreakdown as unknown as Prisma.InputJsonValue,
        maxGapHours: logData.maxGapHours,
        fairnessWindowDays: logData.fairnessWindowDays
      }
    });
  } catch (error) {
    console.error("Error logging assignment:", error);
    // Don't fail assignment if logging fails
  }
}
