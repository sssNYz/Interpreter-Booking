import { NextRequest, NextResponse } from "next/server";
import { getAutoApprovalEngine } from "@/lib/assignment/auto-approval";

/**
 * POST /api/admin/auto-approval/override
 * Enable or disable manual override
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, reason, expiresAt } = body;

    if (!action || !['enable', 'disable'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: "Action must be 'enable' or 'disable'",
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const autoApprovalEngine = getAutoApprovalEngine();

    if (action === 'enable') {
      if (!reason) {
        return NextResponse.json({
          success: false,
          error: "Reason is required when enabling manual override",
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      const expirationDate = expiresAt ? new Date(expiresAt) : undefined;
      await autoApprovalEngine.enableManualOverride(reason, expirationDate);

      console.log(`🔒 Manual override enabled: ${reason}`);

      return NextResponse.json({
        success: true,
        message: "Manual override enabled successfully",
        data: {
          action: 'enabled',
          reason,
          expiresAt: expirationDate?.toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } else {
      await autoApprovalEngine.disableManualOverride();

      console.log("🔓 Manual override disabled");

      return NextResponse.json({
        success: true,
        message: "Manual override disabled successfully",
        data: {
          action: 'disabled'
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("❌ Error managing manual override:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/auto-approval/override
 * Get current manual override status
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📋 Getting manual override status...");

    const autoApprovalEngine = getAutoApprovalEngine();
    const status = await autoApprovalEngine.getAutoApprovalStatus();

    return NextResponse.json({
      success: true,
      data: {
        manualOverride: status.manualOverride
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting manual override status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}