import { NextRequest, NextResponse } from "next/server";
import { loadPolicy, updatePolicy, loadMeetingTypePriorities, updateMeetingTypePriority, applyModeThresholds } from "@/lib/assignment/policy";
import { validateAssignmentPolicy, validateMeetingTypePriority, getParameterLockStatus, getModeRecommendations } from "@/lib/assignment/config-validation";
import prisma from "@/prisma/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeValidation = searchParams.get('includeValidation') === 'true';
    const includeRecommendations = searchParams.get('includeRecommendations') === 'true';
    
    const policy = await loadPolicy();
    const priorities = await loadMeetingTypePriorities();
    
    const response: any = {
      success: true,
      data: {
        policy,
        priorities
      },
      timestamp: new Date().toISOString()
    };

    // Include validation information if requested
    if (includeValidation) {
      const validation = validateAssignmentPolicy(policy, policy);
      const lockStatus = getParameterLockStatus(policy.mode);
      
      response.validation = {
        isValid: validation.isValid,
        warnings: validation.warnings,
        errors: validation.errors,
        recommendations: validation.recommendations,
        impactAssessment: validation.impactAssessment,
        parameterLocks: lockStatus
      };
    }

    // Include mode recommendations if requested
    if (includeRecommendations) {
      const recommendations = getModeRecommendations(policy.mode);
      response.modeRecommendations = recommendations;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error loading auto-assignment config:", error);
    
    // Safe fallback response
    try {
      const fallbackPolicy = {
        mode: 'NORMAL',
        fairnessWindowDays: 30,
        maxGapHours: 4,
        minAdvanceDays: 2,
        w_fair: 1.2,
        w_urgency: 1.0,
        w_lrs: 0.3,
        drConsecutivePenalty: -0.5,
        autoAssignEnabled: true
      };
      
      return NextResponse.json({
        success: false,
        error: "Failed to load configuration",
        fallbackData: {
          policy: fallbackPolicy,
          priorities: []
        },
        details: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 });
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Critical system error - unable to provide fallback configuration",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const validateOnly = searchParams.get('validateOnly') === 'true';
    
    // Get current policy for comparison
    const currentPolicy = await loadPolicy();
    
    // Validate policy if provided
    let policyValidation = null;
    let priorityValidations: any[] = [];
    
    if (body.policy) {
      policyValidation = validateAssignmentPolicy(body.policy, currentPolicy);
      
      // If validation fails and not in validate-only mode, return errors
      if (!policyValidation.isValid && !validateOnly) {
        return NextResponse.json({
          success: false,
          error: "Policy validation failed",
          validation: {
            policy: policyValidation,
            priorities: []
          }
        }, { status: 400 });
      }
    }
    
    // Validate meeting type priorities if provided
    if (body.priorities && Array.isArray(body.priorities)) {
      const mode = body.policy?.mode || currentPolicy.mode;
      
      for (const priority of body.priorities) {
        const validation = validateMeetingTypePriority(priority, mode);
        priorityValidations.push({
          meetingType: priority.meetingType,
          validation
        });
        
        // If validation fails and not in validate-only mode, return errors
        if (!validation.isValid && !validateOnly) {
          return NextResponse.json({
            success: false,
            error: `Priority validation failed for ${priority.meetingType}`,
            validation: {
              policy: policyValidation,
              priorities: priorityValidations
            }
          }, { status: 400 });
        }
      }
    }
    
    // If validate-only mode, return validation results without updating
    if (validateOnly) {
      const lockStatus = getParameterLockStatus(body.policy?.mode || currentPolicy.mode);
      const recommendations = getModeRecommendations(body.policy?.mode || currentPolicy.mode);
      
      return NextResponse.json({
        success: true,
        message: "Validation completed",
        validation: {
          policy: policyValidation,
          priorities: priorityValidations,
          parameterLocks: lockStatus,
          overallValid: policyValidation ? policyValidation.isValid && priorityValidations.every(p => p.validation.isValid) : true
        },
        modeRecommendations: recommendations,
        data: {
          policy: currentPolicy,
          priorities: await loadMeetingTypePriorities()
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Apply safe fallbacks for invalid configurations
    let safePolicy = body.policy;
    if (body.policy && policyValidation && !policyValidation.isValid) {
      console.warn("Applying safe fallbacks for invalid policy configuration");
      safePolicy = applySafeFallbacks(body.policy, currentPolicy, policyValidation);
    }
    
    // Update policy if provided and valid
    if (safePolicy) {
      await updatePolicy(safePolicy);
    }
    
    // Update meeting type priorities if provided and valid
    if (body.priorities && Array.isArray(body.priorities)) {
      console.log(`🔍 Checking ${body.priorities.length} priorities for changes...`);
      
      // Get current priorities to compare against
      const currentPriorities = await loadMeetingTypePriorities();
      const currentPriorityMap = new Map(
        currentPriorities.map(p => [p.meetingType, p])
      );
      
      let changedCount = 0;
      let updatedPriorities: string[] = [];
      
      for (let i = 0; i < body.priorities.length; i++) {
        const priority = body.priorities[i];
        const validation = priorityValidations[i];
        
        if (priority.meetingType && priority.priorityValue !== undefined) {
          const currentPriority = currentPriorityMap.get(priority.meetingType);
          
          // Check if this priority has actually changed
          const hasChanged = !currentPriority || 
            currentPriority.priorityValue !== priority.priorityValue ||
            currentPriority.urgentThresholdDays !== priority.urgentThresholdDays ||
            currentPriority.generalThresholdDays !== priority.generalThresholdDays;
          
          if (!hasChanged) {
            console.log(`⏭️ Skipping ${priority.meetingType} - no changes detected`);
            continue;
          }
          
          console.log(`🔄 Processing changed priority for ${priority.meetingType}:`, {
            old: currentPriority ? {
              priorityValue: currentPriority.priorityValue,
              urgentThresholdDays: currentPriority.urgentThresholdDays,
              generalThresholdDays: currentPriority.generalThresholdDays
            } : 'NEW',
            new: {
              priorityValue: priority.priorityValue,
              urgentThresholdDays: priority.urgentThresholdDays,
              generalThresholdDays: priority.generalThresholdDays
            }
          });
          
          // Apply safe fallbacks if needed
          let safePriority = priority;
          if (validation && !validation.validation.isValid) {
            console.warn(`⚠️ Applying safe fallbacks for ${priority.meetingType} priority`);
            safePriority = applySafePriorityFallbacks(priority, validation.validation);
          }
          
          try {
            // Try to update existing priority
            const activePolicy = safePolicy ? await updatePolicy(safePolicy) : await loadPolicy();
            const adjusted = applyModeThresholds({
              meetingType: safePriority.meetingType,
              urgentThresholdDays: safePriority.urgentThresholdDays,
              generalThresholdDays: safePriority.generalThresholdDays
            }, activePolicy.mode);
            
            await updateMeetingTypePriority(safePriority.meetingType, {
              priorityValue: safePriority.priorityValue,
              urgentThresholdDays: adjusted.urgentThresholdDays,
              generalThresholdDays: adjusted.generalThresholdDays
            });
            
            changedCount++;
            updatedPriorities.push(safePriority.meetingType);
            console.log(`✅ Updated priority for ${safePriority.meetingType}`);
          } catch (error) {
            // If update fails, create new priority
            console.log(`➕ Creating new priority for ${safePriority.meetingType} (update failed: ${error instanceof Error ? error.message : 'Unknown error'})`);
            await prisma.meetingTypePriority.create({
              data: {
                meetingType: safePriority.meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other",
                priorityValue: safePriority.priorityValue,
                urgentThresholdDays: safePriority.urgentThresholdDays || 3,
                generalThresholdDays: safePriority.generalThresholdDays || 30
              }
            });
            
            changedCount++;
            updatedPriorities.push(safePriority.meetingType);
            console.log(`✅ Created new priority for ${safePriority.meetingType}`);
          }
        }
      }
      
      console.log(`📊 Priority update summary: ${changedCount} changed, ${body.priorities.length - changedCount} unchanged`);
      if (updatedPriorities.length > 0) {
        console.log(`🔄 Updated priorities: ${updatedPriorities.join(', ')}`);
      }
    }
    
    // Return updated configuration with validation results
    const updatedPolicy = await loadPolicy();
    const updatedPriorities = await loadMeetingTypePriorities();
    
    // Re-validate the final configuration
    const finalValidation = validateAssignmentPolicy(updatedPolicy, currentPolicy);
    const lockStatus = getParameterLockStatus(updatedPolicy.mode);
    
    return NextResponse.json({
      success: true,
      data: {
        policy: updatedPolicy,
        priorities: updatedPriorities
      },
      validation: {
        policy: finalValidation,
        priorities: priorityValidations,
        parameterLocks: lockStatus,
        overallValid: finalValidation.isValid && priorityValidations.every(p => p.validation.isValid)
      },
      message: "Configuration updated successfully",
      warnings: finalValidation.warnings.length > 0 ? finalValidation.warnings : undefined,
      timestamp: new Date().toISOString(),
      changesSummary: {
        policyUpdated: !!body.policy,
        prioritiesUpdated: !!body.priorities && body.priorities.length > 0,
        fallbacksApplied: safePolicy !== body.policy || body.priorities?.some((p: any, i: number) => 
          priorityValidations[i] && !priorityValidations[i].validation.isValid
        )
      }
    });
  } catch (error) {
    console.error("Error updating auto-assignment config:", error);
    
    // Provide detailed error information for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };
    
    // Try to provide current configuration as fallback
    try {
      const currentPolicy = await loadPolicy();
      const currentPriorities = await loadMeetingTypePriorities();
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to update configuration",
          details: errorDetails,
          fallbackData: {
            policy: currentPolicy,
            priorities: currentPriorities
          },
          recovery: {
            suggestion: "Configuration was not updated. Current settings are preserved.",
            action: "Review the error details and try again with valid parameters."
          }
        },
        { status: 500 }
      );
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Critical system error during configuration update",
          details: errorDetails,
          recovery: {
            suggestion: "System may be in an inconsistent state. Contact administrator.",
            action: "Check system logs and database connectivity."
          }
        },
        { status: 500 }
      );
    }
  }
}

/**
 * Apply safe fallbacks for invalid policy configurations
 */
function applySafeFallbacks(policy: any, currentPolicy: any, validation: any): any {
  const safePolicy = { ...policy };
  
  // Apply fallbacks for critical errors
  validation.errors.forEach((error: any) => {
    switch (error.field) {
      case 'fairnessWindowDays':
        safePolicy.fairnessWindowDays = Math.max(7, Math.min(90, policy.fairnessWindowDays || currentPolicy.fairnessWindowDays));
        break;
      case 'maxGapHours':
        safePolicy.maxGapHours = Math.max(1, Math.min(100, policy.maxGapHours || currentPolicy.maxGapHours));
        break;
      case 'minAdvanceDays':
        safePolicy.minAdvanceDays = Math.max(0, Math.min(30, policy.minAdvanceDays || currentPolicy.minAdvanceDays));
        break;
      case 'w_fair':
        safePolicy.w_fair = Math.max(0, Math.min(5, policy.w_fair || currentPolicy.w_fair));
        break;
      case 'w_urgency':
        safePolicy.w_urgency = Math.max(0, Math.min(5, policy.w_urgency || currentPolicy.w_urgency));
        break;
      case 'w_lrs':
        safePolicy.w_lrs = Math.max(0, Math.min(5, policy.w_lrs || currentPolicy.w_lrs));
        break;
      case 'drConsecutivePenalty':
        safePolicy.drConsecutivePenalty = Math.max(-2.0, Math.min(0, policy.drConsecutivePenalty || currentPolicy.drConsecutivePenalty));
        break;
      case 'mode':
        safePolicy.mode = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'].includes(policy.mode) ? policy.mode : currentPolicy.mode;
        break;
    }
  });
  
  return safePolicy;
}

/**
 * Apply safe fallbacks for invalid priority configurations
 */
function applySafePriorityFallbacks(priority: any, validation: any): any {
  const safePriority = { ...priority };
  
  // Apply fallbacks for critical errors
  validation.errors.forEach((error: any) => {
    switch (error.field) {
      case 'priorityValue':
        safePriority.priorityValue = Math.max(1, Math.min(10, priority.priorityValue || 5));
        break;
      case 'urgentThresholdDays':
        safePriority.urgentThresholdDays = Math.max(0, Math.min(30, priority.urgentThresholdDays || 3));
        break;
      case 'generalThresholdDays':
        safePriority.generalThresholdDays = Math.max(1, Math.min(365, priority.generalThresholdDays || 30));
        break;
      case 'thresholds':
        // Fix threshold relationship
        if (safePriority.urgentThresholdDays >= safePriority.generalThresholdDays) {
          safePriority.urgentThresholdDays = Math.max(0, safePriority.generalThresholdDays - 1);
        }
        break;
    }
  });
  
  return safePriority;
}
