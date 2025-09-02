import { NextRequest, NextResponse } from "next/server";
import { getAutoApprovalEngine } from "@/lib/assignment/auto-approval";
import type { AssignmentPolicy } from "@/types/assignment";

/**
 * POST /api/admin/auto-approval/switch-mode
 * Trigger automatic mode switch based on current load assessment
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Triggering automatic mode switch...");

    const body = await request.json();
    const { targetMode, force } = body;

    const autoApprovalEngine = getAutoApprovalEngine();

    let modeToSwitch: AssignmentPolicy['mode'];

    if (targetMode) {
      // Validate target mode
      const validModes: AssignmentPolicy['mode'][] = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
      if (!validModes.includes(targetMode)) {
        return NextResponse.json({
          success: false,
          error: `Invalid target mode: ${targetMode}. Valid modes: ${validModes.join(', ')}`,
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      modeToSwitch = targetMode;
    } else {
      // Determine optimal mode based on current load
      modeToSwitch = await autoApprovalEngine.determineOptimalMode();
    }

    // Execute the switch
    const switchResult = await autoApprovalEngine.executeAutoSwitch(modeToSwitch);

    return NextResponse.json({
      success: switchResult.success,
      message: switchResult.success ? 
        `Mode switch completed: ${switchResult.oldMode} → ${switchResult.newMode}` :
        `Mode switch failed: ${switchResult.reason}`,
      data: {
        switchResult,
        loadAssessment: switchResult.loadAssessment,
        modeTransition: switchResult.modeTransition
      },
      timestamp: new Date().toISOString()
    }, { status: switchResult.success ? 200 : 400 });

  } catch (error) {
    console.error("❌ Error executing automatic mode switch:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}