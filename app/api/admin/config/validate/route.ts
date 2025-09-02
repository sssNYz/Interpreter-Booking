import { NextRequest, NextResponse } from "next/server";
import { getConfigurationValidator } from "@/lib/assignment/config-validator";
import type { AssignmentPolicy } from "@/types/assignment";

/**
 * POST /api/admin/config/validate
 * Validate configuration changes with impact assessment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, options } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: "Configuration object is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Validating configuration via API...");

    const validator = getConfigurationValidator();
    const validationResult = await validator.validateConfiguration(
      config as Partial<AssignmentPolicy>,
      {
        skipImpactAssessment: options?.skipImpactAssessment || false,
        userId: options?.userId,
        reason: options?.reason
      }
    );

    console.log(`✅ Configuration validation completed: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);

    return NextResponse.json({
      success: true,
      validation: validationResult
    });

  } catch (error) {
    console.error("❌ Error validating configuration:", error);
    
    return NextResponse.json(
      { 
        error: "Configuration validation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/config/validate/recommendations
 * Get configuration recommendations for a specific mode
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as AssignmentPolicy['mode'];

    if (!mode || !['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'].includes(mode)) {
      return NextResponse.json(
        { error: "Valid mode parameter is required (BALANCE, URGENT, NORMAL, CUSTOM)" },
        { status: 400 }
      );
    }

    const { getDRPolicyRecommendations, getModeDefaults } = await import("@/lib/assignment/policy");
    
    const recommendations = getDRPolicyRecommendations(mode);
    const defaults = getModeDefaults(mode);

    return NextResponse.json({
      success: true,
      mode,
      recommendations,
      defaults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting configuration recommendations:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get configuration recommendations",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}