import { NextRequest, NextResponse } from "next/server";
import { getPoolProcessingEngine } from "@/lib/assignment/pool-engine";
import { getPoolErrorRecoveryManager } from "@/lib/assignment/pool-error-recovery";
import { getDailyPoolProcessor } from "@/lib/assignment/daily-pool-processor";
import { bookingPool } from "@/lib/assignment/pool";

/**
 * GET /api/admin/pool/status
 * Get comprehensive pool processing status with error recovery information
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📊 Getting comprehensive pool status...");

    // Get basic pool statistics
    const poolStats = await bookingPool.getPoolStats();
    
    // Get processing engine status
    const engine = getPoolProcessingEngine();
    const processingStatus = await engine.getProcessingStatus();
    
    // Get entries needing processing
    const entriesStatus = await engine.getEntriesNeedingProcessing();
    
    // Get error recovery status
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const errorRecoveryStatus = await errorRecoveryManager.getPoolProcessingStatus();
    
    // Get daily processor status
    const dailyProcessor = getDailyPoolProcessor();
    const dailyProcessorStatus = dailyProcessor?.getStatus() || null;
    
    // Perform health check
    const healthCheck = await errorRecoveryManager.performHealthCheck();

    const response = {
      timestamp: new Date().toISOString(),
      poolStats: {
        totalInPool: poolStats.totalInPool,
        readyForProcessing: poolStats.readyForProcessing,
        currentlyProcessing: poolStats.currentlyProcessing,
        failedEntries: poolStats.failedEntries,
        oldestEntry: poolStats.oldestEntry?.toISOString() || null
      },
      processingStatus: {
        isRunning: processingStatus.isRunning,
        lastProcessingTime: processingStatus.lastProcessingTime?.toISOString() || null,
        nextProcessingTime: processingStatus.nextProcessingTime?.toISOString() || null,
        poolSize: processingStatus.poolSize,
        readyForProcessing: processingStatus.readyForProcessing,
        deadlineEntries: processingStatus.deadlineEntries,
        failedEntries: processingStatus.failedEntries
      },
      entriesBreakdown: {
        deadline: entriesStatus.deadline.length,
        ready: entriesStatus.ready.length,
        pending: entriesStatus.pending.length,
        failed: entriesStatus.failed.length,
        corrupted: entriesStatus.corrupted.length,
        urgencySummary: entriesStatus.summary,
        errorRecovery: entriesStatus.errorRecovery
      },
      errorRecovery: {
        healthStatus: errorRecoveryStatus.healthStatus,
        recentErrors: errorRecoveryStatus.recentErrors,
        configuration: errorRecoveryStatus.errorRecovery
      },
      dailyProcessor: dailyProcessorStatus ? {
        isRunning: dailyProcessorStatus.isRunning,
        processingIntervalMs: dailyProcessorStatus.processingIntervalMs,
        lastProcessingTime: dailyProcessorStatus.lastProcessingTime?.toISOString() || null,
        nextProcessingTime: dailyProcessorStatus.nextProcessingTime?.toISOString() || null,
        recentErrorCount: dailyProcessorStatus.recentErrors.length
      } : null,
      healthCheck: {
        isHealthy: healthCheck.isHealthy,
        issues: healthCheck.issues,
        warnings: healthCheck.warnings,
        checkTime: healthCheck.checkTime,
        timestamp: healthCheck.timestamp.toISOString()
      },
      recommendations: generateRecommendations(
        poolStats,
        entriesStatus,
        errorRecoveryStatus,
        healthCheck
      )
    };

    console.log(`✅ Pool status retrieved: ${poolStats.totalInPool} total, ${poolStats.readyForProcessing} ready, ${poolStats.failedEntries} failed`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting pool status:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get pool status",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations based on pool status
 */
function generateRecommendations(
  poolStats: any,
  entriesStatus: any,
  errorRecoveryStatus: any,
  healthCheck: any
): string[] {
  const recommendations: string[] = [];

  // Pool size recommendations
  if (poolStats.totalInPool > 50) {
    recommendations.push("Large pool size detected. Consider increasing processing frequency or switching to Urgent mode.");
  }

  // Failed entries recommendations
  if (poolStats.failedEntries > poolStats.totalInPool * 0.1) {
    recommendations.push("High failure rate detected. Check error recovery configuration and system health.");
  }

  // Deadline entries recommendations
  if (entriesStatus.deadline > 0) {
    recommendations.push(`${entriesStatus.deadline} entries are past deadline. Consider emergency processing.`);
  }

  // Corrupted entries recommendations
  if (entriesStatus.corrupted > 0) {
    recommendations.push(`${entriesStatus.corrupted} corrupted entries detected. Run corruption cleanup.`);
  }

  // Health check recommendations
  if (!healthCheck.isHealthy) {
    recommendations.push("System health check failed. Review issues and warnings for corrective actions.");
  }

  // Error recovery recommendations
  if (errorRecoveryStatus.recentErrors.stuckProcessing > 0) {
    recommendations.push("Stuck processing entries detected. Consider restarting pool processing or emergency override.");
  }

  if (errorRecoveryStatus.recentErrors.highRetryAttempts > 5) {
    recommendations.push("High retry attempts detected. Review error patterns and consider adjusting retry configuration.");
  }

  // Urgency recommendations
  if (entriesStatus.urgencySummary.critical > 0) {
    recommendations.push(`${entriesStatus.urgencySummary.critical} critical urgency entries. Immediate processing recommended.`);
  }

  // Default recommendation if no issues
  if (recommendations.length === 0) {
    recommendations.push("Pool processing is operating normally. No immediate action required.");
  }

  return recommendations;
}