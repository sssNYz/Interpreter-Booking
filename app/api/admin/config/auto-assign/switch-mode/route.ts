import { NextRequest, NextResponse } from "next/server";
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

    // Mode transition now only updates policy value without pool side effects
    console.log(`🔄 Updating mode: ${currentMode} → ${newMode}`);
    const { updatePolicy } = await import("@/lib/assignment/config/policy");
    await updatePolicy({ mode: newMode as AssignmentPolicy['mode'] });
    return NextResponse.json({
      success: true,
      message: `Mode set to ${newMode}`,
      data: { oldMode: currentMode, newMode },
      timestamp: new Date().toISOString()
    });

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

    const response: {
      success: boolean;
      data: {
        currentMode: string;
        availableModes: string[];
        modeDescriptions: Record<string, string>;
      };
      timestamp: string;
      impact?: {
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
      }; // This gets added later
    } = {
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
  // Pool removed: no pool-state validations

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

  // Pool removed: return neutral impact
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