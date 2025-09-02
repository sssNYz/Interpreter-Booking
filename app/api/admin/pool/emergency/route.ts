import { NextRequest, NextResponse } from "next/server";
import { getPoolProcessingEngine } from "@/lib/assignment/pool-engine";
import { getPoolStatus } from "@/lib/assignment/pool";

/**
 * POST /api/admin/pool/emergency - Emergency pool processing override
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🚨 Emergency pool processing triggered via API");
    
    // Get current pool status before processing
    const beforeStatus = getPoolStatus();
    
    if (beforeStatus.total === 0) {
      return NextResponse.json({
        success: true,
        message: "No entries in pool to process",
        data: {
          beforeProcessing: beforeStatus,
          afterProcessing: beforeStatus,
          processed: {
            entries: 0,
            assigned: 0,
            escalated: 0,
            failed: 0
          }
        }
      });
    }
    
    // Get processing engine and trigger emergency processing
    const engine = getPoolProcessingEngine();
    const results = await engine.processEmergencyOverride();
    
    // Get pool status after processing
    const afterStatus = getPoolStatus();
    
    // Analyze results
    const assigned = results.filter(r => r.status === 'assigned').length;
    const escalated = results.filter(r => r.status === 'escalated').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    // Group results by urgency level
    const urgencyBreakdown = {
      critical: results.filter(r => r.urgencyLevel === 'CRITICAL').length,
      high: results.filter(r => r.urgencyLevel === 'HIGH').length,
      medium: results.filter(r => r.urgencyLevel === 'MEDIUM').length,
      low: results.filter(r => r.urgencyLevel === 'LOW').length
    };
    
    // Get processing time statistics
    const processingTimes = results.map(r => r.processingTime);
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;
    
    return NextResponse.json({
      success: true,
      message: `Emergency processing completed: ${assigned} assigned, ${escalated} escalated, ${failed} failed`,
      data: {
        beforeProcessing: {
          total: beforeStatus.total,
          ready: beforeStatus.ready,
          pending: beforeStatus.pending,
          deadline: beforeStatus.deadline,
          byMode: beforeStatus.byMode
        },
        afterProcessing: {
          total: afterStatus.total,
          ready: afterStatus.ready,
          pending: afterStatus.pending,
          deadline: afterStatus.deadline,
          byMode: afterStatus.byMode
        },
        processed: {
          entries: results.length,
          assigned,
          escalated,
          failed
        },
        urgencyBreakdown,
        performance: {
          averageProcessingTimeMs: Math.round(avgProcessingTime),
          totalProcessingTimeMs: processingTimes.reduce((sum, time) => sum + time, 0)
        },
        results: results.map(r => ({
          bookingId: r.bookingId,
          status: r.status,
          interpreterId: r.interpreterId,
          reason: r.reason,
          urgencyLevel: r.urgencyLevel,
          processingTimeMs: r.processingTime
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error in emergency pool processing:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to perform emergency pool processing"
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/pool/emergency - Get emergency processing status and recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const engine = getPoolProcessingEngine();
    const entriesNeedingProcessing = engine.getEntriesNeedingProcessing();
    const poolStatus = getPoolStatus();
    
    // Determine if emergency processing is recommended
    const criticalCount = entriesNeedingProcessing.summary.critical;
    const highCount = entriesNeedingProcessing.summary.high;
    const totalUrgent = criticalCount + highCount;
    
    const emergencyRecommended = criticalCount > 0 || totalUrgent >= 3;
    
    let recommendation = '';
    if (criticalCount > 0) {
      recommendation = `${criticalCount} critical entries require immediate emergency processing`;
    } else if (totalUrgent >= 3) {
      recommendation = `${totalUrgent} high-priority entries suggest emergency processing`;
    } else if (entriesNeedingProcessing.deadline.length > 0) {
      recommendation = `${entriesNeedingProcessing.deadline.length} entries at deadline - consider emergency processing`;
    } else {
      recommendation = 'No emergency processing needed at this time';
    }
    
    return NextResponse.json({
      success: true,
      data: {
        emergencyRecommended,
        recommendation,
        poolStatus: {
          total: poolStatus.total,
          ready: poolStatus.ready,
          deadline: poolStatus.deadline,
          byMode: poolStatus.byMode
        },
        urgencyBreakdown: entriesNeedingProcessing.summary,
        entries: {
          deadline: entriesNeedingProcessing.deadline.map(entry => ({
            bookingId: entry.bookingId,
            meetingType: entry.meetingType,
            mode: entry.mode,
            deadlineTime: entry.deadlineTime,
            processingPriority: entry.processingPriority,
            hoursToDeadline: Math.round((entry.deadlineTime.getTime() - Date.now()) / (1000 * 60 * 60))
          })),
          ready: entriesNeedingProcessing.ready.map(entry => ({
            bookingId: entry.bookingId,
            meetingType: entry.meetingType,
            mode: entry.mode,
            thresholdDays: entry.thresholdDays,
            processingPriority: entry.processingPriority
          })),
          pending: entriesNeedingProcessing.pending.length
        }
      }
    });

  } catch (error) {
    console.error("❌ Error getting emergency processing status:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      message: "Failed to get emergency processing status"
    }, { status: 500 });
  }
}