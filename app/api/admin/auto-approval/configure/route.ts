import { NextRequest, NextResponse } from "next/server";
import { getAutoApprovalEngine, type AutoApprovalConfig } from "@/lib/assignment/config/auto-approval";

/**
 * POST /api/admin/auto-approval/configure
 * Configure auto-approval settings
 */
export async function POST(request: NextRequest) {
  try {
    console.log("⚙️ Configuring auto-approval settings...");

    const body = await request.json();
    const config: Partial<AutoApprovalConfig> = body.config;

    if (!config) {
      return NextResponse.json({
        success: false,
        error: "Configuration is required",
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const autoApprovalEngine = getAutoApprovalEngine();
    await autoApprovalEngine.configureAutoApproval(config);

    // Get updated status
    const status = await autoApprovalEngine.getAutoApprovalStatus();

    return NextResponse.json({
      success: true,
      message: "Auto-approval configuration updated successfully",
      data: {
        configuration: status.configuration,
        enabled: status.enabled
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error configuring auto-approval:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/auto-approval/configure
 * Get current auto-approval configuration
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📋 Getting auto-approval configuration...");

    const autoApprovalEngine = getAutoApprovalEngine();
    const status = await autoApprovalEngine.getAutoApprovalStatus();

    return NextResponse.json({
      success: true,
      data: {
        configuration: status.configuration,
        enabled: status.enabled,
        manualOverride: status.manualOverride
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting auto-approval configuration:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}