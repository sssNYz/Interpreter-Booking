import { NextRequest, NextResponse } from "next/server";
import { getConfigurationValidator } from "@/lib/assignment/validation/config-validator";
import type { ConfigChangeLogEntry } from "@/lib/assignment/validation/config-validator";

/**
 * POST /api/admin/config/change-log
 * Log a configuration change
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      changeType, 
      oldConfig, 
      newConfig, 
      validationResult, 
      userId, 
      reason,
      impactAssessment 
    } = body;

    if (!changeType || !oldConfig || !newConfig || !validationResult) {
      return NextResponse.json(
        { error: "changeType, oldConfig, newConfig, and validationResult are required" },
        { status: 400 }
      );
    }

    console.log(`📝 Logging configuration change: ${changeType}`);

    const validator = getConfigurationValidator();
    
    const changeEntry: Omit<ConfigChangeLogEntry, 'id' | 'timestamp'> = {
      changeType,
      oldConfig,
      newConfig,
      validationResult,
      userId,
      reason,
      impactAssessment
    };

    await validator.logConfigurationChange(changeEntry);

    console.log("✅ Configuration change logged successfully");

    return NextResponse.json({
      success: true,
      message: "Configuration change logged successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error logging configuration change:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to log configuration change",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/config/change-log
 * Get configuration change history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const changeType = searchParams.get('changeType');
    const userId = searchParams.get('userId');

    console.log("📋 Retrieving configuration change log...");

    const prisma = (await import("@/prisma/prisma")).default;

    // Build where clause
    const where: any = {};
    if (changeType) {
      where.changeType = changeType;
    }
    if (userId) {
      where.userId = userId;
    }

    // Get configuration change logs from assignment log
    const logs = await prisma.assignmentLog.findMany({
      where: {
        ...where,
        reason: {
          contains: 'Configuration change'
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        timestamp: true,
        reason: true,
        systemState: true,
        metadata: true
      }
    });

    // Get total count
    const totalCount = await prisma.assignmentLog.count({
      where: {
        ...where,
        reason: {
          contains: 'Configuration change'
        }
      }
    });

    // Transform logs to match expected format
    const transformedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      changeType: 'POLICY_UPDATE', // Default since we can't determine exact type
      reason: log.reason,
      systemState: log.systemState,
      metadata: log.metadata
    }));

    console.log(`📋 Retrieved ${logs.length} configuration change log entries`);

    return NextResponse.json({
      success: true,
      logs: transformedLogs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error retrieving configuration change log:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to retrieve configuration change log",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}