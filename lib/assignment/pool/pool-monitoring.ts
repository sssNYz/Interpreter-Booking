import { bookingPool, type EnhancedPoolEntry } from "./pool";
import { getPoolProcessingEngine, type ProcessingResult } from "./pool-engine";
import { getPoolErrorRecoveryManager } from "../error-handling/pool-error-recovery";
import { getDailyPoolProcessor } from "./daily-pool-processor";
import { getAssignmentLogger } from "../logging/logging";
import prisma from "@/prisma/prisma";

/**
 * Pool monitoring and debugging system
 */
export class PoolMonitor {
  private static instance: PoolMonitor;
  private logger = getAssignmentLogger();

  private constructor() {}

  public static getInstance(): PoolMonitor {
    if (!PoolMonitor.instance) {
      PoolMonitor.instance = new PoolMonitor();
    }
    return PoolMonitor.instance;
  }

  /**
   * Get comprehensive pool status dashboard
   */
  async getPoolStatusDashboard(): Promise<PoolStatusDashboard> {
    console.log("📊 Getting comprehensive pool status dashboard...");

    const [
      poolStats,
      processingStatus,
      entriesBreakdown,
      processingHistory,
      diagnostics,
      alerts
    ] = await Promise.all([
      this.getPoolStatistics(),
      this.getProcessingStatus(),
      this.getEntriesBreakdown(),
      this.getRecentProcessingHistory(),
      this.getDiagnosticInformation(),
      this.getPoolAlerts()
    ]);

    const dashboard: PoolStatusDashboard = {
      timestamp: new Date(),
      poolStats,
      processingStatus,
      entriesBreakdown,
      processingHistory,
      diagnostics,
      alerts,
      recommendations: this.generateRecommendations(poolStats, processingStatus, diagnostics, alerts)
    };

    console.log(`✅ Pool dashboard generated: ${poolStats.totalEntries} total entries, ${alerts.active.length} active alerts`);
    return dashboard;
  }

  /**
   * Get detailed pool statistics
   */
  async getPoolStatistics(): Promise<PoolStatistics> {
    const poolStats = await bookingPool.getPoolStats();
    const allEntries = await bookingPool.getAllPoolEntries();
    
    // Calculate urgency distribution
    const urgencyDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const now = new Date();
    for (const entry of allEntries) {
      const urgency = this.determineUrgencyLevel(entry, now);
      urgencyDistribution[urgency.toLowerCase() as keyof typeof urgencyDistribution]++;
    }

    // Calculate processing time statistics
    const processingTimes = allEntries
      .filter(entry => entry.processingAttempts > 0)
      .map(entry => entry.processingAttempts * 1000); // Approximate processing time

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      totalEntries: poolStats.totalInPool,
      readyForProcessing: poolStats.readyForProcessing,
      currentlyProcessing: poolStats.currentlyProcessing,
      failedEntries: poolStats.failedEntries,
      oldestEntry: poolStats.oldestEntry,
      urgencyDistribution,
      averageProcessingTime: avgProcessingTime,
      totalProcessingAttempts: allEntries.reduce((sum, entry) => sum + entry.processingAttempts, 0)
    };
  }

  /**
   * Get current processing status
   */
  async getProcessingStatus(): Promise<ProcessingStatus> {
    const engine = getPoolProcessingEngine();
    const dailyProcessor = getDailyPoolProcessor();
    const errorRecoveryManager = getPoolErrorRecoveryManager();

    const [
      engineStatus,
      dailyProcessorStatus,
      errorRecoveryStatus,
      needsProcessing
    ] = await Promise.all([
      engine.getProcessingStatus(),
      Promise.resolve(dailyProcessor?.getStatus() || null),
      errorRecoveryManager.getPoolProcessingStatus(),
      engine.needsImmediateProcessing()
    ]);

    return {
      isRunning: engineStatus.isRunning || (dailyProcessorStatus?.isRunning ?? false),
      lastProcessingTime: engineStatus.lastProcessingTime || dailyProcessorStatus?.lastProcessingTime || null,
      nextProcessingTime: engineStatus.nextProcessingTime || dailyProcessorStatus?.nextProcessingTime || null,
      processingIntervalMs: dailyProcessorStatus?.processingIntervalMs || 24 * 60 * 60 * 1000, // Default 24 hours
      needsImmediateProcessing,
      errorRecovery: {
        healthStatus: errorRecoveryStatus.healthStatus,
        recentErrors: errorRecoveryStatus.recentErrors,
        configuration: errorRecoveryStatus.errorRecovery
      },
      recentErrors: engineStatus.processingErrors || []
    };
  }

  /**
   * Get detailed breakdown of pool entries
   */
  async getEntriesBreakdown(): Promise<EntriesBreakdown> {
    const engine = getPoolProcessingEngine();
    const entriesStatus = await engine.getEntriesNeedingProcessing();
    
    // Get detailed entry information
    const detailedEntries = await Promise.all([
      this.getDetailedEntries(entriesStatus.deadline, 'deadline'),
      this.getDetailedEntries(entriesStatus.ready, 'ready'),
      this.getDetailedEntries(entriesStatus.pending, 'pending'),
      this.getDetailedEntries(entriesStatus.failed, 'failed'),
      this.getDetailedEntries(entriesStatus.corrupted, 'corrupted')
    ]);

    return {
      deadline: {
        count: entriesStatus.deadline.length,
        entries: detailedEntries[0]
      },
      ready: {
        count: entriesStatus.ready.length,
        entries: detailedEntries[1]
      },
      pending: {
        count: entriesStatus.pending.length,
        entries: detailedEntries[2]
      },
      failed: {
        count: entriesStatus.failed.length,
        entries: detailedEntries[3]
      },
      corrupted: {
        count: entriesStatus.corrupted.length,
        entries: detailedEntries[4]
      },
      urgencySummary: entriesStatus.summary,
      errorRecovery: entriesStatus.errorRecovery
    };
  }

  /**
   * Get recent processing history
   */
  async getRecentProcessingHistory(limit: number = 50): Promise<ProcessingHistoryEntry[]> {
    try {
      // Get recent pool processing logs from database
      const recentLogs = await prisma.poolProcessingLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          entries: {
            include: {
              bookingPlan: {
                select: {
                  bookingId: true,
                  meetingType: true,
                  timeStart: true,
                  timeEnd: true,
                  bookingStatus: true
                }
              }
            }
          }
        }
      });

      return recentLogs.map(log => ({
        batchId: log.batchId,
        processingType: log.processingType as 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY',
        startTime: log.processingStartTime,
        endTime: log.processingEndTime,
        totalEntries: log.totalEntries,
        processedEntries: log.processedEntries,
        assignedEntries: log.assignedEntries,
        escalatedEntries: log.escalatedEntries,
        failedEntries: log.failedEntries,
        averageProcessingTime: log.averageProcessingTimeMs,
        systemLoad: log.systemLoad as 'HIGH' | 'MEDIUM' | 'LOW',
        fairnessImprovement: log.fairnessImprovement,
        errors: log.errors as ProcessingError[],
        entries: log.entries.map(entry => ({
          bookingId: entry.bookingId,
          status: entry.status as 'assigned' | 'escalated' | 'failed',
          interpreterId: entry.interpreterId,
          reason: entry.reason,
          processingTime: entry.processingTimeMs,
          urgencyLevel: entry.urgencyLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          errorRecovery: entry.errorRecovery as any
        }))
      }));
    } catch (error) {
      console.error("❌ Error getting processing history:", error);
      return [];
    }
  }

  /**
   * Get diagnostic information for troubleshooting
   */
  async getDiagnosticInformation(): Promise<DiagnosticInformation> {
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const healthCheck = await errorRecoveryManager.performHealthCheck();
    
    // Get stuck entries
    const stuckEntries = await this.getStuckEntries();
    
    // Get processing bottlenecks
    const bottlenecks = await this.identifyProcessingBottlenecks();
    
    // Get system resource usage
    const resourceUsage = await this.getSystemResourceUsage();

    return {
      healthCheck: {
        isHealthy: healthCheck.isHealthy,
        issues: healthCheck.issues,
        warnings: healthCheck.warnings,
        checkTime: healthCheck.checkTime,
        timestamp: healthCheck.timestamp
      },
      stuckEntries: {
        count: stuckEntries.length,
        entries: stuckEntries,
        oldestStuckTime: stuckEntries.length > 0 
          ? Math.min(...stuckEntries.map(e => e.stuckDuration))
          : 0
      },
      bottlenecks,
      resourceUsage,
      systemState: {
        databaseConnected: true, // Would check actual connection
        schedulerRunning: getDailyPoolProcessor()?.getStatus()?.isRunning ?? false,
        errorRecoveryEnabled: true,
        lastSystemRestart: new Date() // Would track actual restart time
      }
    };
  }

  /**
   * Get pool-related alerts and notifications
   */
  async getPoolAlerts(): Promise<PoolAlerts> {
    const alerts: PoolAlert[] = [];
    const warnings: PoolAlert[] = [];
    const info: PoolAlert[] = [];

    // Check for critical conditions
    const poolStats = await bookingPool.getPoolStats();
    const engine = getPoolProcessingEngine();
    const entriesStatus = await engine.getEntriesNeedingProcessing();

    // Critical alerts
    if (entriesStatus.deadline.length > 0) {
      alerts.push({
        id: `deadline-entries-${Date.now()}`,
        type: 'DEADLINE_ENTRIES',
        severity: 'CRITICAL',
        message: `${entriesStatus.deadline.length} entries are past their deadline`,
        timestamp: new Date(),
        affectedEntries: entriesStatus.deadline.length,
        actionRequired: 'Run emergency processing immediately'
      });
    }

    if (entriesStatus.corrupted.length > 0) {
      alerts.push({
        id: `corrupted-entries-${Date.now()}`,
        type: 'CORRUPTED_ENTRIES',
        severity: 'CRITICAL',
        message: `${entriesStatus.corrupted.length} corrupted entries detected`,
        timestamp: new Date(),
        affectedEntries: entriesStatus.corrupted.length,
        actionRequired: 'Run corruption cleanup'
      });
    }

    // Warning alerts
    if (poolStats.failedEntries > poolStats.totalInPool * 0.2) {
      warnings.push({
        id: `high-failure-rate-${Date.now()}`,
        type: 'HIGH_FAILURE_RATE',
        severity: 'WARNING',
        message: `High failure rate: ${poolStats.failedEntries}/${poolStats.totalInPool} entries failed`,
        timestamp: new Date(),
        affectedEntries: poolStats.failedEntries,
        actionRequired: 'Review error recovery configuration'
      });
    }

    if (poolStats.totalInPool > 100) {
      warnings.push({
        id: `large-pool-size-${Date.now()}`,
        type: 'LARGE_POOL_SIZE',
        severity: 'WARNING',
        message: `Large pool size: ${poolStats.totalInPool} entries`,
        timestamp: new Date(),
        affectedEntries: poolStats.totalInPool,
        actionRequired: 'Consider switching to Urgent mode or increasing processing frequency'
      });
    }

    // Info alerts
    if (entriesStatus.summary.critical > 0) {
      info.push({
        id: `critical-urgency-${Date.now()}`,
        type: 'CRITICAL_URGENCY',
        severity: 'INFO',
        message: `${entriesStatus.summary.critical} entries have critical urgency`,
        timestamp: new Date(),
        affectedEntries: entriesStatus.summary.critical,
        actionRequired: 'Monitor for deadline approach'
      });
    }

    return {
      active: alerts,
      warnings,
      info,
      summary: {
        total: alerts.length + warnings.length + info.length,
        critical: alerts.length,
        warnings: warnings.length,
        lastAlert: [...alerts, ...warnings, ...info]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || null
      }
    };
  }

  /**
   * Get detailed entry information
   */
  private async getDetailedEntries(
    entries: EnhancedPoolEntry[], 
    category: string
  ): Promise<DetailedPoolEntry[]> {
    const now = new Date();
    
    return entries.slice(0, 20).map(entry => ({ // Limit to 20 entries for performance
      bookingId: entry.bookingId,
      meetingType: entry.meetingType,
      startTime: entry.startTime,
      endTime: entry.endTime,
      poolEntryTime: entry.poolEntryTime,
      deadlineTime: entry.deadlineTime,
      processingAttempts: entry.processingAttempts,
      urgencyLevel: this.determineUrgencyLevel(entry, now),
      timeInPool: now.getTime() - entry.poolEntryTime.getTime(),
      timeToDeadline: entry.deadlineTime.getTime() - now.getTime(),
      status: category as any,
      lastProcessingAttempt: entry.lastProcessingAttempt,
      processingErrors: entry.processingErrors || []
    }));
  }

  /**
   * Determine urgency level for an entry
   */
  private determineUrgencyLevel(entry: EnhancedPoolEntry, now: Date): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
    const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
    
    if (now >= entry.deadlineTime) {
      return 'CRITICAL';
    } else if (hoursToDeadline <= 2) {
      return 'CRITICAL';
    } else if (hoursToDeadline <= 6) {
      return 'HIGH';
    } else if (hoursToDeadline <= 24) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Get entries that are stuck in processing
   */
  private async getStuckEntries(): Promise<StuckEntry[]> {
    const allEntries = await bookingPool.getAllPoolEntries();
    const now = new Date();
    const stuckThresholdMs = 30 * 60 * 1000; // 30 minutes

    return allEntries
      .filter(entry => {
        if (!entry.lastProcessingAttempt) return false;
        const timeSinceLastAttempt = now.getTime() - entry.lastProcessingAttempt.getTime();
        return timeSinceLastAttempt > stuckThresholdMs && entry.processingAttempts > 0;
      })
      .map(entry => ({
        bookingId: entry.bookingId,
        meetingType: entry.meetingType,
        stuckDuration: now.getTime() - (entry.lastProcessingAttempt?.getTime() || now.getTime()),
        processingAttempts: entry.processingAttempts,
        lastError: entry.processingErrors?.[entry.processingErrors.length - 1]?.message || 'Unknown error',
        possibleCauses: this.identifyStuckCauses(entry)
      }));
  }

  /**
   * Identify possible causes for stuck entries
   */
  private identifyStuckCauses(entry: EnhancedPoolEntry): string[] {
    const causes = [];
    
    if (entry.processingAttempts > 5) {
      causes.push('Excessive retry attempts - possible system issue');
    }
    
    if (entry.processingErrors && entry.processingErrors.length > 0) {
      const lastError = entry.processingErrors[entry.processingErrors.length - 1];
      if (lastError.message.includes('database')) {
        causes.push('Database connectivity issues');
      }
      if (lastError.message.includes('timeout')) {
        causes.push('Processing timeout - system overload');
      }
      if (lastError.message.includes('conflict')) {
        causes.push('Persistent scheduling conflicts');
      }
    }
    
    const now = new Date();
    if (entry.deadlineTime.getTime() < now.getTime()) {
      causes.push('Entry is past deadline - may need emergency processing');
    }
    
    if (causes.length === 0) {
      causes.push('Unknown cause - requires manual investigation');
    }
    
    return causes;
  }

  /**
   * Identify processing bottlenecks
   */
  private async identifyProcessingBottlenecks(): Promise<ProcessingBottleneck[]> {
    const bottlenecks: ProcessingBottleneck[] = [];
    
    // Check pool size bottleneck
    const poolStats = await bookingPool.getPoolStats();
    if (poolStats.totalInPool > 50) {
      bottlenecks.push({
        type: 'LARGE_POOL_SIZE',
        severity: 'MEDIUM',
        description: `Large pool size (${poolStats.totalInPool} entries) may slow processing`,
        impact: 'Increased processing time and resource usage',
        recommendation: 'Consider switching to Urgent mode or increasing processing frequency'
      });
    }

    // Check failure rate bottleneck
    if (poolStats.failedEntries > poolStats.totalInPool * 0.15) {
      bottlenecks.push({
        type: 'HIGH_FAILURE_RATE',
        severity: 'HIGH',
        description: `High failure rate (${Math.round(poolStats.failedEntries / poolStats.totalInPool * 100)}%)`,
        impact: 'Reduced system efficiency and increased manual intervention',
        recommendation: 'Review error logs and adjust error recovery configuration'
      });
    }

    // Check processing frequency bottleneck
    const dailyProcessor = getDailyPoolProcessor();
    const processorStatus = dailyProcessor?.getStatus();
    if (processorStatus && processorStatus.processingIntervalMs > 24 * 60 * 60 * 1000) {
      bottlenecks.push({
        type: 'LOW_PROCESSING_FREQUENCY',
        severity: 'MEDIUM',
        description: 'Processing frequency is low (once per day or less)',
        impact: 'Entries may wait too long before processing',
        recommendation: 'Increase processing frequency or implement real-time processing'
      });
    }

    return bottlenecks;
  }

  /**
   * Get system resource usage information
   */
  private async getSystemResourceUsage(): Promise<SystemResourceUsage> {
    // This would integrate with actual system monitoring in a real implementation
    return {
      memoryUsage: {
        used: 0, // Would get actual memory usage
        total: 0,
        percentage: 0
      },
      cpuUsage: {
        percentage: 0 // Would get actual CPU usage
      },
      databaseConnections: {
        active: 1, // Would get actual connection count
        max: 10
      },
      diskUsage: {
        used: 0, // Would get actual disk usage
        total: 0,
        percentage: 0
      }
    };
  }

  /**
   * Generate recommendations based on pool status
   */
  private generateRecommendations(
    poolStats: PoolStatistics,
    processingStatus: ProcessingStatus,
    diagnostics: DiagnosticInformation,
    alerts: PoolAlerts
  ): string[] {
    const recommendations: string[] = [];

    // Critical recommendations
    if (alerts.active.length > 0) {
      recommendations.push(`🚨 ${alerts.active.length} critical alerts require immediate attention`);
    }

    if (diagnostics.stuckEntries.count > 0) {
      recommendations.push(`🔧 ${diagnostics.stuckEntries.count} stuck entries need manual intervention`);
    }

    // Performance recommendations
    if (poolStats.totalEntries > 100) {
      recommendations.push("📈 Large pool size detected - consider switching to Urgent mode");
    }

    if (poolStats.failedEntries > poolStats.totalEntries * 0.1) {
      recommendations.push("⚠️ High failure rate - review error recovery configuration");
    }

    if (processingStatus.needsImmediateProcessing) {
      recommendations.push("⚡ Immediate processing needed - run manual processing");
    }

    // System health recommendations
    if (!diagnostics.healthCheck.isHealthy) {
      recommendations.push("🏥 System health check failed - review issues and warnings");
    }

    if (!diagnostics.systemState.schedulerRunning) {
      recommendations.push("🔄 Pool processing scheduler is not running - restart scheduler");
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push("✅ Pool processing is operating normally");
    }

    return recommendations;
  }
}

// Type definitions for pool monitoring
export interface PoolStatusDashboard {
  timestamp: Date;
  poolStats: PoolStatistics;
  processingStatus: ProcessingStatus;
  entriesBreakdown: EntriesBreakdown;
  processingHistory: ProcessingHistoryEntry[];
  diagnostics: DiagnosticInformation;
  alerts: PoolAlerts;
  recommendations: string[];
}

export interface PoolStatistics {
  totalEntries: number;
  readyForProcessing: number;
  currentlyProcessing: number;
  failedEntries: number;
  oldestEntry: Date | null;
  urgencyDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageProcessingTime: number;
  totalProcessingAttempts: number;
}

export interface ProcessingStatus {
  isRunning: boolean;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  processingIntervalMs: number;
  needsImmediateProcessing: boolean;
  errorRecovery: {
    healthStatus: any;
    recentErrors: any;
    configuration: any;
  };
  recentErrors: Array<{ timestamp: Date; error: string }>;
}

export interface EntriesBreakdown {
  deadline: {
    count: number;
    entries: DetailedPoolEntry[];
  };
  ready: {
    count: number;
    entries: DetailedPoolEntry[];
  };
  pending: {
    count: number;
    entries: DetailedPoolEntry[];
  };
  failed: {
    count: number;
    entries: DetailedPoolEntry[];
  };
  corrupted: {
    count: number;
    entries: DetailedPoolEntry[];
  };
  urgencySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  errorRecovery: {
    needsRecovery: number;
    stuckProcessing: number;
    excessiveRetries: number;
  };
}

export interface DetailedPoolEntry {
  bookingId: number;
  meetingType: string;
  startTime: Date;
  endTime: Date;
  poolEntryTime: Date;
  deadlineTime: Date;
  processingAttempts: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeInPool: number; // milliseconds
  timeToDeadline: number; // milliseconds
  status: 'deadline' | 'ready' | 'pending' | 'failed' | 'corrupted';
  lastProcessingAttempt?: Date;
  processingErrors: Array<{ timestamp: Date; message: string }>;
}

export interface ProcessingHistoryEntry {
  batchId: string;
  processingType: 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY';
  startTime: Date;
  endTime: Date;
  totalEntries: number;
  processedEntries: number;
  assignedEntries: number;
  escalatedEntries: number;
  failedEntries: number;
  averageProcessingTime: number;
  systemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
  fairnessImprovement?: number;
  errors: ProcessingError[];
  entries: ProcessingResult[];
}

export interface ProcessingError {
  timestamp: Date;
  error: string;
  bookingId?: number;
  context?: any;
}

export interface DiagnosticInformation {
  healthCheck: {
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
    checkTime: string;
    timestamp: Date;
  };
  stuckEntries: {
    count: number;
    entries: StuckEntry[];
    oldestStuckTime: number;
  };
  bottlenecks: ProcessingBottleneck[];
  resourceUsage: SystemResourceUsage;
  systemState: {
    databaseConnected: boolean;
    schedulerRunning: boolean;
    errorRecoveryEnabled: boolean;
    lastSystemRestart: Date;
  };
}

export interface StuckEntry {
  bookingId: number;
  meetingType: string;
  stuckDuration: number; // milliseconds
  processingAttempts: number;
  lastError: string;
  possibleCauses: string[];
}

export interface ProcessingBottleneck {
  type: 'LARGE_POOL_SIZE' | 'HIGH_FAILURE_RATE' | 'LOW_PROCESSING_FREQUENCY' | 'RESOURCE_CONSTRAINT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  impact: string;
  recommendation: string;
}

export interface SystemResourceUsage {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    percentage: number;
  };
  databaseConnections: {
    active: number;
    max: number;
  };
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface PoolAlerts {
  active: PoolAlert[];
  warnings: PoolAlert[];
  info: PoolAlert[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    lastAlert: Date | null;
  };
}

export interface PoolAlert {
  id: string;
  type: 'DEADLINE_ENTRIES' | 'CORRUPTED_ENTRIES' | 'HIGH_FAILURE_RATE' | 'LARGE_POOL_SIZE' | 'CRITICAL_URGENCY' | 'STUCK_PROCESSING';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: Date;
  affectedEntries: number;
  actionRequired: string;
}

/**
 * Get the global pool monitor instance
 */
export function getPoolMonitor(): PoolMonitor {
  return PoolMonitor.getInstance();
}