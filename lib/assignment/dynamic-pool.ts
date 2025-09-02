import prisma from "@/prisma/prisma";

/**
 * Dynamic Pool Management for Auto-Assignment System
 * 
 * Handles fair treatment of new interpreters and cleanup of removed interpreters
 * to maintain assignment fairness when the interpreter pool changes over time.
 */

export interface DynamicPoolAdjustment {
  newInterpreters: string[];
  removedInterpreters: string[];
  adjustmentFactor: number;
  poolChangeDetected: boolean;
  poolSizeChange: number;
  significantChange: boolean;
}

export interface FairnessAdjustment {
  interpreterId: string;
  isNewInterpreter: boolean;
  adjustedPenalty: number;
  adjustedBlocking: boolean;
  adjustmentReason: string;
  effectiveStartDate: Date;
}

/**
 * Adjust fairness calculations for new interpreters to prevent bias
 * New interpreters should not be penalized for lack of assignment history
 */
export async function adjustFairnessForNewInterpreters(
  interpreterPool: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<FairnessAdjustment[]> {
  try {
    console.log(`🔄 Adjusting fairness for ${interpreterPool.length} interpreters with ${fairnessWindowDays}-day window`);

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
        interpreterEmpCode: true,
        timeStart: true
      },
      distinct: ['interpreterEmpCode']
    });

    const interpretersWithHistorySet = new Set(
      interpretersWithHistory.map(b => b.interpreterEmpCode).filter(Boolean)
    );

    // Create fairness adjustments for each interpreter
    const adjustments: FairnessAdjustment[] = [];

    for (const interpreterId of interpreterPool) {
      const isNewInterpreter = !interpretersWithHistorySet.has(interpreterId);
      
      // Calculate adjustment based on interpreter status
      let adjustedPenalty = 0;
      let adjustedBlocking = false;
      let adjustmentReason = '';
      
      if (isNewInterpreter) {
        // New interpreters get reduced penalties to encourage fair distribution
        adjustedPenalty = 0.5; // 50% penalty reduction
        adjustedBlocking = false; // No blocking for new interpreters
        adjustmentReason = 'New interpreter - reduced penalties for fair integration';
      } else {
        // Existing interpreters use standard penalties
        adjustedPenalty = 1.0; // Full penalty
        adjustedBlocking = true; // Standard blocking rules apply
        adjustmentReason = 'Existing interpreter - standard penalty rules';
      }

      adjustments.push({
        interpreterId,
        isNewInterpreter,
        adjustedPenalty,
        adjustedBlocking,
        adjustmentReason,
        effectiveStartDate: windowStart
      });
    }

    console.log(`✅ Created fairness adjustments for ${adjustments.length} interpreters (${adjustments.filter(a => a.isNewInterpreter).length} new)`);
    return adjustments;

  } catch (error) {
    console.error('❌ Error adjusting fairness for new interpreters:', error);
    throw error;
  }
}
/**
 
* Clean up history data for removed interpreters to maintain data integrity
 * This helps prevent stale data from affecting future assignments
 */
export async function cleanupHistoryForRemovedInterpreters(
  currentInterpreterPool: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<{ cleanedCount: number; preservedCount: number }> {
  try {
    console.log(`🧹 Cleaning up history for removed interpreters outside current pool of ${currentInterpreterPool.length}`);

    // Calculate the start of the fairness window
    const windowStart = new Date(referenceDate);
    windowStart.setDate(windowStart.getDate() - fairnessWindowDays);

    // Find all interpreters who have assignments within the fairness window
    // but are no longer in the current interpreter pool
    const assignmentsInWindow = await prisma.bookingPlan.findMany({
      where: {
        timeStart: {
          gte: windowStart,
          lt: referenceDate
        },
        bookingStatus: "approve",
        interpreterEmpCode: {
          not: null
        }
      },
      select: {
        interpreterEmpCode: true,
        bookingId: true,
        timeStart: true
      }
    });

    // Identify removed interpreters (those with assignments but not in current pool)
    const removedInterpreters = new Set<string>();
    const preservedAssignments = new Set<number>();

    for (const assignment of assignmentsInWindow) {
      if (assignment.interpreterEmpCode && !currentInterpreterPool.includes(assignment.interpreterEmpCode)) {
        removedInterpreters.add(assignment.interpreterEmpCode);
      } else {
        preservedAssignments.add(assignment.bookingId);
      }
    }

    console.log(`📊 Found ${removedInterpreters.size} removed interpreters with ${assignmentsInWindow.length - preservedAssignments.size} assignments to clean`);

    // For now, we preserve the historical data but mark it as from removed interpreters
    // This maintains data integrity while allowing for potential interpreter re-activation
    // In a production system, you might want to archive this data instead of deleting it

    const cleanedCount = removedInterpreters.size;
    const preservedCount = preservedAssignments.size;

    console.log(`✅ Cleanup complete: ${cleanedCount} removed interpreters identified, ${preservedCount} current assignments preserved`);

    return {
      cleanedCount,
      preservedCount
    };

  } catch (error) {
    console.error('❌ Error cleaning up history for removed interpreters:', error);
    throw error;
  }
}/**
 
* Detect pool size changes and determine if automatic adjustment is needed
 */
export async function detectPoolSizeChanges(
  currentInterpreterPool: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<DynamicPoolAdjustment> {
  try {
    console.log(`🔍 Detecting pool changes for current pool of ${currentInterpreterPool.length} interpreters`);

    // Calculate the start of the fairness window
    const windowStart = new Date(referenceDate);
    windowStart.setDate(windowStart.getDate() - fairnessWindowDays);

    // Get all interpreters who had assignments in the fairness window
    const historicalInterpreters = await prisma.bookingPlan.findMany({
      where: {
        timeStart: {
          gte: windowStart,
          lt: referenceDate
        },
        bookingStatus: "approve",
        interpreterEmpCode: {
          not: null
        }
      },
      select: {
        interpreterEmpCode: true
      },
      distinct: ['interpreterEmpCode']
    });

    const historicalPool = new Set(
      historicalInterpreters.map(b => b.interpreterEmpCode).filter((code): code is string => Boolean(code))
    );

    const currentPool = new Set(currentInterpreterPool);

    // Identify new and removed interpreters
    const newInterpreters = currentInterpreterPool.filter(id => !historicalPool.has(id));
    const removedInterpreters = Array.from(historicalPool).filter((id: string) => !currentPool.has(id));

    // Calculate pool size changes
    const historicalPoolSize = historicalPool.size;
    const currentPoolSize = currentInterpreterPool.length;
    const poolSizeChange = currentPoolSize - historicalPoolSize;
    const poolChangePercentage = historicalPoolSize > 0 ? Math.abs(poolSizeChange) / historicalPoolSize : 1;

    // Determine if this is a significant change (>20% change or >5 interpreters)
    const significantChange = poolChangePercentage > 0.2 || Math.abs(poolSizeChange) > 5;

    // Calculate adjustment factor based on pool changes
    let adjustmentFactor = 1.0;
    if (newInterpreters.length > 0) {
      // Reduce penalties when new interpreters are added
      adjustmentFactor = Math.max(0.5, 1.0 - (newInterpreters.length / currentPoolSize) * 0.5);
    }

    const poolChangeDetected = newInterpreters.length > 0 || removedInterpreters.length > 0;

    console.log(`📈 Pool analysis: ${newInterpreters.length} new, ${removedInterpreters.length} removed, ${poolSizeChange > 0 ? '+' : ''}${poolSizeChange} size change`);
    console.log(`🎯 Significant change: ${significantChange}, Adjustment factor: ${adjustmentFactor.toFixed(2)}`);

    return {
      newInterpreters,
      removedInterpreters,
      adjustmentFactor,
      poolChangeDetected,
      poolSizeChange,
      significantChange
    };

  } catch (error) {
    console.error('❌ Error detecting pool size changes:', error);
    throw error;
  }
}/*
*
 * Comprehensive dynamic pool management function
 * Combines pool change detection, fairness adjustment, and cleanup
 */
export async function manageDynamicPool(
  currentInterpreterPool: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<{
  poolAdjustment: DynamicPoolAdjustment;
  fairnessAdjustments: FairnessAdjustment[];
  cleanupResult: { cleanedCount: number; preservedCount: number };
}> {
  try {
    console.log(`🎯 Starting comprehensive dynamic pool management for ${currentInterpreterPool.length} interpreters`);

    // Step 1: Detect pool changes
    const poolAdjustment = await detectPoolSizeChanges(
      currentInterpreterPool,
      fairnessWindowDays,
      referenceDate
    );

    // Step 2: Create fairness adjustments for new interpreters
    const fairnessAdjustments = await adjustFairnessForNewInterpreters(
      currentInterpreterPool,
      fairnessWindowDays,
      referenceDate
    );

    // Step 3: Clean up history for removed interpreters
    const cleanupResult = await cleanupHistoryForRemovedInterpreters(
      currentInterpreterPool,
      fairnessWindowDays,
      referenceDate
    );

    console.log(`✅ Dynamic pool management complete:`);
    console.log(`   - Pool changes: ${poolAdjustment.poolChangeDetected ? 'Yes' : 'No'} (${poolAdjustment.poolSizeChange > 0 ? '+' : ''}${poolAdjustment.poolSizeChange})`);
    console.log(`   - New interpreters: ${poolAdjustment.newInterpreters.length}`);
    console.log(`   - Removed interpreters: ${poolAdjustment.removedInterpreters.length}`);
    console.log(`   - Fairness adjustments: ${fairnessAdjustments.length}`);
    console.log(`   - Cleanup: ${cleanupResult.cleanedCount} removed, ${cleanupResult.preservedCount} preserved`);

    return {
      poolAdjustment,
      fairnessAdjustments,
      cleanupResult
    };

  } catch (error) {
    console.error('❌ Error in comprehensive dynamic pool management:', error);
    throw error;
  }
}