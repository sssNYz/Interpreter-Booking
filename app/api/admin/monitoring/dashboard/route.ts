import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringDashboard } from '@/lib/assignment/monitoring-dashboard';

/**
 * GET /api/admin/monitoring/dashboard
 * Get comprehensive monitoring dashboard data
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');
        const section = searchParams.get('section'); // optional: 'overview', 'performance', 'health', 'trends', 'alerts'

        // Validate parameters
        if (days < 1 || days > 90) {
            return NextResponse.json(
                { error: 'Days parameter must be between 1 and 90' },
                { status: 400 }
            );
        }

        const dashboard = getMonitoringDashboard();

        if (section) {
            // Return specific section only
            const fullData = await dashboard.getDashboardData(days);

            if (!(section in fullData)) {
                return NextResponse.json(
                    { error: `Unknown dashboard section: ${section}` },
                    { status: 400 }
                );
            }

            return NextResponse.json({
                section,
                data: (fullData as any)[section],
                timestamp: new Date().toISOString(),
                timeRange: {
                    days,
                    endDate: new Date().toISOString(),
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
                }
            });
        }

        // Return full dashboard data
        const dashboardData = await dashboard.getDashboardData(days);

        const response = {
            ...dashboardData,
            metadata: {
                timestamp: new Date().toISOString(),
                timeRange: {
                    days,
                    endDate: new Date().toISOString(),
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
                },
                version: '1.0.0'
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ Error getting dashboard data:', error);
        return NextResponse.json(
            {
                error: 'Failed to get dashboard data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/monitoring/dashboard
 * Refresh dashboard data or perform dashboard actions
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            action = 'refresh',
            timeRange = 7,
            options = {}
        } = body;

        const dashboard = getMonitoringDashboard();

        switch (action) {
            case 'refresh':
                // Force refresh of dashboard data
                const refreshedData = await dashboard.getDashboardData(timeRange);

                return NextResponse.json({
                    status: 'refreshed',
                    data: refreshedData,
                    timestamp: new Date().toISOString()
                });

            case 'export':
                // Export dashboard data in specified format
                const exportFormat = options.format || 'json';
                const exportData = await dashboard.getDashboardData(timeRange);

                if (exportFormat === 'csv') {
                    const csvData = convertDashboardToCSV(exportData);

                    return new NextResponse(csvData, {
                        headers: {
                            'Content-Type': 'text/csv',
                            'Content-Disposition': `attachment; filename="monitoring-dashboard-${new Date().toISOString().split('T')[0]}.csv"`
                        }
                    });
                }

                return NextResponse.json({
                    status: 'exported',
                    format: exportFormat,
                    data: exportData,
                    timestamp: new Date().toISOString()
                });

            case 'analyze':
                // Perform detailed analysis
                const analysisData = await dashboard.getDashboardData(timeRange);
                const insights = generateDashboardInsights(analysisData);

                return NextResponse.json({
                    status: 'analyzed',
                    analysis: analysisData,
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
        console.error('❌ Error in dashboard action:', error);
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
function convertDashboardToCSV(dashboardData: any): string {
    const sections = [];

    // Overview section
    sections.push('OVERVIEW');
    sections.push('System Status,' + dashboardData.overview.systemStatus.status);
    sections.push('Uptime,' + dashboardData.overview.systemStatus.uptime);
    sections.push('Total Assignments,' + dashboardData.overview.keyMetrics.totalAssignments);
    sections.push('Success Rate,' + (dashboardData.overview.keyMetrics.successRate * 100).toFixed(2) + '%');
    sections.push('Active Bookings,' + dashboardData.overview.keyMetrics.activeBookings);
    sections.push('Pool Backlog,' + dashboardData.overview.keyMetrics.poolBacklog);
    sections.push('');

    // Performance section
    sections.push('PERFORMANCE');
    sections.push('Average Processing Time,' + dashboardData.performance.processingTimes.average.toFixed(0) + 'ms');
    sections.push('Maximum Processing Time,' + dashboardData.performance.processingTimes.maximum.toFixed(0) + 'ms');
    sections.push('Processing Trend,' + dashboardData.performance.processingTimes.trend);
    sections.push('Assignments Per Hour,' + dashboardData.performance.throughput.assignmentsPerHour);
    sections.push('Conflict Rate,' + (dashboardData.performance.conflicts.averageRate * 100).toFixed(2) + '%');
    sections.push('Efficiency Score,' + dashboardData.performance.efficiency.overallScore + '%');
    sections.push('');

    // Health section
    sections.push('HEALTH');
    sections.push('Overall Health,' + dashboardData.health.overallHealth);
    sections.push('Health Score,' + dashboardData.health.healthScore + '%');
    sections.push('Availability,' + dashboardData.health.systemVitals.availability + '%');
    sections.push('Performance Score,' + dashboardData.health.systemVitals.performance + '%');
    sections.push('Reliability Score,' + dashboardData.health.systemVitals.reliability + '%');
    sections.push('');

    // Alerts section
    sections.push('ALERTS');
    sections.push('Total Alerts,' + dashboardData.alerts.summary.total);
    sections.push('Critical Alerts,' + dashboardData.alerts.summary.critical);
    sections.push('Warnings,' + dashboardData.alerts.summary.warnings);
    sections.push('');

    return sections.join('\n');
}

/**
 * Generate insights from dashboard data
 */
function generateDashboardInsights(dashboardData: any): Array<{
    category: string;
    type: 'positive' | 'warning' | 'critical' | 'info';
    message: string;
    priority: 'high' | 'medium' | 'low';
}> {
    const insights = [];

    // System status insights
    if (dashboardData.overview.systemStatus.status === 'OPERATIONAL') {
        insights.push({
            category: 'system',
            type: 'positive' as const,
            message: 'System is operating normally',
            priority: 'low' as const
        });
    } else if (dashboardData.overview.systemStatus.status === 'DEGRADED') {
        insights.push({
            category: 'system',
            type: 'warning' as const,
            message: 'System performance is degraded - investigate bottlenecks',
            priority: 'high' as const
        });
    } else {
        insights.push({
            category: 'system',
            type: 'critical' as const,
            message: 'System is down - immediate attention required',
            priority: 'high' as const
        });
    }

    // Performance insights
    if (dashboardData.performance.efficiency.overallScore > 85) {
        insights.push({
            category: 'performance',
            type: 'positive' as const,
            message: `Excellent system efficiency (${dashboardData.performance.efficiency.overallScore}%)`,
            priority: 'low' as const
        });
    } else if (dashboardData.performance.efficiency.overallScore < 60) {
        insights.push({
            category: 'performance',
            type: 'warning' as const,
            message: `Low system efficiency (${dashboardData.performance.efficiency.overallScore}%) - optimization needed`,
            priority: 'medium' as const
        });
    }

    // Health insights
    if (dashboardData.health.overallHealth === 'CRITICAL') {
        insights.push({
            category: 'health',
            type: 'critical' as const,
            message: 'System health is critical - immediate intervention required',
            priority: 'high' as const
        });
    } else if (dashboardData.health.overallHealth === 'WARNING') {
        insights.push({
            category: 'health',
            type: 'warning' as const,
            message: 'System health shows warning signs - monitor closely',
            priority: 'medium' as const
        });
    }

    // Workload insights
    if (dashboardData.trends.workloadDistribution.balance > 90) {
        insights.push({
            category: 'fairness',
            type: 'positive' as const,
            message: `Excellent workload balance (${dashboardData.trends.workloadDistribution.balance}%)`,
            priority: 'low' as const
        });
    } else if (dashboardData.trends.workloadDistribution.balance < 70) {
        insights.push({
            category: 'fairness',
            type: 'warning' as const,
            message: `Poor workload balance (${dashboardData.trends.workloadDistribution.balance}%) - review fairness settings`,
            priority: 'medium' as const
        });
    }

    // Alert insights
    if (dashboardData.alerts.summary.critical > 0) {
        insights.push({
            category: 'alerts',
            type: 'critical' as const,
            message: `${dashboardData.alerts.summary.critical} critical alerts require immediate attention`,
            priority: 'high' as const
        });
    }

    // Trend insights
    if (dashboardData.trends.assignmentTrends.successRate === 'DECLINING') {
        insights.push({
            category: 'trends',
            type: 'warning' as const,
            message: 'Assignment success rate is declining - investigate root causes',
            priority: 'medium' as const
        });
    }

    if (dashboardData.trends.conflictTrends.frequency === 'WORSENING') {
        insights.push({
            category: 'trends',
            type: 'warning' as const,
            message: 'Conflict frequency is increasing - review scheduling patterns',
            priority: 'medium' as const
        });
    }

    return insights;
}