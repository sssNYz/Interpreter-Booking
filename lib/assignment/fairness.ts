import prisma from "@/prisma/prisma";
import type { HoursSnapshot } from "@/types/assignment";

/**
 * Get rolling hours for all interpreters within the specified window
 */
export async function getRollingHours(fairnessWindowDays: number): Promise<HoursSnapshot> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

  try {
    // Query all completed and active bookings within the window
    const bookings = await prisma.bookingPlan.findMany({
      where: {
        AND: [
          { createdAt: { gte: cutoffDate } },
          { bookingStatus: { not: 'cancel' } },
          { interpreterEmpCode: { not: null } }
        ]
      },
      select: {
        interpreterEmpCode: true,
        timeStart: true,
        timeEnd: true,
      }
    });

    // Calculate hours per interpreter
    const hoursMap: HoursSnapshot = {};
    
    for (const booking of bookings) {
      if (!booking.interpreterEmpCode) continue;
      
      const start = new Date(booking.timeStart);
      const end = new Date(booking.timeEnd);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      hoursMap[booking.interpreterEmpCode] = (hoursMap[booking.interpreterEmpCode] || 0) + durationHours;
    }

    return hoursMap;
  } catch (error) {
    console.error("Error getting rolling hours:", error);
    return {};
  }
}

/**
 * Apply hard gap filter to candidates
 * Returns only interpreters that would not exceed maxGapHours after assignment
 */
export function applyHardGapFilter(
  candidates: string[],
  hoursMap: HoursSnapshot,
  durationHours: number,
  maxGapHours: number
): string[] {
  if (candidates.length === 0) return [];

  const eligible: string[] = [];
  
  for (const candidateId of candidates) {
    // Simulate assignment to this candidate
    const simulatedHours = { ...hoursMap };
    simulatedHours[candidateId] = (simulatedHours[candidateId] || 0) + durationHours;
    
    // Calculate gap after assignment
    const hours = Object.values(simulatedHours);
    if (hours.length === 0) continue;
    
    const minHours = Math.min(...hours);
    const maxHours = Math.max(...hours);
    const gap = maxHours - minHours;
    
    if (gap <= maxGapHours) {
      eligible.push(candidateId);
    }
  }
  
  return eligible;
}

/**
 * Compute fairness score for an interpreter
 * Higher score = more fair (fewer hours relative to others)
 */
export function computeFairnessScore(
  interpreterHours: number,
  minHours: number,
  maxGapHours: number
): number {
  // If all interpreters have same hours, perfect fairness
  if (interpreterHours === minHours) {
    return 1.0;
  }
  
  // Calculate how much this interpreter exceeds the minimum
  const gap = interpreterHours - minHours;
  
  // Higher score = fewer hours (more fair)
  // Score decreases as gap increases
  const score = Math.max(0, 1 - (gap / maxGapHours));
  
  return score;
}

/**
 * Get minimum hours from hours snapshot
 */
export function getMinHours(hoursMap: HoursSnapshot): number {
  const hours = Object.values(hoursMap);
  return hours.length > 0 ? Math.min(...hours) : 0;
}

/**
 * Create a snapshot of current hours for logging
 */
export function snapshotHours(hoursMap: HoursSnapshot, interpreterIds: string[]): HoursSnapshot {
  const snapshot: HoursSnapshot = {};
  for (const id of interpreterIds) {
    snapshot[id] = hoursMap[id] || 0;
  }
  return snapshot;
}

/**
 * Project post-assignment hours for logging
 */
export function projectPostHours(
  preSnapshot: HoursSnapshot,
  assignedInterpreterId: string,
  durationHours: number
): HoursSnapshot {
  const postSnapshot = { ...preSnapshot };
  postSnapshot[assignedInterpreterId] = (postSnapshot[assignedInterpreterId] || 0) + durationHours;
  return postSnapshot;
}
