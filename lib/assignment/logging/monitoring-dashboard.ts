import { getAssignmentMonitor } from './monitoring';
import { LogAnalyzer } from './logging';

/**
 * Monitoring dashboard utilities for comprehensive system oversight
 */
export class MonitoringDashboard {
  private static instance: MonitoringDashboard;
  
  private constructor() {}
  
  public static getInstance(): MonitoringDashboard {
    if (!MonitoringDashboard.instance) {
      MonitoringDashboard.instance = new MonitoringDashboard();
    }
    return MonitoringDashboard.instance;
  }
  
  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(timeRangeDays: number = 7): Promise<{
    overview: DashboardOverview;
    performance: PerformanceDashboard;
    health: HealthDashboard;
    trends: TrendsDashboard;
    alerts: AlertsDashboard;
    recommendations: string[];
  }> {
    const monitor = getAssignmentMonitor();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);
    
    // Get all required data in parallel
    const [
      realTimeStatus,
      performanceMetrics,
      poolStatus,
      healthAnalysis,
      assignmentPatterns,
      conflictStats
    ] = await Promise.all([
      monitor.getRealTimeStatus(),
      Promise.resolve(monitor.getPerformanceMetrics()),
      monitor.getPoolStatus(),
      monitor.analyzeSystemHealth(startDate, endDate),
      LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate),
      LogAnalyzer.getConflictStatistics(startDate, endDate)
    ]);
    
    // Build dashboard sections
    const overview = this.buildOverview(realTimeStatus, assignmentPatterns, poolStatus);
    const performance = this.buildPerformanceDashboard(performanceMetrics, assignmentPatterns);
    const health = this.buildHealthDashboard(healthAnalysis, realTimeStatus);
    const trends = this.buildTrendsDashboard(assignmentPatterns, conflictStats, timeRangeDays);
    const alerts = this.buildAlertsDashboard(healthAnalysis.alerts, realTimeStatus);
    
    return {
      overview,
      performance,
      health,
      trends,
      alerts,
      recommendations: healthAnalysis.recommendations
    };
  }
  
  /**
   * Build overview dashboard section
   */
  private buildOverview(
    realTimeStatus: {
      status: string;
      lastProcessedAssignment?: Date;
      activeAssignments: number;
      poolBacklog: number;
      systemLoad: string;
      upcomingDeadlines: number;
      criticalAlerts: number;
    },
    assignmentPatterns: {
      totalAssignments: number;
      successRate: number;
      escalationRate: number;
      interpreterWorkload: Record<string, number>;
    },
    poolStatus: { totalPoolEntries: number }
  ): DashboardOverview {
    return {
      systemStatus: {
        status: realTimeStatus.status,
        uptime: this.calculateUptime(realTimeStatus.lastProcessedAssignment),
        lastActivity: realTimeStatus.lastProcessedAssignment
      },
      keyMetrics: {
        totalAssignments: assignmentPatterns.totalAssignments,
        successRate: assignmentPatterns.successRate,
        activeBookings: realTimeStatus.activeAssignments,
        poolBacklog: realTimeStatus.poolBacklog
      },
      currentLoad: {
        systemLoad: realTimeStatus.systemLoad,
        poolEntries: poolStatus.totalPoolEntries,
        upcomingDeadlines: realTimeStatus.upcomingDeadlines,
        criticalAlerts: realTimeStatus.criticalAlerts
      }
    };
  }
  
  /**
   * Build performance dashboard section
   */
  private buildPerformanceDashboard(
    performanceMetrics: {
      averageProcessingTime: number;
      maxProcessingTime: number;
      averageConflictRate: number;
    },
    assignmentPatterns: {
      totalAssignments: number;
      successRate: number;
      escalationRate: number;
      drOverrideRate: number;
      interpreterWorkload: Record<string, number>;
    }
  ): PerformanceDashboard {
    return {
      processingTimes: {
        average: performanceMetrics.averageProcessingTime,
        maximum: performanceMetrics.maxProcessingTime,
        trend: this.calculateProcessingTrend(performanceMetrics.averageProcessingTime)
      },
      throughput: {
        assignmentsPerHour: this.calculateThroughput(assignmentPatterns),
        successRate: assignmentPatterns.successRate,
        escalationRate: assignmentPatterns.escalationRate
      },
      conflicts: {
        averageRate: performanceMetrics.averageConflictRate,
        trend: this.calculateConflictTrend(performanceMetrics.averageConflictRate)
      },
      efficiency: {
        overallScore: this.calculateEfficiencyScore(assignmentPatterns, performanceMetrics),
        bottlenecks: this.identifyBottlenecks(assignmentPatterns, performanceMetrics)
      }
    };
  }
  
  /**
   * Build health dashboard section
   */
  private buildHealthDashboard(
    healthAnalysis: {
      overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
      metrics: {
        successRate: number;
        escalationRate: number;
        averageProcessingTime: number;
        conflictRate: number;
        drOverrideRate: number;
      };
      trends: {
        processingTimesTrend: string;
        conflictsTrend: string;
        successRateTrend: string;
      };
      alerts: Array<{
        type: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        message: string;
        timestamp: Date;
      }>;
      recommendations: string[];
    },
    realTimeStatus: {
      status: string;
      upcomingDeadlines: number;
    }
  ): HealthDashboard {
    return {
      overallHealth: healthAnalysis.overallHealth,
      healthScore: this.calculateHealthScore(healthAnalysis.metrics),
      systemVitals: {
        availability: realTimeStatus.status === 'OPERATIONAL' ? 100 : 
                     realTimeStatus.status === 'DEGRADED' ? 75 : 0,
        performance: this.calculatePerformanceScore(healthAnalysis.metrics),
        reliability: this.calculateReliabilityScore(healthAnalysis.metrics)
      },
      trends: healthAnalysis.trends,
      criticalIssues: this.identifyCriticalIssues(healthAnalysis)
    };
  }
  
  /**
   * Build trends dashboard section
   */
  private buildTrendsDashboard(
    assignmentPatterns: { totalAssignments: number; successRate: number; interpreterWorkload: Record<string, number> },
    conflictStats: { averageConflictsPerCheck: number; totalConflictChecks: number },
    timeRangeDays: number
  ): TrendsDashboard {
    return {
      timeRange: {
        days: timeRangeDays,
        startDate: new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      assignmentTrends: {
        volume: this.calculateVolumeTrend(assignmentPatterns),
        successRate: this.calculateSuccessTrend(assignmentPatterns),
        processingTime: 'STABLE' // Would need historical data for real trends
      },
      conflictTrends: {
        frequency: this.calculateConflictFrequencyTrend(conflictStats),
        resolution: this.calculateConflictResolutionTrend(conflictStats)
      },
      workloadDistribution: {
        fairness: this.calculateFairnessTrend(assignmentPatterns.interpreterWorkload),
        balance: this.calculateWorkloadBalance(assignmentPatterns.interpreterWorkload)
      }
    };
  }
  
  /**
   * Build alerts dashboard section
   */
  private buildAlertsDashboard(
    healthAlerts: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      message: string;
      timestamp: Date;
    }>,
    realTimeStatus: {
      status: string;
      upcomingDeadlines: number;
    }
  ): AlertsDashboard {
    const alerts = [...healthAlerts];
    
    // Add real-time alerts
    if (realTimeStatus.status === 'DEGRADED') {
      alerts.push({
        type: 'SYSTEM_DEGRADED',
        severity: 'MEDIUM' as const,
        message: 'System performance is degraded',
        timestamp: new Date()
      });
    }
    
    if (realTimeStatus.status === 'DOWN') {
      alerts.push({
        type: 'SYSTEM_DOWN',
        severity: 'HIGH' as const,
        message: 'System is not operational',
        timestamp: new Date()
      });
    }
    
    if (realTimeStatus.upcomingDeadlines > 10) {
      alerts.push({
        type: 'HIGH_DEADLINE_PRESSURE',
        severity: 'MEDIUM' as const,
        message: `${realTimeStatus.upcomingDeadlines} bookings approaching deadline`,
        timestamp: new Date()
      });
    }
    
    return {
      active: alerts.filter(alert => alert.severity === 'HIGH'),
      warnings: alerts.filter(alert => alert.severity === 'MEDIUM'),
      info: alerts.filter(alert => alert.severity === 'LOW'),
      summary: {
        total: alerts.length,
        critical: alerts.filter(alert => alert.severity === 'HIGH').length,
        warnings: alerts.filter(alert => alert.severity === 'MEDIUM').length,
        lastAlert: alerts.length > 0 ? alerts[alerts.length - 1].timestamp : undefined
      }
    };
  }
  
  /**
   * Calculate system uptime
   */
  private calculateUptime(lastActivity?: Date): string {
    if (!lastActivity) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }
  
  /**
   * Calculate processing trend
   */
  private calculateProcessingTrend(averageTime: number): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    // Simplified trend calculation - would need historical data for real implementation
    if (averageTime < 1000) return 'IMPROVING';
    if (averageTime > 3000) return 'DEGRADING';
    return 'STABLE';
  }
  
  /**
   * Calculate conflict trend
   */
  private calculateConflictTrend(conflictRate: number): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    if (conflictRate < 0.2) return 'IMPROVING';
    if (conflictRate > 0.6) return 'DEGRADING';
    return 'STABLE';
  }
  
  /**
   * Calculate throughput
   */
  private calculateThroughput(assignmentPatterns: { totalAssignments: number }): number {
    // Simplified calculation - assignments per hour over the analysis period
    return Math.round(assignmentPatterns.totalAssignments / (7 * 24)); // Assuming 7-day period
  }
  
  /**
   * Calculate efficiency score
   */
  private calculateEfficiencyScore(assignmentPatterns: { successRate: number; escalationRate: number; drOverrideRate: number }, performanceMetrics: { averageProcessingTime: number; averageConflictRate: number }): number {
    const successWeight = 0.4;
    const speedWeight = 0.3;
    const conflictWeight = 0.3;
    
    const successScore = assignmentPatterns.successRate;
    const speedScore = Math.max(0, 1 - (performanceMetrics.averageProcessingTime / 5000)); // Normalize to 5s max
    const conflictScore = Math.max(0, 1 - performanceMetrics.averageConflictRate);
    
    return Math.round((successScore * successWeight + speedScore * speedWeight + conflictScore * conflictWeight) * 100);
  }
  
  /**
   * Identify system bottlenecks
   */
  private identifyBottlenecks(assignmentPatterns: { escalationRate: number; drOverrideRate: number }, performanceMetrics: { averageProcessingTime: number; averageConflictRate: number }): string[] {
    const bottlenecks = [];
    
    if (performanceMetrics.averageProcessingTime > 3000) {
      bottlenecks.push('Slow processing times');
    }
    
    if (performanceMetrics.averageConflictRate > 0.5) {
      bottlenecks.push('High conflict resolution overhead');
    }
    
    if (assignmentPatterns.escalationRate > 0.3) {
      bottlenecks.push('High escalation rate');
    }
    
    if (assignmentPatterns.drOverrideRate > 0.2) {
      bottlenecks.push('Frequent DR policy overrides');
    }
    
    return bottlenecks;
  }
  
  /**
   * Calculate health score
   */
  private calculateHealthScore(metrics: { successRate: number; escalationRate: number; averageProcessingTime: number; conflictRate: number; drOverrideRate: number }): number {
    const weights = {
      successRate: 0.3,
      escalationRate: 0.2,
      processingTime: 0.2,
      conflictRate: 0.15,
      drOverrideRate: 0.15
    };
    
    let score = 0;
    score += metrics.successRate * weights.successRate;
    score += Math.max(0, 1 - metrics.escalationRate) * weights.escalationRate;
    score += Math.max(0, 1 - (metrics.averageProcessingTime / 5000)) * weights.processingTime;
    score += Math.max(0, 1 - metrics.conflictRate) * weights.conflictRate;
    score += Math.max(0, 1 - Math.abs(metrics.drOverrideRate - 0.1) / 0.4) * weights.drOverrideRate;
    
    return Math.round(score * 100);
  }
  
  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(metrics: { averageProcessingTime: number; conflictRate: number }): number {
    const processingScore = Math.max(0, 1 - (metrics.averageProcessingTime / 5000));
    const conflictScore = Math.max(0, 1 - metrics.conflictRate);
    
    return Math.round((processingScore * 0.6 + conflictScore * 0.4) * 100);
  }
  
  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(metrics: { successRate: number; escalationRate: number }): number {
    const successScore = metrics.successRate;
    const escalationScore = Math.max(0, 1 - metrics.escalationRate);
    
    return Math.round((successScore * 0.7 + escalationScore * 0.3) * 100);
  }
  
  /**
   * Identify critical issues
   */
  private identifyCriticalIssues(healthAnalysis: { overallHealth: string; metrics: { successRate: number; escalationRate: number; averageProcessingTime: number } }): string[] {
    const issues = [];
    
    if (healthAnalysis.overallHealth === 'CRITICAL') {
      issues.push('System health is critical');
    }
    
    if (healthAnalysis.metrics.successRate < 0.5) {
      issues.push('Very low success rate');
    }
    
    if (healthAnalysis.metrics.escalationRate > 0.5) {
      issues.push('Very high escalation rate');
    }
    
    if (healthAnalysis.metrics.averageProcessingTime > 10000) {
      issues.push('Extremely slow processing');
    }
    
    return issues;
  }
  
  /**
   * Calculate volume trend
   */
  private calculateVolumeTrend(assignmentPatterns: { totalAssignments: number }): 'INCREASING' | 'STABLE' | 'DECREASING' {
    // Simplified - would need historical comparison
    if (assignmentPatterns.totalAssignments > 100) return 'INCREASING';
    if (assignmentPatterns.totalAssignments < 20) return 'DECREASING';
    return 'STABLE';
  }
  
  /**
   * Calculate success trend
   */
  private calculateSuccessTrend(assignmentPatterns: { successRate: number }): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    if (assignmentPatterns.successRate > 0.9) return 'IMPROVING';
    if (assignmentPatterns.successRate < 0.7) return 'DECLINING';
    return 'STABLE';
  }
  
  /**
   * Calculate conflict frequency trend
   */
  private calculateConflictFrequencyTrend(conflictStats: { averageConflictsPerCheck: number }): 'IMPROVING' | 'STABLE' | 'WORSENING' {
    if (conflictStats.averageConflictsPerCheck < 0.2) return 'IMPROVING';
    if (conflictStats.averageConflictsPerCheck > 0.6) return 'WORSENING';
    return 'STABLE';
  }
  
  /**
   * Calculate conflict resolution trend
   */
  private calculateConflictResolutionTrend(conflictStats: { totalConflictChecks: number; averageConflictsPerCheck: number }): 'IMPROVING' | 'STABLE' | 'WORSENING' {
    // Simplified - based on total conflict checks vs conflicts found
    const resolutionRate = conflictStats.totalConflictChecks > 0 
      ? 1 - (conflictStats.averageConflictsPerCheck)
      : 1;
    
    if (resolutionRate > 0.8) return 'IMPROVING';
    if (resolutionRate < 0.5) return 'WORSENING';
    return 'STABLE';
  }
  
  /**
   * Calculate fairness trend
   */
  private calculateFairnessTrend(interpreterWorkload: Record<string, number>): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    const workloads = Object.values(interpreterWorkload);
    if (workloads.length === 0) return 'STABLE';
    
    const max = Math.max(...workloads);
    const min = Math.min(...workloads);
    const gap = max - min;
    
    if (gap <= 2) return 'IMPROVING';
    if (gap > 5) return 'DECLINING';
    return 'STABLE';
  }
  
  /**
   * Calculate workload balance
   */
  private calculateWorkloadBalance(interpreterWorkload: Record<string, number>): number {
    const workloads = Object.values(interpreterWorkload);
    if (workloads.length === 0) return 100;
    
    const max = Math.max(...workloads);
    const min = Math.min(...workloads);
    const avg = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    
    if (avg === 0) return 100;
    
    const balance = 1 - ((max - min) / (2 * avg));
    return Math.max(0, Math.round(balance * 100));
  }
}

// Dashboard data interfaces
export interface DashboardOverview {
  systemStatus: {
    status: string;
    uptime: string;
    lastActivity?: Date;
  };
  keyMetrics: {
    totalAssignments: number;
    successRate: number;
    activeBookings: number;
    poolBacklog: number;
  };
  currentLoad: {
    systemLoad: string;
    poolEntries: number;
    upcomingDeadlines: number;
    criticalAlerts: number;
  };
}

export interface PerformanceDashboard {
  processingTimes: {
    average: number;
    maximum: number;
    trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
  throughput: {
    assignmentsPerHour: number;
    successRate: number;
    escalationRate: number;
  };
  conflicts: {
    averageRate: number;
    trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
  efficiency: {
    overallScore: number;
    bottlenecks: string[];
  };
}

export interface HealthDashboard {
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthScore: number;
  systemVitals: {
    availability: number;
    performance: number;
    reliability: number;
  };
  trends: {
    processingTimesTrend: string;
    conflictsTrend: string;
    successRateTrend: string;
  };
  criticalIssues: string[];
}

export interface TrendsDashboard {
  timeRange: {
    days: number;
    startDate: Date;
    endDate: Date;
  };
  assignmentTrends: {
    volume: 'INCREASING' | 'STABLE' | 'DECREASING';
    successRate: 'IMPROVING' | 'STABLE' | 'DECLINING';
    processingTime: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
  conflictTrends: {
    frequency: 'IMPROVING' | 'STABLE' | 'WORSENING';
    resolution: 'IMPROVING' | 'STABLE' | 'WORSENING';
  };
  workloadDistribution: {
    fairness: 'IMPROVING' | 'STABLE' | 'DECLINING';
    balance: number;
  };
}

export interface AlertsDashboard {
  active: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: Date;
  }>;
  warnings: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: Date;
  }>;
  info: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: Date;
  }>;
  summary: {
    total: number;
    critical: number;
    warnings: number;
    lastAlert?: Date;
  };
}

/**
 * Convenience function to get dashboard instance
 */
export function getMonitoringDashboard(): MonitoringDashboard {
  return MonitoringDashboard.getInstance();
}