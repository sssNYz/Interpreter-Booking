import { NextRequest, NextResponse } from "next/server";
import { 
  startPoolScheduler, 
  stopPoolScheduler, 
  getPoolScheduler,
  initializePoolScheduler 
} from "@/lib/assignment/pool-scheduler";

/**
 * POST /api/admin/pool/scheduler - Control pool processing scheduler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, intervalMs } = body;

    switch (action) {
      case 'start':
        const scheduler = startPoolScheduler(intervalMs);
        return NextResponse.json({
          success: true,
          message: "Pool scheduler started",
          data: {
            isRunning: true,
            intervalMs: scheduler.getStatus().processingIntervalMs
          }
        });

      case 'stop':
        stopPoolScheduler();
        return NextResponse.json({
          success: true,
          message: "Pool scheduler stopped",
          data: {
            isRunning: false
          }
        });

      case 'restart':
        stopPoolScheduler();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const restartedScheduler = startPoolScheduler(intervalMs);
        return NextResponse.json({
          success: true,
          message: "Pool scheduler restarted",
          data: {
            isRunning: true,
            intervalMs: restartedScheduler.getStatus().processingIntervalMs
          }
        });

      case 'initialize':
        await initializePoolScheduler();
        return NextResponse.json({
          success: true,
          message: "Pool scheduler initialized based on current policy",
          data: {
            isRunning: true
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action. Use 'start', 'stop', 'restart', or 'initialize'"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("❌ Error controlling pool scheduler:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to control pool scheduler"
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/pool/scheduler - Get scheduler status
 */
export async function GET(request: NextRequest) {
  try {
    const scheduler = getPoolScheduler();
    
    if (!scheduler) {
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          message: "Scheduler not initialized"
        }
      });
    }

    const status = scheduler.getStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        processingIntervalMs: status.processingIntervalMs,
        processingIntervalMinutes: Math.round(status.processingIntervalMs / 60000),
        lastProcessingTime: status.lastProcessingTime,
        nextProcessingTime: status.nextProcessingTime,
        timeUntilNextProcessing: status.nextProcessingTime ? 
          Math.max(0, status.nextProcessingTime.getTime() - Date.now()) : null,
        recentErrors: status.recentErrors,
        poolStatus: status.poolStatus,
        processingNeeded: scheduler.isProcessingNeeded()
      }
    });

  } catch (error) {
    console.error("❌ Error getting scheduler status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to get scheduler status"
    }, { status: 500 });
  }
}