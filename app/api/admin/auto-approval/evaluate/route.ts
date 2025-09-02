import { NextRequest, NextResponse } from "next/server";
import { getAutoApprovalEngine } from "@/lib/assignment/auto-approval";

/**
 * POST /api/admin/auto-approval/evaluate
 * Manually trigger system load evaluation
 */
export async function POST(request: NextRequest) {
  try {
    console.log("📊 Manually triggering system load evaluation...");

    const autoApprovalEngine = getAutoApprovalEngine();
    const loadAssessment = await autoApprovalEngine.evaluateSystemLoad();

    return NextResponse.json({
      success: true,
      message: "System load evaluation completed",
      data: {
        loadAssessment,
        recommendedAction: loadAssessment.recommendedMode !== (await import("@/lib/assignment/policy")).loadPolicy().then(p => p.mode) ?
          `Consider switching to ${loadAssessment.recommendedMode} mode` :
          `Current mode is optimal`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error evaluating system load:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}