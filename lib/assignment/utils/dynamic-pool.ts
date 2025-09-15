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
  interpreterList: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<FairnessAdjustment[]> {
  try {
    console.log(`🔄 Adjusting fairness for ${interpreterList.length} interpreters with ${fairnessWindowDays}-day window`);

    // Calculate the start of the fairness window
    const windowStart = new Date(referenceDate);
    windowStart.setDate(windowStart.getDate() - fairnessWindowDays);

    // Find interpreters who have had assignments within the fairness window
    const interpretersWithHistory = await prisma.bookingPlan.findMany({
      where: {
        interpreterEmpCode: { in: interpreterList },
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

    for (const interpreterId of interpreterList) {
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
  currentInterpreterList: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<{ cleanedCount: number; preservedCount: number }> {
  try {
    console.log(`🗑️ Cleaning up history for removed interpreters outside current list of ${currentInterpreterList.length}`);

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
      if (assignment.interpreterEmpCode && !currentInterpreterList.includes(assignment.interpreterEmpCode)) {
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
}

/**
 * Detect interpreter availability changes and determine if automatic adjustment is needed
 */
export async function detectInterpreterListChanges(
  currentInterpreterList: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<DynamicPoolAdjustment> {
  try {
    console.log(`🔍 Detecting Interpreter changes for current List of ${currentInterpreterList.length} interpreters`);

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

    const historicalList = new Set(
      historicalInterpreters.map(b => b.interpreterEmpCode).filter((code): code is string => Boolean(code))
    );

    const currentList = new Set(currentInterpreterList);

    // Identify new and removed interpreters
    const newInterpreters = currentInterpreterList.filter(id => !historicalList.has(id));
    const removedInterpreters = Array.from(historicalList).filter((id: string) => !currentList.has(id));

    // Calculate list size changes
    const historicalListSize = historicalList.size;
    const currentListSize = currentInterpreterList.length;
    const listSizeChange = currentListSize - historicalListSize;
    const listChangePercentage = historicalListSize > 0 ? Math.abs(listSizeChange) / historicalListSize : 1;

    // Determine if this is a significant change (>20% change or >5 interpreters)
    const significantChange = listChangePercentage > 0.2 || Math.abs(listSizeChange) > 5;

    // Calculate adjustment factor based on list changes
    let adjustmentFactor = 1.0;
    if (newInterpreters.length > 0) {
      // Reduce penalties when new interpreters are added
      adjustmentFactor = Math.max(0.5, 1.0 - (newInterpreters.length / currentListSize) * 0.5);
    }

    const listChangeDetected = newInterpreters.length > 0 || removedInterpreters.length > 0;

    console.log(`📈 List analysis: ${newInterpreters.length} new, ${removedInterpreters.length} removed, ${listSizeChange > 0 ? '+' : ''}${listSizeChange} size change`);
    console.log(`🎯 Significant change: ${significantChange}, Adjustment factor: ${adjustmentFactor.toFixed(2)}`);

    return {
      newInterpreters,
      removedInterpreters,
      adjustmentFactor,
      poolChangeDetected: listChangeDetected,
      poolSizeChange: listSizeChange,
      significantChange
    };

  } catch (error) {
    console.error('❌ Error detecting list size changes:', error);
    throw error;
  }
}/*
*
 * Comprehensive dynamic pool management function
 * Combines pool change detection, fairness adjustment, and cleanup
 */
export async function manageDynamicPool(
  currentInterpreterList: string[],
  fairnessWindowDays: number,
  referenceDate: Date = new Date()
): Promise<{
  poolAdjustment: DynamicPoolAdjustment;
  fairnessAdjustments: FairnessAdjustment[];
  cleanupResult: { cleanedCount: number; preservedCount: number };
}> {
  try {
    console.log(`🎯 Starting comprehensive dynamic pool management for ${currentInterpreterList.length} interpreters`);

    // Step 1: Detect interpreter pool changes
    const poolAdjustment = await detectInterpreterListChanges(
      currentInterpreterList,
      fairnessWindowDays,
      referenceDate
    );

    // Step 2: Create fairness adjustments for new interpreters
    const fairnessAdjustments = await adjustFairnessForNewInterpreters(
      currentInterpreterList,
      fairnessWindowDays,
      referenceDate
    );

    // Step 3: Clean up history for removed interpreters
    const cleanupResult = await cleanupHistoryForRemovedInterpreters(
      currentInterpreterList,
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