import { NextRequest, NextResponse } from "next/server";
import { processPoolNow, getPoolScheduler } from "@/lib/assignment/pool/pool-scheduler";
import { getPoolStatus } from "@/lib/assignment/pool/pool";

/**
 * POST /api/admin/pool/process - Manually trigger pool processing
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Manual pool processing triggered via API");
    
    // Get current pool status before processing
    const beforeStatus = getPoolStatus();
    
    // Trigger immediate pool processing
    await processPoolNow();
    
    // Get pool status after processing
    const afterStatus = getPoolStatus();
    
    // Get scheduler status
    const scheduler = getPoolScheduler();
    const schedulerStatus = scheduler?.getStatus() || null;
    
    return NextResponse.json({
      success: true,
      message: "Pool processing completed",
      data: {
        beforeProcessing: {
          total: beforeStatus.total,
          ready: beforeStatus.ready,
          pending: beforeStatus.pending,
          deadline: beforeStatus.deadline
        },
        afterProcessing: {
          total: afterStatus.total,
          ready: afterStatus.ready,
          pending: afterStatus.pending,
          deadline: afterStatus.deadline
        },
        processed: {
          entries: beforeStatus.ready,
          remaining: afterStatus.ready
        },
        scheduler: schedulerStatus ? {
          isRunning: schedulerStatus.isRunning,
          lastProcessingTime: schedulerStatus.lastProcessingTime,
          nextProcessingTime: schedulerStatus.nextProcessingTime,
          intervalMs: schedulerStatus.processingIntervalMs,
          recentErrors: schedulerStatus.recentErrors.length
        } : null
      }
    });

  } catch (error) {
    console.error("❌ Error in manual pool processing:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to process pool"
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/pool/process - Get pool processing status
 */
export async function GET(request: NextRequest) {
  try {
    const poolStatus = getPoolStatus();
    const scheduler = getPoolScheduler();
    const schedulerStatus = scheduler?.getStatus() || null;
    
    return NextResponse.json({
      success: true,
      data: {
        pool: {
          total: poolStatus.total,
          ready: poolStatus.ready,
          pending: poolStatus.pending,
          deadline: poolStatus.deadline,
          byMode: poolStatus.byMode,
          entries: poolStatus.entries.map(entry => ({
            bookingId: entry.bookingId,
            meetingType: entry.meetingType,
            mode: entry.mode,
            thresholdDays: entry.thresholdDays,
            deadlineTime: entry.deadlineTime,
            processingPriority: entry.processingPriority,
            poolEntryTime: entry.poolEntryTime,
            isReady: new Date() >= new Date(entry.poolEntryTime.getTime() + entry.thresholdDays * 24 * 60 * 60 * 1000) || new Date() >= entry.deadlineTime
          }))
        },
        scheduler: schedulerStatus ? {
          isRunning: schedulerStatus.isRunning,
          processingIntervalMs: schedulerStatus.processingIntervalMs,
          lastProcessingTime: schedulerStatus.lastProcessingTime,
          nextProcessingTime: schedulerStatus.nextProcessingTime,
          recentErrors: schedulerStatus.recentErrors,
          processingNeeded: scheduler.isProcessingNeeded()
        } : {
          isRunning: false,
          message: "Scheduler not initialized"
        }
      }
    });

  } catch (error) {
    console.error("❌ Error getting pool status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to get pool status"
    }, { status: 500 });
  }
}