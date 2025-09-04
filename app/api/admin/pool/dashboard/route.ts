import { NextRequest, NextResponse } from "next/server";
import { getPoolMonitor } from "@/lib/assignment/pool/pool-monitoring";

/**
 * GET /api/admin/pool/dashboard
 * Get comprehensive pool monitoring dashboard
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📊 Getting pool monitoring dashboard...");

    const poolMonitor = getPoolMonitor();
    const dashboard = await poolMonitor.getPoolStatusDashboard();

    const response = {
      ...dashboard,
      timestamp: dashboard.timestamp.toISOString(),
      poolStats: {
        ...dashboard.poolStats,
        oldestEntry: dashboard.poolStats.oldestEntry?.toISOString() || null
      },
      processingStatus: {
        ...dashboard.processingStatus,
        lastProcessingTime: dashboard.processingStatus.lastProcessingTime?.toISOString() || null,
        nextProcessingTime: dashboard.processingStatus.nextProcessingTime?.toISOString() || null,
        recentErrors: dashboard.processingStatus.recentErrors.map(error => ({
          ...error,
          timestamp: error.timestamp.toISOString()
        }))
      },
      entriesBreakdown: {
        ...dashboard.entriesBreakdown,
        deadline: {
          ...dashboard.entriesBreakdown.deadline,
          entries: dashboard.entriesBreakdown.deadline.entries.map(entry => ({
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime.toISOString(),
            poolEntryTime: entry.poolEntryTime.toISOString(),
            deadlineTime: entry.deadlineTime.toISOString(),
            lastProcessingAttempt: entry.lastProcessingAttempt?.toISOString() || null,
            processingErrors: entry.processingErrors.map(error => ({
              ...error,
              timestamp: error.timestamp.toISOString()
            }))
          }))
        },
        ready: {
          ...dashboard.entriesBreakdown.ready,
          entries: dashboard.entriesBreakdown.ready.entries.map(entry => ({
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime.toISOString(),
            poolEntryTime: entry.poolEntryTime.toISOString(),
            deadlineTime: entry.deadlineTime.toISOString(),
            lastProcessingAttempt: entry.lastProcessingAttempt?.toISOString() || null,
            processingErrors: entry.processingErrors.map(error => ({
              ...error,
              timestamp: error.timestamp.toISOString()
            }))
          }))
        },
        pending: {
          ...dashboard.entriesBreakdown.pending,
          entries: dashboard.entriesBreakdown.pending.entries.map(entry => ({
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime.toISOString(),
            poolEntryTime: entry.poolEntryTime.toISOString(),
            deadlineTime: entry.deadlineTime.toISOString(),
            lastProcessingAttempt: entry.lastProcessingAttempt?.toISOString() || null,
            processingErrors: entry.processingErrors.map(error => ({
              ...error,
              timestamp: error.timestamp.toISOString()
            }))
          }))
        },
        failed: {
          ...dashboard.entriesBreakdown.failed,
          entries: dashboard.entriesBreakdown.failed.entries.map(entry => ({
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime.toISOString(),
            poolEntryTime: entry.poolEntryTime.toISOString(),
            deadlineTime: entry.deadlineTime.toISOString(),
            lastProcessingAttempt: entry.lastProcessingAttempt?.toISOString() || null,
            processingErrors: entry.processingErrors.map(error => ({
              ...error,
              timestamp: error.timestamp.toISOString()
            }))
          }))
        },
        corrupted: {
          ...dashboard.entriesBreakdown.corrupted,
          entries: dashboard.entriesBreakdown.corrupted.entries.map(entry => ({
            ...entry,
            startTime: entry.startTime.toISOString(),
            endTime: entry.endTime.toISOString(),
            poolEntryTime: entry.poolEntryTime.toISOString(),
            deadlineTime: entry.deadlineTime.toISOString(),
            lastProcessingAttempt: entry.lastProcessingAttempt?.toISOString() || null,
            processingErrors: entry.processingErrors.map(error => ({
              ...error,
              timestamp: error.timestamp.toISOString()
            }))
          }))
        }
      },
      processingHistory: dashboard.processingHistory.map(entry => ({
        ...entry,
        startTime: entry.startTime.toISOString(),
        endTime: entry.endTime.toISOString(),
        errors: entry.errors.map(error => ({
          ...error,
          timestamp: error.timestamp.toISOString()
        }))
      })),
      diagnostics: {
        ...dashboard.diagnostics,
        healthCheck: {
          ...dashboard.diagnostics.healthCheck,
          timestamp: dashboard.diagnostics.healthCheck.timestamp.toISOString()
        },
        systemState: {
          ...dashboard.diagnostics.systemState,
          lastSystemRestart: dashboard.diagnostics.systemState.lastSystemRestart.toISOString()
        }
      },
      alerts: {
        ...dashboard.alerts,
        active: dashboard.alerts.active.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        warnings: dashboard.alerts.warnings.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        info: dashboard.alerts.info.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        summary: {
          ...dashboard.alerts.summary,
          lastAlert: dashboard.alerts.summary.lastAlert?.toISOString() || null
        }
      }
    };

    console.log(`✅ Pool dashboard retrieved: ${dashboard.poolStats.totalEntries} total entries, ${dashboard.alerts.active.length} active alerts`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting pool dashboard:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get pool dashboard",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool/dashboard
 * Perform dashboard actions (refresh, export, analyze)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'refresh', options = {} } = body;

    const poolMonitor = getPoolMonitor();

    switch (action) {
      case 'refresh':
        // Force refresh of dashboard data
        const refreshedDashboard = await poolMonitor.getPoolStatusDashboard();
        
        return NextResponse.json({
          status: 'refreshed',
          data: refreshedDashboard,
          timestamp: new Date().toISOString()
        });

      case 'export':
        // Export dashboard data
        const exportFormat = options.format || 'json';
        const exportDashboard = await poolMonitor.getPoolStatusDashboard();

        if (exportFormat === 'csv') {
          const csvData = convertDashboardToCSV(exportDashboard);
          
          return new NextResponse(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="pool-dashboard-${new Date().toISOString().split('T')[0]}.csv"`
            }
          });
        }

        return NextResponse.json({
          status: 'exported',
          format: exportFormat,
          data: exportDashboard,
          timestamp: new Date().toISOString()
        });

      case 'analyze':
        // Perform detailed analysis
        const analysisDashboard = await poolMonitor.getPoolStatusDashboard();
        const insights = generateDashboardInsights(analysisDashboard);

        return NextResponse.json({
          status: 'analyzed',
          analysis: analysisDashboard,
          insights,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("❌ Error in pool dashboard action:", error);
    return NextResponse.json(
      {
        error: 'Failed to perform dashboard action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Convert dashboard data to CSV format
 */
function convertDashboardToCSV(dashboard: any): string {
  const sections = [];

  // Pool Statistics
  sections.push('POOL STATISTICS');
  sections.push('Total Entries,' + dashboard.poolStats.totalEntries);
  sections.push('Ready for Processing,' + dashboard.poolStats.readyForProcessing);
  sections.push('Currently Processing,' + dashboard.poolStats.currentlyProcessing);
  sections.push('Failed Entries,' + dashboard.poolStats.failedEntries);
  sections.push('Average Processing Time,' + dashboard.poolStats.averageProcessingTime + 'ms');
  sections.push('');

  // Urgency Distribution
  sections.push('URGENCY DISTRIBUTION');
  sections.push('Critical,' + dashboard.poolStats.urgencyDistribution.critical);
  sections.push('High,' + dashboard.poolStats.urgencyDistribution.high);
  sections.push('Medium,' + dashboard.poolStats.urgencyDistribution.medium);
  sections.push('Low,' + dashboard.poolStats.urgencyDistribution.low);
  sections.push('');

  // Processing Status
  sections.push('PROCESSING STATUS');
  sections.push('Is Running,' + (dashboard.processingStatus.isRunning ? 'Yes' : 'No'));
  sections.push('Needs Immediate Processing,' + (dashboard.processingStatus.needsImmediateProcessing ? 'Yes' : 'No'));
  sections.push('Processing Interval,' + dashboard.processingStatus.processingIntervalMs + 'ms');
  sections.push('');

  // Entries Breakdown
  sections.push('ENTRIES BREAKDOWN');
  sections.push('Deadline Entries,' + dashboard.entriesBreakdown.deadline.count);
  sections.push('Ready Entries,' + dashboard.entriesBreakdown.ready.count);
  sections.push('Pending Entries,' + dashboard.entriesBreakdown.pending.count);
  sections.push('Failed Entries,' + dashboard.entriesBreakdown.failed.count);
  sections.push('Corrupted Entries,' + dashboard.entriesBreakdown.corrupted.count);
  sections.push('');

  // Alerts Summary
  sections.push('ALERTS SUMMARY');
  sections.push('Total Alerts,' + dashboard.alerts.summary.total);
  sections.push('Critical Alerts,' + dashboard.alerts.summary.critical);
  sections.push('Warnings,' + dashboard.alerts.summary.warnings);
  sections.push('');

  // Recommendations
  sections.push('RECOMMENDATIONS');
  dashboard.recommendations.forEach((rec: string) => {
    sections.push(rec.replace(/[🚨📈⚠️⚡🏥🔄✅]/g, '').trim());
  });

  return sections.join('\n');
}

/**
 * Generate insights from dashboard data
 */
function generateDashboardInsights(dashboard: any): Array<{
  category: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  message: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const insights = [];

  // Pool size insights
  if (dashboard.poolStats.totalEntries > 100) {
    insights.push({
      category: 'pool-size',
      type: 'warning' as const,
      message: `Large pool size (${dashboard.poolStats.totalEntries} entries) may impact performance`,
      priority: 'medium' as const
    });
  } else if (dashboard.poolStats.totalEntries === 0) {
    insights.push({
      category: 'pool-size',
      type: 'positive' as const,
      message: 'Pool is empty - system is processing efficiently',
      priority: 'low' as const
    });
  }

  // Failure rate insights
  const failureRate = dashboard.poolStats.totalEntries > 0 
    ? dashboard.poolStats.failedEntries / dashboard.poolStats.totalEntries 
    : 0;
  
  if (failureRate > 0.2) {
    insights.push({
      category: 'failure-rate',
      type: 'critical' as const,
      message: `High failure rate (${Math.round(failureRate * 100)}%) requires immediate attention`,
      priority: 'high' as const
    });
  } else if (failureRate > 0.1) {
    insights.push({
      category: 'failure-rate',
      type: 'warning' as const,
      message: `Moderate failure rate (${Math.round(failureRate * 100)}%) should be monitored`,
      priority: 'medium' as const
    });
  }

  // Urgency insights
  if (dashboard.poolStats.urgencyDistribution.critical > 0) {
    insights.push({
      category: 'urgency',
      type: 'critical' as const,
      message: `${dashboard.poolStats.urgencyDistribution.critical} critical urgency entries need immediate processing`,
      priority: 'high' as const
    });
  }

  // Processing insights
  if (!dashboard.processingStatus.isRunning && dashboard.processingStatus.needsImmediateProcessing) {
    insights.push({
      category: 'processing',
      type: 'critical' as const,
      message: 'Processing is not running but entries need immediate processing',
      priority: 'high' as const
    });
  }

  // Health insights
  if (!dashboard.diagnostics.healthCheck.isHealthy) {
    insights.push({
      category: 'health',
      type: 'critical' as const,
      message: 'System health check failed - review issues and warnings',
      priority: 'high' as const
    });
  }

  // Stuck entries insights
  if (dashboard.diagnostics.stuckEntries.count > 0) {
    insights.push({
      category: 'stuck-entries',
      type: 'warning' as const,
      message: `${dashboard.diagnostics.stuckEntries.count} entries are stuck and need manual intervention`,
      priority: 'medium' as const
    });
  }

  return insights;
}