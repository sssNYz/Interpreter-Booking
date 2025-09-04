import prisma from "@/prisma/prisma";
import type { AssignmentPolicy, MeetingTypePriority } from "@/types/assignment";
import { loadPolicy, getDRPolicy, validateDRPolicyConfig, getDRPolicyRecommendations } from "../config/policy";
import { bookingPool } from "../pool/pool";
import { getAssignmentLogger } from "../logging/logging";

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  impact: ConfigImpactAssessment;
  timestamp: Date;
}

/**
 * Configuration impact assessment
 */
export interface ConfigImpactAssessment {
  existingPooledBookings: number;
  affectedBookings: number;
  modeChangeImpact?: ModeChangeImpact;
  fairnessImpact?: FairnessImpact;
  poolProcessingImpact?: PoolProcessingImpact;
  drPolicyImpact?: DRPolicyImpact;
}

/**
 * Mode change impact details
 */
export interface ModeChangeImpact {
  fromMode: AssignmentPolicy['mode'];
  toMode: AssignmentPolicy['mode'];
  poolEntriesAffected: number;
  thresholdChanges: Array<{
    meetingType: string;
    oldUrgentThreshold: number;
    newUrgentThreshold: number;
    oldGeneralThreshold: number;
    newGeneralThreshold: number;
  }>;
  immediateProcessingRequired: number;
  poolingBehaviorChange: string;
}

/**
 * Fairness impact assessment
 */
export interface FairnessImpact {
  currentGap: number;
  projectedGap: number;
  gapChange: number;
  affectedInterpreters: number;
  fairnessImprovement: boolean;
  windowDaysChange?: number;
}

/**
 * Pool processing impact
 */
export interface PoolProcessingImpact {
  currentPoolSize: number;
  processingFrequencyChange?: string;
  thresholdAdjustments: number;
  deadlineAdjustments: number;
  batchProcessingChange?: string;
}

/**
 * DR policy impact
 */
export interface DRPolicyImpact {
  blockingBehaviorChange?: string;
  penaltyChange: number;
  overrideAvailabilityChange?: boolean;
  affectedDRBookings: number;
  fairnessDistributionChange: string;
}

/**
 * Configuration change log entry
 */
export interface ConfigChangeLogEntry {
  id?: number;
  timestamp: Date;
  userId?: string;
  changeType: 'MODE_CHANGE' | 'POLICY_UPDATE' | 'THRESHOLD_CHANGE' | 'VALIDATION_UPDATE';
  oldConfig: Partial<AssignmentPolicy>;
  newConfig: Partial<AssignmentPolicy>;
  validationResult: ConfigValidationResult;
  reason?: string;
  impactAssessment: ConfigImpactAssessment;
}

/**
 * Pool-related configuration parameters
 */
export interface PoolConfigParameters {
  mode: AssignmentPolicy['mode'];
  fairnessWindowDays: number;
  maxGapHours: number;
  drConsecutivePenalty: number;
  w_fair: number;
  w_urgency: number;
  w_lrs: number;
  meetingTypePriorities: MeetingTypePriority[];
}

/**
 * Configuration Validator - validates pool-related configuration parameters
 */
export class ConfigurationValidator {
  private logger = getAssignmentLogger();

  /**
   * Validate complete configuration with impact assessment
   */
  async validateConfiguration(
    newConfig: Partial<AssignmentPolicy>,
    options?: {
      skipImpactAssessment?: boolean;
      userId?: string;
      reason?: string;
    }
  ): Promise<ConfigValidationResult> {
    console.log("🔍 Validating configuration changes...");

    const startTime = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Get current configuration for comparison
      const currentConfig = await loadPolicy();

      // Validate individual parameters
      const paramValidation = await this.validateParameters(newConfig, currentConfig);
      errors.push(...paramValidation.errors);
      warnings.push(...paramValidation.warnings);
      recommendations.push(...paramValidation.recommendations);

      // Validate parameter relationships
      const relationshipValidation = this.validateParameterRelationships(newConfig, currentConfig);
      errors.push(...relationshipValidation.errors);
      warnings.push(...relationshipValidation.warnings);
      recommendations.push(...relationshipValidation.recommendations);

      // Validate mode-specific constraints
      const modeValidation = await this.validateModeConstraints(newConfig, currentConfig);
      errors.push(...modeValidation.errors);
      warnings.push(...modeValidation.warnings);
      recommendations.push(...modeValidation.recommendations);

      // Assess impact on existing pooled bookings
      const impact = options?.skipImpactAssessment ? 
        await this.createMinimalImpactAssessment() :
        await this.assessConfigurationImpact(newConfig, currentConfig);

      // Add impact-based warnings
      const impactWarnings = this.generateImpactWarnings(impact);
      warnings.push(...impactWarnings);

      const result: ConfigValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations,
        impact,
        timestamp: startTime
      };

      console.log(`🔍 Configuration validation completed: ${result.isValid ? 'VALID' : 'INVALID'}`);
      console.log(`   Errors: ${errors.length}, Warnings: ${warnings.length}, Recommendations: ${recommendations.length}`);

      return result;

    } catch (error) {
      console.error("❌ Error validating configuration:", error);
      
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        recommendations: [],
        impact: await this.createMinimalImpactAssessment(),
        timestamp: startTime
      };
    }
  }

  /**
   * Validate individual configuration parameters
   */
  private async validateParameters(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<{ errors: string[]; warnings: string[]; recommendations: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate fairnessWindowDays
    if (newConfig.fairnessWindowDays !== undefined) {
      if (newConfig.fairnessWindowDays < 7) {
        errors.push("Fairness window must be at least 7 days");
      } else if (newConfig.fairnessWindowDays > 90) {
        errors.push("Fairness window cannot exceed 90 days");
      } else if (newConfig.fairnessWindowDays < 14) {
        warnings.push("Fairness window below 14 days may not provide sufficient data for fair distribution");
      } else if (newConfig.fairnessWindowDays > 60) {
        warnings.push("Fairness window above 60 days may be too slow to adapt to changes");
      }

      // Mode-specific recommendations
      const mode = newConfig.mode || currentConfig.mode;
      if (mode === 'BALANCE' && newConfig.fairnessWindowDays < 30) {
        recommendations.push("Balance mode works best with fairness window of 30+ days");
      } else if (mode === 'URGENT' && newConfig.fairnessWindowDays > 21) {
        recommendations.push("Urgent mode works best with fairness window of 21 days or less");
      }
    }

    // Validate maxGapHours
    if (newConfig.maxGapHours !== undefined) {
      if (newConfig.maxGapHours < 1) {
        errors.push("Maximum gap hours must be at least 1");
      } else if (newConfig.maxGapHours > 100) {
        errors.push("Maximum gap hours cannot exceed 100");
      } else if (newConfig.maxGapHours < 2) {
        warnings.push("Very low max gap hours may cause frequent assignment failures");
      } else if (newConfig.maxGapHours > 20) {
        warnings.push("Very high max gap hours may allow unfair workload distribution");
      }

      // Check against interpreter pool size
      const activeInterpreters = await this.getActiveInterpreterCount();
      if (activeInterpreters > 0) {
        const recommendedMaxGap = Math.max(2, Math.ceil(activeInterpreters * 0.3));
        if (newConfig.maxGapHours > recommendedMaxGap) {
          recommendations.push(`With ${activeInterpreters} active interpreters, consider max gap of ${recommendedMaxGap} hours or less`);
        }
      }
    }

    // Validate scoring weights
    if (newConfig.w_fair !== undefined) {
      if (newConfig.w_fair < 0 || newConfig.w_fair > 5) {
        errors.push("Fairness weight must be between 0 and 5");
      } else if (newConfig.w_fair < 0.5) {
        warnings.push("Very low fairness weight may cause uneven workload distribution");
      }
    }

    if (newConfig.w_urgency !== undefined) {
      if (newConfig.w_urgency < 0 || newConfig.w_urgency > 5) {
        errors.push("Urgency weight must be between 0 and 5");
      } else if (newConfig.w_urgency < 0.3) {
        warnings.push("Very low urgency weight may not prioritize time-sensitive bookings");
      }
    }

    if (newConfig.w_lrs !== undefined) {
      if (newConfig.w_lrs < 0 || newConfig.w_lrs > 5) {
        errors.push("LRS weight must be between 0 and 5");
      }
    }

    // Validate DR consecutive penalty
    if (newConfig.drConsecutivePenalty !== undefined) {
      const mode = newConfig.mode || currentConfig.mode;
      const drValidation = validateDRPolicyConfig(mode, newConfig);
      errors.push(...drValidation.errors);
      warnings.push(...drValidation.warnings);
      recommendations.push(...drValidation.recommendations);
    }

    return { errors, warnings, recommendations };
  }

  /**
   * Validate relationships between parameters
   */
  private validateParameterRelationships(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): { errors: string[]; warnings: string[]; recommendations: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const mergedConfig = { ...currentConfig, ...newConfig };

    // Check weight balance
    const totalWeight = mergedConfig.w_fair + mergedConfig.w_urgency + mergedConfig.w_lrs;
    if (totalWeight < 1.0) {
      warnings.push("Very low total scoring weights may not differentiate candidates effectively");
    } else if (totalWeight > 10.0) {
      warnings.push("Very high total scoring weights may cause score overflow issues");
    }

    // Check fairness vs urgency balance
    const fairnessRatio = mergedConfig.w_fair / (mergedConfig.w_fair + mergedConfig.w_urgency);
    if (fairnessRatio < 0.2) {
      warnings.push("Low fairness-to-urgency ratio may cause workload imbalance");
    } else if (fairnessRatio > 0.8) {
      warnings.push("High fairness-to-urgency ratio may delay urgent assignments");
    }

    // Check fairness window vs max gap relationship
    const expectedAssignmentsPerInterpreter = mergedConfig.fairnessWindowDays / 7; // Rough estimate
    if (mergedConfig.maxGapHours < expectedAssignmentsPerInterpreter) {
      recommendations.push("Consider increasing max gap hours or reducing fairness window for better balance");
    }

    // Mode-specific relationship validation
    const mode = mergedConfig.mode;
    if (mode === 'BALANCE') {
      if (mergedConfig.w_fair <= mergedConfig.w_urgency) {
        warnings.push("Balance mode should prioritize fairness weight over urgency weight");
      }
      if (mergedConfig.maxGapHours > 5) {
        recommendations.push("Balance mode works best with tighter max gap hours (≤5)");
      }
    } else if (mode === 'URGENT') {
      if (mergedConfig.w_urgency <= mergedConfig.w_fair) {
        warnings.push("Urgent mode should prioritize urgency weight over fairness weight");
      }
      if (mergedConfig.maxGapHours < 5) {
        recommendations.push("Urgent mode may need higher max gap hours (≥5) for flexibility");
      }
    }

    return { errors, warnings, recommendations };
  }

  /**
   * Validate mode-specific constraints
   */
  private async validateModeConstraints(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<{ errors: string[]; warnings: string[]; recommendations: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const newMode = newConfig.mode;
    if (!newMode) return { errors, warnings, recommendations };

    // Validate mode transition
    if (newMode !== currentConfig.mode) {
      const transitionValidation = await this.validateModeTransition(currentConfig.mode, newMode);
      errors.push(...transitionValidation.errors);
      warnings.push(...transitionValidation.warnings);
      recommendations.push(...transitionValidation.recommendations);
    }

    // Get mode-specific recommendations
    const modeRecommendations = getDRPolicyRecommendations(newMode);
    
    // Check if current config aligns with mode best practices
    const mergedConfig = { ...currentConfig, ...newConfig };
    
    switch (newMode) {
      case 'BALANCE':
        if (mergedConfig.fairnessWindowDays < 30) {
          recommendations.push("Balance mode: Consider fairness window of 30+ days for optimal fairness");
        }
        if (mergedConfig.maxGapHours > 3) {
          recommendations.push("Balance mode: Consider max gap of 3 hours or less for tight fairness control");
        }
        break;

      case 'URGENT':
        if (mergedConfig.fairnessWindowDays > 21) {
          recommendations.push("Urgent mode: Consider fairness window of 21 days or less for faster response");
        }
        if (mergedConfig.maxGapHours < 8) {
          recommendations.push("Urgent mode: Consider max gap of 8+ hours for assignment flexibility");
        }
        break;

      case 'CUSTOM':
        recommendations.push("Custom mode: Carefully test configuration changes in a non-production environment");
        recommendations.push("Custom mode: Monitor assignment patterns closely after configuration changes");
        break;
    }

    // Add mode-specific potential issues as warnings
    for (const issue of modeRecommendations.potentialIssues) {
      warnings.push(`${newMode} mode: ${issue}`);
    }

    return { errors, warnings, recommendations };
  }

  /**
   * Validate mode transition
   */
  private async validateModeTransition(
    fromMode: AssignmentPolicy['mode'],
    toMode: AssignmentPolicy['mode']
  ): Promise<{ errors: string[]; warnings: string[]; recommendations: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for problematic transitions
    if (fromMode === 'BALANCE' && toMode === 'URGENT') {
      const poolStats = await bookingPool.getPoolStats();
      if (poolStats.totalInPool > 10) {
        warnings.push(`Switching from Balance to Urgent with ${poolStats.totalInPool} pooled bookings may cause immediate processing surge`);
        recommendations.push("Consider processing pool entries gradually or during low-activity periods");
      }
    }

    if (fromMode === 'URGENT' && toMode === 'BALANCE') {
      warnings.push("Switching from Urgent to Balance may delay future assignments for fairness optimization");
      recommendations.push("Monitor assignment delays and adjust fairness window if needed");
    }

    if (toMode === 'CUSTOM') {
      warnings.push("Switching to Custom mode requires careful parameter tuning");
      recommendations.push("Start with parameters similar to your previous mode and adjust gradually");
    }

    // Check interpreter pool size for mode suitability
    const activeInterpreters = await this.getActiveInterpreterCount();
    if (toMode === 'BALANCE' && activeInterpreters < 3) {
      warnings.push(`Balance mode with only ${activeInterpreters} interpreters may cause assignment failures`);
      recommendations.push("Consider using Normal or Urgent mode with small interpreter pools");
    }

    return { errors, warnings, recommendations };
  }

  /**
   * Assess impact of configuration changes on existing pooled bookings
   */
  private async assessConfigurationImpact(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<ConfigImpactAssessment> {
    const poolStats = await bookingPool.getPoolStats();
    const existingPooledBookings = poolStats.totalInPool;

    let affectedBookings = 0;
    let modeChangeImpact: ModeChangeImpact | undefined;
    let fairnessImpact: FairnessImpact | undefined;
    let poolProcessingImpact: PoolProcessingImpact | undefined;
    let drPolicyImpact: DRPolicyImpact | undefined;

    // Assess mode change impact
    if (newConfig.mode && newConfig.mode !== currentConfig.mode) {
      modeChangeImpact = await this.assessModeChangeImpact(currentConfig.mode, newConfig.mode);
      affectedBookings += modeChangeImpact.poolEntriesAffected;
    }

    // Assess fairness impact
    if (newConfig.fairnessWindowDays !== undefined || newConfig.maxGapHours !== undefined) {
      fairnessImpact = await this.assessFairnessImpact(newConfig, currentConfig);
    }

    // Assess pool processing impact
    if (this.hasPoolProcessingChanges(newConfig)) {
      poolProcessingImpact = await this.assessPoolProcessingImpact(newConfig, currentConfig);
    }

    // Assess DR policy impact
    if (newConfig.drConsecutivePenalty !== undefined || newConfig.mode !== undefined) {
      drPolicyImpact = await this.assessDRPolicyImpact(newConfig, currentConfig);
      if (drPolicyImpact.affectedDRBookings > 0) {
        affectedBookings += drPolicyImpact.affectedDRBookings;
      }
    }

    return {
      existingPooledBookings,
      affectedBookings: Math.min(affectedBookings, existingPooledBookings), // Cap at total pooled
      modeChangeImpact,
      fairnessImpact,
      poolProcessingImpact,
      drPolicyImpact
    };
  }

  /**
   * Assess mode change impact
   */
  private async assessModeChangeImpact(
    fromMode: AssignmentPolicy['mode'],
    toMode: AssignmentPolicy['mode']
  ): Promise<ModeChangeImpact> {
    const poolEntries = await bookingPool.getAllPoolEntries();
    const meetingTypePriorities = await this.getMeetingTypePriorities();

    const thresholdChanges = meetingTypePriorities.map(priority => {
      // Apply old mode thresholds
      const oldThresholds = this.applyModeThresholds(priority, fromMode);
      // Apply new mode thresholds  
      const newThresholds = this.applyModeThresholds(priority, toMode);

      return {
        meetingType: priority.meetingType,
        oldUrgentThreshold: oldThresholds.urgentThresholdDays,
        newUrgentThreshold: newThresholds.urgentThresholdDays,
        oldGeneralThreshold: oldThresholds.generalThresholdDays,
        newGeneralThreshold: newThresholds.generalThresholdDays
      };
    });

    // Count entries that would need immediate processing
    let immediateProcessingRequired = 0;
    if (fromMode === 'BALANCE' && toMode === 'URGENT') {
      // In urgent mode, more entries become immediately processable
      immediateProcessingRequired = poolEntries.filter(entry => {
        const now = new Date();
        const hoursUntilStart = (entry.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilStart <= 24; // Urgent mode processes within 24 hours
      }).length;
    }

    const poolingBehaviorChange = this.describeModePoolingBehavior(fromMode, toMode);

    return {
      fromMode,
      toMode,
      poolEntriesAffected: poolEntries.length,
      thresholdChanges,
      immediateProcessingRequired,
      poolingBehaviorChange
    };
  }

  /**
   * Assess fairness impact
   */
  private async assessFairnessImpact(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<FairnessImpact> {
    // Get current fairness gap
    const currentGap = await this.calculateCurrentFairnessGap(currentConfig.fairnessWindowDays);
    
    // Project fairness gap with new settings
    const newWindowDays = newConfig.fairnessWindowDays || currentConfig.fairnessWindowDays;
    const projectedGap = await this.calculateCurrentFairnessGap(newWindowDays);

    const gapChange = projectedGap - currentGap;
    const fairnessImprovement = gapChange < 0; // Negative change means improvement

    // Count affected interpreters (rough estimate)
    const affectedInterpreters = await this.getActiveInterpreterCount();

    return {
      currentGap,
      projectedGap,
      gapChange,
      affectedInterpreters,
      fairnessImprovement,
      windowDaysChange: newConfig.fairnessWindowDays ? 
        newConfig.fairnessWindowDays - currentConfig.fairnessWindowDays : undefined
    };
  }

  /**
   * Assess pool processing impact
   */
  private async assessPoolProcessingImpact(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<PoolProcessingImpact> {
    const poolStats = await bookingPool.getPoolStats();
    
    let thresholdAdjustments = 0;
    let deadlineAdjustments = 0;

    // If mode changes, all pool entries may need threshold recalculation
    if (newConfig.mode && newConfig.mode !== currentConfig.mode) {
      thresholdAdjustments = poolStats.totalInPool;
      deadlineAdjustments = poolStats.totalInPool;
    }

    const processingFrequencyChange = this.describeProcessingFrequencyChange(newConfig, currentConfig);
    const batchProcessingChange = this.describeBatchProcessingChange(newConfig, currentConfig);

    return {
      currentPoolSize: poolStats.totalInPool,
      processingFrequencyChange,
      thresholdAdjustments,
      deadlineAdjustments,
      batchProcessingChange
    };
  }

  /**
   * Assess DR policy impact
   */
  private async assessDRPolicyImpact(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): Promise<DRPolicyImpact> {
    const newMode = newConfig.mode || currentConfig.mode;
    const currentDRPolicy = getDRPolicy(currentConfig.mode, currentConfig);
    const newDRPolicy = getDRPolicy(newMode, { ...currentConfig, ...newConfig });

    const blockingBehaviorChange = currentDRPolicy.forbidConsecutive !== newDRPolicy.forbidConsecutive ?
      `${currentDRPolicy.forbidConsecutive ? 'Hard blocking' : 'Soft penalty'} → ${newDRPolicy.forbidConsecutive ? 'Hard blocking' : 'Soft penalty'}` :
      undefined;

    const penaltyChange = newDRPolicy.consecutivePenalty - currentDRPolicy.consecutivePenalty;

    const overrideAvailabilityChange = 
      ('overrideAvailable' in currentDRPolicy && 'overrideAvailable' in newDRPolicy) ?
      currentDRPolicy.overrideAvailable !== newDRPolicy.overrideAvailable : undefined;

    // Count DR bookings in pool
    const poolEntries = await bookingPool.getAllPoolEntries();
    const affectedDRBookings = poolEntries.filter(entry => 
      entry.meetingType === 'DR'
    ).length;

    const fairnessDistributionChange = this.describeDRFairnessChange(currentDRPolicy, newDRPolicy);

    return {
      blockingBehaviorChange,
      penaltyChange,
      overrideAvailabilityChange,
      affectedDRBookings,
      fairnessDistributionChange
    };
  }

  /**
   * Generate impact-based warnings
   */
  private generateImpactWarnings(impact: ConfigImpactAssessment): string[] {
    const warnings: string[] = [];

    if (impact.existingPooledBookings > 0) {
      warnings.push(`${impact.existingPooledBookings} bookings currently in pool may be affected by configuration changes`);
    }

    if (impact.modeChangeImpact?.immediateProcessingRequired > 0) {
      warnings.push(`${impact.modeChangeImpact.immediateProcessingRequired} pooled bookings may require immediate processing after mode change`);
    }

    if (impact.fairnessImpact?.gapChange > 2) {
      warnings.push(`Configuration may increase fairness gap by ${impact.fairnessImpact.gapChange.toFixed(1)} hours`);
    }

    if (impact.drPolicyImpact?.affectedDRBookings > 0) {
      warnings.push(`${impact.drPolicyImpact.affectedDRBookings} DR bookings in pool may be affected by policy changes`);
    }

    if (impact.poolProcessingImpact?.thresholdAdjustments > 10) {
      warnings.push(`${impact.poolProcessingImpact.thresholdAdjustments} pool entries may need threshold recalculation`);
    }

    return warnings;
  }

  /**
   * Log configuration change
   */
  async logConfigurationChange(
    changeEntry: Omit<ConfigChangeLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const logEntry: ConfigChangeLogEntry = {
        ...changeEntry,
        timestamp: new Date()
      };

      // Log to assignment system
      await this.logger.logConfigurationChange({
        timestamp: logEntry.timestamp,
        changeType: logEntry.changeType,
        userId: logEntry.userId,
        reason: logEntry.reason,
        oldConfig: logEntry.oldConfig,
        newConfig: logEntry.newConfig,
        validationResult: logEntry.validationResult,
        impactAssessment: logEntry.impactAssessment
      });

      console.log(`📝 Configuration change logged: ${logEntry.changeType}`);

    } catch (error) {
      console.error("❌ Error logging configuration change:", error);
      // Don't throw - logging failure shouldn't block configuration changes
    }
  }

  /**
   * Helper methods
   */
  private async getActiveInterpreterCount(): Promise<number> {
    try {
      const count = await prisma.interpreter.count({
        where: { isActive: true }
      });
      return count;
    } catch (error) {
      console.error("Error getting active interpreter count:", error);
      return 0;
    }
  }

  private async getMeetingTypePriorities(): Promise<MeetingTypePriority[]> {
    try {
      return await prisma.meetingTypePriority.findMany();
    } catch (error) {
      console.error("Error getting meeting type priorities:", error);
      return [];
    }
  }

  private applyModeThresholds(
    priority: MeetingTypePriority,
    mode: AssignmentPolicy['mode']
  ): { urgentThresholdDays: number; generalThresholdDays: number } {
    const isDR = priority.meetingType === 'DR';
    
    switch (mode) {
      case 'URGENT':
        return {
          urgentThresholdDays: isDR ? 0 : 1,
          generalThresholdDays: isDR ? 7 : 30
        };
      case 'BALANCE':
      case 'NORMAL':
      default:
        return {
          urgentThresholdDays: isDR ? 1 : 3,
          generalThresholdDays: isDR ? 7 : 30
        };
      case 'CUSTOM':
        return {
          urgentThresholdDays: priority.urgentThresholdDays,
          generalThresholdDays: priority.generalThresholdDays
        };
    }
  }

  private async calculateCurrentFairnessGap(windowDays: number): Promise<number> {
    try {
      // Get interpreter hours for the window
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - windowDays);

      const assignments = await prisma.bookingPlan.findMany({
        where: {
          timeStart: { gte: windowStart },
          interpreterEmpCode: { not: null }
        },
        select: {
          interpreterEmpCode: true
        }
      });

      // Count assignments per interpreter
      const hoursByInterpreter: { [key: string]: number } = {};
      for (const assignment of assignments) {
        if (assignment.interpreterEmpCode) {
          hoursByInterpreter[assignment.interpreterEmpCode] = 
            (hoursByInterpreter[assignment.interpreterEmpCode] || 0) + 1;
        }
      }

      const hours = Object.values(hoursByInterpreter);
      if (hours.length === 0) return 0;

      return Math.max(...hours) - Math.min(...hours);
    } catch (error) {
      console.error("Error calculating fairness gap:", error);
      return 0;
    }
  }

  private hasPoolProcessingChanges(newConfig: Partial<AssignmentPolicy>): boolean {
    return !!(newConfig.mode || newConfig.fairnessWindowDays || newConfig.maxGapHours);
  }

  private describeModePoolingBehavior(
    fromMode: AssignmentPolicy['mode'],
    toMode: AssignmentPolicy['mode']
  ): string {
    if (fromMode === 'BALANCE' && toMode === 'URGENT') {
      return "Pool processing will switch from batch optimization to immediate assignment";
    } else if (fromMode === 'URGENT' && toMode === 'BALANCE') {
      return "Pool processing will switch from immediate assignment to batch optimization";
    } else if (toMode === 'CUSTOM') {
      return "Pool processing behavior will depend on custom configuration parameters";
    }
    return "Pool processing behavior will adjust to new mode requirements";
  }

  private describeProcessingFrequencyChange(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): string | undefined {
    const newMode = newConfig.mode || currentConfig.mode;
    const oldMode = currentConfig.mode;

    if (newMode !== oldMode) {
      if (newMode === 'URGENT') {
        return "Processing frequency will increase for immediate assignment";
      } else if (newMode === 'BALANCE') {
        return "Processing frequency will optimize for batch fairness";
      }
    }
    return undefined;
  }

  private describeBatchProcessingChange(
    newConfig: Partial<AssignmentPolicy>,
    currentConfig: AssignmentPolicy
  ): string | undefined {
    const newMode = newConfig.mode || currentConfig.mode;
    const oldMode = currentConfig.mode;

    if (newMode !== oldMode) {
      if (oldMode === 'BALANCE' && newMode !== 'BALANCE') {
        return "Batch processing optimization will be reduced";
      } else if (oldMode !== 'BALANCE' && newMode === 'BALANCE') {
        return "Batch processing optimization will be enhanced";
      }
    }
    return undefined;
  }

  private describeDRFairnessChange(
    currentPolicy: any,
    newPolicy: any
  ): string {
    if (currentPolicy.forbidConsecutive && !newPolicy.forbidConsecutive) {
      return "DR fairness distribution will become more flexible with penalty-based system";
    } else if (!currentPolicy.forbidConsecutive && newPolicy.forbidConsecutive) {
      return "DR fairness distribution will become stricter with hard blocking";
    } else if (Math.abs(newPolicy.consecutivePenalty - currentPolicy.consecutivePenalty) > 0.2) {
      const change = newPolicy.consecutivePenalty > currentPolicy.consecutivePenalty ? "reduced" : "increased";
      return `DR fairness enforcement will be ${change} with penalty adjustment`;
    }
    return "DR fairness distribution approach will remain similar";
  }

  private async createMinimalImpactAssessment(): Promise<ConfigImpactAssessment> {
    const poolStats = await bookingPool.getPoolStats();
    return {
      existingPooledBookings: poolStats.totalInPool,
      affectedBookings: 0
    };
  }
}

/**
 * Global configuration validator instance
 */
let globalValidator: ConfigurationValidator | null = null;

/**
 * Get the global configuration validator
 */
export function getConfigurationValidator(): ConfigurationValidator {
  if (!globalValidator) {
    globalValidator = new ConfigurationValidator();
  }
  return globalValidator;
}