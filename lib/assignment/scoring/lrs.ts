import prisma from "@/prisma/prisma";

/**
 * Compute LRS (Least Recently Served) score for an interpreter
 * Higher score = longer since last assignment
 */
export async function computeLRSScore(
  interpreterEmpCode: string,
  fairnessWindowDays: number
): Promise<number> {
  try {
    // Find the most recent assignment for this interpreter
    const lastAssignment = await prisma.assignmentLog.findFirst({
      where: {
        interpreterEmpCode,
        status: "assigned"
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (!lastAssignment) {
      // If never assigned, maximum LRS score
      return 1.0;
    }

    const now = new Date();
    const timeDiff = now.getTime() - lastAssignment.createdAt.getTime();
    const daysSinceLast = timeDiff / (1000 * 60 * 60 * 24);
    
    // Normalize to 0..1 range
    const score = daysSinceLast / fairnessWindowDays;
    return Math.max(0, Math.min(1, score)); // clamp to 0..1
  } catch (error) {
    console.error(`Error computing LRS score for ${interpreterEmpCode}:`, error);
    return 0.0; // fallback to no preference
  }
}

/**
 * Get days since last assignment for an interpreter
 */
export async function getDaysSinceLastAssignment(interpreterEmpCode: string): Promise<number> {
  try {
    const lastAssignment = await prisma.assignmentLog.findFirst({
      where: {
        interpreterEmpCode,
        status: "assigned"
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (!lastAssignment) {
      return Infinity; // never assigned
    }

    const now = new Date();
    const timeDiff = now.getTime() - lastAssignment.createdAt.getTime();
    return timeDiff / (1000 * 60 * 60 * 24);
  } catch (error) {
    console.error(`Error getting days since last assignment for ${interpreterEmpCode}:`, error);
    return 0;
  }
}

/**
 * Get LRS scores for multiple interpreters
 */
export async function getLRSScores(
  interpreterEmpCodes: string[],
  fairnessWindowDays: number
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};
  
  for (const empCode of interpreterEmpCodes) {
    scores[empCode] = await computeLRSScore(empCode, fairnessWindowDays);
  }
  
  return scores;
}
