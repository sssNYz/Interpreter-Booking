import { NextRequest, NextResponse } from "next/server";
import { 
  getDailyPoolProcessor, 
  processDailyPoolNow, 
  getDailyProcessingStatistics,
  initializeDailyPoolProcessor,
  stopDailyPoolProcessor
} from "@/lib/assignment/daily-pool-processor";
import { getServerStatus, initializeServer } from "@/lib/assignment/server-startup";

/**
 * GET /api/admin/pool/daily-processor
 * Get daily pool processor status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const processor = getDailyPoolProcessor();
    const statistics = await getDailyProcessingStatistics();
    const serverStatus = await getServerStatus();

    return NextResponse.json({
      success: true,
      data: {
        processor: processor ? {
          status: processor.getStatus(),
          isRunning: processor.getStatus().isRunning,
          lastProcessingTime: processor.getStatus().lastProcessingTime,
          nextProcessingTime: processor.getStatus().nextProcessingTime,
          recentErrors: processor.getStatus().recentErrors
        } : null,
        statistics,
        serverStatus: {
          initialized: serverStatus.initialized,
          health: serverStatus.health,
          uptime: serverStatus.uptime
        }
      }
    });

  } catch (error) {
    console.error("❌ Error getting daily processor status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/pool/daily-processor
 * Control daily pool processor (start, stop, process now)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'initialize':
        console.log("🚀 Initializing daily pool processor via API...");
        await initializeDailyPoolProcessor();
        
        return NextResponse.json({
          success: true,
          message: "Daily pool processor initialized successfully",
          data: {
            status: getDailyPoolProcessor()?.getStatus() || null
          }
        });

      case 'start':
        console.log("▶️ Starting daily pool processor via API...");
        const processor = getDailyPoolProcessor();
        
        if (!processor) {
          // Initialize if not already done
          await initializeDailyPoolProcessor();
          return NextResponse.json({
            success: true,
            message: "Daily pool processor initialized and started",
            data: {
              status: getDailyPoolProcessor()?.getStatus() || null
            }
          });
        } else {
          processor.start();
          return NextResponse.json({
            success: true,
            message: "Daily pool processor started",
            data: {
              status: processor.getStatus()
            }
          });
        }

      case 'stop':
        console.log("⏹️ Stopping daily pool processor via API...");
        stopDailyPoolProcessor();
        
        return NextResponse.json({
          success: true,
          message: "Daily pool processor stopped",
          data: null
        });

      case 'process_now':
        console.log("⚡ Triggering immediate daily pool processing via API...");
        const result = await processDailyPoolNow();
        
        return NextResponse.json({
          success: true,
          message: "Daily pool processing completed",
          data: {
            result,
            statistics: await getDailyProcessingStatistics()
          }
        });

      case 'server_initialize':
        console.log("🚀 Initializing entire server via API...");
        await initializeServer();
        
        const serverStatus = await getServerStatus();
        return NextResponse.json({
          success: true,
          message: "Server initialization completed",
          data: {
            serverStatus
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: initialize, start, stop, process_now, server_initialize`,
          data: null
        }, { status: 400 });
    }

  } catch (error) {
    console.error(`❌ Error executing daily processor action:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/pool/daily-processor
 * Update daily processor configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { processingIntervalHours } = body;

    if (typeof processingIntervalHours !== 'number' || processingIntervalHours <= 0) {
      return NextResponse.json({
        success: false,
        error: "processingIntervalHours must be a positive number",
        data: null
      }, { status: 400 });
    }

    const processor = getDailyPoolProcessor();
    
    if (!processor) {
      return NextResponse.json({
        success: false,
        error: "Daily pool processor not initialized",
        data: null
      }, { status: 404 });
    }

    const intervalMs = processingIntervalHours * 60 * 60 * 1000;
    processor.setProcessingInterval(intervalMs);

    return NextResponse.json({
      success: true,
      message: `Processing interval updated to ${processingIntervalHours} hours (restart required)`,
      data: {
        processingIntervalHours,
        processingIntervalMs: intervalMs,
        status: processor.getStatus()
      }
    });

  } catch (error) {
    console.error("❌ Error updating daily processor configuration:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null
    }, { status: 500 });
  }
}