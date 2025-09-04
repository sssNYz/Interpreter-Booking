import { NextRequest, NextResponse } from 'next/server';
import { LogAnalyzer } from '@/lib/assignment/logging/logging';

/**
 * GET /api/admin/monitoring/logs
 * Get assignment logs analysis and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const analysisType = searchParams.get('type') || 'patterns';
    const bookingId = searchParams.get('bookingId');
    const interpreterId = searchParams.get('interpreterId');
    
    // Validate parameters
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Days parameter must be between 1 and 90' },
        { status: 400 }
      );
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let analysisResult;
    
    switch (analysisType) {
      case 'patterns':
        analysisResult = await LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate);
        break;
        
      case 'conflicts':
        analysisResult = await LogAnalyzer.getConflictStatistics(startDate, endDate);
        break;
        
      case 'combined':
        const [patterns, conflicts] = await Promise.all([
          LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate),
          LogAnalyzer.getConflictStatistics(startDate, endDate)
        ]);
        
        analysisResult = {
          patterns,
          conflicts,
          summary: {
            totalAssignments: patterns.totalAssignments,
            successRate: patterns.successRate,
            conflictRate: conflicts.averageConflictsPerCheck,
            systemEfficiency: patterns.successRate * (1 - conflicts.averageConflictsPerCheck)
          }
        };
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown analysis type: ${analysisType}` },
          { status: 400 }
        );
    }
    
    const response = {
      timeRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days
      },
      analysisType,
      filters: {
        bookingId: bookingId || null,
        interpreterId: interpreterId || null
      },
      data: analysisResult,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error analyzing logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/monitoring/logs
 * Trigger custom log analysis or export logs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action,
      timeRange,
      filters = {},
      exportFormat = 'json'
    } = body;
    
    // Validate time range
    const startDate = timeRange?.startDate ? new Date(timeRange.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = timeRange?.endDate ? new Date(timeRange.endDate) : new Date();
    
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'Time range cannot exceed 90 days' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'analyze':
        const [patterns, conflicts] = await Promise.all([
          LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate),
          LogAnalyzer.getConflictStatistics(startDate, endDate)
        ]);
        
        // Generate insights based on the analysis
        const insights = generateInsights(patterns, conflicts);
        
        return NextResponse.json({
          status: 'completed',
          analysis: {
            patterns,
            conflicts,
            insights
          },
          timeRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            days: daysDiff
          },
          timestamp: new Date().toISOString()
        });
        
      case 'export':
        // For now, return analysis data in requested format
        const exportData = await LogAnalyzer.analyzeAssignmentPatterns(startDate, endDate);
        
        if (exportFormat === 'csv') {
          // Convert to CSV format (simplified)
          const csvData = convertToCSV(exportData);
          
          return new NextResponse(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="assignment-logs-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`
            }
          });
        }
        
        return NextResponse.json({
          status: 'exported',
          format: exportFormat,
          data: exportData,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('❌ Error in log analysis action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform log analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate insights from log analysis data
 */
function generateInsights(patterns: any, conflicts: any) {
  const insights = [];
  
  // Success rate insights
  if (patterns.successRate < 0.7) {
    insights.push({
      type: 'warning',
      category: 'success_rate',
      message: `Low success rate (${(patterns.successRate * 100).toFixed(1)}%). Consider reviewing assignment policies.`,
      severity: 'high'
    });
  } else if (patterns.successRate > 0.9) {
    insights.push({
      type: 'positive',
      category: 'success_rate',
      message: `Excellent success rate (${(patterns.successRate * 100).toFixed(1)}%). System is performing well.`,
      severity: 'low'
    });
  }
  
  // Conflict rate insights
  if (conflicts.averageConflictsPerCheck > 0.5) {
    insights.push({
      type: 'warning',
      category: 'conflicts',
      message: `High conflict rate (${(conflicts.averageConflictsPerCheck * 100).toFixed(1)}%). Review scheduling patterns.`,
      severity: 'medium'
    });
  }
  
  // Processing time insights
  if (patterns.averageProcessingTime > 3000) {
    insights.push({
      type: 'warning',
      category: 'performance',
      message: `Slow processing times (${patterns.averageProcessingTime.toFixed(0)}ms avg). Consider optimization.`,
      severity: 'medium'
    });
  }
  
  // Workload distribution insights
  const workloadValues = Object.values(patterns.interpreterWorkload) as number[];
  if (workloadValues.length > 0) {
    const maxWorkload = Math.max(...workloadValues);
    const minWorkload = Math.min(...workloadValues);
    const workloadGap = maxWorkload - minWorkload;
    
    if (workloadGap > 5) {
      insights.push({
        type: 'info',
        category: 'fairness',
        message: `Workload imbalance detected (gap: ${workloadGap} assignments). Review fairness settings.`,
        severity: 'medium'
      });
    }
  }
  
  // DR override insights
  if (patterns.drOverrideRate > 0.2) {
    insights.push({
      type: 'warning',
      category: 'dr_policy',
      message: `High DR override rate (${(patterns.drOverrideRate * 100).toFixed(1)}%). Review DR policies.`,
      severity: 'medium'
    });
  }
  
  return insights;
}

/**
 * Convert analysis data to CSV format
 */
function convertToCSV(data: any): string {
  const headers = [
    'Metric',
    'Value',
    'Description'
  ];
  
  const rows = [
    ['Total Assignments', data.totalAssignments, 'Total number of assignment attempts'],
    ['Success Rate', `${(data.successRate * 100).toFixed(2)}%`, 'Percentage of successful assignments'],
    ['Escalation Rate', `${(data.escalationRate * 100).toFixed(2)}%`, 'Percentage of escalated assignments'],
    ['Average Processing Time', `${data.averageProcessingTime.toFixed(0)}ms`, 'Average time to process assignments'],
    ['Conflict Rate', `${(data.conflictRate * 100).toFixed(2)}%`, 'Percentage of assignments with conflicts'],
    ['DR Override Rate', `${(data.drOverrideRate * 100).toFixed(2)}%`, 'Percentage of DR policy overrides']
  ];
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}