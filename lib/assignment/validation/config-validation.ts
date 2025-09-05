import type { AssignmentPolicy, MeetingTypePriority } from "@/types/assignment";
import { getDRPolicy, getModeDefaults, getScoringWeights } from "../config/policy";

// Configuration validation result interfaces
export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
  recommendations: ValidationMessage[];
  impactAssessment: ConfigurationImpact;
}

export interface ValidationMessage {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

export interface ConfigurationImpact {
  fairnessImpact: 'positive' | 'neutral' | 'negative';
  urgencyImpact: 'positive' | 'neutral' | 'negative';
  systemLoad: 'low' | 'medium' | 'high';
  assignmentSpeed: 'faster' | 'normal' | 'slower';
  overallRisk: 'low' | 'medium' | 'high';
  description: string;
  keyChanges: string[];
}

// Parameter validation ranges and rules
export const VALIDATION_RULES = {
  fairnessWindowDays: {
    min: 7,
    max: 90,
    recommended: { min: 14, max: 60 },
    description: "Days to consider for fairness calculations"
  },
  maxGapHours: {
    min: 1,
    max: 100,
    recommended: { min: 2, max: 12 },
    description: "Maximum hours between assignments for same interpreter"
  },
  w_fair: {
    min: 0,
    max: 5,
    recommended: { min: 0.5, max: 3.0 },
    description: "Fairness weight in scoring algorithm"
  },
  w_urgency: {
    min: 0,
    max: 5,
    recommended: { min: 0.3, max: 2.5 },
    description: "Urgency weight in scoring algorithm"
  },
  w_lrs: {
    min: 0,
    max: 5,
    recommended: { min: 0.1, max: 1.0 },
    description: "Last rotation score weight in scoring algorithm"
  },
  drConsecutivePenalty: {
    min: -2.0,
    max: 0,
    recommended: { min: -1.0, max: -0.1 },
    description: "Penalty for consecutive DR assignments (negative values)"
  }
} as const;

// Mode-specific parameter constraints
export const MODE_CONSTRAINTS = {
  BALANCE: {
    lockedParams: ['fairnessWindowDays', 'maxGapHours', 'drConsecutivePenalty', 'w_fair', 'w_urgency', 'w_lrs'],
    description: "Balance mode optimizes for fairness with locked parameters",
    keyFeatures: ["Extended fairness window", "Strong DR penalties", "High fairness weighting"]
  },
  URGENT: {
    lockedParams: ['fairnessWindowDays', 'maxGapHours', 'drConsecutivePenalty', 'w_fair', 'w_urgency', 'w_lrs'],
    description: "Urgent mode prioritizes immediate assignment with minimal constraints",
    keyFeatures: ["Short fairness window", "Minimal DR penalties", "High urgency weighting"]
  },
  NORMAL: {
    lockedParams: ['fairnessWindowDays', 'maxGapHours', 'drConsecutivePenalty', 'w_fair', 'w_urgency', 'w_lrs'],
    description: "Normal mode provides balanced fairness and urgency",
    keyFeatures: ["Standard fairness window", "Moderate DR penalties", "Balanced weighting"]
  },
  CUSTOM: {
    lockedParams: [],
    description: "Custom mode allows full parameter configuration",
    keyFeatures: ["All parameters configurable", "Advanced validation", "Expert mode"]
  }
} as const;

/**
 * Validate assignment policy configuration with comprehensive checks
 */
export function validateAssignmentPolicy(
  policy: Partial<AssignmentPolicy>,
  currentPolicy?: AssignmentPolicy
): ValidationResult {
  const warnings: ValidationMessage[] = [];
  const errors: ValidationMessage[] = [];
  const recommendations: ValidationMessage[] = [];

  // Validate mode
  const mode = policy.mode || 'NORMAL';
  if (!['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'].includes(mode)) {
    errors.push({
      field: 'mode',
      message: `Invalid mode: ${mode}`,
      severity: 'critical',
      suggestion: 'Use BALANCE, URGENT, NORMAL, or CUSTOM'
    });
  }

  // Validate individual parameters
  validateNumericParameter('fairnessWindowDays', policy.fairnessWindowDays, warnings, errors, recommendations);
  validateNumericParameter('maxGapHours', policy.maxGapHours, warnings, errors, recommendations);
  validateNumericParameter('w_fair', policy.w_fair, warnings, errors, recommendations);
  validateNumericParameter('w_urgency', policy.w_urgency, warnings, errors, recommendations);
  validateNumericParameter('w_lrs', policy.w_lrs, warnings, errors, recommendations);
  validateNumericParameter('drConsecutivePenalty', policy.drConsecutivePenalty, warnings, errors, recommendations);

  // Mode-specific validation
  validateModeSpecificConstraints(mode, policy, warnings, errors, recommendations);

  // Cross-parameter validation
  validateParameterRelationships(policy, warnings, errors, recommendations);

  // DR policy validation
  validateDRPolicyConfiguration(mode, policy, warnings, errors, recommendations);

  // Generate impact assessment
  const impactAssessment = assessConfigurationImpact(policy, currentPolicy);

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    recommendations,
    impactAssessment
  };
}

/**
 * Validate numeric parameter against rules
 */
function validateNumericParameter(
  field: keyof typeof VALIDATION_RULES,
  value: number | undefined,
  warnings: ValidationMessage[],
  errors: ValidationMessage[],
  recommendations: ValidationMessage[]
): void {
  if (value === undefined) return;

  const rules = VALIDATION_RULES[field];
  
  // Check hard limits
  if (value < rules.min || value > rules.max) {
    errors.push({
      field,
      message: `${field} must be between ${rules.min} and ${rules.max}`,
      severity: 'critical',
      suggestion: `Current value ${value} is outside valid range`
    });
    return;
  }

  // Check recommended ranges
  if (value < rules.recommended.min || value > rules.recommended.max) {
    warnings.push({
      field,
      message: `${field} is outside recommended range (${rules.recommended.min}-${rules.recommended.max})`,
      severity: 'medium',
      suggestion: `Consider using a value between ${rules.recommended.min} and ${rules.recommended.max}`
    });
  }

  // Field-specific warnings
  addFieldSpecificWarnings(field, value, warnings, recommendations);
}

/**
 * Add field-specific validation warnings
 */
function addFieldSpecificWarnings(
  field: string,
  value: number,
  warnings: ValidationMessage[],
  recommendations: ValidationMessage[]
): void {
  switch (field) {
    case 'fairnessWindowDays':
      if (value < 14) {
        warnings.push({
          field,
          message: "Short fairness window may not provide adequate fairness tracking",
          severity: 'medium',
          suggestion: "Consider using at least 14 days for meaningful fairness calculations"
        });
      }
      if (value > 60) {
        warnings.push({
          field,
          message: "Long fairness window may slow down assignment calculations",
          severity: 'low',
          suggestion: "Consider using 60 days or less for optimal performance"
        });
      }
      break;

    case 'maxGapHours':
      if (value < 2) {
        warnings.push({
          field,
          message: "Very short gap hours may cause frequent assignment conflicts",
          severity: 'medium',
          suggestion: "Consider using at least 2 hours to allow for travel time"
        });
      }
      if (value > 24) {
        recommendations.push({
          field,
          message: "Large gap hours may reduce assignment efficiency",
          severity: 'low',
          suggestion: "Consider if gaps over 24 hours are necessary for your use case"
        });
      }
      break;

    case 'drConsecutivePenalty':
      if (value > -0.1) {
        warnings.push({
          field,
          message: "Very small DR penalty may not effectively prevent consecutive assignments",
          severity: 'medium',
          suggestion: "Consider using a penalty of at least -0.1 for meaningful impact"
        });
      }
      if (value < -1.5) {
        warnings.push({
          field,
          message: "Very large DR penalty may cause assignment failures in small pools",
          severity: 'high',
          suggestion: "Consider using a penalty no smaller than -1.5 to avoid blocking all assignments"
        });
      }
      break;

    case 'w_fair':
      if (value < 0.5) {
        recommendations.push({
          field,
          message: "Low fairness weight may lead to uneven workload distribution",
          severity: 'medium',
          suggestion: "Consider increasing fairness weight for better workload balance"
        });
      }
      break;

    case 'w_urgency':
      if (value > 2.0) {
        warnings.push({
          field,
          message: "Very high urgency weight may override fairness considerations",
          severity: 'medium',
          suggestion: "Consider balancing urgency with fairness for sustainable assignments"
        });
      }
      break;
  }
}

/**
 * Validate mode-specific constraints
 */
function validateModeSpecificConstraints(
  mode: string,
  policy: Partial<AssignmentPolicy>,
  warnings: ValidationMessage[],
  errors: ValidationMessage[],
  recommendations: ValidationMessage[]
): void {
  const constraints = MODE_CONSTRAINTS[mode as keyof typeof MODE_CONSTRAINTS];
  if (!constraints) return;

  // For non-CUSTOM modes, check if user is trying to modify locked parameters
  if (mode !== 'CUSTOM') {
    const modeDefaults = getModeDefaults(mode);
    
    constraints.lockedParams.forEach(param => {
      const paramKey = param as keyof AssignmentPolicy;
      if (policy[paramKey] !== undefined && policy[paramKey] !== modeDefaults[paramKey]) {
        warnings.push({
          field: param,
          message: `Parameter ${param} is locked in ${mode} mode`,
          severity: 'medium',
          suggestion: `Use CUSTOM mode to modify this parameter, or accept the ${mode} mode default`
        });
      }
    });
  }

  // Mode-specific recommendations
  if (mode === 'CUSTOM') {
    recommendations.push({
      field: 'mode',
      message: "Custom mode requires careful parameter tuning",
      severity: 'medium',
      suggestion: "Consider starting with a preset mode and switching to CUSTOM only if needed"
    });
  }
}

/**
 * Validate relationships between parameters
 */
function validateParameterRelationships(
  policy: Partial<AssignmentPolicy>,
  warnings: ValidationMessage[],
  errors: ValidationMessage[],
  recommendations: ValidationMessage[]
): void {
  // Check weight balance
  const wFair = policy.w_fair || 1.0;
  const wUrgency = policy.w_urgency || 1.0;
  const wLrs = policy.w_lrs || 1.0;
  
  const totalWeight = wFair + wUrgency + wLrs;
  if (totalWeight < 1.0) {
    warnings.push({
      field: 'weights',
      message: "Very low total weights may reduce assignment effectiveness",
      severity: 'medium',
      suggestion: "Consider increasing one or more weights for better scoring differentiation"
    });
  }

  // Check fairness vs urgency balance
  if (wUrgency > wFair * 3) {
    warnings.push({
      field: 'weights',
      message: "Urgency weight significantly higher than fairness weight",
      severity: 'medium',
      suggestion: "This may lead to unfair workload distribution over time"
    });
  }

  // No additional cross-parameter validation needed after removing minAdvanceDays
}

/**
 * Validate DR policy configuration
 */
function validateDRPolicyConfiguration(
  mode: string,
  policy: Partial<AssignmentPolicy>,
  warnings: ValidationMessage[],
  errors: ValidationMessage[],
  recommendations: ValidationMessage[]
): void {
  const drPolicy = getDRPolicy(mode, policy);
  const penalty = policy.drConsecutivePenalty || drPolicy.consecutivePenalty;

  // Validate penalty is within policy rules
  if (penalty < drPolicy.validationRules.minPenalty) {
    warnings.push({
      field: 'drConsecutivePenalty',
      message: `DR penalty below ${mode} mode minimum (${drPolicy.validationRules.minPenalty})`,
      severity: 'high',
      suggestion: `Consider using a penalty >= ${drPolicy.validationRules.minPenalty} for this mode`
    });
  }

  if (penalty > drPolicy.validationRules.maxPenalty) {
    warnings.push({
      field: 'drConsecutivePenalty',
      message: `DR penalty above ${mode} mode maximum (${drPolicy.validationRules.maxPenalty})`,
      severity: 'medium',
      suggestion: `Consider using a penalty <= ${drPolicy.validationRules.maxPenalty} for this mode`
    });
  }

  // Mode-specific DR validation
  switch (mode.toUpperCase()) {
    case 'BALANCE':
      if (!drPolicy.forbidConsecutive && penalty > -0.7) {
        recommendations.push({
          field: 'drConsecutivePenalty',
          message: "Balance mode works best with strong DR penalties or hard blocking",
          severity: 'medium',
          suggestion: "Consider using a penalty <= -0.7 or enabling hard blocking"
        });
      }
      break;

    case 'URGENT':
      if (drPolicy.forbidConsecutive) {
        errors.push({
          field: 'drConsecutivePenalty',
          message: "Urgent mode should not use hard blocking",
          severity: 'high',
          suggestion: "Use soft penalties (> -1.0) to allow immediate assignment"
        });
      }
      break;
  }
}

/**
 * Assess the impact of configuration changes
 */
export function assessConfigurationImpact(
  newPolicy: Partial<AssignmentPolicy>,
  currentPolicy?: AssignmentPolicy
): ConfigurationImpact {
  const mode = newPolicy.mode || 'NORMAL';
  const keyChanges: string[] = [];
  
  // Analyze mode change impact
  if (currentPolicy && newPolicy.mode && newPolicy.mode !== currentPolicy.mode) {
    keyChanges.push(`Mode changed from ${currentPolicy.mode} to ${newPolicy.mode}`);
  }

  // Analyze parameter changes
  if (currentPolicy) {
    const significantChanges = analyzeParameterChanges(newPolicy, currentPolicy);
    keyChanges.push(...significantChanges);
  }

  // Determine impact levels
  const fairnessImpact = assessFairnessImpact(newPolicy, currentPolicy);
  const urgencyImpact = assessUrgencyImpact(newPolicy, currentPolicy);
  const systemLoad = assessSystemLoad(newPolicy);
  const assignmentSpeed = assessAssignmentSpeed(newPolicy);
  const overallRisk = assessOverallRisk(newPolicy, fairnessImpact, urgencyImpact, systemLoad);

  return {
    fairnessImpact,
    urgencyImpact,
    systemLoad,
    assignmentSpeed,
    overallRisk,
    description: generateImpactDescription(mode, fairnessImpact, urgencyImpact, systemLoad),
    keyChanges
  };
}

/**
 * Analyze significant parameter changes
 */
function analyzeParameterChanges(
  newPolicy: Partial<AssignmentPolicy>,
  currentPolicy: AssignmentPolicy
): string[] {
  const changes: string[] = [];
  
  // Check fairness window changes
  if (newPolicy.fairnessWindowDays && 
      Math.abs(newPolicy.fairnessWindowDays - currentPolicy.fairnessWindowDays) > 7) {
    const direction = newPolicy.fairnessWindowDays > currentPolicy.fairnessWindowDays ? 'increased' : 'decreased';
    changes.push(`Fairness window ${direction} significantly`);
  }

  // Check weight changes
  if (newPolicy.w_fair && Math.abs(newPolicy.w_fair - currentPolicy.w_fair) > 0.5) {
    const direction = newPolicy.w_fair > currentPolicy.w_fair ? 'increased' : 'decreased';
    changes.push(`Fairness weight ${direction} significantly`);
  }

  if (newPolicy.w_urgency && Math.abs(newPolicy.w_urgency - currentPolicy.w_urgency) > 0.5) {
    const direction = newPolicy.w_urgency > currentPolicy.w_urgency ? 'increased' : 'decreased';
    changes.push(`Urgency weight ${direction} significantly`);
  }

  // Check DR penalty changes
  if (newPolicy.drConsecutivePenalty && 
      Math.abs(newPolicy.drConsecutivePenalty - currentPolicy.drConsecutivePenalty) > 0.3) {
    const direction = newPolicy.drConsecutivePenalty > currentPolicy.drConsecutivePenalty ? 'reduced' : 'increased';
    changes.push(`DR penalty ${direction} significantly`);
  }

  return changes;
}

/**
 * Assess fairness impact
 */
function assessFairnessImpact(
  newPolicy: Partial<AssignmentPolicy>,
  currentPolicy?: AssignmentPolicy
): 'positive' | 'neutral' | 'negative' {
  const mode = newPolicy.mode || 'NORMAL';
  
  // Mode-based assessment
  if (mode === 'BALANCE') return 'positive';
  if (mode === 'URGENT') return 'negative';
  
  // Parameter-based assessment
  const fairWeight = newPolicy.w_fair || (currentPolicy?.w_fair ?? 1.0);
  const drPenalty = Math.abs(newPolicy.drConsecutivePenalty || (currentPolicy?.drConsecutivePenalty ?? -0.5));
  
  if (fairWeight >= 1.5 && drPenalty >= 0.5) return 'positive';
  if (fairWeight <= 0.7 || drPenalty <= 0.2) return 'negative';
  
  return 'neutral';
}

/**
 * Assess urgency impact
 */
function assessUrgencyImpact(
  newPolicy: Partial<AssignmentPolicy>,
  currentPolicy?: AssignmentPolicy
): 'positive' | 'neutral' | 'negative' {
  const mode = newPolicy.mode || 'NORMAL';
  
  // Mode-based assessment
  if (mode === 'URGENT') return 'positive';
  if (mode === 'BALANCE') return 'negative';
  
  // Parameter-based assessment
  const urgencyWeight = newPolicy.w_urgency || (currentPolicy?.w_urgency ?? 1.0);
  
  if (urgencyWeight >= 1.5) return 'positive';
  if (urgencyWeight <= 0.5) return 'negative';
  
  return 'neutral';
}

/**
 * Assess system load impact
 */
function assessSystemLoad(newPolicy: Partial<AssignmentPolicy>): 'low' | 'medium' | 'high' {
  const fairnessWindow = newPolicy.fairnessWindowDays || 30;
  const mode = newPolicy.mode || 'NORMAL';
  
  if (mode === 'BALANCE' || fairnessWindow > 60) return 'high';
  if (mode === 'URGENT' || fairnessWindow < 14) return 'low';
  
  return 'medium';
}

/**
 * Assess assignment speed impact
 */
function assessAssignmentSpeed(newPolicy: Partial<AssignmentPolicy>): 'faster' | 'normal' | 'slower' {
  const mode = newPolicy.mode || 'NORMAL';
  
  if (mode === 'URGENT') return 'faster';
  if (mode === 'BALANCE') return 'slower';
  
  return 'normal';
}

/**
 * Assess overall risk level
 */
function assessOverallRisk(
  newPolicy: Partial<AssignmentPolicy>,
  fairnessImpact: string,
  urgencyImpact: string,
  systemLoad: string
): 'low' | 'medium' | 'high' {
  const mode = newPolicy.mode || 'NORMAL';
  
  // High risk conditions
  if (mode === 'CUSTOM' && (fairnessImpact === 'negative' || urgencyImpact === 'negative')) return 'high';
  if (systemLoad === 'high' && urgencyImpact === 'negative') return 'high';
  
  // Medium risk conditions
  if (mode === 'CUSTOM') return 'medium';
  if (systemLoad === 'high' || fairnessImpact === 'negative' || urgencyImpact === 'negative') return 'medium';
  
  return 'low';
}

/**
 * Generate impact description
 */
function generateImpactDescription(
  mode: string,
  fairnessImpact: string,
  urgencyImpact: string,
  systemLoad: string
): string {
  const modeDescriptions = {
    BALANCE: "Optimizes for fairness with potential assignment delays",
    URGENT: "Prioritizes immediate assignment with reduced fairness considerations",
    NORMAL: "Provides balanced fairness and urgency handling",
    CUSTOM: "Uses custom parameters - impact depends on specific configuration"
  };

  let description = modeDescriptions[mode as keyof typeof modeDescriptions] || modeDescriptions.NORMAL;

  // Add impact details
  if (fairnessImpact === 'positive') description += ". Improves workload distribution";
  if (fairnessImpact === 'negative') description += ". May reduce workload fairness";
  
  if (urgencyImpact === 'positive') description += ". Faster assignment processing";
  if (urgencyImpact === 'negative') description += ". May delay urgent assignments";
  
  if (systemLoad === 'high') description += ". Higher computational requirements";
  if (systemLoad === 'low') description += ". Lower computational requirements";

  return description;
}

/**
 * Validate meeting type priority configuration
 */
export function validateMeetingTypePriority(
  priority: Partial<MeetingTypePriority>,
  mode: string
): ValidationResult {
  const warnings: ValidationMessage[] = [];
  const errors: ValidationMessage[] = [];
  const recommendations: ValidationMessage[] = [];

  // Validate priority value
  if (priority.priorityValue !== undefined) {
    if (priority.priorityValue < 1 || priority.priorityValue > 10) {
      errors.push({
        field: 'priorityValue',
        message: "Priority value must be between 1 and 10",
        severity: 'critical',
        suggestion: "Use 1 for lowest priority, 10 for highest priority"
      });
    }
  }

  // Validate threshold days
  if (priority.urgentThresholdDays !== undefined) {
    if (priority.urgentThresholdDays < 0 || priority.urgentThresholdDays > 60) {
      errors.push({
        field: 'urgentThresholdDays',
        message: "Urgent threshold must be between 0 and 60 days",
        severity: 'critical'
      });
    }
  }

  if (priority.generalThresholdDays !== undefined) {
    if (priority.generalThresholdDays < 1 || priority.generalThresholdDays > 365) {
      errors.push({
        field: 'generalThresholdDays',
        message: "General threshold must be between 1 and 365 days",
        severity: 'critical'
      });
    }
  }

  // Validate threshold relationship
  if (priority.urgentThresholdDays !== undefined && priority.generalThresholdDays !== undefined) {
    if (priority.urgentThresholdDays >= priority.generalThresholdDays) {
      errors.push({
        field: 'thresholds',
        message: "Urgent threshold must be less than general threshold",
        severity: 'critical',
        suggestion: "Urgent threshold represents more immediate needs than general threshold"
      });
    }
  }

  // Mode-specific validation
  if (mode !== 'CUSTOM') {
    warnings.push({
      field: 'thresholds',
      message: `Threshold values are locked in ${mode} mode`,
      severity: 'medium',
      suggestion: "Switch to CUSTOM mode to modify threshold values"
    });
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    recommendations,
    impactAssessment: {
      fairnessImpact: 'neutral',
      urgencyImpact: 'neutral',
      systemLoad: 'low',
      assignmentSpeed: 'normal',
      overallRisk: 'low',
      description: "Meeting type priority changes affect assignment urgency calculations",
      keyChanges: []
    }
  };
}

/**
 * Get parameter lock status for UI
 */
export function getParameterLockStatus(mode: string): Record<string, boolean> {
  const constraints = MODE_CONSTRAINTS[mode as keyof typeof MODE_CONSTRAINTS];
  if (!constraints) return {};

  const lockStatus: Record<string, boolean> = {};
  
  // All parameters are unlocked by default
  Object.keys(VALIDATION_RULES).forEach(param => {
    lockStatus[param] = false;
  });

  // Lock parameters based on mode
  constraints.lockedParams.forEach(param => {
    lockStatus[param] = true;
  });

  return lockStatus;
}

/**
 * Get mode-specific recommendations
 */
export function getModeRecommendations(mode: string): {
  description: string;
  keyFeatures: string[];
  bestUseCases: string[];
  potentialIssues: string[];
} {
  const constraints = MODE_CONSTRAINTS[mode as keyof typeof MODE_CONSTRAINTS];
  if (!constraints) {
    return {
      description: "Unknown mode",
      keyFeatures: [],
      bestUseCases: [],
      potentialIssues: []
    };
  }

  const recommendations = {
    BALANCE: {
      bestUseCases: [
        "Large interpreter pools (5+ interpreters)",
        "Predictable scheduling patterns",
        "Long-term fairness optimization",
        "Non-urgent meeting types"
      ],
      potentialIssues: [
        "May cause assignment delays",
        "Requires override handling for emergencies",
        "Less effective with small interpreter pools"
      ]
    },
    URGENT: {
      bestUseCases: [
        "Emergency or time-critical meetings",
        "Small interpreter pools",
        "High-priority coverage requirements",
        "Immediate assignment needs"
      ],
      potentialIssues: [
        "May create unfair workload distribution",
        "Can lead to interpreter burnout",
        "Less optimal long-term fairness"
      ]
    },
    NORMAL: {
      bestUseCases: [
        "General meeting scheduling",
        "Mixed interpreter pool sizes",
        "Standard operational requirements",
        "Balanced fairness and efficiency needs"
      ],
      potentialIssues: [
        "May not optimize for extreme fairness",
        "Requires careful parameter tuning",
        "Moderate complexity in configuration"
      ]
    },
    CUSTOM: {
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
    }
  };

  const modeRecs = recommendations[mode as keyof typeof recommendations];
  
  return {
    description: constraints.description,
    keyFeatures: constraints.keyFeatures,
    bestUseCases: modeRecs?.bestUseCases || [],
    potentialIssues: modeRecs?.potentialIssues || []
  };
}