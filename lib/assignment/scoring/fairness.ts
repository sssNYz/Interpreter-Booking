import prisma from "@/prisma/prisma";
import type { HoursSnapshot } from "@/types/assignment";

// Owner groups used across booking plans
const OWNER_GROUPS = ["iot", "hardware", "software", "other"] as const;
export type OwnerGroupKey = typeof OWNER_GROUPS[number];

/**
 * Get active interpreters with INTERPRETER role
 */
export async function getActiveInterpreters(): Promise<Array<{ empCode: string }>> {
  try {
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
    
    return interpreters;
  } catch (error) {
    console.error("Error getting active interpreters:", error);
    return [];
  }
}

/**
 * Get interpreter hours for the specified window
 */
export async function getInterpreterHours(
  interpreters: Array<{ empCode: string }>, 
  fairnessWindowDays: number
): Promise<HoursSnapshot> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

  try {
    // Query all completed and active bookings within the window
    const bookings = await prisma.bookingPlan.findMany({
      where: {
        AND: [
          { timeStart: { gte: cutoffDate } },
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

    // Calculate hours per interpreter - only for active interpreters
    const hoursMap: HoursSnapshot = {};
    const activeEmpCodes = interpreters.map(i => i.empCode);
    
    // Initialize all active interpreters with 0 hours
    for (const interpreter of interpreters) {
      hoursMap[interpreter.empCode] = 0;
    }
    
    for (const booking of bookings) {
      if (!booking.interpreterEmpCode) continue;
      
      // Only include hours for active interpreters
      if (!activeEmpCodes.includes(booking.interpreterEmpCode)) continue;
      
      const start = new Date(booking.timeStart);
      const end = new Date(booking.timeEnd);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      hoursMap[booking.interpreterEmpCode] = (hoursMap[booking.interpreterEmpCode] || 0) + durationHours;
    }

    return hoursMap;
  } catch (error) {
    console.error("Error getting interpreter hours:", error);
    return {};
  }
}

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
          { timeStart: { gte: cutoffDate } },
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
 * Get interpreter hours split by owner group within the specified window
 */
export async function getInterpreterGroupHours(
  interpreters: Array<{ empCode: string }>,
  fairnessWindowDays: number
): Promise<Record<string, Record<OwnerGroupKey, number>>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);

  try {
    const activeEmpCodes = new Set(interpreters.map((i) => i.empCode));

    // Initialize zero structure
    const base: Record<OwnerGroupKey, number> = {
      iot: 0,
      hardware: 0,
      software: 0,
      other: 0,
    };
    const result: Record<string, Record<OwnerGroupKey, number>> = {};
    for (const { empCode } of interpreters) {
      result[empCode] = { ...base };
    }

    const bookings = await prisma.bookingPlan.findMany({
      where: {
        AND: [
          { timeStart: { gte: cutoffDate } },
          { bookingStatus: { not: "cancel" } },
          { interpreterEmpCode: { not: null } },
        ],
      },
      select: {
        interpreterEmpCode: true,
        ownerGroup: true,
        timeStart: true,
        timeEnd: true,
      },
    });

    for (const b of bookings) {
      const emp = b.interpreterEmpCode as string | null;
      if (!emp || !activeEmpCodes.has(emp)) continue;
      const og = String(b.ownerGroup || "other").toLowerCase() as OwnerGroupKey;
      const start = new Date(b.timeStart);
      const end = new Date(b.timeEnd);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      (result[emp] ||= { ...base });
      result[emp][og] = Math.max(0, (result[emp][og] || 0) + durationHours);
    }

    // Round to 0.1h for stability
    for (const emp of Object.keys(result)) {
      for (const k of OWNER_GROUPS) {
        result[emp][k] = Math.round((result[emp][k] || 0) * 10) / 10;
      }
    }

    return result;
  } catch (error) {
    console.error("Error getting interpreter group hours:", error);
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
