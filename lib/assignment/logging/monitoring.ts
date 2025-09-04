import prisma from "@/prisma/prisma";
import { LogAnalyzer } from "./logging";

/**
 * System monitoring utilities for assignment performance and health
 */
export class AssignmentMonitor {
  private static instance: AssignmentMonitor;
  private performanceMetrics: Map<string, number[]> = new Map();
  private alertThresholds = {
    maxProcessingTime: 5000, // 5 seconds
    maxConflictRate: 0.8, // 80% conflicts
    minSuccessRate: 0.7, // 70% success rate
    maxEscalationRate: 0.3 // 30% escalation rate
  };
  
  private constructor() {
    // Start monitoring intervals
    this.startPerformanceMonitoring();
    this.startHealthChecks();
  }
  
  public static getInstance(): AssignmentMonitor {
    if (!AssignmentMonitor.instance) {
      AssignmentMonitor.instance = new AssignmentMonitor();
    }
    return AssignmentMonitor.instance;
  }
  
  /**
   * Record assignment processing time
   */
  recordProcessingTime(bookingId: number, processingTimeMs: number): void {
    const key = 'processing_time';
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    
    const times = this.performanceMetrics.get(key)!;
    times.push(processingTimeMs);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
    
    // Check for performance alerts
    if (processingTimeMs > this.alertThresholds.maxProcessingTime) {
      this.triggerAlert('SLOW_PROCESSING', {
        bookingId,
        processingTimeMs,
        threshold: this.alertThresholds.maxProcessingTime
      });
    }
  }
  
  /**
   * Record conflict detection statistics
   */
  recordConflictStats(totalChecked: number, conflicted: number): void {
    const conflictRate = totalChecked > 0 ? conflicted / totalChecked : 0;
    
    const key = 'conflict_rate';
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    
    const rates = this.performanceMetrics.get(key)!;
    rates.push(conflictRate);
    
    // Keep only last 50 measurements
    if (rates.length > 50) {
      rates.shift();
    }
    
    // Check for conflict alerts
    if (conflictRate > this.alertThresholds.maxConflictRate) {
      this.triggerAlert('HIGH_CONFLICT_RATE', {
        conflictRate,
        totalChecked,
        conflicted,
        threshold: this.alertThresholds.maxConflictRate
      });
    }
  }
  
  /**
   * Get current system performance metrics
   */
  getPerformanceMetrics(): {
    averageProcessingTime: number;
    maxProcessingTime: number;
    averageConflictRate: number;
    currentSystemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
    alertsInLastHour: number;
  } {
    const processingTimes = this.performanceMetrics.get('processing_time') || [];
    const conflictRates = this.performanceMetrics.get('conflict_rate') || [];
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;
    
    const maxProcessingTime = processingTimes.length > 0 
      ? Math.max(...processingTimes)
      : 0;
    
    const averageConflictRate = conflictRates.length > 0
      ? conflictRates.reduce((sum, rate) => sum + rate, 0) / conflictRates.length
      : 0;
    
    // Determine system load based on metrics
    const currentSystemLoad: 'HIGH' | 'MEDIUM' | 'LOW' = 
      averageProcessingTime > this.alertThresholds.maxProcessingTime * 0.8 ||
      averageConflictRate > this.alertThresholds.maxConflictRate * 0.8 ? 'HIGH' :
      averageProcessingTime > this.alertThresholds.maxProcessingTime * 0.5 ||
      averageConflictRate > this.alertThresholds.maxConflictRate * 0.5 ? 'MEDIUM' : 'LOW';
    
    return {
      averageProcessingTime,
      maxProcessingTime,
      averageConflictRate,
      currentSystemLoad,
      alertsInLastHour: 0 // Will be implemented with alert storage
    };
  }
  
  /**
   * Get pool status monitoring information
   */
  async getPoolStatus(): Promise<{
    totalPoolEntries: number;
    entriesByMode: Record<string, number>;
    oldestEntry?: {
      bookingId: number;
      timeInPool: number; // minutes
      mode: string;
    };
    upcomingDeadlines: Array<{
      bookingId: number;
      deadlineTime: Date;
      timeUntilDeadline: number; // minutes
    }>;
    processingBacklog: number;
  }> {
    try {
      // Get pool status from the pool module
      const { getPoolStatus } = await import('../pool/pool');
      const poolStatus = await getPoolStatus();
      
      // Calculate additional monitoring metrics
      const now = new Date();
      const upcomingDeadlines = poolStatus.entries
        .filter(entry => entry.deadlineTime > now)
        .map(entry => ({
          bookingId: entry.bookingId,
          deadlineTime: entry.deadlineTime,
          timeUntilDeadline: Math.floor((entry.deadlineTime.getTime() - now.getTime()) / (1000 * 60))
        }))
        .sort((a, b) => a.timeUntilDeadline - b.timeUntilDeadline)
        .slice(0, 10); // Top 10 upcoming deadlines
      
      const oldestEntry = poolStatus.entries.length > 0 
        ? poolStatus.entries.reduce((oldest, entry) => 
            entry.poolEntryTime < oldest.poolEntryTime ? entry : oldest
          )
        : undefined;
      
      const entriesByMode: Record<string, number> = {};
      poolStatus.entries.forEach(entry => {
        entriesByMode[entry.mode] = (entriesByMode[entry.mode] || 0) + 1;
      });
      
      return {
        totalPoolEntries: poolStatus.entries.length,
        entriesByMode,
        oldestEntry: oldestEntry ? {
          bookingId: oldestEntry.bookingId,
          timeInPool: Math.floor((now.getTime() - oldestEntry.poolEntryTime.getTime()) / (1000 * 60)),
          mode: oldestEntry.mode
        } : undefined,
        upcomingDeadlines,
        processingBacklog: poolStatus.entries.filter(entry => 
          entry.deadlineTime <= now || 
          entry.thresholdDays <= 0
        ).length
      };
      
    } catch (error) {
      console.error("❌ Error getting pool status for monitoring:", error);
      return {
        totalPoolEntries: 0,
        entriesByMode: {},
        upcomingDeadlines: [],
        processingBacklog: 0
      };
    }
  }
  
  /**
   * Analyze system health over a time period
   */
  async analyzeSystemHealth(
    startDate: Date,
    endDate: Date
  ): Promise<{
    overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    metrics: {
      successRate: number;
      escalationRate: number;
      averageProcessingTime: number;
      conflictRate: number;
      drOverrideRate: number;
    };
    trends: {
      processingTimesTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
      conflictsTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
      successRateTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    };
    recommendations: string[];
    alerts: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      message: string;
      timestamp: Date;
    }>;
  }> {
    try {
      // Get assignment patterns analysis
      const patterns = await LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate);
      const conflictStats = await LogAnalyzer.getConflictStatistics(startDate, endDate);
      
      // Calculate health metrics
      const metrics = {
        successRate: patterns.successRate,
        escalationRate: patterns.escalationRate,
        averageProcessingTime: patterns.averageProcessingTime,
        conflictRate: conflictStats.averageConflictsPerCheck,
        drOverrideRate: patterns.drOverrideRate
      };
      
      // Determine overall health
      const healthScore = this.calculateHealthScore(metrics);
      const overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 
        healthScore >= 0.8 ? 'HEALTHY' :
        healthScore >= 0.6 ? 'WARNING' : 'CRITICAL';
      
      // Analyze trends (simplified - would need historical data for real trends)
      const trends = {
        processingTimesTrend: metrics.averageProcessingTime < 2000 ? 'IMPROVING' : 
                             metrics.averageProcessingTime < 4000 ? 'STABLE' : 'DEGRADING',
        conflictsTrend: metrics.conflictRate < 0.3 ? 'IMPROVING' :
                       metrics.conflictRate < 0.6 ? 'STABLE' : 'DEGRADING',
        successRateTrend: metrics.successRate > 0.8 ? 'IMPROVING' :
                         metrics.successRate > 0.6 ? 'STABLE' : 'DEGRADING'
      } as const;
      
      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(metrics, trends);
      
      // Generate alerts based on thresholds
      const alerts = this.generateHealthAlerts(metrics);
      
      return {
        overallHealth,
        metrics,
        trends,
        recommendations,
        alerts
      };
      
    } catch (error) {
      console.error("❌ Error analyzing system health:", error);
      throw error;
    }
  }
  
  /**
   * Get real-time system status
   */
  async getRealTimeStatus(): Promise<{
    status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
    activeAssignments: number;
    poolBacklog: number;
    systemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
    lastProcessedAssignment?: Date;
    upcomingDeadlines: number;
    criticalAlerts: number;
  }> {
    try {
      // Get current performance metrics
      const perfMetrics = this.getPerformanceMetrics();
      
      // Get pool status
      const poolStatus = await this.getPoolStatus();
      
      // Check recent assignment activity
      const recentAssignments = await prisma.assignmentLog.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      });
      
      const activeAssignments = await prisma.bookingPlan.count({
        where: {
          bookingStatus: 'waiting',
          timeStart: {
            gte: new Date()
          }
        }
      });
      
      // Determine system status
      const status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN' = 
        perfMetrics.currentSystemLoad === 'HIGH' ? 'DEGRADED' :
        poolStatus.processingBacklog > 50 ? 'DEGRADED' : 'OPERATIONAL';
      
      return {
        status,
        activeAssignments,
        poolBacklog: poolStatus.totalPoolEntries,
        systemLoad: perfMetrics.currentSystemLoad,
        lastProcessedAssignment: recentAssignments[0]?.createdAt,
        upcomingDeadlines: poolStatus.upcomingDeadlines.filter(d => d.timeUntilDeadline <= 60).length,
        criticalAlerts: 0 // Will be implemented with alert storage
      };
      
    } catch (error) {
      console.error("❌ Error getting real-time status:", error);
      return {
        status: 'DOWN',
        activeAssignments: 0,
        poolBacklog: 0,
        systemLoad: 'HIGH',
        upcomingDeadlines: 0,
        criticalAlerts: 1
      };
    }
  }
  
  /**
   * Start performance monitoring intervals
   */
  private startPerformanceMonitoring(): void {
    // Monitor performance every minute
    setInterval(async () => {
      try {
        const metrics = this.getPerformanceMetrics();
        
        // Log performance metrics
        console.log(`📊 Performance Monitor: Avg processing: ${metrics.averageProcessingTime.toFixed(0)}ms, Conflict rate: ${(metrics.averageConflictRate * 100).toFixed(1)}%, Load: ${metrics.currentSystemLoad}`);
        
        // Check for performance degradation
        if (metrics.currentSystemLoad === 'HIGH') {
          this.triggerAlert('HIGH_SYSTEM_LOAD', {
            averageProcessingTime: metrics.averageProcessingTime,
            conflictRate: metrics.averageConflictRate,
            systemLoad: metrics.currentSystemLoad
          });
        }
        
      } catch (error) {
        console.error("❌ Error in performance monitoring:", error);
      }
    }, 60000); // Every minute
  }
  
  /**
   * Start health check intervals
   */
  private startHealthChecks(): void {
    // Health check every 5 minutes
    setInterval(async () => {
      try {
        const status = await this.getRealTimeStatus();
        
        console.log(`🏥 Health Check: Status: ${status.status}, Active: ${status.activeAssignments}, Pool: ${status.poolBacklog}, Load: ${status.systemLoad}`);
        
        // Alert on system degradation
        if (status.status === 'DEGRADED' || status.status === 'DOWN') {
          this.triggerAlert('SYSTEM_DEGRADED', {
            status: status.status,
            systemLoad: status.systemLoad,
            poolBacklog: status.poolBacklog,
            upcomingDeadlines: status.upcomingDeadlines
          });
        }
        
      } catch (error) {
        console.error("❌ Error in health check:", error);
      }
    }, 5 * 60000); // Every 5 minutes
  }
  
  /**
   * Calculate health score from metrics
   */
  private calculateHealthScore(metrics: {
    successRate: number;
    escalationRate: number;
    averageProcessingTime: number;
    conflictRate: number;
    drOverrideRate: number;
  }): number {
    let score = 0;
    
    // Success rate (40% weight)
    score += Math.max(0, metrics.successRate) * 0.4;
    
    // Escalation rate (20% weight) - lower is better
    score += Math.max(0, 1 - metrics.escalationRate) * 0.2;
    
    // Processing time (20% weight) - lower is better
    const processingScore = Math.max(0, 1 - (metrics.averageProcessingTime / 10000)); // Normalize to 10s max
    score += processingScore * 0.2;
    
    // Conflict rate (15% weight) - lower is better
    score += Math.max(0, 1 - metrics.conflictRate) * 0.15;
    
    // DR override rate (5% weight) - moderate is best
    const drScore = metrics.drOverrideRate > 0.5 ? 0 : 
                   metrics.drOverrideRate < 0.1 ? 1 : 
                   1 - Math.abs(metrics.drOverrideRate - 0.2) / 0.3;
    score += drScore * 0.05;
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(
    metrics: any,
    trends: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.successRate < this.alertThresholds.minSuccessRate) {
      recommendations.push("Success rate is below threshold. Consider reviewing assignment policies and interpreter availability.");
    }
    
    if (metrics.escalationRate > this.alertThresholds.maxEscalationRate) {
      recommendations.push("High escalation rate detected. Review conflict detection and fairness parameters.");
    }
    
    if (metrics.averageProcessingTime > this.alertThresholds.maxProcessingTime) {
      recommendations.push("Processing times are high. Consider optimizing database queries and conflict detection algorithms.");
    }
    
    if (metrics.conflictRate > this.alertThresholds.maxConflictRate) {
      recommendations.push("High conflict rate indicates scheduling issues. Review booking patterns and interpreter schedules.");
    }
    
    if (trends.processingTimesTrend === 'DEGRADING') {
      recommendations.push("Processing performance is degrading. Monitor system resources and database performance.");
    }
    
    if (trends.conflictsTrend === 'DEGRADING') {
      recommendations.push("Conflict rates are increasing. Consider adjusting booking policies or interpreter capacity.");
    }
    
    return recommendations;
  }
  
  /**
   * Generate health alerts
   */
  private generateHealthAlerts(metrics: any): Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: Date;
  }> {
    const alerts = [];
    const now = new Date();
    
    if (metrics.successRate < 0.5) {
      alerts.push({
        type: 'LOW_SUCCESS_RATE',
        severity: 'HIGH' as const,
        message: `Critical: Success rate is ${(metrics.successRate * 100).toFixed(1)}%, well below acceptable threshold`,
        timestamp: now
      });
    } else if (metrics.successRate < this.alertThresholds.minSuccessRate) {
      alerts.push({
        type: 'LOW_SUCCESS_RATE',
        severity: 'MEDIUM' as const,
        message: `Warning: Success rate is ${(metrics.successRate * 100).toFixed(1)}%, below threshold of ${(this.alertThresholds.minSuccessRate * 100).toFixed(1)}%`,
        timestamp: now
      });
    }
    
    if (metrics.averageProcessingTime > this.alertThresholds.maxProcessingTime * 2) {
      alerts.push({
        type: 'SLOW_PROCESSING',
        severity: 'HIGH' as const,
        message: `Critical: Average processing time is ${metrics.averageProcessingTime.toFixed(0)}ms, significantly above threshold`,
        timestamp: now
      });
    } else if (metrics.averageProcessingTime > this.alertThresholds.maxProcessingTime) {
      alerts.push({
        type: 'SLOW_PROCESSING',
        severity: 'MEDIUM' as const,
        message: `Warning: Average processing time is ${metrics.averageProcessingTime.toFixed(0)}ms, above threshold of ${this.alertThresholds.maxProcessingTime}ms`,
        timestamp: now
      });
    }
    
    return alerts;
  }
  
  /**
   * Trigger system alert
   */
  private triggerAlert(type: string, data: any): void {
    const timestamp = new Date();
    console.warn(`🚨 ALERT [${type}] at ${timestamp.toISOString()}:`, data);
    
    // In a real implementation, this would:
    // 1. Store alerts in database
    // 2. Send notifications (email, Slack, etc.)
    // 3. Update monitoring dashboards
    // 4. Trigger automated responses if configured
  }
}

/**
 * Convenience function to get monitor instance
 */
export function getAssignmentMonitor(): AssignmentMonitor {
  return AssignmentMonitor.getInstance();
}

/**
 * Error logging with system state capture
 */
export async function logSystemError(
  error: Error,
  context: {
    operation: string;
    bookingId?: number;
    interpreterId?: string;
    additionalData?: any;
  }
): Promise<void> {
  try {
    const monitor = getAssignmentMonitor();
    const systemStatus = await monitor.getRealTimeStatus();
    const performanceMetrics = monitor.getPerformanceMetrics();
    
    const errorLog = {
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      systemState: {
        status: systemStatus.status,
        systemLoad: systemStatus.systemLoad,
        activeAssignments: systemStatus.activeAssignments,
        poolBacklog: systemStatus.poolBacklog,
        performanceMetrics
      }
    };
    
    console.error("❌ System Error with State Capture:", errorLog);
    
    // Store error log in database
    await prisma.systemErrorLog.create({
      data: {
        operation: context.operation,
        bookingId: context.bookingId,
        interpreterId: context.interpreterId,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        systemState: errorLog.systemState as any,
        additionalData: context.additionalData as any
      }
    }).catch(dbError => {
      console.error("❌ Failed to store error log in database:", dbError);
    });
    
  } catch (loggingError) {
    console.error("❌ Error in error logging system:", loggingError);
  }
}