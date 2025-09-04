import { NextRequest, NextResponse } from 'next/server';
import { getAssignmentMonitor } from '@/lib/assignment/logging/monitoring';

/**
 * GET /api/admin/monitoring/performance
 * Get real-time performance metrics and system status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyDays = parseInt(searchParams.get('historyDays') || '1');
    
    const monitor = getAssignmentMonitor();
    
    // Get current performance metrics
    const performanceMetrics = monitor.getPerformanceMetrics();
    
    // Get real-time status
    const realTimeStatus = await monitor.getRealTimeStatus();
    
    // Get pool status
    const poolStatus = await monitor.getPoolStatus();
    
    let historicalData = null;
    if (includeHistory) {
      try {
        const { LogAnalyzer } = await import('@/lib/assignment/logging/logging');
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - historyDays);
        
        const [assignmentPatterns, conflictStats] = await Promise.all([
          LogAnalyzer.analyzeAssignmentPatterns(startDate, startDate),
          LogAnalyzer.getConflictStatistics(startDate, endDate)
        ]);
        
        historicalData = {
          timeRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            days: historyDays
          },
          assignmentPatterns,
          conflictStats
        };
      } catch (error) {
        console.warn('⚠️ Could not load historical data:', error);
        historicalData = { error: 'Historical data unavailable' };
      }
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      performance: {
        current: performanceMetrics,
        realTime: realTimeStatus,
        pool: poolStatus
      },
      historical: historicalData,
      systemHealth: {
        status: realTimeStatus.status,
        load: performanceMetrics.currentSystemLoad,
        alerts: realTimeStatus.criticalAlerts,
        uptime: {
          lastProcessedAssignment: realTimeStatus.lastProcessedAssignment,
          activeAssignments: realTimeStatus.activeAssignments
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error getting performance metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/monitoring/performance
 * Record custom performance metrics or trigger performance analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    const monitor = getAssignmentMonitor();
    
    switch (action) {
      case 'recordProcessingTime':
        if (!data.bookingId || !data.processingTimeMs) {
          return NextResponse.json(
            { error: 'Missing required fields: bookingId, processingTimeMs' },
            { status: 400 }
          );
        }
        
        monitor.recordProcessingTime(data.bookingId, data.processingTimeMs);
        
        return NextResponse.json({
          status: 'recorded',
          message: `Processing time recorded for booking ${data.bookingId}`,
          timestamp: new Date().toISOString()
        });
        
      case 'recordConflictStats':
        if (data.totalChecked === undefined || data.conflicted === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields: totalChecked, conflicted' },
            { status: 400 }
          );
        }
        
        monitor.recordConflictStats(data.totalChecked, data.conflicted);
        
        return NextResponse.json({
          status: 'recorded',
          message: `Conflict stats recorded: ${data.conflicted}/${data.totalChecked}`,
          timestamp: new Date().toISOString()
        });
        
      case 'getDetailedMetrics':
        const detailedMetrics = {
          performance: monitor.getPerformanceMetrics(),
          realTime: await monitor.getRealTimeStatus(),
          pool: await monitor.getPoolStatus()
        };
        
        return NextResponse.json({
          status: 'success',
          metrics: detailedMetrics,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('❌ Error in performance monitoring action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform monitoring action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}