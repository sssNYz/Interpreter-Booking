import { NextRequest, NextResponse } from "next/server";
import { getPoolMonitor } from "@/lib/assignment/pool/pool-monitoring";
import { getPoolHistoryTracker } from "@/lib/assignment/pool/pool-history-tracker";

/**
 * GET /api/admin/pool/alerts
 * Get pool-related alerts and notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity'); // 'CRITICAL', 'WARNING', 'INFO'
    const type = searchParams.get('type'); // Alert type filter
    const includeHistory = searchParams.get('includeHistory') === 'true';

    console.log(`🚨 Getting pool alerts... severity: ${severity}, type: ${type}, includeHistory: ${includeHistory}`);

    const poolMonitor = getPoolMonitor();
    const alerts = await poolMonitor.getPoolAlerts();

    // Filter alerts by severity if specified
    let filteredAlerts = alerts;
    if (severity) {
      const severityUpper = severity.toUpperCase();
      filteredAlerts = {
        ...alerts,
        active: severityUpper === 'CRITICAL' ? alerts.active : [],
        warnings: severityUpper === 'WARNING' ? alerts.warnings : [],
        info: severityUpper === 'INFO' ? alerts.info : []
      };
    }

    // Filter by type if specified
    if (type) {
      const typeUpper = type.toUpperCase();
      filteredAlerts = {
        ...filteredAlerts,
        active: filteredAlerts.active.filter(alert => alert.type === typeUpper),
        warnings: filteredAlerts.warnings.filter(alert => alert.type === typeUpper),
        info: filteredAlerts.info.filter(alert => alert.type === typeUpper)
      };
    }

    // Get alert history if requested
    let alertHistory = [];
    if (includeHistory) {
      const historyTracker = getPoolHistoryTracker();
      const recentEvents = await historyTracker.getRecentSystemEvents(50);
      
      alertHistory = recentEvents
        .filter(event => 
          event.action === 'SYSTEM_EVENT' && 
          event.systemState?.eventType && 
          ['HEALTH_CHECK', 'EMERGENCY_PROCESSING'].includes(event.systemState.eventType)
        )
        .map(event => ({
          id: event.id,
          type: event.systemState.eventType,
          message: event.systemState.details,
          timestamp: event.timestamp.toISOString(),
          systemState: event.systemState
        }));
    }

    // Generate alert recommendations
    const recommendations = generateAlertRecommendations(filteredAlerts);

    // Calculate alert trends
    const trends = await calculateAlertTrends();

    const response = {
      timestamp: new Date().toISOString(),
      filters: {
        severity,
        type,
        includeHistory
      },
      alerts: {
        active: filteredAlerts.active.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        warnings: filteredAlerts.warnings.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        info: filteredAlerts.info.map(alert => ({
          ...alert,
          timestamp: alert.timestamp.toISOString()
        })),
        summary: {
          ...filteredAlerts.summary,
          lastAlert: filteredAlerts.summary.lastAlert?.toISOString() || null
        }
      },
      history: alertHistory,
      recommendations,
      trends,
      actions: {
        available: [
          'acknowledge',
          'resolve',
          'escalate',
          'snooze'
        ],
        emergency: [
          'emergency_processing',
          'corruption_cleanup',
          'scheduler_restart'
        ]
      }
    };

    console.log(`✅ Pool alerts retrieved: ${filteredAlerts.summary.total} total, ${filteredAlerts.summary.critical} critical`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting pool alerts:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get pool alerts",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool/alerts
 * Perform alert actions (acknowledge, resolve, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      alertId,
      alertType,
      reason,
      options = {}
    } = body;

    console.log(`🚨 Performing alert action: ${action} for ${alertId || alertType}`);

    const historyTracker = getPoolHistoryTracker();

    switch (action) {
      case 'acknowledge':
        // Acknowledge an alert
        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Alert acknowledged: ${alertType || alertId}`,
          {
            action: 'acknowledge',
            alertId,
            alertType,
            reason,
            acknowledgedBy: 'admin', // Would get from auth context
            acknowledgedAt: new Date().toISOString()
          }
        );

        return NextResponse.json({
          status: 'acknowledged',
          alertId,
          alertType,
          timestamp: new Date().toISOString()
        });

      case 'resolve':
        // Mark alert as resolved
        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Alert resolved: ${alertType || alertId}`,
          {
            action: 'resolve',
            alertId,
            alertType,
            reason,
            resolvedBy: 'admin',
            resolvedAt: new Date().toISOString()
          }
        );

        return NextResponse.json({
          status: 'resolved',
          alertId,
          alertType,
          timestamp: new Date().toISOString()
        });

      case 'escalate':
        // Escalate alert
        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Alert escalated: ${alertType || alertId}`,
          {
            action: 'escalate',
            alertId,
            alertType,
            reason,
            escalatedBy: 'admin',
            escalatedAt: new Date().toISOString(),
            escalationLevel: options.level || 'high'
          }
        );

        return NextResponse.json({
          status: 'escalated',
          alertId,
          alertType,
          escalationLevel: options.level || 'high',
          timestamp: new Date().toISOString()
        });

      case 'snooze':
        // Snooze alert for specified duration
        const snoozeDuration = options.duration || 3600000; // Default 1 hour
        const snoozeUntil = new Date(Date.now() + snoozeDuration);

        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Alert snoozed: ${alertType || alertId}`,
          {
            action: 'snooze',
            alertId,
            alertType,
            reason,
            snoozedBy: 'admin',
            snoozedAt: new Date().toISOString(),
            snoozeUntil: snoozeUntil.toISOString(),
            duration: snoozeDuration
          }
        );

        return NextResponse.json({
          status: 'snoozed',
          alertId,
          alertType,
          snoozeUntil: snoozeUntil.toISOString(),
          timestamp: new Date().toISOString()
        });

      case 'create_notification':
        // Create a custom notification
        await historyTracker.trackSystemEvent(
          'HEALTH_CHECK',
          `Custom notification created: ${options.message}`,
          {
            action: 'create_notification',
            message: options.message,
            severity: options.severity || 'INFO',
            createdBy: 'admin',
            createdAt: new Date().toISOString()
          }
        );

        return NextResponse.json({
          status: 'notification_created',
          message: options.message,
          severity: options.severity || 'INFO',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: `Unknown alert action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("❌ Error performing alert action:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to perform alert action",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations based on current alerts
 */
function generateAlertRecommendations(alerts: any): Array<{
  category: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  description: string;
  automated: boolean;
}> {
  const recommendations = [];

  // Critical alert recommendations
  if (alerts.active.length > 0) {
    recommendations.push({
      category: 'critical-alerts',
      priority: 'high' as const,
      action: 'immediate_attention',
      description: `${alerts.active.length} critical alerts require immediate attention`,
      automated: false
    });

    // Specific recommendations based on alert types
    const deadlineAlerts = alerts.active.filter((alert: any) => alert.type === 'DEADLINE_ENTRIES');
    if (deadlineAlerts.length > 0) {
      recommendations.push({
        category: 'deadline-processing',
        priority: 'high' as const,
        action: 'emergency_processing',
        description: 'Run emergency processing for deadline entries',
        automated: true
      });
    }

    const corruptedAlerts = alerts.active.filter((alert: any) => alert.type === 'CORRUPTED_ENTRIES');
    if (corruptedAlerts.length > 0) {
      recommendations.push({
        category: 'corruption-cleanup',
        priority: 'high' as const,
        action: 'corruption_cleanup',
        description: 'Run corruption cleanup for affected entries',
        automated: true
      });
    }
  }

  // Warning alert recommendations
  if (alerts.warnings.length > 0) {
    const highFailureAlerts = alerts.warnings.filter((alert: any) => alert.type === 'HIGH_FAILURE_RATE');
    if (highFailureAlerts.length > 0) {
      recommendations.push({
        category: 'failure-rate',
        priority: 'medium' as const,
        action: 'review_configuration',
        description: 'Review error recovery configuration and system health',
        automated: false
      });
    }

    const largPoolAlerts = alerts.warnings.filter((alert: any) => alert.type === 'LARGE_POOL_SIZE');
    if (largPoolAlerts.length > 0) {
      recommendations.push({
        category: 'pool-size',
        priority: 'medium' as const,
        action: 'mode_switch',
        description: 'Consider switching to Urgent mode or increasing processing frequency',
        automated: true
      });
    }
  }

  // General recommendations
  if (alerts.summary.total === 0) {
    recommendations.push({
      category: 'monitoring',
      priority: 'low' as const,
      action: 'continue_monitoring',
      description: 'No alerts detected - continue normal monitoring',
      automated: false
    });
  }

  return recommendations;
}

/**
 * Calculate alert trends over time
 */
async function calculateAlertTrends(): Promise<{
  daily: {
    critical: number;
    warnings: number;
    total: number;
  };
  weekly: {
    critical: number;
    warnings: number;
    total: number;
  };
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}> {
  try {
    const historyTracker = getPoolHistoryTracker();
    const errorSummary = await historyTracker.getErrorSummary(7);

    // Simplified trend calculation - would need more historical data for accurate trends
    const dailyErrors = Math.round(errorSummary.totalErrors / 7);
    const weeklyErrors = errorSummary.totalErrors;

    // Estimate critical vs warning distribution
    const criticalRatio = 0.2; // Assume 20% of errors are critical
    const warningRatio = 0.6;  // Assume 60% are warnings

    return {
      daily: {
        critical: Math.round(dailyErrors * criticalRatio),
        warnings: Math.round(dailyErrors * warningRatio),
        total: dailyErrors
      },
      weekly: {
        critical: Math.round(weeklyErrors * criticalRatio),
        warnings: Math.round(weeklyErrors * warningRatio),
        total: weeklyErrors
      },
      trend: weeklyErrors > 20 ? 'INCREASING' : weeklyErrors < 5 ? 'DECREASING' : 'STABLE'
    };
  } catch (error) {
    console.error("❌ Error calculating alert trends:", error);
    return {
      daily: { critical: 0, warnings: 0, total: 0 },
      weekly: { critical: 0, warnings: 0, total: 0 },
      trend: 'STABLE'
    };
  }
}