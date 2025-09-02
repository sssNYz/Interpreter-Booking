import { NextRequest, NextResponse } from "next/server";
import { initializeAssignmentSystem, checkAssignmentSystemHealth } from "@/lib/assignment/startup";

/**
 * POST /api/system/startup - Initialize assignment system
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🚀 System startup initialization requested");
    
    await initializeAssignmentSystem();
    
    // Check system health after initialization
    const health = await checkAssignmentSystemHealth();
    
    return NextResponse.json({
      success: true,
      message: "Assignment system initialized successfully",
      data: {
        health: health.overall,
        components: health.components,
        details: health.details
      }
    });

  } catch (error) {
    console.error("❌ Error during system startup:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to initialize assignment system"
    }, { status: 500 });
  }
}

/**
 * GET /api/system/startup - Get system health status
 */
export async function GET(request: NextRequest) {
  try {
    const health = await checkAssignmentSystemHealth();
    
    return NextResponse.json({
      success: true,
      data: {
        health: health.overall,
        components: health.components,
        details: health.details,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Error checking system health:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to check system health"
    }, { status: 500 });
  }
}