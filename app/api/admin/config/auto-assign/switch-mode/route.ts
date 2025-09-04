import { NextRequest, NextResponse } from "next/server";
import { modeTransitionManager } from "@/lib/assignment/config/mode-transition";
import { loadPolicy } from "@/lib/assignment/config/policy";
import type { AssignmentPolicy } from "@/types/assignment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newMode, validateOnly = false } = body;

    // Validate the new mode
    const validModes: AssignmentPolicy['mode'][] = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
    if (!newMode || !validModes.includes(newMode)) {
      return NextResponse.json({
        success: false,
        error: "Invalid mode specified",
        details: `Mode must be one of: ${validModes.join(', ')}`,
        validModes
      }, { status: 400 });
    }

    // Get current mode for comparison
    const currentPolicy = await loadPolicy();
    const currentMode = currentPolicy.mode;

    // If validate-only mode, just return validation without switching
    if (validateOnly) {
      if (currentMode === newMode) {
        return NextResponse.json({
          success: true,
          message: `Mode is already set to ${newMode}`,
          validation: {
            isValid: true,
            warnings: [],
            errors: []
          },
          currentMode,
          requestedMode: newMode,
          timestamp: new Date().toISOString()
        });
      }

      // Perform validation without actually switching
      const validation = await validateModeSwitch(newMode);
      
      return NextResponse.json({
        success: true,
        message: "Mode switch validation completed",
        validation,
        currentMode,
        requestedMode: newMode,
        impact: await getModeTransitionImpact(currentMode, newMode),
        timestamp: new Date().toISOString()
      });
    }

    // Perform the actual mode switch
    console.log(`🔄 Starting mode switch: ${currentMode} → ${newMode}`);
    
    const result = await modeTransitionManager.switchMode(newMode);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully switched from ${result.oldMode} to ${result.newMode} mode`,
        data: {
          oldMode: result.oldMode,
          newMode: result.newMode,
          pooledBookingsAffected: result.pooledBookingsAffected,
          immediateAssignments: result.immediateAssignments,
          poolTransition: result.poolTransition,
          transitionTime: result.transitionTime,
          userFeedback: result.userFeedback
        },
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: "Mode switch failed",
        details: result.errors.map(e => e.error).join(', '),
        data: {
          oldMode: result.oldMode,
          requestedMode: result.newMode,
          errors: result.errors,
          transitionTime: result.transitionTime,
          userFeedback: result.userFeedback
        },
        recovery: {
          suggestion: "Mode was not changed. Current settings are preserved.",
          action: "Review the error details and try again."
        },
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in mode switch API:", error);
    
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };

    // Try to provide current configuration as fallback
    try {
      const currentPolicy = await loadPolicy();
      
      return NextResponse.json({
        success: false,
        error: "Failed to switch mode",
        details: errorDetails,
        fallbackData: {
          currentMode: currentPolicy.mode,
          policy: currentPolicy
        },
        recovery: {
          suggestion: "Mode was not changed. Current settings are preserved.",
          action: "Check system logs and try again."
        }
      }, { status: 500 });
    } catch (fallbackError) {
      return NextResponse.json({
        success: false,
        error: "Critical system error during mode switch",
        details: errorDetails,
        recovery: {
          suggestion: "System may be in an inconsistent state. Contact administrator.",
          action: "Check system logs and database connectivity."
        }
      }, { status: 500 });
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeImpact = searchParams.get('includeImpact') === 'true';
    const targetMode = searchParams.get('targetMode') as AssignmentPolicy['mode'];

    const currentPolicy = await loadPolicy();
    const currentMode = currentPolicy.mode;

    const response: any = {
      success: true,
      data: {
        currentMode,
        availableModes: ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'],
        modeDescriptions: {
          BALANCE: 'Optimizes fairness through batch processing and delayed assignment',
          URGENT: 'Prioritizes immediate assignment with minimal fairness constraints',
          NORMAL: 'Balanced approach with moderate penalties and flexible processing',
          CUSTOM: 'Fully configurable policy for specific organizational needs'
        }
      },
      timestamp: new Date().toISOString()
    };

    // Include impact assessment if requested
    if (includeImpact && targetMode && targetMode !== currentMode) {
      const impact = await getModeTransitionImpact(currentMode, targetMode);
      response.impact = impact;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting mode switch info:", error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to get mode switch information",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * Validate mode switch without performing it
 */
async function validateModeSwitch(newMode: AssignmentPolicy['mode']): Promise<{
  isValid: boolean;
  warnings: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate mode is supported
  const validModes: AssignmentPolicy['mode'][] = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
  if (!validModes.includes(newMode)) {
    errors.push(`Invalid mode: ${newMode}. Supported modes: ${validModes.join(', ')}`);
  }

  // Check system state
  try {
    const { bookingPool } = await import('@/lib/assignment/pool/pool');
    const poolStats = await bookingPool.getPoolStats();
    
    if (poolStats.currentlyProcessing > 0) {
      warnings.push(`${poolStats.currentlyProcessing} bookings are currently being processed. Mode switch will handle them gracefully.`);
    }

    if (poolStats.failedEntries > 0) {
      warnings.push(`${poolStats.failedEntries} failed pool entries detected. Consider resolving these before mode switch.`);
    }

    // Mode-specific validations
    if (newMode === 'URGENT' && poolStats.totalInPool > 50) {
      warnings.push(`Large pool size (${poolStats.totalInPool}) may cause system load when switching to Urgent mode.`);
    }

    if (newMode === 'BALANCE' && poolStats.totalInPool < 5) {
      warnings.push(`Small pool size (${poolStats.totalInPool}) may not benefit from Balance mode optimization.`);
    }

  } catch (error) {
    warnings.push(`Could not validate pool state: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get impact assessment for mode transition
 */
async function getModeTransitionImpact(
  currentMode: AssignmentPolicy['mode'],
  targetMode: AssignmentPolicy['mode']
): Promise<{
  poolImpact: {
    totalBookings: number;
    expectedImmediateAssignments: number;
    expectedDeadlineUpdates: number;
    expectedStatusChanges: number;
  };
  systemImpact: {
    processingLoad: 'LOW' | 'MEDIUM' | 'HIGH';
    fairnessImpact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    urgencyImpact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  };
  recommendations: string[];
  warnings: string[];
}> {
  const recommendations: string[] = [];
  const warnings: string[] = [];

  try {
    const { bookingPool } = await import('@/lib/assignment/pool/pool');
    const poolStats = await bookingPool.getPoolStats();

    // Estimate impact based on mode transition
    let expectedImmediateAssignments = 0;
    let expectedDeadlineUpdates = 0;
    let expectedStatusChanges = 0;
    let processingLoad: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let fairnessImpact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let urgencyImpact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';

    switch (targetMode) {
      case 'URGENT':
        expectedImmediateAssignments = Math.floor(poolStats.totalInPool * 0.7); // Estimate 70% immediate
        expectedDeadlineUpdates = poolStats.totalInPool - expectedImmediateAssignments;
        processingLoad = poolStats.totalInPool > 20 ? 'HIGH' : 'MEDIUM';
        fairnessImpact = 'NEGATIVE';
        urgencyImpact = 'POSITIVE';
        
        recommendations.push('Monitor system load as Urgent mode processes bookings immediately');
        if (poolStats.totalInPool > 30) {
          warnings.push(`Large pool size may cause high system load during transition`);
        }
        break;

      case 'BALANCE':
        expectedImmediateAssignments = Math.floor(poolStats.readyForProcessing * 0.3); // Only urgent ones
        expectedDeadlineUpdates = poolStats.totalInPool - expectedImmediateAssignments;
        expectedStatusChanges = poolStats.totalInPool;
        processingLoad = 'LOW';
        fairnessImpact = 'POSITIVE';
        urgencyImpact = 'NEGATIVE';
        
        recommendations.push('Balance mode will optimize fairness through batch processing');
        if (poolStats.totalInPool < 10) {
          warnings.push(`Small pool size may not benefit significantly from Balance mode`);
        }
        break;

      case 'NORMAL':
        expectedImmediateAssignments = Math.floor(poolStats.readyForProcessing * 0.5);
        expectedDeadlineUpdates = Math.floor(poolStats.totalInPool * 0.4);
        processingLoad = 'MEDIUM';
        fairnessImpact = 'NEUTRAL';
        urgencyImpact = 'NEUTRAL';
        
        recommendations.push('Normal mode provides balanced assignment processing');
        break;

      case 'CUSTOM':
        expectedDeadlineUpdates = Math.floor(poolStats.totalInPool * 0.3);
        processingLoad = 'MEDIUM';
        
        recommendations.push('Custom mode uses your configured parameters - monitor results and adjust as needed');
        break;
    }

    return {
      poolImpact: {
        totalBookings: poolStats.totalInPool,
        expectedImmediateAssignments,
        expectedDeadlineUpdates,
        expectedStatusChanges
      },
      systemImpact: {
        processingLoad,
        fairnessImpact,
        urgencyImpact
      },
      recommendations,
      warnings
    };

  } catch (error) {
    warnings.push(`Could not assess impact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      poolImpact: {
        totalBookings: 0,
        expectedImmediateAssignments: 0,
        expectedDeadlineUpdates: 0,
        expectedStatusChanges: 0
      },
      systemImpact: {
        processingLoad: 'LOW',
        fairnessImpact: 'NEUTRAL',
        urgencyImpact: 'NEUTRAL'
      },
      recommendations,
      warnings
    };
  }
}