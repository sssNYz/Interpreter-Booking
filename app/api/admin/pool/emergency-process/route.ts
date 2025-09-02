import { NextRequest, NextResponse } from "next/server";
import { getEmergencyProcessingManager } from "@/lib/assignment/emergency-processing";
import { bookingPool } from "@/lib/assignment/pool";

/**
 * POST /api/admin/pool/emergency-process
 * Force immediate processing of all pooled bookings with priority-based processing,
 * detailed reporting, audit logging, and manual escalation for failed entries
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🚨 Emergency pool processing triggered by admin");

    // Parse request body for additional context
    let requestBody: { reason?: string; triggeredBy?: string } = {};
    try {
      requestBody = await request.json();
    } catch {
      // Use defaults if no body provided
    }

    const reason = requestBody.reason || "Manual emergency processing triggered by admin";
    const triggeredBy = requestBody.triggeredBy || "ADMIN";

    // Get current pool status before processing
    const poolStatsBefore = await bookingPool.getPoolStats();
    
    if (poolStatsBefore.totalInPool === 0) {
      return NextResponse.json({
        success: true,
        message: "No entries in pool to process",
        batchId: `emergency_empty_${Date.now()}`,
        results: {
          processedCount: 0,
          assignedCount: 0,
          escalatedCount: 0,
          failedCount: 0,
          manualEscalationCount: 0,
          processingTime: 0
        },
        priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        recommendations: [
          "No entries in pool required emergency processing",
          "System is operating normally"
        ],
        auditLog: {
          id: `emergency_empty_${Date.now()}`,
          timestamp: new Date().toISOString(),
          triggeredBy,
          reason,
          impact: "No processing required"
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🚨 Starting enhanced emergency processing for ${poolStatsBefore.totalInPool} pool entries`);

    // Execute emergency processing with enhanced features
    const emergencyManager = getEmergencyProcessingManager();
    const result = await emergencyManager.executeEmergencyProcessing(triggeredBy, reason);
    
    // Get pool status after processing
    const poolStatsAfter = await bookingPool.getPoolStats();
    
    const response = {
      success: result.success,
      message: result.success 
        ? `Emergency processing completed: ${result.assignedEntries} assigned, ${result.escalatedEntries} escalated, ${result.manualEscalationEntries} require manual assignment`
        : "Emergency processing failed",
      batchId: result.batchId,
      results: {
        processedCount: result.processedEntries,
        assignedCount: result.assignedEntries,
        escalatedCount: result.escalatedEntries,
        failedCount: result.failedEntries,
        manualEscalationCount: result.manualEscalationEntries,
        processingTime: result.processingTimeMs,
        averageProcessingTime: result.averageProcessingTimeMs
      },
      priorityBreakdown: result.priorityBreakdown,
      poolStatus: {
        before: {
          totalInPool: poolStatsBefore.totalInPool,
          readyForProcessing: poolStatsBefore.readyForProcessing,
          failedEntries: poolStatsBefore.failedEntries
        },
        after: {
          totalInPool: poolStatsAfter.totalInPool,
          readyForProcessing: poolStatsAfter.readyForProcessing,
          failedEntries: poolStatsAfter.failedEntries
        }
      },
      auditLog: {
        id: result.auditLog.id,
        timestamp: result.auditLog.timestamp.toISOString(),
        triggeredBy: result.auditLog.triggeredBy,
        reason: result.auditLog.reason,
        systemState: result.auditLog.systemState,
        processingConfiguration: result.auditLog.processingConfiguration,
        results: result.auditLog.results,
        impact: result.auditLog.impact
      },
      recommendations: result.recommendations,
      detailedResults: result.detailedResults.map(entry => ({
        bookingId: entry.bookingId,
        status: entry.status,
        interpreterId: entry.interpreterId,
        reason: entry.reason,
        processingTime: entry.processingTimeMs,
        urgencyLevel: entry.urgencyLevel,
        priorityScore: entry.priorityScore,
        originalDeadline: entry.originalDeadline.toISOString(),
        timeToDeadline: entry.timeToDeadline,
        retryAttempts: entry.retryAttempts,
        errorType: entry.errorType,
        escalationReason: entry.escalationReason,
        manualAssignmentRequired: entry.manualAssignmentRequired
      })),
      errors: result.errors.map(error => ({
        bookingId: error.bookingId,
        error: error.error,
        errorType: error.errorType,
        timestamp: error.timestamp.toISOString(),
        retryAttempts: error.retryAttempts,
        escalatedToManual: error.escalatedToManual,
        context: error.context
      })),
      timestamp: new Date().toISOString()
    };

    if (result.success) {
      console.log(`✅ Enhanced emergency processing completed: ${result.assignedEntries}/${result.processedEntries} successfully assigned, ${result.manualEscalationEntries} escalated to manual`);
    } else {
      console.error(`❌ Enhanced emergency processing failed: ${result.errors.length} errors occurred`);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error during enhanced emergency pool processing:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Enhanced emergency processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
        batchId: `emergency_failed_${Date.now()}`,
        recommendations: [
          "Emergency processing failed completely",
          "Check system logs for detailed error information",
          "Consider manual assignment for all pooled bookings",
          "Verify database connectivity and system health"
        ],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/pool/emergency-process
 * Get information about emergency processing capabilities with enhanced priority analysis
 */
export async function GET(request: NextRequest) {
  try {
    const poolStats = await bookingPool.getPoolStats();
    const allEntries = await bookingPool.getAllPoolEntries();
    const now = new Date();
    
    // Analyze entries by priority and urgency
    const priorityAnalysis = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    const deadlineAnalysis = {
      pastDeadline: 0,
      within2Hours: 0,
      within6Hours: 0,
      within24Hours: 0,
      moreThan24Hours: 0
    };
    
    let totalPriorityScore = 0;
    
    for (const entry of allEntries) {
      const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
      const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
      
      // Calculate priority score (same logic as emergency processing)
      let priorityScore = 0;
      if (now >= entry.deadlineTime) {
        priorityScore += 1000;
        deadlineAnalysis.pastDeadline++;
      } else if (hoursToDeadline <= 2) {
        priorityScore += 800;
        deadlineAnalysis.within2Hours++;
      } else if (hoursToDeadline <= 6) {
        priorityScore += 600;
        deadlineAnalysis.within6Hours++;
      } else if (hoursToDeadline <= 24) {
        priorityScore += 400;
        deadlineAnalysis.within24Hours++;
      } else {
        priorityScore += Math.max(0, 200 - hoursToDeadline);
        deadlineAnalysis.moreThan24Hours++;
      }
      
      // Meeting type priority
      switch (entry.meetingType) {
        case 'DR':
          priorityScore += 200;
          break;
        case 'VIP':
          priorityScore += 150;
          break;
        case 'Augent':
          priorityScore += 100;
          break;
        case 'Weekly':
          priorityScore += 50;
          break;
        default:
          priorityScore += 25;
      }
      
      // Processing attempts penalty
      priorityScore -= (entry.processingAttempts || 0) * 10;
      
      totalPriorityScore += priorityScore;
      
      // Categorize by urgency level
      if (now >= entry.deadlineTime || hoursToDeadline <= 2) {
        priorityAnalysis.critical++;
      } else if (hoursToDeadline <= 6) {
        priorityAnalysis.high++;
      } else if (hoursToDeadline <= 24) {
        priorityAnalysis.medium++;
      } else {
        priorityAnalysis.low++;
      }
    }
    
    const averagePriorityScore = allEntries.length > 0 ? totalPriorityScore / allEntries.length : 0;
    const estimatedProcessingTime = allEntries.length * 3000; // 3 seconds per entry for enhanced processing
    
    const response = {
      canProcess: poolStats.totalInPool > 0,
      poolSize: poolStats.totalInPool,
      priorityAnalysis,
      deadlineAnalysis,
      averagePriorityScore: Math.round(averagePriorityScore),
      estimatedProcessingTime,
      estimatedProcessingTimeFormatted: formatProcessingTime(estimatedProcessingTime),
      processingCapabilities: {
        priorityBasedProcessing: true,
        manualEscalationEnabled: true,
        auditLoggingEnabled: true,
        detailedReporting: true,
        errorRecoveryEnabled: true,
        maxRetryAttempts: 5
      },
      systemRecommendations: generateEnhancedEmergencyRecommendations(
        poolStats, 
        priorityAnalysis, 
        deadlineAnalysis, 
        averagePriorityScore
      ),
      riskAssessment: {
        level: assessEmergencyRiskLevel(priorityAnalysis, deadlineAnalysis),
        factors: identifyRiskFactors(priorityAnalysis, deadlineAnalysis, poolStats),
        urgencyScore: calculateUrgencyScore(priorityAnalysis, deadlineAnalysis)
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error getting enhanced emergency processing info:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get enhanced emergency processing info",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Format processing time in human-readable format
 */
function formatProcessingTime(timeMs: number): string {
  if (timeMs < 1000) {
    return `${timeMs}ms`;
  } else if (timeMs < 60000) {
    return `${Math.round(timeMs / 1000)}s`;
  } else {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.round((timeMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Generate enhanced recommendations for emergency processing
 */
function generateEnhancedEmergencyRecommendations(
  poolStats: any,
  priorityAnalysis: any,
  deadlineAnalysis: any,
  averagePriorityScore: number
): string[] {
  const recommendations: string[] = [];

  if (poolStats.totalInPool === 0) {
    recommendations.push("No entries in pool. Emergency processing not needed.");
    return recommendations;
  }

  // Critical urgency recommendations
  if (priorityAnalysis.critical > 0) {
    recommendations.push(`🚨 ${priorityAnalysis.critical} critical urgency entries detected. Immediate emergency processing required.`);
  }

  // Deadline-based recommendations
  if (deadlineAnalysis.pastDeadline > 0) {
    recommendations.push(`⏰ ${deadlineAnalysis.pastDeadline} entries are past deadline. Emergency processing strongly recommended.`);
  }

  if (deadlineAnalysis.within2Hours > 0) {
    recommendations.push(`⚡ ${deadlineAnalysis.within2Hours} entries have deadlines within 2 hours. Urgent processing needed.`);
  }

  if (deadlineAnalysis.within6Hours > 0) {
    recommendations.push(`🕕 ${deadlineAnalysis.within6Hours} entries have deadlines within 6 hours. Consider emergency processing.`);
  }

  // Pool size recommendations
  if (poolStats.totalInPool > 50) {
    recommendations.push("📊 Large pool size detected. Emergency processing will take significant time but will clear backlog effectively.");
  } else if (poolStats.totalInPool > 20) {
    recommendations.push("📈 Moderate pool size. Emergency processing recommended to prevent further backlog.");
  }

  // Priority score recommendations
  if (averagePriorityScore > 800) {
    recommendations.push("🔥 Very high average priority score. Emergency processing is critical for system stability.");
  } else if (averagePriorityScore > 600) {
    recommendations.push("📈 High average priority score. Emergency processing recommended.");
  } else if (averagePriorityScore > 400) {
    recommendations.push("📊 Moderate average priority score. Emergency processing may be beneficial.");
  }

  // Failed entries recommendations
  if (poolStats.failedEntries > 0) {
    recommendations.push(`🔧 ${poolStats.failedEntries} failed entries will be retried with enhanced error recovery.`);
  }

  // System load recommendations
  const totalHighPriority = priorityAnalysis.critical + priorityAnalysis.high;
  if (totalHighPriority > poolStats.totalInPool * 0.5) {
    recommendations.push("⚠️ High proportion of urgent entries. Emergency processing will significantly improve system performance.");
  }

  // Alternative recommendations
  if (priorityAnalysis.critical === 0 && deadlineAnalysis.pastDeadline === 0 && deadlineAnalysis.within2Hours === 0) {
    recommendations.push("✅ No critical or immediate deadline entries. Regular processing may be sufficient.");
    recommendations.push("💡 Consider scheduling regular pool processing instead of emergency processing.");
  }

  // Processing time warnings
  if (poolStats.totalInPool > 100) {
    recommendations.push("⏱️ Large pool will require extended processing time. Ensure system resources are available.");
  }

  return recommendations;
}

/**
 * Assess emergency risk level based on priority and deadline analysis
 */
function assessEmergencyRiskLevel(
  priorityAnalysis: any,
  deadlineAnalysis: any
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (priorityAnalysis.critical > 10 || deadlineAnalysis.pastDeadline > 5) {
    return 'CRITICAL';
  } else if (priorityAnalysis.critical > 5 || deadlineAnalysis.pastDeadline > 0 || deadlineAnalysis.within2Hours > 5) {
    return 'HIGH';
  } else if (priorityAnalysis.high > 10 || deadlineAnalysis.within6Hours > 10) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

/**
 * Identify specific risk factors
 */
function identifyRiskFactors(
  priorityAnalysis: any,
  deadlineAnalysis: any,
  poolStats: any
): string[] {
  const factors: string[] = [];

  if (deadlineAnalysis.pastDeadline > 0) {
    factors.push(`${deadlineAnalysis.pastDeadline} entries past deadline`);
  }

  if (priorityAnalysis.critical > 0) {
    factors.push(`${priorityAnalysis.critical} critical priority entries`);
  }

  if (deadlineAnalysis.within2Hours > 0) {
    factors.push(`${deadlineAnalysis.within2Hours} entries due within 2 hours`);
  }

  if (poolStats.totalInPool > 50) {
    factors.push('Large pool size creating processing backlog');
  }

  if (poolStats.failedEntries > 0) {
    factors.push(`${poolStats.failedEntries} previously failed entries`);
  }

  if (factors.length === 0) {
    factors.push('No significant risk factors identified');
  }

  return factors;
}

/**
 * Calculate overall urgency score (0-100)
 */
function calculateUrgencyScore(
  priorityAnalysis: any,
  deadlineAnalysis: any
): number {
  let score = 0;

  // Past deadline entries contribute most to urgency
  score += deadlineAnalysis.pastDeadline * 20;

  // Critical entries
  score += priorityAnalysis.critical * 15;

  // Within 2 hours
  score += deadlineAnalysis.within2Hours * 10;

  // High priority entries
  score += priorityAnalysis.high * 5;

  // Within 6 hours
  score += deadlineAnalysis.within6Hours * 3;

  // Medium priority entries
  score += priorityAnalysis.medium * 1;

  // Cap at 100
  return Math.min(100, score);
}