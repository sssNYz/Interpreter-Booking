import { NextRequest, NextResponse } from "next/server";
import { getConfigurationValidator } from "@/lib/assignment/config-validator";
import { loadPolicy } from "@/lib/assignment/policy";
import type { AssignmentPolicy } from "@/types/assignment";

/**
 * POST /api/admin/config/impact-assessment
 * Get detailed impact assessment for configuration changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: "Configuration object is required" },
        { status: 400 }
      );
    }

    console.log("📊 Performing configuration impact assessment...");

    const validator = getConfigurationValidator();
    const currentConfig = await loadPolicy();
    
    // Get full validation with impact assessment
    const validationResult = await validator.validateConfiguration(
      config as Partial<AssignmentPolicy>,
      { skipImpactAssessment: false }
    );

    // Extract detailed impact information
    const impact = validationResult.impact;
    
    const detailedAssessment = {
      summary: {
        existingPooledBookings: impact.existingPooledBookings,
        affectedBookings: impact.affectedBookings,
        impactLevel: impact.affectedBookings === 0 ? 'NONE' :
                    impact.affectedBookings < 5 ? 'LOW' :
                    impact.affectedBookings < 15 ? 'MEDIUM' : 'HIGH'
      },
      modeChange: impact.modeChangeImpact ? {
        transition: `${impact.modeChangeImpact.fromMode} → ${impact.modeChangeImpact.toMode}`,
        poolEntriesAffected: impact.modeChangeImpact.poolEntriesAffected,
        immediateProcessingRequired: impact.modeChangeImpact.immediateProcessingRequired,
        thresholdChanges: impact.modeChangeImpact.thresholdChanges,
        behaviorChange: impact.modeChangeImpact.poolingBehaviorChange
      } : null,
      fairnessImpact: impact.fairnessImpact ? {
        currentGap: impact.fairnessImpact.currentGap,
        projectedGap: impact.fairnessImpact.projectedGap,
        gapChange: impact.fairnessImpact.gapChange,
        improvement: impact.fairnessImpact.fairnessImprovement,
        affectedInterpreters: impact.fairnessImpact.affectedInterpreters,
        windowDaysChange: impact.fairnessImpact.windowDaysChange
      } : null,
      poolProcessing: impact.poolProcessingImpact ? {
        currentPoolSize: impact.poolProcessingImpact.currentPoolSize,
        thresholdAdjustments: impact.poolProcessingImpact.thresholdAdjustments,
        deadlineAdjustments: impact.poolProcessingImpact.deadlineAdjustments,
        processingFrequencyChange: impact.poolProcessingImpact.processingFrequencyChange,
        batchProcessingChange: impact.poolProcessingImpact.batchProcessingChange
      } : null,
      drPolicy: impact.drPolicyImpact ? {
        blockingBehaviorChange: impact.drPolicyImpact.blockingBehaviorChange,
        penaltyChange: impact.drPolicyImpact.penaltyChange,
        overrideAvailabilityChange: impact.drPolicyImpact.overrideAvailabilityChange,
        affectedDRBookings: impact.drPolicyImpact.affectedDRBookings,
        fairnessDistributionChange: impact.drPolicyImpact.fairnessDistributionChange
      } : null,
      recommendations: validationResult.recommendations,
      warnings: validationResult.warnings
    };

    console.log(`📊 Impact assessment completed: ${detailedAssessment.summary.impactLevel} impact level`);

    return NextResponse.json({
      success: true,
      assessment: detailedAssessment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error performing impact assessment:", error);
    
    return NextResponse.json(
      { 
        error: "Impact assessment failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/config/impact-assessment/current-state
 * Get current system state for impact assessment baseline
 */
export async function GET() {
  try {
    console.log("📊 Getting current system state for impact assessment...");

    const { bookingPool } = await import("@/lib/assignment/pool");
    const { loadPolicy } = await import("@/lib/assignment/policy");
    const prisma = (await import("@/prisma/prisma")).default;

    const [
      currentPolicy,
      poolStats,
      activeInterpreters,
      recentAssignments
    ] = await Promise.all([
      loadPolicy(),
      bookingPool.getPoolStats(),
      prisma.interpreter.count({ where: { isActive: true } }),
      prisma.assignmentLog.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    // Get fairness gap
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - currentPolicy.fairnessWindowDays);

    const assignments = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: windowStart },
        interpreterEmpCode: { not: null }
      },
      select: {
        interpreterEmpCode: true
      }
    });

    const hoursByInterpreter: { [key: string]: number } = {};
    for (const assignment of assignments) {
      if (assignment.interpreterEmpCode) {
        hoursByInterpreter[assignment.interpreterEmpCode] = 
          (hoursByInterpreter[assignment.interpreterEmpCode] || 0) + 1;
      }
    }

    const hours = Object.values(hoursByInterpreter);
    const currentFairnessGap = hours.length > 0 ? Math.max(...hours) - Math.min(...hours) : 0;

    const currentState = {
      policy: currentPolicy,
      pool: {
        totalEntries: poolStats.totalInPool,
        readyForProcessing: poolStats.readyForProcessing,
        failedEntries: poolStats.failedEntries,
        oldestEntry: poolStats.oldestEntry
      },
      interpreters: {
        active: activeInterpreters,
        fairnessGap: currentFairnessGap,
        fairnessWindow: currentPolicy.fairnessWindowDays
      },
      activity: {
        recentAssignments,
        timeWindow: "24 hours"
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      currentState
    });

  } catch (error) {
    console.error("❌ Error getting current system state:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get current system state",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}