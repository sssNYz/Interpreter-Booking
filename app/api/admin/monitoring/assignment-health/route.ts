import { NextRequest, NextResponse } from 'next/server';
import { getAssignmentMonitor } from '@/lib/assignment/logging/monitoring';

/**
 * GET /api/admin/monitoring/assignment-health
 * Get comprehensive assignment system health analysis
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    // Validate days parameter
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Days parameter must be between 1 and 90' },
        { status: 400 }
      );
    }
    
    const monitor = getAssignmentMonitor();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get comprehensive health analysis
    const healthAnalysis = await monitor.analyzeSystemHealth(startDate, endDate);
    
    // Get current real-time status
    const realTimeStatus = await monitor.getRealTimeStatus();
    
    // Get current performance metrics
    const performanceMetrics = monitor.getPerformanceMetrics();
    
    // Get pool status
    const poolStatus = await monitor.getPoolStatus();
    
    const response = {
      timeRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days
      },
      overallHealth: healthAnalysis.overallHealth,
      realTimeStatus,
      performanceMetrics,
      poolStatus,
      healthMetrics: healthAnalysis.metrics,
      trends: healthAnalysis.trends,
      recommendations: healthAnalysis.recommendations,
      alerts: healthAnalysis.alerts,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error getting assignment health:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get assignment health data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/monitoring/assignment-health
 * Trigger manual health check and analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      days = 7,
      includeDetailedAnalysis = true,
      generateRecommendations = true 
    } = body;
    
    // Validate parameters
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Days parameter must be between 1 and 90' },
        { status: 400 }
      );
    }
    
    const monitor = getAssignmentMonitor();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Perform comprehensive analysis
    const healthAnalysis = await monitor.analyzeSystemHealth(startDate, endDate);
    
    // Get additional detailed analysis if requested
    let detailedAnalysis = null;
    if (includeDetailedAnalysis) {
      const { LogAnalyzer } = await import('@/lib/assignment/logging/logging');
      
      const [assignmentPatterns, conflictStats] = await Promise.all([
        LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate),
        LogAnalyzer.getConflictStatistics(startDate, endDate)
      ]);
      
      detailedAnalysis = {
        assignmentPatterns,
        conflictStats
      };
    }
    
    const response = {
      healthCheck: {
        timestamp: new Date().toISOString(),
        timeRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days
        },
        overallHealth: healthAnalysis.overallHealth,
        metrics: healthAnalysis.metrics,
        trends: healthAnalysis.trends,
        recommendations: generateRecommendations ? healthAnalysis.recommendations : [],
        alerts: healthAnalysis.alerts
      },
      detailedAnalysis,
      status: 'completed'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error performing manual health check:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform health check',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}