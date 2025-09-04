import prisma from "@/prisma/prisma";
import type { AssignmentPolicy } from "@/types/assignment";
import { loadPolicy, updatePolicy } from "./policy";
import { bookingPool } from "../pool/pool";
import { getPoolProcessingEngine } from "../pool/pool-engine";
import { modeTransitionManager, type ModeTransitionResult } from "./mode-transition";
import { getAssignmentLogger } from "../logging/logging";

/**
 * System load assessment result
 */
export interface SystemLoadAssessment {
  poolSize: number;
  averageProcessingTime: number;
  conflictRate: number;
  escalationRate: number;
  recommendedMode: AssignmentPolicy['mode'];
  confidence: number;
  loadLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metrics: {
    recentAssignments: number;
    failedAssignments: number;
    poolGrowthRate: number;
    systemResponseTime: number;
    deadlineViolations: number;
  };
  timestamp: Date;
}

/**
 * Auto-approval configuration
 */
export interface AutoApprovalConfig {
  enabled: boolean;
  evaluationIntervalMs: number;
  loadThresholds: {
    highLoad: LoadThreshold;
    normalLoad: LoadThreshold;
  };
  modePreferences: ModePreference[];
  notifications: {
    enabled: boolean;
    channels: ('console' | 'database' | 'email')[];
  };
  manualOverride: {
    enabled: boolean;
    reason?: string;
    expiresAt?: Date;
  };
}

/**
 * Load threshold configuration
 */
export interface LoadThreshold {
  poolSizeThreshold: number;
  escalationRateThreshold: number;
  conflictRateThreshold: number;
  averageProcessingTimeMs: number;
  deadlineViolationThreshold: number;
  targetMode: AssignmentPolicy['mode'];
  confidence: number;
}

/**
 * Mode preference configuration
 */
export interface ModePreference {
  mode: AssignmentPolicy['mode'];
  priority: number;
  conditions: {
    minPoolSize?: number;
    maxPoolSize?: number;
    maxEscalationRate?: number;
    maxConflictRate?: number;
    timeOfDay?: { start: string; end: string };
  };
}

/**
 * Auto-switch result
 */
export interface AutoSwitchResult {
  success: boolean;
  oldMode: AssignmentPolicy['mode'];
  newMode: AssignmentPolicy['mode'];
  reason: string;
  loadAssessment: SystemLoadAssessment;
  modeTransition?: ModeTransitionResult;
  timestamp: Date;
  confidence: number;
  overrideApplied: boolean;
}

/**
 * Auto-approval status
 */
export interface AutoApprovalStatus {
  enabled: boolean;
  currentMode: AssignmentPolicy['mode'];
  lastEvaluation: Date | null;
  nextEvaluation: Date | null;
  lastModeSwitch: Date | null;
  recentSwitches: Array<{
    timestamp: Date;
    fromMode: AssignmentPolicy['mode'];
    toMode: AssignmentPolicy['mode'];
    reason: string;
    automatic: boolean;
  }>;
  manualOverride: {
    active: boolean;
    reason?: string;
    enabledAt?: Date;
    expiresAt?: Date;
  };
  systemLoad: SystemLoadAssessment | null;
  configuration: AutoApprovalConfig;
}

/**
 * Auto-Approval Engine - handles automatic mode switching based on system load
 */
export class AutoApprovalEngine {
  private logger = getAssignmentLogger();
  private config: AutoApprovalConfig;
  private evaluationTimer: NodeJS.Timeout | null = null;
  private lastEvaluation: Date | null = null;
  private recentSwitches: AutoSwitchResult[] = [];

  constructor(config?: Partial<AutoApprovalConfig>) {
    this.config = this.getDefaultConfig();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Get default auto-approval configuration
   */
  private getDefaultConfig(): AutoApprovalConfig {
    return {
      enabled: false,
      evaluationIntervalMs: 5 * 60 * 1000, // 5 minutes
      loadThresholds: {
        highLoad: {
          poolSizeThreshold: 20,
          escalationRateThreshold: 0.3,
          conflictRateThreshold: 0.4,
          averageProcessingTimeMs: 5000,
          deadlineViolationThreshold: 5,
          targetMode: 'URGENT',
          confidence: 0.8
        },
        normalLoad: {
          poolSizeThreshold: 10,
          escalationRateThreshold: 0.15,
          conflictRateThreshold: 0.2,
          averageProcessingTimeMs: 2000,
          deadlineViolationThreshold: 2,
          targetMode: 'BALANCE',
          confidence: 0.7
        }
      },
      modePreferences: [
        {
          mode: 'URGENT',
          priority: 1,
          conditions: {
            minPoolSize: 15,
            maxEscalationRate: 0.5,
            maxConflictRate: 0.6
          }
        },
        {
          mode: 'BALANCE',
          priority: 2,
          conditions: {
            minPoolSize: 5,
            maxPoolSize: 25,
            maxEscalationRate: 0.25,
            maxConflictRate: 0.3
          }
        },
        {
          mode: 'NORMAL',
          priority: 3,
          conditions: {
            maxPoolSize: 15,
            maxEscalationRate: 0.2,
            maxConflictRate: 0.25
          }
        }
      ],
      notifications: {
        enabled: true,
        channels: ['console', 'database']
      },
      manualOverride: {
        enabled: false
      }
    };
  }

  /**
   * Evaluate current system load and performance
   */
  async evaluateSystemLoad(): Promise<SystemLoadAssessment> {
    console.log("📊 Evaluating system load for auto-approval...");

    const startTime = Date.now();
    
    try {
      // Get pool statistics
      const poolStats = await bookingPool.getPoolStats();
      const poolEngine = getPoolProcessingEngine();
      const processingStatus = await poolEngine.getProcessingStatus();

      // Get recent assignment metrics (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentAssignments = await prisma.assignmentLog.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          }
        }
      });

      const failedAssignments = await prisma.assignmentLog.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          },
          status: 'escalated'
        }
      });

      // Calculate metrics
      const escalationRate = recentAssignments > 0 ? failedAssignments / recentAssignments : 0;
      
      // Get conflict rate from recent conflict detection logs
      const recentConflicts = await prisma.conflictDetectionLog.findMany({
        where: {
          timestamp: {
            gte: twentyFourHoursAgo
          }
        },
        select: {
          totalInterpretersChecked: true,
          conflictedInterpreters: true
        }
      });

      const totalChecked = recentConflicts.reduce((sum, log) => sum + log.totalInterpretersChecked, 0);
      const totalConflicted = recentConflicts.reduce((sum, log) => sum + log.conflictedInterpreters, 0);
      const conflictRate = totalChecked > 0 ? totalConflicted / totalChecked : 0;

      // Get average processing time from recent pool processing logs
      const recentPoolProcessing = await prisma.poolProcessingLog.findMany({
        where: {
          processingStartTime: {
            gte: twentyFourHoursAgo
          }
        },
        select: {
          averageProcessingTimeMs: true
        }
      });

      const averageProcessingTime = recentPoolProcessing.length > 0 ?
        recentPoolProcessing.reduce((sum, log) => sum + log.averageProcessingTimeMs, 0) / recentPoolProcessing.length :
        1000; // Default 1 second

      // Calculate pool growth rate (entries added vs processed in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentPoolEntries = await prisma.bookingPlan.count({
        where: {
          poolEntryTime: {
            gte: oneHourAgo
          }
        }
      });

      const recentProcessedEntries = await prisma.poolProcessingLog.aggregate({
        where: {
          processingStartTime: {
            gte: oneHourAgo
          }
        },
        _sum: {
          processedEntries: true
        }
      });

      const processedCount = recentProcessedEntries._sum.processedEntries || 0;
      const poolGrowthRate = processedCount > 0 ? 
        (recentPoolEntries - processedCount) / processedCount : 
        recentPoolEntries > 0 ? 1 : 0;

      // Count deadline violations (bookings processed after their deadline)
      const deadlineViolations = await prisma.bookingPlan.count({
        where: {
          poolDeadlineTime: {
            lt: new Date(),
            gte: twentyFourHoursAgo
          },
          poolStatus: {
            not: null
          }
        }
      });

      const systemResponseTime = Date.now() - startTime;

      // Determine load level
      const loadLevel = this.determineLoadLevel({
        poolSize: poolStats.totalInPool,
        escalationRate,
        conflictRate,
        averageProcessingTime,
        deadlineViolations,
        poolGrowthRate
      });

      // Recommend mode based on load and thresholds
      const recommendedMode = this.recommendMode(loadLevel, {
        poolSize: poolStats.totalInPool,
        escalationRate,
        conflictRate,
        averageProcessingTime,
        deadlineViolations
      });

      // Calculate confidence based on data quality and consistency
      const confidence = this.calculateConfidence({
        recentAssignments,
        dataPoints: recentConflicts.length + recentPoolProcessing.length,
        systemResponseTime,
        loadLevel
      });

      const assessment: SystemLoadAssessment = {
        poolSize: poolStats.totalInPool,
        averageProcessingTime,
        conflictRate,
        escalationRate,
        recommendedMode,
        confidence,
        loadLevel,
        metrics: {
          recentAssignments,
          failedAssignments,
          poolGrowthRate,
          systemResponseTime,
          deadlineViolations
        },
        timestamp: new Date()
      };

      console.log(`📊 System load assessment completed:`);
      console.log(`   Load Level: ${loadLevel}`);
      console.log(`   Pool Size: ${poolStats.totalInPool}`);
      console.log(`   Escalation Rate: ${(escalationRate * 100).toFixed(1)}%`);
      console.log(`   Conflict Rate: ${(conflictRate * 100).toFixed(1)}%`);
      console.log(`   Recommended Mode: ${recommendedMode}`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

      return assessment;

    } catch (error) {
      console.error("❌ Error evaluating system load:", error);
      
      // Return safe fallback assessment
      return {
        poolSize: 0,
        averageProcessingTime: 1000,
        conflictRate: 0,
        escalationRate: 0,
        recommendedMode: 'NORMAL',
        confidence: 0.1,
        loadLevel: 'LOW',
        metrics: {
          recentAssignments: 0,
          failedAssignments: 0,
          poolGrowthRate: 0,
          systemResponseTime: Date.now() - startTime,
          deadlineViolations: 0
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Determine load level based on metrics
   */
  private determineLoadLevel(metrics: {
    poolSize: number;
    escalationRate: number;
    conflictRate: number;
    averageProcessingTime: number;
    deadlineViolations: number;
    poolGrowthRate: number;
  }): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const { poolSize, escalationRate, conflictRate, averageProcessingTime, deadlineViolations, poolGrowthRate } = metrics;

    // Critical conditions
    if (deadlineViolations > 10 || escalationRate > 0.5 || poolGrowthRate > 2) {
      return 'CRITICAL';
    }

    // High load conditions
    if (poolSize > this.config.loadThresholds.highLoad.poolSizeThreshold ||
        escalationRate > this.config.loadThresholds.highLoad.escalationRateThreshold ||
        conflictRate > this.config.loadThresholds.highLoad.conflictRateThreshold ||
        averageProcessingTime > this.config.loadThresholds.highLoad.averageProcessingTimeMs ||
        deadlineViolations > this.config.loadThresholds.highLoad.deadlineViolationThreshold) {
      return 'HIGH';
    }

    // Medium load conditions
    if (poolSize > this.config.loadThresholds.normalLoad.poolSizeThreshold ||
        escalationRate > this.config.loadThresholds.normalLoad.escalationRateThreshold ||
        conflictRate > this.config.loadThresholds.normalLoad.conflictRateThreshold ||
        averageProcessingTime > this.config.loadThresholds.normalLoad.averageProcessingTimeMs ||
        deadlineViolations > this.config.loadThresholds.normalLoad.deadlineViolationThreshold) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Recommend assignment mode based on load level and metrics
   */
  private recommendMode(
    loadLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    metrics: {
      poolSize: number;
      escalationRate: number;
      conflictRate: number;
      averageProcessingTime: number;
      deadlineViolations: number;
    }
  ): AssignmentPolicy['mode'] {
    // Critical load always goes to URGENT
    if (loadLevel === 'CRITICAL') {
      return 'URGENT';
    }

    // Check mode preferences based on conditions
    const eligibleModes = this.config.modePreferences
      .filter(pref => this.checkModeConditions(pref, metrics))
      .sort((a, b) => a.priority - b.priority);

    if (eligibleModes.length > 0) {
      return eligibleModes[0].mode;
    }

    // Fallback based on load level
    switch (loadLevel) {
      case 'HIGH':
        return 'URGENT';
      case 'MEDIUM':
        return 'BALANCE';
      case 'LOW':
      default:
        return 'NORMAL';
    }
  }

  /**
   * Check if mode conditions are met
   */
  private checkModeConditions(
    preference: ModePreference,
    metrics: {
      poolSize: number;
      escalationRate: number;
      conflictRate: number;
      averageProcessingTime: number;
      deadlineViolations: number;
    }
  ): boolean {
    const { conditions } = preference;
    const { poolSize, escalationRate, conflictRate } = metrics;

    if (conditions.minPoolSize !== undefined && poolSize < conditions.minPoolSize) {
      return false;
    }

    if (conditions.maxPoolSize !== undefined && poolSize > conditions.maxPoolSize) {
      return false;
    }

    if (conditions.maxEscalationRate !== undefined && escalationRate > conditions.maxEscalationRate) {
      return false;
    }

    if (conditions.maxConflictRate !== undefined && conflictRate > conditions.maxConflictRate) {
      return false;
    }

    // Time of day check (if specified)
    if (conditions.timeOfDay) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = parseInt(conditions.timeOfDay.start.replace(':', ''));
      const endTime = parseInt(conditions.timeOfDay.end.replace(':', ''));

      if (startTime <= endTime) {
        // Same day range
        if (currentTime < startTime || currentTime > endTime) {
          return false;
        }
      } else {
        // Overnight range
        if (currentTime < startTime && currentTime > endTime) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(factors: {
    recentAssignments: number;
    dataPoints: number;
    systemResponseTime: number;
    loadLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): number {
    let confidence = 1.0;

    // Reduce confidence if insufficient data
    if (factors.recentAssignments < 10) {
      confidence *= 0.7;
    }

    if (factors.dataPoints < 5) {
      confidence *= 0.8;
    }

    // Reduce confidence if system is slow to respond
    if (factors.systemResponseTime > 5000) {
      confidence *= 0.6;
    }

    // Adjust based on load level stability
    switch (factors.loadLevel) {
      case 'CRITICAL':
        confidence *= 0.9; // High urgency but less predictable
        break;
      case 'HIGH':
        confidence *= 0.95;
        break;
      case 'MEDIUM':
        confidence *= 1.0;
        break;
      case 'LOW':
        confidence *= 0.85; // Less data in low load scenarios
        break;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Determine optimal mode based on current assessment
   */
  async determineOptimalMode(): Promise<AssignmentPolicy['mode']> {
    const assessment = await this.evaluateSystemLoad();
    return assessment.recommendedMode;
  }

  /**
   * Execute automatic mode switch
   */
  async executeAutoSwitch(targetMode: AssignmentPolicy['mode']): Promise<AutoSwitchResult> {
    console.log(`🔄 Executing automatic mode switch to ${targetMode}...`);

    const startTime = new Date();
    
    try {
      // Check if manual override is active
      if (this.config.manualOverride.enabled) {
        console.log("⚠️ Manual override is active, skipping automatic mode switch");
        
        const currentPolicy = await loadPolicy();
        const loadAssessment = await this.evaluateSystemLoad();
        
        return {
          success: false,
          oldMode: currentPolicy.mode,
          newMode: targetMode,
          reason: `Manual override active: ${this.config.manualOverride.reason || 'No reason provided'}`,
          loadAssessment,
          timestamp: startTime,
          confidence: 0,
          overrideApplied: true
        };
      }

      // Get current mode and load assessment
      const currentPolicy = await loadPolicy();
      const loadAssessment = await this.evaluateSystemLoad();

      // Check if mode change is actually needed
      if (currentPolicy.mode === targetMode) {
        console.log(`ℹ️ Mode is already ${targetMode}, no switch needed`);
        
        return {
          success: true,
          oldMode: currentPolicy.mode,
          newMode: targetMode,
          reason: `Mode is already ${targetMode}`,
          loadAssessment,
          timestamp: startTime,
          confidence: loadAssessment.confidence,
          overrideApplied: false
        };
      }

      // Check confidence threshold
      if (loadAssessment.confidence < 0.6) {
        console.log(`⚠️ Low confidence (${(loadAssessment.confidence * 100).toFixed(1)}%), skipping automatic switch`);
        
        return {
          success: false,
          oldMode: currentPolicy.mode,
          newMode: targetMode,
          reason: `Low confidence in load assessment (${(loadAssessment.confidence * 100).toFixed(1)}%)`,
          loadAssessment,
          timestamp: startTime,
          confidence: loadAssessment.confidence,
          overrideApplied: false
        };
      }

      // Execute mode transition
      console.log(`🔄 Switching from ${currentPolicy.mode} to ${targetMode} (confidence: ${(loadAssessment.confidence * 100).toFixed(1)}%)`);
      
      const modeTransition = await modeTransitionManager.switchMode(targetMode);

      const result: AutoSwitchResult = {
        success: modeTransition.success,
        oldMode: currentPolicy.mode,
        newMode: targetMode,
        reason: modeTransition.success ? 
          `Automatic switch based on system load (${loadAssessment.loadLevel})` :
          `Mode switch failed: ${modeTransition.errors.map(e => e.error).join(', ')}`,
        loadAssessment,
        modeTransition,
        timestamp: startTime,
        confidence: loadAssessment.confidence,
        overrideApplied: false
      };

      // Add to recent switches
      this.recentSwitches.push(result);
      
      // Keep only last 10 switches
      if (this.recentSwitches.length > 10) {
        this.recentSwitches = this.recentSwitches.slice(-10);
      }

      // Send notifications
      await this.sendAutoSwitchNotification(result);

      // Log the auto-switch
      await this.logAutoSwitch(result);

      console.log(`${result.success ? '✅' : '❌'} Automatic mode switch completed: ${result.reason}`);

      return result;

    } catch (error) {
      console.error("❌ Error executing automatic mode switch:", error);
      
      const currentPolicy = await loadPolicy();
      const loadAssessment = await this.evaluateSystemLoad();
      
      const errorResult: AutoSwitchResult = {
        success: false,
        oldMode: currentPolicy.mode,
        newMode: targetMode,
        reason: `Auto-switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loadAssessment,
        timestamp: startTime,
        confidence: 0,
        overrideApplied: false
      };

      await this.logAutoSwitch(errorResult);
      return errorResult;
    }
  }

  /**
   * Configure auto-approval settings
   */
  async configureAutoApproval(config: Partial<AutoApprovalConfig>): Promise<void> {
    console.log("⚙️ Configuring auto-approval settings...");

    // Validate configuration
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Update configuration
    this.config = { ...this.config, ...config };

    // Restart evaluation timer if interval changed
    if (config.evaluationIntervalMs !== undefined) {
      this.stopEvaluationTimer();
      if (this.config.enabled) {
        this.startEvaluationTimer();
      }
    }

    // Start/stop based on enabled status
    if (config.enabled !== undefined) {
      if (config.enabled && !this.evaluationTimer) {
        this.startEvaluationTimer();
      } else if (!config.enabled && this.evaluationTimer) {
        this.stopEvaluationTimer();
      }
    }

    console.log(`✅ Auto-approval configuration updated (enabled: ${this.config.enabled})`);
  }

  /**
   * Validate auto-approval configuration
   */
  private validateConfiguration(config: Partial<AutoApprovalConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.evaluationIntervalMs !== undefined) {
      if (config.evaluationIntervalMs < 60000) { // 1 minute minimum
        errors.push("Evaluation interval must be at least 60 seconds");
      }
      if (config.evaluationIntervalMs > 3600000) { // 1 hour maximum
        warnings.push("Evaluation interval over 1 hour may not respond quickly to load changes");
      }
    }

    if (config.loadThresholds) {
      const { highLoad, normalLoad } = config.loadThresholds;
      
      if (highLoad.poolSizeThreshold <= normalLoad.poolSizeThreshold) {
        errors.push("High load pool threshold must be greater than normal load threshold");
      }
      
      if (highLoad.escalationRateThreshold <= normalLoad.escalationRateThreshold) {
        errors.push("High load escalation rate threshold must be greater than normal load threshold");
      }
    }

    if (config.modePreferences) {
      const priorities = config.modePreferences.map(p => p.priority);
      const uniquePriorities = new Set(priorities);
      
      if (priorities.length !== uniquePriorities.size) {
        errors.push("Mode preferences must have unique priorities");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get current auto-approval status
   */
  async getAutoApprovalStatus(): Promise<AutoApprovalStatus> {
    const currentPolicy = await loadPolicy();
    const systemLoad = this.lastEvaluation ? await this.evaluateSystemLoad() : null;

    return {
      enabled: this.config.enabled,
      currentMode: currentPolicy.mode,
      lastEvaluation: this.lastEvaluation,
      nextEvaluation: this.evaluationTimer ? 
        new Date(Date.now() + this.config.evaluationIntervalMs) : null,
      lastModeSwitch: this.recentSwitches.length > 0 ? 
        this.recentSwitches[this.recentSwitches.length - 1].timestamp : null,
      recentSwitches: this.recentSwitches.map(switch_ => ({
        timestamp: switch_.timestamp,
        fromMode: switch_.oldMode,
        toMode: switch_.newMode,
        reason: switch_.reason,
        automatic: true
      })),
      manualOverride: {
        active: this.config.manualOverride.enabled,
        reason: this.config.manualOverride.reason,
        enabledAt: this.config.manualOverride.enabled ? new Date() : undefined,
        expiresAt: this.config.manualOverride.expiresAt
      },
      systemLoad,
      configuration: this.config
    };
  }

  /**
   * Enable manual override
   */
  async enableManualOverride(reason: string, expiresAt?: Date): Promise<void> {
    console.log(`🔒 Enabling manual override: ${reason}`);

    this.config.manualOverride = {
      enabled: true,
      reason,
      expiresAt
    };

    // Log the override
    await this.logger.logAutoApprovalEvent({
      timestamp: new Date(),
      eventType: 'MANUAL_OVERRIDE_ENABLED',
      reason,
      expiresAt,
      currentMode: (await loadPolicy()).mode
    });

    console.log("✅ Manual override enabled - automatic mode switching disabled");
  }

  /**
   * Disable manual override
   */
  async disableManualOverride(): Promise<void> {
    console.log("🔓 Disabling manual override");

    const previousReason = this.config.manualOverride.reason;
    
    this.config.manualOverride = {
      enabled: false
    };

    // Log the override removal
    await this.logger.logAutoApprovalEvent({
      timestamp: new Date(),
      eventType: 'MANUAL_OVERRIDE_DISABLED',
      reason: `Previous override: ${previousReason}`,
      currentMode: (await loadPolicy()).mode
    });

    console.log("✅ Manual override disabled - automatic mode switching re-enabled");
  }

  /**
   * Start automatic evaluation timer
   */
  private startEvaluationTimer(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }

    console.log(`⏰ Starting auto-approval evaluation timer (${this.config.evaluationIntervalMs}ms interval)`);

    this.evaluationTimer = setInterval(async () => {
      try {
        await this.performAutomaticEvaluation();
      } catch (error) {
        console.error("❌ Error in automatic evaluation:", error);
      }
    }, this.config.evaluationIntervalMs);
  }

  /**
   * Stop automatic evaluation timer
   */
  private stopEvaluationTimer(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
      console.log("⏹️ Auto-approval evaluation timer stopped");
    }
  }

  /**
   * Perform automatic evaluation and mode switching
   */
  private async performAutomaticEvaluation(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log("🔄 Performing automatic evaluation...");
    this.lastEvaluation = new Date();

    try {
      // Check if manual override has expired
      if (this.config.manualOverride.enabled && this.config.manualOverride.expiresAt) {
        if (new Date() >= this.config.manualOverride.expiresAt) {
          console.log("⏰ Manual override expired, disabling...");
          await this.disableManualOverride();
        }
      }

      // Skip if manual override is still active
      if (this.config.manualOverride.enabled) {
        console.log("⚠️ Manual override active, skipping automatic evaluation");
        return;
      }

      // Evaluate system load
      const loadAssessment = await this.evaluateSystemLoad();
      const currentPolicy = await loadPolicy();

      // Check if mode switch is recommended
      if (loadAssessment.recommendedMode !== currentPolicy.mode) {
        console.log(`📊 Load assessment recommends switching to ${loadAssessment.recommendedMode} (current: ${currentPolicy.mode})`);
        
        // Execute automatic switch
        const switchResult = await this.executeAutoSwitch(loadAssessment.recommendedMode);
        
        if (switchResult.success) {
          console.log(`✅ Automatic mode switch successful: ${currentPolicy.mode} → ${loadAssessment.recommendedMode}`);
        } else {
          console.log(`❌ Automatic mode switch failed: ${switchResult.reason}`);
        }
      } else {
        console.log(`✅ Current mode ${currentPolicy.mode} is optimal for current load (${loadAssessment.loadLevel})`);
      }

    } catch (error) {
      console.error("❌ Error in automatic evaluation:", error);
      
      // Log the error
      await this.logger.logAutoApprovalEvent({
        timestamp: new Date(),
        eventType: 'EVALUATION_ERROR',
        reason: error instanceof Error ? error.message : 'Unknown error',
        currentMode: (await loadPolicy()).mode
      });
    }
  }

  /**
   * Send notification for automatic mode switch
   */
  private async sendAutoSwitchNotification(result: AutoSwitchResult): Promise<void> {
    if (!this.config.notifications.enabled) {
      return;
    }

    const message = `Auto-Approval: ${result.success ? 'Successfully switched' : 'Failed to switch'} from ${result.oldMode} to ${result.newMode}. Reason: ${result.reason}`;

    for (const channel of this.config.notifications.channels) {
      try {
        switch (channel) {
          case 'console':
            console.log(`📢 ${message}`);
            break;
            
          case 'database':
            await this.logger.logAutoApprovalEvent({
              timestamp: result.timestamp,
              eventType: result.success ? 'AUTO_SWITCH_SUCCESS' : 'AUTO_SWITCH_FAILED',
              reason: result.reason,
              oldMode: result.oldMode,
              newMode: result.newMode,
              loadAssessment: result.loadAssessment,
              confidence: result.confidence
            });
            break;
            
          case 'email':
            // Email notification would be implemented here
            console.log(`📧 Email notification: ${message}`);
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to send notification via ${channel}:`, error);
      }
    }
  }

  /**
   * Log auto-switch event
   */
  private async logAutoSwitch(result: AutoSwitchResult): Promise<void> {
    try {
      await this.logger.logAutoApprovalEvent({
        timestamp: result.timestamp,
        eventType: result.success ? 'AUTO_SWITCH_SUCCESS' : 'AUTO_SWITCH_FAILED',
        reason: result.reason,
        oldMode: result.oldMode,
        newMode: result.newMode,
        loadAssessment: result.loadAssessment,
        confidence: result.confidence,
        overrideApplied: result.overrideApplied,
        modeTransition: result.modeTransition
      });
    } catch (error) {
      console.error("❌ Failed to log auto-switch event:", error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopEvaluationTimer();
    console.log("🧹 Auto-approval engine destroyed");
  }
}

// Global auto-approval engine instance
let globalAutoApprovalEngine: AutoApprovalEngine | null = null;

/**
 * Get the global auto-approval engine
 */
export function getAutoApprovalEngine(): AutoApprovalEngine {
  if (!globalAutoApprovalEngine) {
    globalAutoApprovalEngine = new AutoApprovalEngine();
  }
  return globalAutoApprovalEngine;
}

/**
 * Initialize auto-approval engine with configuration
 */
export async function initializeAutoApproval(config?: Partial<AutoApprovalConfig>): Promise<AutoApprovalEngine> {
  console.log("🚀 Initializing auto-approval engine...");
  
  const engine = getAutoApprovalEngine();
  
  if (config) {
    await engine.configureAutoApproval(config);
  }
  
  console.log("✅ Auto-approval engine initialized");
  return engine;
}