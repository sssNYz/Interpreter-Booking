import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";

/**
 * GET /api/admin/pool/history
 * Get pool entry history for debugging
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const action = searchParams.get('action'); // Filter by action type
    const days = parseInt(searchParams.get('days') || '7'); // Last N days

    console.log(`📊 Getting pool entry history... bookingId: ${bookingId}, limit: ${limit}, action: ${action}, days: ${days}`);

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query conditions
    const whereConditions: any = {
      createdAt: {
        gte: startDate
      }
    };

    if (bookingId) {
      whereConditions.bookingId = parseInt(bookingId);
    }

    if (action) {
      whereConditions.action = action;
    }

    // Get pool entry history
    const historyEntries = await prisma.poolEntryHistory.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bookingPlan: {
          select: {
            bookingId: true,
            meetingType: true,
            timeStart: true,
            timeEnd: true,
            bookingStatus: true,
            poolStatus: true,
            poolEntryTime: true,
            poolDeadlineTime: true,
            poolProcessingAttempts: true
          }
        }
      }
    });

    // Get summary statistics
    const summaryStats = await prisma.poolEntryHistory.groupBy({
      by: ['action'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        action: true
      }
    });

    // Get error statistics
    const errorStats = await prisma.poolEntryHistory.findMany({
      where: {
        createdAt: {
          gte: startDate
        },
        errorMessage: {
          not: null
        }
      },
      select: {
        action: true,
        errorMessage: true,
        bookingId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Format response
    const response = {
      timestamp: new Date().toISOString(),
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      filters: {
        bookingId: bookingId ? parseInt(bookingId) : null,
        action,
        limit
      },
      summary: {
        totalEntries: historyEntries.length,
        actionBreakdown: summaryStats.reduce((acc, stat) => {
          acc[stat.action] = stat._count.action;
          return acc;
        }, {} as Record<string, number>),
        errorCount: errorStats.length
      },
      history: historyEntries.map(entry => ({
        id: entry.id,
        bookingId: entry.bookingId,
        action: entry.action,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        processingAttempts: entry.processingAttempts,
        errorMessage: entry.errorMessage,
        systemState: entry.systemState,
        timestamp: entry.createdAt.toISOString(),
        booking: {
          meetingType: entry.bookingPlan.meetingType,
          startTime: entry.bookingPlan.timeStart.toISOString(),
          endTime: entry.bookingPlan.timeEnd.toISOString(),
          bookingStatus: entry.bookingPlan.bookingStatus,
          poolStatus: entry.bookingPlan.poolStatus,
          poolEntryTime: entry.bookingPlan.poolEntryTime?.toISOString() || null,
          poolDeadlineTime: entry.bookingPlan.poolDeadlineTime?.toISOString() || null,
          poolProcessingAttempts: entry.bookingPlan.poolProcessingAttempts
        }
      })),
      recentErrors: errorStats.map(error => ({
        bookingId: error.bookingId,
        action: error.action,
        errorMessage: error.errorMessage,
        timestamp: error.createdAt.toISOString()
      })),
      insights: generateHistoryInsights(historyEntries, errorStats, summaryStats)
    };

    console.log(`✅ Pool history retrieved: ${historyEntries.length} entries, ${errorStats.length} errors`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting pool history:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get pool history",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pool/history
 * Add pool entry history record (for manual tracking)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bookingId,
      action,
      previousStatus,
      newStatus,
      processingAttempts = 0,
      errorMessage,
      systemState
    } = body;

    // Validate required fields
    if (!bookingId || !action) {
      return NextResponse.json(
        { error: "bookingId and action are required" },
        { status: 400 }
      );
    }

    console.log(`📝 Adding pool history entry: bookingId=${bookingId}, action=${action}`);

    // Create history entry
    const historyEntry = await prisma.poolEntryHistory.create({
      data: {
        bookingId: parseInt(bookingId),
        action,
        previousStatus,
        newStatus,
        processingAttempts,
        errorMessage,
        systemState: systemState || {}
      },
      include: {
        bookingPlan: {
          select: {
            bookingId: true,
            meetingType: true,
            timeStart: true,
            timeEnd: true,
            bookingStatus: true,
            poolStatus: true
          }
        }
      }
    });

    const response = {
      status: 'created',
      entry: {
        id: historyEntry.id,
        bookingId: historyEntry.bookingId,
        action: historyEntry.action,
        previousStatus: historyEntry.previousStatus,
        newStatus: historyEntry.newStatus,
        processingAttempts: historyEntry.processingAttempts,
        errorMessage: historyEntry.errorMessage,
        systemState: historyEntry.systemState,
        timestamp: historyEntry.createdAt.toISOString(),
        booking: {
          meetingType: historyEntry.bookingPlan.meetingType,
          startTime: historyEntry.bookingPlan.timeStart.toISOString(),
          endTime: historyEntry.bookingPlan.timeEnd.toISOString(),
          bookingStatus: historyEntry.bookingPlan.bookingStatus,
          poolStatus: historyEntry.bookingPlan.poolStatus
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Pool history entry created: ID ${historyEntry.id}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error creating pool history entry:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to create pool history entry",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Generate insights from pool history data
 */
function generateHistoryInsights(
  historyEntries: any[],
  errorStats: any[],
  summaryStats: any[]
): Array<{
  category: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  message: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const insights = [];

  // Error rate insights
  const errorRate = historyEntries.length > 0 ? errorStats.length / historyEntries.length : 0;
  
  if (errorRate > 0.3) {
    insights.push({
      category: 'error-rate',
      type: 'critical' as const,
      message: `High error rate (${Math.round(errorRate * 100)}%) in pool operations`,
      priority: 'high' as const
    });
  } else if (errorRate > 0.1) {
    insights.push({
      category: 'error-rate',
      type: 'warning' as const,
      message: `Moderate error rate (${Math.round(errorRate * 100)}%) should be monitored`,
      priority: 'medium' as const
    });
  } else if (errorRate === 0 && historyEntries.length > 0) {
    insights.push({
      category: 'error-rate',
      type: 'positive' as const,
      message: 'No errors detected in recent pool operations',
      priority: 'low' as const
    });
  }

  // Activity insights
  const actionCounts = summaryStats.reduce((acc, stat) => {
    acc[stat.action] = stat._count.action;
    return acc;
  }, {} as Record<string, number>);

  const totalActions = Object.values(actionCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalActions === 0) {
    insights.push({
      category: 'activity',
      type: 'warning' as const,
      message: 'No pool activity detected in the specified time range',
      priority: 'medium' as const
    });
  } else {
    const mostCommonAction = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommonAction) {
      insights.push({
        category: 'activity',
        type: 'info' as const,
        message: `Most common pool action: ${mostCommonAction[0]} (${mostCommonAction[1]} occurrences)`,
        priority: 'low' as const
      });
    }
  }

  // Processing attempts insights
  const highRetryEntries = historyEntries.filter(entry => entry.processingAttempts > 3);
  
  if (highRetryEntries.length > 0) {
    insights.push({
      category: 'retry-attempts',
      type: 'warning' as const,
      message: `${highRetryEntries.length} entries required excessive retry attempts`,
      priority: 'medium' as const
    });
  }

  // Status transition insights
  const statusTransitions = historyEntries
    .filter(entry => entry.previousStatus && entry.newStatus)
    .map(entry => `${entry.previousStatus} → ${entry.newStatus}`);
  
  const transitionCounts = statusTransitions.reduce((acc, transition) => {
    acc[transition] = (acc[transition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const failedTransitions = Object.entries(transitionCounts)
    .filter(([transition]) => transition.includes('failed'))
    .reduce((sum, [, count]) => sum + count, 0);

  if (failedTransitions > 0) {
    insights.push({
      category: 'status-transitions',
      type: 'warning' as const,
      message: `${failedTransitions} transitions to failed status detected`,
      priority: 'medium' as const
    });
  }

  return insights;
}