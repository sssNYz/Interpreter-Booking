import { NextRequest, NextResponse } from "next/server";
import { getPoolMonitor } from "@/lib/assignment/pool-monitoring";
import { getPoolHistoryTracker } from "@/lib/assignment/pool-history-tracker";
import { getPoolProcessingEngine } from "@/lib/assignment/pool-engine";
import { getPoolErrorRecoveryManager } from "@/lib/assignment/pool-error-recovery";
import { bookingPool } from "@/lib/assignment/pool";

/**
 * GET /api/admin/pool/diagnostics
 * Get comprehensive pool diagnostics information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const bookingId = searchParams.get('bookingId');

    console.log(`🔍 Getting pool diagnostics... includeDetails: ${includeDetails}, bookingId: ${bookingId}`);

    const poolMonitor = getPoolMonitor();
    const diagnostics = await poolMonitor.getDiagnosticInformation();

    // Get additional diagnostic information
    const [
      systemHealth,
      performanceMetrics,
      entryDiagnostics,
      errorAnalysis
    ] = await Promise.all([
      getSystemHealthDiagnostics(),
      getPerformanceMetrics(),
      bookingId ? getEntrySpecificDiagnostics(parseInt(bookingId)) : null,
      getErrorAnalysis()
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      filters: {
        includeDetails,
        bookingId: bookingId ? parseInt(bookingId) : null
      },
      diagnostics: {
        ...diagnostics,
        healthCheck: {
          ...diagnostics.healthCheck,
          timestamp: diagnostics.healthCheck.timestamp.toISOString()
        },
        systemState: {
          ...diagnostics.systemState,
          lastSystemRestart: diagnostics.systemState.lastSystemRestart.toISOString()
        }
      },
      systemHealth,
      performanceMetrics,
      entryDiagnostics,
      errorAnalysis,
      troubleshooting: generateTroubleshootingGuide(diagnostics, systemHealth, errorAnalysis),
      recommendations: generateDiagnosticRecommendations(diagnostics, systemHealth, performanceMetrics)
    };

    console.log(`✅ Pool diagnostics retrieved: ${diagnostics.stuckEntries.count} stuck entries, ${diagnostics.bottlenecks.length} bottlenecks`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting pool diagnostics:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get pool diagnostics",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool/diagnostics
 * Run diagnostic tests and repairs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      target,
      options = {}
    } = body;

    console.log(`🔧 Running diagnostic action: ${action} on ${target}`);

    const historyTracker = getPoolHistoryTracker();

    switch (action) {
      case 'health_check':
        // Run comprehensive health check
        const errorRecoveryManager = getPoolErrorRecoveryManager();
        const healthCheck = await errorRecoveryManager.performHealthCheck();

        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Manual health check performed`,
          {
            action: 'health_check',
            result: healthCheck,
            triggeredBy: 'admin'
          }
        );

        return NextResponse.json({
          status: 'completed',
          action: 'health_check',
          result: {
            isHealthy: healthCheck.isHealthy,
            issues: healthCheck.issues,
            warnings: healthCheck.warnings,
            checkTime: healthCheck.checkTime,
            timestamp: healthCheck.timestamp.toISOString()
          },
          timestamp: new Date().toISOString()
        });

      case 'corruption_scan':
        // Scan for corrupted entries
        const corruptionResults = await scanForCorruption();

        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Corruption scan completed: ${corruptionResults.corruptedCount} corrupted entries found`,
          {
            action: 'corruption_scan',
            result: corruptionResults,
            triggeredBy: 'admin'
          }
        );

        return NextResponse.json({
          status: 'completed',
          action: 'corruption_scan',
          result: corruptionResults,
          timestamp: new Date().toISOString()
        });

      case 'stuck_entry_analysis':
        // Analyze stuck entries
        const stuckAnalysis = await analyzeStuckEntries();

        return NextResponse.json({
          status: 'completed',
          action: 'stuck_entry_analysis',
          result: stuckAnalysis,
          timestamp: new Date().toISOString()
        });

      case 'performance_analysis':
        // Analyze system performance
        const performanceAnalysis = await analyzePerformance();

        return NextResponse.json({
          status: 'completed',
          action: 'performance_analysis',
          result: performanceAnalysis,
          timestamp: new Date().toISOString()
        });

      case 'repair_stuck_entries':
        // Attempt to repair stuck entries
        const repairResults = await repairStuckEntries(options.force || false);

        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Stuck entry repair completed: ${repairResults.repairedCount} entries repaired`,
          {
            action: 'repair_stuck_entries',
            result: repairResults,
            triggeredBy: 'admin',
            force: options.force
          }
        );

        return NextResponse.json({
          status: 'completed',
          action: 'repair_stuck_entries',
          result: repairResults,
          timestamp: new Date().toISOString()
        });

      case 'cleanup_corrupted':
        // Clean up corrupted entries
        const cleanupResults = await cleanupCorruptedEntries(options.force || false);

        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Corrupted entry cleanup completed: ${cleanupResults.cleanedCount} entries cleaned`,
          {
            action: 'cleanup_corrupted',
            result: cleanupResults,
            triggeredBy: 'admin',
            force: options.force
          }
        );

        return NextResponse.json({
          status: 'completed',
          action: 'cleanup_corrupted',
          result: cleanupResults,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: `Unknown diagnostic action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("❌ Error running diagnostic action:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to run diagnostic action",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get system health diagnostics
 */
async function getSystemHealthDiagnostics(): Promise<{
  database: {
    connected: boolean;
    responseTime: number;
    connectionCount: number;
  };
  scheduler: {
    running: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
  };
  errorRecovery: {
    enabled: boolean;
    healthStatus: string;
    recentErrors: number;
  };
  memory: {
    usage: number;
    available: number;
  };
}> {
  try {
    // Database health check
    const dbStart = Date.now();
    await bookingPool.getPoolStats(); // Simple DB query
    const dbResponseTime = Date.now() - dbStart;

    // Get error recovery status
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const errorRecoveryStatus = await errorRecoveryManager.getPoolProcessingStatus();

    return {
      database: {
        connected: true,
        responseTime: dbResponseTime,
        connectionCount: 1 // Would get actual connection count
      },
      scheduler: {
        running: false, // Would check actual scheduler status
        lastRun: null,
        nextRun: null
      },
      errorRecovery: {
        enabled: true,
        healthStatus: errorRecoveryStatus.healthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY',
        recentErrors: errorRecoveryStatus.recentErrors.totalFailures
      },
      memory: {
        usage: 0, // Would get actual memory usage
        available: 0
      }
    };
  } catch (error) {
    console.error("❌ Error getting system health diagnostics:", error);
    return {
      database: { connected: false, responseTime: -1, connectionCount: 0 },
      scheduler: { running: false, lastRun: null, nextRun: null },
      errorRecovery: { enabled: false, healthStatus: 'UNKNOWN', recentErrors: 0 },
      memory: { usage: 0, available: 0 }
    };
  }
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(): Promise<{
  poolSize: {
    current: number;
    average: number;
    peak: number;
  };
  processingTime: {
    average: number;
    median: number;
    p95: number;
  };
  throughput: {
    entriesPerHour: number;
    successRate: number;
  };
  errors: {
    rate: number;
    types: Record<string, number>;
  };
}> {
  try {
    const poolStats = await bookingPool.getPoolStats();
    const historyTracker = getPoolHistoryTracker();
    const errorSummary = await historyTracker.getErrorSummary(7);

    return {
      poolSize: {
        current: poolStats.totalInPool,
        average: poolStats.totalInPool, // Would calculate from historical data
        peak: poolStats.totalInPool // Would track peak from historical data
      },
      processingTime: {
        average: 2000, // Would calculate from actual processing times
        median: 1500,
        p95: 5000
      },
      throughput: {
        entriesPerHour: 10, // Would calculate from actual throughput
        successRate: 0.85
      },
      errors: {
        rate: errorSummary.totalErrors / 7, // Errors per day
        types: errorSummary.errorsByAction
      }
    };
  } catch (error) {
    console.error("❌ Error getting performance metrics:", error);
    return {
      poolSize: { current: 0, average: 0, peak: 0 },
      processingTime: { average: 0, median: 0, p95: 0 },
      throughput: { entriesPerHour: 0, successRate: 0 },
      errors: { rate: 0, types: {} }
    };
  }
}

/**
 * Get diagnostics for a specific entry
 */
async function getEntrySpecificDiagnostics(bookingId: number): Promise<{
  entry: any;
  history: any[];
  issues: string[];
  recommendations: string[];
} | null> {
  try {
    const historyTracker = getPoolHistoryTracker();
    const history = await historyTracker.getEntryHistory(bookingId, 20);
    
    if (history.length === 0) {
      return null;
    }

    const issues = [];
    const recommendations = [];

    // Analyze entry history for issues
    const errorCount = history.filter(h => h.errorMessage).length;
    if (errorCount > 3) {
      issues.push(`High error count: ${errorCount} errors in recent history`);
      recommendations.push('Review error messages and consider manual intervention');
    }

    const processingAttempts = Math.max(...history.map(h => h.processingAttempts));
    if (processingAttempts > 5) {
      issues.push(`Excessive processing attempts: ${processingAttempts}`);
      recommendations.push('Consider error recovery or manual assignment');
    }

    return {
      entry: history[0], // Most recent entry
      history: history.slice(0, 10), // Last 10 history entries
      issues,
      recommendations
    };
  } catch (error) {
    console.error(`❌ Error getting entry diagnostics for booking ${bookingId}:`, error);
    return null;
  }
}

/**
 * Get error analysis
 */
async function getErrorAnalysis(): Promise<{
  summary: any;
  patterns: Array<{
    pattern: string;
    frequency: number;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendation: string;
  }>;
  trends: {
    increasing: string[];
    decreasing: string[];
    stable: string[];
  };
}> {
  try {
    const historyTracker = getPoolHistoryTracker();
    const errorSummary = await historyTracker.getErrorSummary(7);

    // Analyze error patterns
    const patterns = [];
    for (const [action, count] of Object.entries(errorSummary.errorsByAction)) {
      if (count > 5) {
        patterns.push({
          pattern: `High ${action} errors`,
          frequency: count,
          impact: count > 20 ? 'HIGH' as const : count > 10 ? 'MEDIUM' as const : 'LOW' as const,
          recommendation: `Review ${action} process and error handling`
        });
      }
    }

    return {
      summary: errorSummary,
      patterns,
      trends: {
        increasing: [], // Would analyze trends from historical data
        decreasing: [],
        stable: Object.keys(errorSummary.errorsByAction)
      }
    };
  } catch (error) {
    console.error("❌ Error getting error analysis:", error);
    return {
      summary: { totalErrors: 0, errorsByAction: {}, errorsByBooking: {}, recentErrors: [] },
      patterns: [],
      trends: { increasing: [], decreasing: [], stable: [] }
    };
  }
}

/**
 * Scan for corrupted entries
 */
async function scanForCorruption(): Promise<{
  scannedCount: number;
  corruptedCount: number;
  corruptedEntries: Array<{
    bookingId: number;
    corruptionType: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}> {
  try {
    const allEntries = await bookingPool.getAllPoolEntries();
    const corruptedEntries = [];

    for (const entry of allEntries) {
      // Check for various corruption types
      const corruptions = [];

      // Check for invalid dates
      if (entry.deadlineTime < entry.poolEntryTime) {
        corruptions.push({ type: 'INVALID_DEADLINE', severity: 'HIGH' as const });
      }

      // Check for excessive processing attempts
      if (entry.processingAttempts > 10) {
        corruptions.push({ type: 'EXCESSIVE_RETRIES', severity: 'MEDIUM' as const });
      }

      // Check for missing required fields
      if (!entry.meetingType || !entry.startTime || !entry.endTime) {
        corruptions.push({ type: 'MISSING_FIELDS', severity: 'HIGH' as const });
      }

      if (corruptions.length > 0) {
        corruptedEntries.push({
          bookingId: entry.bookingId,
          corruptionType: corruptions.map(c => c.type).join(', '),
          severity: corruptions.some(c => c.severity === 'HIGH') ? 'HIGH' as const : 'MEDIUM' as const
        });
      }
    }

    return {
      scannedCount: allEntries.length,
      corruptedCount: corruptedEntries.length,
      corruptedEntries
    };
  } catch (error) {
    console.error("❌ Error scanning for corruption:", error);
    return {
      scannedCount: 0,
      corruptedCount: 0,
      corruptedEntries: []
    };
  }
}

/**
 * Analyze stuck entries
 */
async function analyzeStuckEntries(): Promise<{
  stuckCount: number;
  stuckEntries: Array<{
    bookingId: number;
    stuckDuration: number;
    possibleCauses: string[];
    recommendedAction: string;
  }>;
  commonCauses: Record<string, number>;
}> {
  try {
    const poolMonitor = getPoolMonitor();
    const diagnostics = await poolMonitor.getDiagnosticInformation();
    
    const commonCauses: Record<string, number> = {};
    
    for (const entry of diagnostics.stuckEntries.entries) {
      for (const cause of entry.possibleCauses) {
        commonCauses[cause] = (commonCauses[cause] || 0) + 1;
      }
    }

    const stuckEntries = diagnostics.stuckEntries.entries.map(entry => ({
      bookingId: entry.bookingId,
      stuckDuration: entry.stuckDuration,
      possibleCauses: entry.possibleCauses,
      recommendedAction: entry.processingAttempts > 5 
        ? 'Manual intervention required'
        : 'Retry with error recovery'
    }));

    return {
      stuckCount: diagnostics.stuckEntries.count,
      stuckEntries,
      commonCauses
    };
  } catch (error) {
    console.error("❌ Error analyzing stuck entries:", error);
    return {
      stuckCount: 0,
      stuckEntries: [],
      commonCauses: {}
    };
  }
}

/**
 * Analyze system performance
 */
async function analyzePerformance(): Promise<{
  overall: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  bottlenecks: string[];
  recommendations: string[];
  metrics: {
    poolEfficiency: number;
    processingSpeed: number;
    errorRate: number;
    resourceUtilization: number;
  };
}> {
  const performanceMetrics = await getPerformanceMetrics();
  
  const poolEfficiency = performanceMetrics.throughput.successRate * 100;
  const processingSpeed = Math.max(0, 100 - (performanceMetrics.processingTime.average / 50)); // Normalize to 0-100
  const errorRate = Math.max(0, 100 - (performanceMetrics.errors.rate * 10)); // Normalize to 0-100
  const resourceUtilization = 75; // Would calculate from actual resource usage

  const overallScore = (poolEfficiency + processingSpeed + errorRate + resourceUtilization) / 4;
  
  let overall: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  if (overallScore >= 90) overall = 'EXCELLENT';
  else if (overallScore >= 75) overall = 'GOOD';
  else if (overallScore >= 60) overall = 'FAIR';
  else overall = 'POOR';

  const bottlenecks = [];
  const recommendations = [];

  if (performanceMetrics.processingTime.average > 3000) {
    bottlenecks.push('Slow processing times');
    recommendations.push('Optimize processing algorithms or increase resources');
  }

  if (performanceMetrics.errors.rate > 5) {
    bottlenecks.push('High error rate');
    recommendations.push('Review error handling and system stability');
  }

  if (performanceMetrics.poolSize.current > 100) {
    bottlenecks.push('Large pool size');
    recommendations.push('Increase processing frequency or switch to Urgent mode');
  }

  return {
    overall,
    bottlenecks,
    recommendations,
    metrics: {
      poolEfficiency,
      processingSpeed,
      errorRate,
      resourceUtilization
    }
  };
}

/**
 * Repair stuck entries
 */
async function repairStuckEntries(force: boolean = false): Promise<{
  repairedCount: number;
  failedCount: number;
  results: Array<{
    bookingId: number;
    action: string;
    success: boolean;
    error?: string;
  }>;
}> {
  try {
    const poolMonitor = getPoolMonitor();
    const diagnostics = await poolMonitor.getDiagnosticInformation();
    const results = [];
    let repairedCount = 0;
    let failedCount = 0;

    for (const stuckEntry of diagnostics.stuckEntries.entries) {
      try {
        // Attempt to repair the stuck entry
        if (stuckEntry.processingAttempts > 5 && !force) {
          results.push({
            bookingId: stuckEntry.bookingId,
            action: 'SKIPPED',
            success: false,
            error: 'Too many attempts - use force option'
          });
          failedCount++;
          continue;
        }

        // Reset processing status
        await bookingPool.resetProcessingStatus(stuckEntry.bookingId);
        
        results.push({
          bookingId: stuckEntry.bookingId,
          action: 'RESET_STATUS',
          success: true
        });
        repairedCount++;

      } catch (error) {
        results.push({
          bookingId: stuckEntry.bookingId,
          action: 'REPAIR_FAILED',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failedCount++;
      }
    }

    return {
      repairedCount,
      failedCount,
      results
    };
  } catch (error) {
    console.error("❌ Error repairing stuck entries:", error);
    return {
      repairedCount: 0,
      failedCount: 0,
      results: []
    };
  }
}

/**
 * Clean up corrupted entries
 */
async function cleanupCorruptedEntries(force: boolean = false): Promise<{
  cleanedCount: number;
  failedCount: number;
  results: Array<{
    bookingId: number;
    action: string;
    success: boolean;
    error?: string;
  }>;
}> {
  try {
    const corruptionScan = await scanForCorruption();
    const results = [];
    let cleanedCount = 0;
    let failedCount = 0;

    for (const corruptedEntry of corruptionScan.corruptedEntries) {
      try {
        if (corruptedEntry.severity === 'HIGH' || force) {
          // Remove corrupted entry from pool
          await bookingPool.removeFromPool(corruptedEntry.bookingId);
          
          results.push({
            bookingId: corruptedEntry.bookingId,
            action: 'REMOVED_FROM_POOL',
            success: true
          });
          cleanedCount++;
        } else {
          results.push({
            bookingId: corruptedEntry.bookingId,
            action: 'SKIPPED',
            success: false,
            error: 'Low severity - use force option'
          });
          failedCount++;
        }
      } catch (error) {
        results.push({
          bookingId: corruptedEntry.bookingId,
          action: 'CLEANUP_FAILED',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failedCount++;
      }
    }

    return {
      cleanedCount,
      failedCount,
      results
    };
  } catch (error) {
    console.error("❌ Error cleaning up corrupted entries:", error);
    return {
      cleanedCount: 0,
      failedCount: 0,
      results: []
    };
  }
}

/**
 * Generate troubleshooting guide
 */
function generateTroubleshootingGuide(
  diagnostics: any,
  systemHealth: any,
  errorAnalysis: any
): Array<{
  issue: string;
  symptoms: string[];
  possibleCauses: string[];
  solutions: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}> {
  const guide = [];

  // Stuck entries troubleshooting
  if (diagnostics.stuckEntries.count > 0) {
    guide.push({
      issue: 'Stuck Pool Entries',
      symptoms: [
        `${diagnostics.stuckEntries.count} entries stuck in processing`,
        'Entries not progressing through pool stages',
        'High processing attempt counts'
      ],
      possibleCauses: [
        'Database connectivity issues',
        'Processing timeout problems',
        'Scheduling conflicts',
        'System resource constraints'
      ],
      solutions: [
        'Run stuck entry repair',
        'Check database connection health',
        'Review system resource usage',
        'Restart pool processing scheduler'
      ],
      priority: 'HIGH' as const
    });
  }

  // High error rate troubleshooting
  if (errorAnalysis.summary.totalErrors > 20) {
    guide.push({
      issue: 'High Error Rate',
      symptoms: [
        `${errorAnalysis.summary.totalErrors} errors in the last 7 days`,
        'Frequent processing failures',
        'Reduced system efficiency'
      ],
      possibleCauses: [
        'System configuration issues',
        'Database performance problems',
        'Network connectivity issues',
        'Resource exhaustion'
      ],
      solutions: [
        'Review error patterns and logs',
        'Check system configuration',
        'Monitor database performance',
        'Increase system resources if needed'
      ],
      priority: 'MEDIUM' as const
    });
  }

  // Database health troubleshooting
  if (!systemHealth.database.connected || systemHealth.database.responseTime > 1000) {
    guide.push({
      issue: 'Database Performance Issues',
      symptoms: [
        systemHealth.database.connected ? 'Slow database response times' : 'Database connection failures',
        'Processing delays',
        'Timeout errors'
      ],
      possibleCauses: [
        'Database server overload',
        'Network latency',
        'Inefficient queries',
        'Connection pool exhaustion'
      ],
      solutions: [
        'Check database server health',
        'Optimize database queries',
        'Review connection pool settings',
        'Monitor network connectivity'
      ],
      priority: 'HIGH' as const
    });
  }

  return guide;
}

/**
 * Generate diagnostic recommendations
 */
function generateDiagnosticRecommendations(
  diagnostics: any,
  systemHealth: any,
  performanceMetrics: any
): Array<{
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  action: string;
  automated: boolean;
}> {
  const recommendations = [];

  // Critical recommendations
  if (diagnostics.stuckEntries.count > 0) {
    recommendations.push({
      category: 'stuck-entries',
      priority: 'HIGH' as const,
      recommendation: `${diagnostics.stuckEntries.count} stuck entries need immediate attention`,
      action: 'repair_stuck_entries',
      automated: true
    });
  }

  if (!systemHealth.database.connected) {
    recommendations.push({
      category: 'database',
      priority: 'HIGH' as const,
      recommendation: 'Database connection issues detected',
      action: 'check_database_health',
      automated: false
    });
  }

  // Performance recommendations
  if (performanceMetrics.poolSize.current > 100) {
    recommendations.push({
      category: 'performance',
      priority: 'MEDIUM' as const,
      recommendation: 'Large pool size may impact performance',
      action: 'optimize_pool_processing',
      automated: true
    });
  }

  if (performanceMetrics.errors.rate > 5) {
    recommendations.push({
      category: 'errors',
      priority: 'MEDIUM' as const,
      recommendation: 'High error rate requires investigation',
      action: 'analyze_error_patterns',
      automated: false
    });
  }

  return recommendations;
}