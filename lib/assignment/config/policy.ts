import prisma from "@/prisma/prisma";
import type { AssignmentPolicy, MeetingTypePriority, DRPolicy } from "@/types/assignment";

const DEFAULT_POLICY: AssignmentPolicy = {
  autoAssignEnabled: true,
  mode: 'NORMAL',
  fairnessWindowDays: 30,
  maxGapHours: 5,
  w_fair: 1.2,
  w_urgency: 0.8,
  w_lrs: 0.3,
  drConsecutivePenalty: -0.5, // Default penalty for consecutive DR assignments (Normal mode)
};

/**
 * Get mode-specific scoring weights
 */
export function getScoringWeights(mode: string): { w_fair: number; w_urgency: number; w_lrs: number } {
  switch (mode.toUpperCase()) {
    case 'BALANCE':
      return {
        w_fair: 2.0,      // High - make work equal between interpreters
        w_urgency: 0.6,   // Medium - some speed is good
        w_lrs: 0.6        // High - give turns to everyone
      };
    case 'URGENT':
      return {
        w_fair: 0.5,      // Low - speed is more important than fairness
        w_urgency: 2.5,   // Very High - assign fast, don't wait
        w_lrs: 0.2        // Low - don't worry about turns
      };
      case 'NORMAL':
    default:
      return {
        w_fair: 1.2,      // High - keep work balanced
        w_urgency: 0.8,   // Medium-High - speed matters
        w_lrs: 0.3        // Medium - some turns are good
      };

    case 'CUSTOM':
      // Admin can change these numbers
      return {
        w_fair: 1.0,      // Will be changed by admin
        w_urgency: 1.0,   // Will be changed by admin
        w_lrs: 1.0        // Will be changed by admin
      };
  }
}

/**
 * Get additional mode-defaults beyond weights
 */
export function getModeDefaults(mode: string): Pick<AssignmentPolicy, 'fairnessWindowDays' | 'maxGapHours' | 'drConsecutivePenalty' | 'w_fair' | 'w_urgency' | 'w_lrs'> {
  const upper = mode.toUpperCase();
  if (upper === 'BALANCE') {
    return {
      fairnessWindowDays: 60,
      maxGapHours: 2,
      drConsecutivePenalty: -0.8,
      ...getScoringWeights('BALANCE')
    };
  }
  if (upper === 'URGENT') {
    return {
      fairnessWindowDays: 14,
      maxGapHours: 10,
      drConsecutivePenalty: -0.1,
      ...getScoringWeights('URGENT')
    };
  }
  // NORMAL default
  return {
    fairnessWindowDays: 30,
    maxGapHours: 5,
    drConsecutivePenalty: -0.5,
    ...getScoringWeights('NORMAL')
  };
}

/**
 * Apply mode-specific thresholds to a meeting type priority when not in CUSTOM mode
 * Rules per requirements:
 * - Normal: DR urgent=1 day, general=7 days; others urgent=3, general=30
 * - Balance: same as Normal
 * - Urgent: DR urgent=0, General urgent=1; general thresholds same as Normal (DR=7, others=30)
 */
export function applyModeThresholds<T extends { meetingType: string; urgentThresholdDays: number; generalThresholdDays: number }>(
  priority: T,
  mode: string
): T {
  const upper = mode.toUpperCase();
  if (upper === 'CUSTOM') return priority;

  const isDR = priority.meetingType === 'DR';

  if (upper === 'URGENT') {
    return {
      ...priority,
      urgentThresholdDays: isDR ? 0 : 1,
      generalThresholdDays: isDR ? 7 : 30
    };
  }

  // NORMAL and BALANCE
  return {
    ...priority,
    urgentThresholdDays: isDR ? 1 : 3,
    generalThresholdDays: isDR ? 7 : 30
  };
}

/**
 * Load all meeting type priorities
 */
export async function loadMeetingTypePriorities(): Promise<MeetingTypePriority[]> {
  try {
    let priorities = await prisma.meetingTypePriority.findMany({
      orderBy: { priorityValue: 'desc' }
    });
    
    // If no priorities exist, create default ones
    if (priorities.length === 0) {
      console.log("No meeting type priorities found, creating defaults...");
      await createDefaultMeetingTypePriorities();
      priorities = await prisma.meetingTypePriority.findMany({
        orderBy: { priorityValue: 'desc' }
      });
    }
    
    return priorities;
  } catch (error) {
    console.error("Error loading meeting type priorities:", error);
    return [];
  }
}

/**
 * Create default meeting type priorities
 */
export async function createDefaultMeetingTypePriorities(): Promise<void> {
  const defaultPriorities = [
    { meetingType: 'DR' as const, priorityValue: 5, urgentThresholdDays: 1, generalThresholdDays: 7 },
    { meetingType: 'VIP' as const, priorityValue: 4, urgentThresholdDays: 2, generalThresholdDays: 14 },
    { meetingType: 'Weekly' as const, priorityValue: 3, urgentThresholdDays: 3, generalThresholdDays: 30 },
    { meetingType: 'General' as const, priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
    { meetingType: 'Augent' as const, priorityValue: 2, urgentThresholdDays: 3, generalThresholdDays: 30 },
    { meetingType: 'Other' as const, priorityValue: 1, urgentThresholdDays: 5, generalThresholdDays: 45 }
  ];

  try {
    for (const priority of defaultPriorities) {
      await prisma.meetingTypePriority.upsert({
        where: { meetingType: priority.meetingType },
        update: {}, // Don't update if exists
        create: priority
      });
    }
    console.log("Default meeting type priorities created successfully");
  } catch (error) {
    console.error("Error creating default meeting type priorities:", error);
    throw error;
  }
}

/**
 * Get meeting type priority by type
 */
  export async function getMeetingTypePriority(meetingType: string): Promise<MeetingTypePriority | null> {
  try {
    const priority = await prisma.meetingTypePriority.findUnique({
      where: { meetingType: meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other" }
    });
    return priority;
  } catch (error) {
    console.error(`Error loading priority for meeting type ${meetingType}:`, error);
    return null;
  }
}

//load policy that use for ..
export async function loadPolicy(): Promise<AssignmentPolicy> {
  try {
    const config = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!config) {
      // Create default config if none exists
      const defaultConfig = await prisma.autoAssignmentConfig.create({
        data: DEFAULT_POLICY
      });
      return validateAndClampPolicy(defaultConfig);
    }

    return validateAndClampPolicy(config);
  } catch (error) {
    console.error("Error loading assignment policy:", error);
    return DEFAULT_POLICY;
  }
}

/**
 * Validate and clamp policy values to safe ranges
 */
function validateAndClampPolicy(config: Record<string, unknown>): AssignmentPolicy {
  const mode = (config.mode as string) || 'NORMAL';
  const validMode = (mode === 'BALANCE' || mode === 'URGENT' || mode === 'NORMAL' || mode === 'CUSTOM') ? mode : 'NORMAL';
  
  const clamped: AssignmentPolicy = {
    autoAssignEnabled: Boolean(config.autoAssignEnabled),
    mode: validMode,
    fairnessWindowDays: Math.max(7, Math.min(90, Number(config.fairnessWindowDays) || 30)),
    maxGapHours: Math.max(1, Math.min(100, Number(config.maxGapHours) || 5)),
    w_fair: Math.max(0, Math.min(5, Number(config.w_fair) || 1.2)),
    w_urgency: Math.max(0, Math.min(5, Number(config.w_urgency) || 0.8)),
    w_lrs: Math.max(0, Math.min(5, Number(config.w_lrs) || 0.3)),
    drConsecutivePenalty: Math.max(-2.0, Math.min(0, Number(config.drConsecutivePenalty) || -0.5)),
  };

  // For non-CUSTOM modes, enforce mode-specific defaults to keep UI locked values consistent
  if (validMode !== 'CUSTOM') {
    const defaults = getModeDefaults(validMode);
    return {
      ...clamped,
      ...defaults,
    };
  }

  return clamped;
}

/**
 * Update the active policy
 */
export async function updatePolicy(policy: Partial<AssignmentPolicy>): Promise<AssignmentPolicy> {
  try {
    const existing = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (existing) {
      const updated = await prisma.autoAssignmentConfig.update({
        where: { id: existing.id },
        data: policy
      });
      return validateAndClampPolicy(updated);
    } else {
      const created = await prisma.autoAssignmentConfig.create({
        data: { ...DEFAULT_POLICY, ...policy }
      });
      return validateAndClampPolicy(created);
    }
  } catch (error) {
    console.error("Error updating assignment policy:", error);
    throw new Error("Failed to update assignment policy");
  }
}

/**
 * Update meeting type priority
 */
export async function updateMeetingTypePriority(
  meetingType: string, 
  priority: Partial<Omit<MeetingTypePriority, 'id' | 'meetingType' | 'createdAt' | 'updatedAt'>>
): Promise<MeetingTypePriority> {
  try {
    const updated = await prisma.meetingTypePriority.update({
      where: { meetingType: meetingType as "DR" | "VIP" | "Weekly" | "General" | "Augent" | "Other" },
      data: priority
    });
    return updated;
  } catch (error) {
    console.error(`Error updating priority for meeting type ${meetingType}:`, error);
    throw new Error(`Failed to update priority for meeting type ${meetingType}`);
  }
}

/**
 * Get DR policy configuration based on mode with detailed policy information
 * Enhanced to provide comprehensive mode-specific DR policies with override mechanisms
 */
export function getDRPolicy(mode: string, customConfig?: Partial<AssignmentPolicy>): DRPolicy & {
  description: string;
  overrideAvailable: boolean;
  emergencyOverride: boolean;
  modeSpecificRules: {
    blockingBehavior: 'HARD_BLOCK' | 'SOFT_PENALTY' | 'MINIMAL_PENALTY';
    fairnessWeight: 'HIGH' | 'MEDIUM' | 'LOW';
    urgencyPriority: 'HIGH' | 'MEDIUM' | 'LOW';
    overrideThreshold: 'NEVER' | 'CRITICAL_ONLY' | 'NO_ALTERNATIVES' | 'ALWAYS';
  };
  validationRules: {
    minPenalty: number;
    maxPenalty: number;
    recommendedRange: [number, number];
  };
} {
  const upper = mode.toUpperCase();
  
  switch (upper) {
    case 'BALANCE':
      return {
        scope: "GLOBAL",
        forbidConsecutive: true, // Hard block for balance mode
        consecutivePenalty: -0.8,
        includePendingInGlobal: false,
        description: "Balance mode: Hard block on consecutive DR assignments to maximize fairness distribution",
        overrideAvailable: true,
        emergencyOverride: true,
        modeSpecificRules: {
          blockingBehavior: 'HARD_BLOCK',
          fairnessWeight: 'HIGH',
          urgencyPriority: 'MEDIUM',
          overrideThreshold: 'NO_ALTERNATIVES'
        },
        validationRules: {
          minPenalty: -2.0,
          maxPenalty: -0.5,
          recommendedRange: [-1.0, -0.7]
        }
      };
    case 'URGENT':
      return {
        scope: "GLOBAL", 
        forbidConsecutive: false, // Soft penalty for urgent mode
        consecutivePenalty: -0.1,
        includePendingInGlobal: true, // Include pending in urgent mode for faster decisions
        description: "Urgent mode: Minimal penalties to prioritize immediate assignment and coverage",
        overrideAvailable: false, // No overrides needed since no blocking
        emergencyOverride: false,
        modeSpecificRules: {
          blockingBehavior: 'MINIMAL_PENALTY',
          fairnessWeight: 'LOW',
          urgencyPriority: 'HIGH',
          overrideThreshold: 'ALWAYS'
        },
        validationRules: {
          minPenalty: -0.3,
          maxPenalty: 0,
          recommendedRange: [-0.2, -0.05]
        }
      };
    case 'CUSTOM':
      // For CUSTOM mode, use configurable values from policy with enhanced validation
      const customPenalty = customConfig?.drConsecutivePenalty ?? -0.7;
      const forbidConsecutive = customPenalty <= -1.0; // Hard block if penalty is very high
      const blockingBehavior = forbidConsecutive ? 'HARD_BLOCK' : 
                              (customPenalty <= -0.3 ? 'SOFT_PENALTY' : 'MINIMAL_PENALTY');
      
      return {
        scope: "GLOBAL",
        forbidConsecutive,
        consecutivePenalty: customPenalty,
        includePendingInGlobal: false,
        description: `Custom mode: ${forbidConsecutive ? 'Hard block' : 'Soft penalty'} with ${Math.abs(customPenalty).toFixed(1)} penalty magnitude`,
        overrideAvailable: true,
        emergencyOverride: true,
        modeSpecificRules: {
          blockingBehavior,
          fairnessWeight: customPenalty <= -0.5 ? 'HIGH' : 'MEDIUM',
          urgencyPriority: 'MEDIUM',
          overrideThreshold: forbidConsecutive ? 'CRITICAL_ONLY' : 'NO_ALTERNATIVES'
        },
        validationRules: {
          minPenalty: -2.0,
          maxPenalty: 0,
          recommendedRange: [-1.0, -0.3]
        }
      };
    case 'NORMAL':
    default:
      return {
        scope: "GLOBAL",
        forbidConsecutive: false, // Soft penalty for normal mode
        consecutivePenalty: -0.5,
        includePendingInGlobal: false,
        description: "Normal mode: Balanced approach with moderate consecutive penalties for fair distribution",
        overrideAvailable: true,
        emergencyOverride: true,
        modeSpecificRules: {
          blockingBehavior: 'SOFT_PENALTY',
          fairnessWeight: 'MEDIUM',
          urgencyPriority: 'MEDIUM',
          overrideThreshold: 'NO_ALTERNATIVES'
        },
        validationRules: {
          minPenalty: -1.0,
          maxPenalty: -0.1,
          recommendedRange: [-0.7, -0.3]
        }
      };
  }
}

/**
 * Check if DR policy allows override for critical coverage with enhanced mode-specific logic
 */
export function canOverrideDRPolicy(
  policy: DRPolicy & { 
    overrideAvailable?: boolean; 
    emergencyOverride?: boolean;
    modeSpecificRules?: {
      overrideThreshold: 'NEVER' | 'CRITICAL_ONLY' | 'NO_ALTERNATIVES' | 'ALWAYS';
    };
  },
  options?: {
    isCriticalCoverage?: boolean;
    noAlternativesAvailable?: boolean;
    systemLoad?: 'HIGH' | 'MEDIUM' | 'LOW';
  }
): { canOverride: boolean; reason: string; overrideType?: 'EMERGENCY' | 'CRITICAL' | 'NO_ALTERNATIVES' | 'POLICY' } {
  const { 
    isCriticalCoverage = false, 
    noAlternativesAvailable = false,
    systemLoad = 'MEDIUM'
  } = options || {};

  const overrideThreshold = policy.modeSpecificRules?.overrideThreshold || 'NO_ALTERNATIVES';

  // Check override threshold rules
  switch (overrideThreshold) {
    case 'NEVER':
      return {
        canOverride: false,
        reason: "Mode policy prohibits all overrides"
      };

    case 'CRITICAL_ONLY':
      if (isCriticalCoverage && policy.emergencyOverride) {
        return {
          canOverride: true,
          reason: "Emergency override for critical coverage situation",
          overrideType: 'EMERGENCY'
        };
      }
      return {
        canOverride: false,
        reason: "Only critical coverage overrides allowed in this mode"
      };

    case 'NO_ALTERNATIVES':
      // Emergency override for critical coverage
      if (isCriticalCoverage && policy.emergencyOverride) {
        return {
          canOverride: true,
          reason: "Emergency override for critical coverage",
          overrideType: 'EMERGENCY'
        };
      }
      
      // Override when no alternatives available
      if (noAlternativesAvailable && policy.overrideAvailable) {
        return {
          canOverride: true,
          reason: "Override applied - no alternative interpreters available",
          overrideType: 'NO_ALTERNATIVES'
        };
      }

      // High system load can trigger overrides in some modes
      if (systemLoad === 'HIGH' && policy.overrideAvailable) {
        return {
          canOverride: true,
          reason: "Override applied due to high system load",
          overrideType: 'CRITICAL'
        };
      }

      return {
        canOverride: false,
        reason: "Override requires critical coverage or no alternatives"
      };

    case 'ALWAYS':
      // Urgent mode or policies that don't block
      if (!policy.forbidConsecutive) {
        return {
          canOverride: true,
          reason: "Policy uses penalties only, no blocking required",
          overrideType: 'POLICY'
        };
      }

      if (policy.overrideAvailable) {
        return {
          canOverride: true,
          reason: "Policy allows flexible overrides",
          overrideType: 'POLICY'
        };
      }

      return {
        canOverride: true,
        reason: "Mode allows all overrides",
        overrideType: 'POLICY'
      };

    default:
      // Fallback to legacy behavior
      if (isCriticalCoverage && policy.emergencyOverride) {
        return {
          canOverride: true,
          reason: "Emergency override for critical coverage",
          overrideType: 'EMERGENCY'
        };
      }

      if (policy.overrideAvailable) {
        return {
          canOverride: true,
          reason: "Policy allows override when needed",
          overrideType: 'POLICY'
        };
      }

      return {
        canOverride: false,
        reason: "Policy does not allow overrides"
      };
  }
}

/**
 * Apply DR policy rules to determine if an interpreter should be blocked or penalized
 * Enhanced with mode-specific logic and comprehensive override handling
 */
export function applyDRPolicyRules(
  isConsecutiveGlobal: boolean,
  policy: DRPolicy & { 
    overrideAvailable?: boolean; 
    emergencyOverride?: boolean;
    modeSpecificRules?: {
      blockingBehavior: 'HARD_BLOCK' | 'SOFT_PENALTY' | 'MINIMAL_PENALTY';
      overrideThreshold: 'NEVER' | 'CRITICAL_ONLY' | 'NO_ALTERNATIVES' | 'ALWAYS';
    };
  },
  options?: {
    isCriticalCoverage?: boolean;
    noAlternativesAvailable?: boolean;
    systemLoad?: 'HIGH' | 'MEDIUM' | 'LOW';
    interpreterListSize?: number;
  }
): {
  isBlocked: boolean;
  penaltyApplied: boolean;
  penaltyAmount: number;
  overrideApplied: boolean;
  reason: string;
  policyDecision: {
    blockingBehavior: string;
    overrideType?: string;
    systemFactors: string[];
  };
} {
  const { 
    isCriticalCoverage = false, 
    noAlternativesAvailable = false,
    systemLoad = 'MEDIUM',
    interpreterListSize = 0
  } = options || {};

  // If not consecutive, no restrictions apply
  if (!isConsecutiveGlobal) {
    return {
      isBlocked: false,
      penaltyApplied: false,
      penaltyAmount: 0,
      overrideApplied: false,
      reason: "Not consecutive to last global DR assignment",
      policyDecision: {
        blockingBehavior: 'NO_RESTRICTION',
        systemFactors: ['not_consecutive']
      }
    };
  }

  const blockingBehavior = policy.modeSpecificRules?.blockingBehavior || 
                          (policy.forbidConsecutive ? 'HARD_BLOCK' : 'SOFT_PENALTY');

  // Collect system factors for decision logging
  const systemFactors: string[] = ['consecutive_global'];
  if (isCriticalCoverage) systemFactors.push('critical_coverage');
  if (noAlternativesAvailable) systemFactors.push('no_alternatives');
  if (systemLoad === 'HIGH') systemFactors.push('high_system_load');
  if (interpreterListSize > 0 && interpreterListSize < 3) systemFactors.push('small_pool');

  // Check for override conditions with enhanced logic
  const overrideCheck = canOverrideDRPolicy(policy, {
    isCriticalCoverage,
    noAlternativesAvailable,
    systemLoad
  });

  const shouldOverride = overrideCheck.canOverride && 
                        (isCriticalCoverage || noAlternativesAvailable || systemLoad === 'HIGH');

  // Apply mode-specific blocking behavior
  switch (blockingBehavior) {
    case 'HARD_BLOCK':
      if (shouldOverride) {
        return {
          isBlocked: false,
          penaltyApplied: true,
          penaltyAmount: policy.consecutivePenalty,
          overrideApplied: true,
          reason: `Hard block overridden: ${overrideCheck.reason}`,
          policyDecision: {
            blockingBehavior: 'HARD_BLOCK_OVERRIDDEN',
            overrideType: overrideCheck.overrideType,
            systemFactors
          }
        };
      }

      return {
        isBlocked: true,
        penaltyApplied: false,
        penaltyAmount: 0,
        overrideApplied: false,
        reason: "Consecutive DR assignment hard blocked by mode policy",
        policyDecision: {
          blockingBehavior: 'HARD_BLOCK',
          systemFactors
        }
      };

    case 'SOFT_PENALTY':
      // Apply penalty but don't block
      const penaltyAmount = shouldOverride ? 
                           policy.consecutivePenalty * 0.5 : // Reduced penalty if override conditions met
                           policy.consecutivePenalty;

      return {
        isBlocked: false,
        penaltyApplied: true,
        penaltyAmount,
        overrideApplied: shouldOverride,
        reason: shouldOverride ? 
                `Soft penalty reduced due to: ${overrideCheck.reason}` :
                "Consecutive DR soft penalty applied",
        policyDecision: {
          blockingBehavior: shouldOverride ? 'SOFT_PENALTY_REDUCED' : 'SOFT_PENALTY',
          overrideType: shouldOverride ? overrideCheck.overrideType : undefined,
          systemFactors
        }
      };

    case 'MINIMAL_PENALTY':
      // Very light penalty, mainly for logging
      const minimalPenalty = Math.max(policy.consecutivePenalty * 0.2, -0.1);

      return {
        isBlocked: false,
        penaltyApplied: true,
        penaltyAmount: minimalPenalty,
        overrideApplied: false,
        reason: "Minimal consecutive DR penalty applied (urgent mode)",
        policyDecision: {
          blockingBehavior: 'MINIMAL_PENALTY',
          systemFactors
        }
      };

    default:
      // Fallback to legacy behavior
      if (policy.forbidConsecutive) {
        if (shouldOverride) {
          return {
            isBlocked: false,
            penaltyApplied: true,
            penaltyAmount: policy.consecutivePenalty,
            overrideApplied: true,
            reason: `Override applied: ${overrideCheck.reason}`,
            policyDecision: {
              blockingBehavior: 'LEGACY_OVERRIDE',
              overrideType: overrideCheck.overrideType,
              systemFactors
            }
          };
        }

        return {
          isBlocked: true,
          penaltyApplied: false,
          penaltyAmount: 0,
          overrideApplied: false,
          reason: "Consecutive DR assignment blocked by policy",
          policyDecision: {
            blockingBehavior: 'LEGACY_BLOCK',
            systemFactors
          }
        };
      }

      // Soft penalty mode
      return {
        isBlocked: false,
        penaltyApplied: true,
        penaltyAmount: policy.consecutivePenalty,
        overrideApplied: false,
        reason: "Consecutive DR penalty applied",
        policyDecision: {
          blockingBehavior: 'LEGACY_PENALTY',
          systemFactors
        }
      };
  }
}
/**
 * Validate DR policy configuration and provide warnings for mode-specific settings
 */
export function validateDRPolicyConfig(
  mode: string,
  config: Partial<AssignmentPolicy>
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];
  
  const drPenalty = config.drConsecutivePenalty ?? -0.5;
  const policy = getDRPolicy(mode, config);
  
  // Validate penalty range
  if (drPenalty > 0) {
    errors.push("DR consecutive penalty must be negative (penalty reduces score)");
  }
  
  if (drPenalty < policy.validationRules.minPenalty) {
    warnings.push(`DR penalty ${drPenalty} is below recommended minimum ${policy.validationRules.minPenalty}`);
  }
  
  if (drPenalty > policy.validationRules.maxPenalty) {
    warnings.push(`DR penalty ${drPenalty} is above recommended maximum ${policy.validationRules.maxPenalty}`);
  }
  
  // Mode-specific validation
  const upper = mode.toUpperCase();
  switch (upper) {
    case 'BALANCE':
      if (drPenalty > -0.5) {
        warnings.push("Balance mode works best with stronger DR penalties (< -0.5) to ensure fairness");
      }
      if (!policy.forbidConsecutive && drPenalty > -1.0) {
        recommendations.push("Consider using hard blocking (penalty <= -1.0) in Balance mode for maximum fairness");
      }
      break;
      
    case 'URGENT':
      if (drPenalty < -0.3) {
        warnings.push("Urgent mode should use minimal DR penalties (> -0.3) to prioritize immediate assignment");
      }
      if (policy.forbidConsecutive) {
        errors.push("Urgent mode should not use hard blocking as it prevents immediate assignment");
      }
      break;
      
    case 'NORMAL':
      if (drPenalty < -1.0 || drPenalty > -0.1) {
        recommendations.push("Normal mode works best with moderate DR penalties between -1.0 and -0.1");
      }
      break;
      
    case 'CUSTOM':
      if (Math.abs(drPenalty) < 0.1) {
        warnings.push("Very small DR penalties may not effectively distribute workload");
      }
      if (drPenalty <= -1.5) {
        warnings.push("Very large DR penalties may cause assignment failures in small interpreter pools");
      }
      break;
  }
  
  // Check for potential system issues
  if (policy.forbidConsecutive && !policy.overrideAvailable) {
    errors.push("Hard blocking without override mechanisms may cause assignment failures");
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    warnings,
    errors,
    recommendations
  };
}

/**
 * Get mode-specific DR policy recommendations
 */
export function getDRPolicyRecommendations(mode: string): {
  description: string;
  recommendedPenalty: number;
  keyFeatures: string[];
  bestUseCases: string[];
  potentialIssues: string[];
} {
  const upper = mode.toUpperCase();
  
  switch (upper) {
    case 'BALANCE':
      return {
        description: "Maximizes fairness by hard-blocking consecutive DR assignments",
        recommendedPenalty: -0.8,
        keyFeatures: [
          "Hard blocking of consecutive assignments",
          "Override available for critical coverage",
          "High fairness weighting",
          "Delayed assignment processing for optimization"
        ],
        bestUseCases: [
          "Large interpreter pools (5+ interpreters)",
          "Predictable scheduling patterns",
          "Emphasis on long-term fairness",
          "Non-urgent DR meetings"
        ],
        potentialIssues: [
          "May cause assignment delays",
          "Requires override handling for emergencies",
          "Less effective with small interpreter pools"
        ]
      };
      
    case 'URGENT':
      return {
        description: "Prioritizes immediate assignment with minimal fairness constraints",
        recommendedPenalty: -0.1,
        keyFeatures: [
          "Minimal penalties only",
          "No hard blocking",
          "Includes pending bookings in decisions",
          "Immediate assignment processing"
        ],
        bestUseCases: [
          "Emergency or urgent DR meetings",
          "Small interpreter pools",
          "High-priority coverage requirements",
          "Time-sensitive assignments"
        ],
        potentialIssues: [
          "May create unfair workload distribution",
          "Can lead to interpreter burnout",
          "Less optimal long-term fairness"
        ]
      };
      
    case 'NORMAL':
      return {
        description: "Balanced approach with moderate penalties and flexible overrides",
        recommendedPenalty: -0.5,
        keyFeatures: [
          "Soft penalties for consecutive assignments",
          "Override available when needed",
          "Balanced fairness and urgency weighting",
          "Standard assignment processing"
        ],
        bestUseCases: [
          "General DR meeting scheduling",
          "Mixed interpreter pool sizes",
          "Standard operational requirements",
          "Balanced fairness and efficiency needs"
        ],
        potentialIssues: [
          "May not optimize for extreme fairness",
          "Requires careful penalty tuning",
          "Moderate complexity in override logic"
        ]
      };
      
    case 'CUSTOM':
      return {
        description: "Fully configurable policy for specific organizational needs",
        recommendedPenalty: -0.7,
        keyFeatures: [
          "All parameters configurable",
          "Flexible blocking and penalty rules",
          "Override mechanisms available",
          "Validation and warning system"
        ],
        bestUseCases: [
          "Unique organizational requirements",
          "Specific fairness or urgency needs",
          "Testing and optimization scenarios",
          "Advanced administrative control"
        ],
        potentialIssues: [
          "Requires expertise to configure properly",
          "Risk of suboptimal configurations",
          "More complex validation requirements"
        ]
      };
      
    default:
      return getDRPolicyRecommendations('NORMAL');
  }
}

/**
 * Get default DR policy configuration
 */
export function getDefaultDRPolicy(): DRPolicy {
  return {
    scope: "GLOBAL",
    forbidConsecutive: false,
    consecutivePenalty: -0.7,
    includePendingInGlobal: false
  };
}