import { NextRequest, NextResponse } from "next/server";
import { getPoolErrorRecoveryManager } from "@/lib/assignment/error-handling/pool-error-recovery";
import { bookingPool } from "@/lib/assignment/pool/pool";
import prisma from "@/prisma/prisma";
import { PoolStatus } from "@prisma/client";

/**
 * GET /api/admin/pool/health
 * Perform comprehensive health check of pool processing system
 */
export async function GET(request: NextRequest) {
  try {
    console.log("🏥 Performing pool health check...");

    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const healthCheck = await errorRecoveryManager.performHealthCheck();
    const poolStatus = await errorRecoveryManager.getPoolProcessingStatus();

    // Additional detailed health information
    const detailedHealth = await getDetailedHealthInfo();

    const response = {
      healthCheck: {
        isHealthy: healthCheck.isHealthy,
        issues: healthCheck.issues,
        warnings: healthCheck.warnings,
        checkTime: healthCheck.checkTime,
        timestamp: healthCheck.timestamp.toISOString()
      },
      poolStatus: {
        poolSize: poolStatus.poolSize,
        readyForProcessing: poolStatus.readyForProcessing,
        currentlyProcessing: poolStatus.currentlyProcessing,
        failedEntries: poolStatus.failedEntries,
        oldestEntry: poolStatus.oldestEntry?.toISOString() || null
      },
      errorRecovery: {
        healthStatus: poolStatus.healthStatus,
        recentErrors: poolStatus.recentErrors,
        configuration: poolStatus.errorRecovery
      },
      detailedHealth,
      recommendations: generateHealthRecommendations(healthCheck, poolStatus, detailedHealth),
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Health check completed: ${healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error during health check:", error);
    
    return NextResponse.json(
      { 
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool/health/repair
 * Perform automated repair operations for detected issues
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operations = [] } = body;

    console.log(`🔧 Starting pool health repair operations: ${operations.join(', ')}`);

    const results: RepairResult[] = [];
    const errorRecoveryManager = getPoolErrorRecoveryManager();

    // Perform requested repair operations
    for (const operation of operations) {
      const startTime = Date.now();
      
      try {
        switch (operation) {
          case 'cleanup_stuck_processing':
            const stuckResult = await cleanupStuckProcessing();
            results.push({
              operation,
              success: true,
              message: `Cleaned up ${stuckResult.count} stuck processing entries`,
              processingTime: Date.now() - startTime,
              details: stuckResult
            });
            break;

          case 'reset_excessive_retries':
            const retryResult = await resetExcessiveRetries();
            results.push({
              operation,
              success: true,
              message: `Reset ${retryResult.count} entries with excessive retries`,
              processingTime: Date.now() - startTime,
              details: retryResult
            });
            break;

          case 'cleanup_corrupted_entries':
            const corruptedResult = await cleanupCorruptedEntries(errorRecoveryManager);
            results.push({
              operation,
              success: true,
              message: `Processed ${corruptedResult.total} corrupted entries (${corruptedResult.recovered} recovered, ${corruptedResult.removed} removed)`,
              processingTime: Date.now() - startTime,
              details: corruptedResult
            });
            break;

          case 'retry_failed_entries':
            const failedResult = await retryFailedEntries();
            results.push({
              operation,
              success: true,
              message: `Reset ${failedResult.count} failed entries for retry`,
              processingTime: Date.now() - startTime,
              details: failedResult
            });
            break;

          case 'validate_pool_integrity':
            const integrityResult = await validatePoolIntegrity();
            results.push({
              operation,
              success: true,
              message: `Validated ${integrityResult.checked} entries (${integrityResult.issues} issues found)`,
              processingTime: Date.now() - startTime,
              details: integrityResult
            });
            break;

          default:
            results.push({
              operation,
              success: false,
              message: `Unknown repair operation: ${operation}`,
              processingTime: Date.now() - startTime
            });
        }
      } catch (error) {
        results.push({
          operation,
          success: false,
          message: `Repair operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Perform health check after repairs
    const postRepairHealth = await errorRecoveryManager.performHealthCheck();

    const response = {
      success: true,
      message: `Completed ${results.length} repair operations`,
      results,
      postRepairHealth: {
        isHealthy: postRepairHealth.isHealthy,
        issues: postRepairHealth.issues,
        warnings: postRepairHealth.warnings,
        timestamp: postRepairHealth.timestamp.toISOString()
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Pool repair completed: ${results.filter(r => r.success).length}/${results.length} operations successful`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error during pool repair:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Pool repair failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get detailed health information
 */
async function getDetailedHealthInfo(): Promise<DetailedHealthInfo> {
  try {
    // Database connectivity test
    const dbConnectivity = await testDatabaseConnectivity();
    
    // Pool table statistics
    const poolTableStats = await getPoolTableStatistics();
    
    // Processing performance metrics
    const performanceMetrics = await getProcessingPerformanceMetrics();
    
    return {
      databaseConnectivity: dbConnectivity,
      poolTableStats,
      performanceMetrics
    };
  } catch (error) {
    console.error("❌ Error getting detailed health info:", error);
    return {
      databaseConnectivity: { connected: false, responseTime: 0, error: error instanceof Error ? error.message : 'Unknown error' },
      poolTableStats: { totalEntries: 0, statusBreakdown: {}, oldestEntry: null, newestEntry: null },
      performanceMetrics: { averageProcessingTime: 0, successRate: 0, errorRate: 0 }
    };
  }
}

/**
 * Test database connectivity
 */
async function testDatabaseConnectivity(): Promise<DatabaseConnectivityTest> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get pool table statistics
 */
async function getPoolTableStatistics(): Promise<PoolTableStatistics> {
  const totalEntries = await prisma.bookingPlan.count({
    where: { poolStatus: { not: null } }
  });

  const statusBreakdown = await prisma.bookingPlan.groupBy({
    by: ['poolStatus'],
    where: { poolStatus: { not: null } },
    _count: true
  });

  const oldestEntry = await prisma.bookingPlan.findFirst({
    where: { poolStatus: { not: null } },
    orderBy: { poolEntryTime: 'asc' },
    select: { poolEntryTime: true }
  });

  const newestEntry = await prisma.bookingPlan.findFirst({
    where: { poolStatus: { not: null } },
    orderBy: { poolEntryTime: 'desc' },
    select: { poolEntryTime: true }
  });

  return {
    totalEntries,
    statusBreakdown: statusBreakdown.reduce((acc, item) => {
      if (item.poolStatus) {
        acc[item.poolStatus] = item._count;
      }
      return acc;
    }, {} as Record<string, number>),
    oldestEntry: oldestEntry?.poolEntryTime?.toISOString() || null,
    newestEntry: newestEntry?.poolEntryTime?.toISOString() || null
  };
}

/**
 * Get processing performance metrics
 */
async function getProcessingPerformanceMetrics(): Promise<ProcessingPerformanceMetrics> {
  // This would typically come from logs or metrics collection
  // For now, return basic estimates based on current pool state
  const poolStats = await bookingPool.getPoolStats();
  
  const totalEntries = poolStats.totalInPool;
  const failedEntries = poolStats.failedEntries;
  const successfulEntries = totalEntries - failedEntries;
  
  return {
    averageProcessingTime: 2000, // Estimated 2 seconds per entry
    successRate: totalEntries > 0 ? (successfulEntries / totalEntries) * 100 : 100,
    errorRate: totalEntries > 0 ? (failedEntries / totalEntries) * 100 : 0
  };
}

/**
 * Cleanup stuck processing entries
 */
async function cleanupStuckProcessing(): Promise<{ count: number; entries: number[] }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const stuckEntries = await prisma.bookingPlan.findMany({
    where: {
      poolStatus: PoolStatus.processing,
      poolEntryTime: { lt: oneHourAgo }
    },
    select: { bookingId: true }
  });

  const result = await prisma.bookingPlan.updateMany({
    where: {
      poolStatus: PoolStatus.processing,
      poolEntryTime: { lt: oneHourAgo }
    },
    data: {
      poolStatus: PoolStatus.waiting
    }
  });

  return {
    count: result.count,
    entries: stuckEntries.map(e => e.bookingId)
  };
}

/**
 * Reset entries with excessive retry attempts
 */
async function resetExcessiveRetries(): Promise<{ count: number; entries: number[] }> {
  const excessiveEntries = await prisma.bookingPlan.findMany({
    where: {
      poolProcessingAttempts: { gt: 6 } // More than 6 attempts
    },
    select: { bookingId: true }
  });

  const result = await prisma.bookingPlan.updateMany({
    where: {
      poolProcessingAttempts: { gt: 6 }
    },
    data: {
      poolProcessingAttempts: 0,
      poolStatus: PoolStatus.waiting
    }
  });

  return {
    count: result.count,
    entries: excessiveEntries.map(e => e.bookingId)
  };
}

/**
 * Cleanup corrupted entries
 */
async function cleanupCorruptedEntries(errorRecoveryManager: any): Promise<{ total: number; recovered: number; removed: number }> {
  const allEntries = await bookingPool.getAllPoolEntries();
  let recovered = 0;
  let removed = 0;

  for (const entry of allEntries) {
    const corruptionCheck = await errorRecoveryManager.detectEntryCorruption(entry);
    if (corruptionCheck.isCorrupted) {
      const cleanupResult = await errorRecoveryManager.cleanupCorruptedEntry(entry, corruptionCheck);
      if (cleanupResult.recovered) {
        recovered++;
      } else {
        removed++;
      }
    }
  }

  return {
    total: recovered + removed,
    recovered,
    removed
  };
}

/**
 * Retry failed entries
 */
async function retryFailedEntries(): Promise<{ count: number; entries: number[] }> {
  const failedEntries = await prisma.bookingPlan.findMany({
    where: {
      poolStatus: PoolStatus.failed
    },
    select: { bookingId: true }
  });

  await bookingPool.retryFailedEntries();

  return {
    count: failedEntries.length,
    entries: failedEntries.map(e => e.bookingId)
  };
}

/**
 * Validate pool integrity
 */
async function validatePoolIntegrity(): Promise<{ checked: number; issues: number; details: string[] }> {
  const allEntries = await bookingPool.getAllPoolEntries();
  const issues: string[] = [];

  for (const entry of allEntries) {
    // Check for basic integrity issues
    if (entry.startTime.getTime() <= Date.now()) {
      issues.push(`Entry ${entry.bookingId}: Meeting start time is in the past`);
    }
    
    if (entry.endTime.getTime() <= entry.startTime.getTime()) {
      issues.push(`Entry ${entry.bookingId}: End time is before start time`);
    }
    
    if (entry.deadlineTime.getTime() > entry.startTime.getTime()) {
      issues.push(`Entry ${entry.bookingId}: Deadline is after meeting start time`);
    }
  }

  return {
    checked: allEntries.length,
    issues: issues.length,
    details: issues
  };
}

/**
 * Generate health recommendations
 */
function generateHealthRecommendations(
  healthCheck: any,
  poolStatus: any,
  detailedHealth: DetailedHealthInfo
): string[] {
  const recommendations: string[] = [];

  if (!healthCheck.isHealthy) {
    recommendations.push("System is unhealthy. Review issues and perform repair operations.");
  }

  if (!detailedHealth.databaseConnectivity.connected) {
    recommendations.push("Database connectivity issues detected. Check database server status.");
  }

  if (detailedHealth.databaseConnectivity.responseTime > 5000) {
    recommendations.push("Slow database response time. Consider database optimization.");
  }

  if (poolStatus.recentErrors.stuckProcessing > 0) {
    recommendations.push("Run 'cleanup_stuck_processing' repair operation.");
  }

  if (poolStatus.recentErrors.highRetryAttempts > 5) {
    recommendations.push("Run 'reset_excessive_retries' repair operation.");
  }

  if (poolStatus.failedEntries > 0) {
    recommendations.push("Run 'retry_failed_entries' repair operation.");
  }

  if (detailedHealth.performanceMetrics.errorRate > 20) {
    recommendations.push("High error rate detected. Consider system maintenance.");
  }

  if (recommendations.length === 0) {
    recommendations.push("System is healthy. No immediate action required.");
  }

  return recommendations;
}

// Type definitions
interface RepairResult {
  operation: string;
  success: boolean;
  message: string;
  processingTime: number;
  details?: any;
  error?: string;
}

interface DetailedHealthInfo {
  databaseConnectivity: DatabaseConnectivityTest;
  poolTableStats: PoolTableStatistics;
  performanceMetrics: ProcessingPerformanceMetrics;
}

interface DatabaseConnectivityTest {
  connected: boolean;
  responseTime: number;
  error?: string;
}

interface PoolTableStatistics {
  totalEntries: number;
  statusBreakdown: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

interface ProcessingPerformanceMetrics {
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
}