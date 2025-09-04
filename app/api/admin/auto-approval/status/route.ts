import { NextRequest, NextResponse } from "next/server";
import { getAutoApprovalEngine } from "@/lib/assignment/config/auto-approval";

/**
 * GET /api/admin/auto-approval/status
 * Get current auto-approval status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📊 Getting auto-approval status...");

    const autoApprovalEngine = getAutoApprovalEngine();
    const status = await autoApprovalEngine.getAutoApprovalStatus();

    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting auto-approval status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}