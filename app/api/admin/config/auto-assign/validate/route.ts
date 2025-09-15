import { NextRequest, NextResponse } from "next/server";
import { loadPolicy } from "@/lib/assignment/config/policy";
import { 
  validateAssignmentPolicy, 
  validateMeetingTypePriority, 
  getParameterLockStatus, 
  getModeRecommendations,
  assessConfigurationImpact 
} from "@/lib/assignment/validation/config-validation";

/**
 * Real-time validation endpoint for configuration changes
 * Provides immediate feedback without persisting changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const includeRecommendations = searchParams.get('includeRecommendations') === 'true';
    const includeImpactAssessment = searchParams.get('includeImpactAssessment') === 'true';
    
    // Get current policy for comparison
    const currentPolicy = await loadPolicy();
    
    const response: any = {
      success: true,
      validation: {
        policy: null,
        priorities: [],
        parameterLocks: {},
        overallValid: true
      }
    };
    
    // Validate policy if provided
    if (body.policy) {
      const policyValidation = validateAssignmentPolicy(body.policy, currentPolicy);
      const lockStatus = getParameterLockStatus(body.policy.mode || currentPolicy.mode);
      
      response.validation.policy = policyValidation;
      response.validation.parameterLocks = lockStatus;
      response.validation.overallValid = policyValidation.isValid;
      
      // Include mode recommendations if requested
      if (includeRecommendations) {
        const recommendations = getModeRecommendations(body.policy.mode || currentPolicy.mode);
        response.modeRecommendations = recommendations;
      }
      
      // Include impact assessment if requested
      if (includeImpactAssessment) {
        const impact = assessConfigurationImpact(body.policy, currentPolicy);
        response.impactAssessment = impact;
      }
    }
    
    // Validate meeting type priorities if provided
    if (body.priorities && Array.isArray(body.priorities)) {
      const mode = body.policy?.mode || currentPolicy.mode;
      
      for (const priority of body.priorities) {
        const validation = validateMeetingTypePriority(priority, mode);
        
        response.validation.priorities.push({
          meetingType: priority.meetingType,
          validation
        });
        
        // Update overall validity
        if (!validation.isValid) {
          response.validation.overallValid = false;
        }
      }
    }
    
    // Validate individual parameter if provided (for real-time field validation)
    if (body.parameter && body.value !== undefined) {
      const testPolicy = {
        ...currentPolicy,
        [body.parameter]: body.value
      };
      
      const paramValidation = validateAssignmentPolicy(testPolicy, currentPolicy);
      
      // Filter validation results to only include the specific parameter
      const parameterErrors = paramValidation.errors.filter(e => e.field === body.parameter);
      const parameterWarnings = paramValidation.warnings.filter(w => w.field === body.parameter);
      const parameterRecommendations = paramValidation.recommendations.filter(r => r.field === body.parameter);
      
      response.validation.parameter = {
        field: body.parameter,
        value: body.value,
        isValid: parameterErrors.length === 0,
        errors: parameterErrors,
        warnings: parameterWarnings,
        recommendations: parameterRecommendations
      };
      
      response.validation.overallValid = parameterErrors.length === 0;
    }
    
    // Add response metadata
    response.metadata = {
      timestamp: new Date().toISOString(),
      validationVersion: "1.0",
      processingTime: Date.now() - Date.now() // This would be calculated properly in real implementation
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error validating configuration:", error);
    
    // Provide safe fallback validation response
    try {
      const currentPolicy = await loadPolicy();
      const basicValidation = validateAssignmentPolicy(currentPolicy, currentPolicy);
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to validate configuration",
          details: error instanceof Error ? error.message : "Unknown error",
          fallbackValidation: {
            policy: basicValidation,
            priorities: [],
            parameterLocks: getParameterLockStatus(currentPolicy.mode),
            overallValid: basicValidation.isValid
          },
          recovery: {
            suggestion: "Using current configuration for validation baseline",
            action: "Check input parameters and try again"
          }
        },
        { status: 500 }
      );
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Critical validation system error",
          details: error instanceof Error ? error.message : "Unknown error",
          recovery: {
            suggestion: "Validation system unavailable",
            action: "Contact system administrator"
          }
        },
        { status: 500 }
      );
    }
  }
}

/**
 * Get validation rules and constraints for UI
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'NORMAL';
    
    const currentPolicy = await loadPolicy();
    const lockStatus = getParameterLockStatus(mode);
    const recommendations = getModeRecommendations(mode);
    
    // Get validation rules from the validation system
    const { VALIDATION_RULES, MODE_CONSTRAINTS } = await import("@/lib/assignment/validation/config-validation");
    
    return NextResponse.json({
      success: true,
      data: {
        validationRules: VALIDATION_RULES,
        modeConstraints: MODE_CONSTRAINTS,
        parameterLocks: lockStatus,
        modeRecommendations: recommendations,
        currentPolicy
      },
      metadata: {
        timestamp: new Date().toISOString(),
        mode: mode,
        rulesVersion: "1.0"
      }
    });
  } catch (error) {
    console.error("Error loading validation rules:", error);
    
    // Provide minimal fallback validation rules
    const fallbackRules = {
      fairnessWindowDays: { min: 7, max: 90, recommended: { min: 14, max: 60 } },
      w_fair: { min: 0, max: 5, recommended: { min: 0.5, max: 3.0 } },
      w_urgency: { min: 0, max: 5, recommended: { min: 0.3, max: 2.5 } },
      drConsecutivePenalty: { min: -2.0, max: 0, recommended: { min: -1.0, max: -0.1 } }
    };
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to load validation rules",
        details: error instanceof Error ? error.message : "Unknown error",
        fallbackData: {
          validationRules: fallbackRules,
          modeConstraints: {
            NORMAL: { lockedParams: [], description: "Standard mode" },
            CUSTOM: { lockedParams: [], description: "Custom configuration" }
          }
        },
        recovery: {
          suggestion: "Using minimal validation rules",
          action: "System functionality may be limited"
        }
      },
      { status: 500 }
    );
  }
}