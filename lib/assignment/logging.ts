import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import type { 
  AssignmentLogData, 
  DRPolicy
} from "@/types/assignment";
import { ResilientLogger, type LoggingContext } from "./resilient-logger";
import { validateSchemaOnStartup } from "./schema-validator";

/**
 * Enhanced assignment logging with conflict detection and DR policy details
 */
export interface EnhancedAssignmentLogData extends AssignmentLogData {
  // Conflict detection details
  conflictDetection?: {
    totalInterpretersChecked: number;
    availableInterpreters: number;
    conflictedInterpreters: number;
    conflictDetails: Array<{
      interpreterId: string;
      conflictCount: number;
      conflictTypes: string[];
    }>;
    processingTimeMs: number;
  };
  
  // DR policy decision details
  drPolicyDecision?: {
    isDRMeeting: boolean;
    drType?: string;
    lastGlobalDR?: {
      interpreterId: string | null;
      timeStart?: Date;
      bookingId?: number;
    };
    policyApplied: DRPolicy & {
      description?: string;
      modeSpecificRules?: unknown;
    };
    interpreterDRHistory?: {
      interpreterId: string;
      consecutiveCount: number;
      isBlocked: boolean;
      penaltyApplied: boolean;
      penaltyAmount: number;
      overrideApplied?: boolean;
      overrideReason?: string;
    };
    alternativeInterpreters?: number;
    policyDecisionReason: string;
  };
  
  // Pool processing details
  poolProcessing?: {
    wasPooled: boolean;
    poolMode: string;
    thresholdDays?: number;
    deadlineTime?: Date;
    batchId?: string;
    batchSize?: number;
    processingPriority?: number;
    fairnessImprovement?: number;
  };
  
  // Performance metrics
  performance?: {
    totalProcessingTimeMs: number;
    conflictCheckTimeMs: number;
    scoringTimeMs: number;
    dbOperationTimeMs: number;
    retryAttempts?: number;
  };
  
  // System state at time of assignment
  systemState?: {
    activeInterpreters: number;
    poolSize: number;
    systemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
    concurrentAssignments?: number;
  };
}

/**
 * Pool processing batch log entry
 */
export interface PoolProcessingLogData {
  batchId: string;
  mode: string;
  processingStartTime: Date;
  processingEndTime: Date;
  totalEntries: number;
  processedEntries: number;
  assignedEntries: number;
  escalatedEntries: number;
  failedEntries: number;
  fairnessImprovement?: number;
  averageProcessingTimeMs: number;
  systemLoad: 'HIGH' | 'MEDIUM' | 'LOW';
  errors: Array<{
    bookingId: number;
    error: string;
    timestamp: Date;
  }>;
  performance: {
    conflictDetectionTimeMs: number;
    scoringTimeMs: number;
    dbOperationTimeMs: number;
    totalTimeMs: number;
  };
}

/**
 * Conflict detection statistics log entry
 */
export interface ConflictDetectionLogData {
  timestamp: Date;
  bookingId: number;
  requestedTimeStart: Date;
  requestedTimeEnd: Date;
  totalInterpretersChecked: number;
  availableInterpreters: number;
  conflictedInterpreters: number;
  conflicts: Array<{
    interpreterId: string;
    conflictingBookingId: number;
    conflictType: 'OVERLAP' | 'ADJACENT' | 'CONTAINED';
    conflictStart: Date;
    conflictEnd: Date;
    meetingType: string;
  }>;
  processingTimeMs: number;
  resolutionStrategy: 'FILTER_CONFLICTS' | 'RETRY_NEXT_CANDIDATE' | 'ESCALATE';
  outcome: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
}

/**
 * DR policy decision log entry
 */
export interface DRPolicyLogData {
  timestamp: Date;
  bookingId: number;
  interpreterId: string;
  isDRMeeting: boolean;
  drType?: string;
  mode: string;
  policyApplied: DRPolicy & {
    description?: string;
    modeSpecificRules?: unknown;
  };
  lastGlobalDR?: {
    interpreterId: string | null;
    timeStart?: Date;
    bookingId?: number;
  };
  drHistory: {
    consecutiveCount: number;
    isBlocked: boolean;
    penaltyApplied: boolean;
    penaltyAmount: number;
    overrideApplied: boolean;
    overrideReason?: string;
    policyDecisionReason: string;
  };
  alternativeInterpreters: number;
  finalDecision: 'ASSIGNED' | 'BLOCKED' | 'PENALIZED' | 'OVERRIDDEN';
  decisionRationale: string;
}

/**
 * Enhanced assignment logger class with resilient error handling
 */
export class AssignmentLogger {
  private static instance: AssignmentLogger;
  private logBuffer: EnhancedAssignmentLogData[] = [];
  private conflictLogBuffer: ConflictDetectionLogData[] = [];
  private drPolicyLogBuffer: DRPolicyLogData[] = [];
  private poolLogBuffer: PoolProcessingLogData[] = [];
  private resilientLogger: ResilientLogger;
  private isInitialized: boolean = false;
  
  private constructor() {
    this.resilientLogger = ResilientLogger.getInstance();
    this.initializeLogger();
    
    // Flush buffers periodically
    setInterval(() => this.flushBuffers(), 30000); // Every 30 seconds
  }
  
  public static getInstance(): AssignmentLogger {
    if (!AssignmentLogger.instance) {
      AssignmentLogger.instance = new AssignmentLogger();
    }
    return AssignmentLogger.instance;
  }

  /**
   * Initialize logger with schema validation
   */
  private async initializeLogger(): Promise<void> {
    try {
      console.log("🔧 Initializing assignment logger...");
      
      // Validate database schema on startup
      const isValid = await validateSchemaOnStartup();
      if (!isValid) {
        console.warn("⚠️ Schema validation failed - logger will use fallback mode");
      }
      
      this.isInitialized = true;
      console.log("✅ Assignment logger initialized");
      
    } catch (error) {
      console.error("❌ Error initializing assignment logger:", error);
      this.isInitialized = false;
    }
  }
  
  /**
   * Log enhanced assignment decision with all context
   */
  async logAssignment(logData: EnhancedAssignmentLogData): Promise<void> {
    const context: LoggingContext = {
      operation: 'logAssignment',
      bookingId: logData.bookingId,
      interpreterId: logData.interpreterEmpCode || undefined,
      correlationId: `assignment_${logData.bookingId}_${Date.now()}`
    };

    try {
      // Add to buffer for batch processing
      this.logBuffer.push(logData);
      
      // Also log to database immediately for critical assignments
      if (logData.status === 'escalated' || logData.drPolicyDecision?.interpreterDRHistory?.overrideApplied) {
        await this.flushAssignmentLogSafely(logData, context);
      }
      
      // Console logging with enhanced details
      this.logAssignmentToConsole(logData);
      
    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown assignment logging error'),
        context
      );
    }
  }
  
  /**
   * Log conflict detection details
   */
  async logConflictDetection(logData: ConflictDetectionLogData): Promise<void> {
    const context: LoggingContext = {
      operation: 'logConflictDetection',
      bookingId: logData.bookingId,
      correlationId: `conflict_${logData.bookingId}_${Date.now()}`
    };

    try {
      this.conflictLogBuffer.push(logData);
      
      // Console logging for conflicts
      if (logData.conflictedInterpreters > 0) {
        console.log(`🔍 Conflict Detection: ${logData.conflictedInterpreters}/${logData.totalInterpretersChecked} interpreters had conflicts (${logData.processingTimeMs}ms)`);
        
        if (logData.conflicts.length > 0) {
          const conflictSummary = logData.conflicts
            .map(c => `${c.interpreterId}:${c.conflictType}`)
            .join(', ');
          console.log(`   Conflicts: ${conflictSummary}`);
        }
      }
      
    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown conflict detection logging error'),
        context
      );
    }
  }
  
  /**
   * Log DR policy decision details
   */
  async logDRPolicyDecision(logData: DRPolicyLogData): Promise<void> {
    const context: LoggingContext = {
      operation: 'logDRPolicyDecision',
      bookingId: logData.bookingId,
      interpreterId: logData.interpreterId,
      correlationId: `dr_policy_${logData.bookingId}_${Date.now()}`
    };

    try {
      this.drPolicyLogBuffer.push(logData);
      
      // Console logging for DR decisions
      if (logData.isDRMeeting) {
        const decision = logData.finalDecision;
        const penalty = logData.drHistory.penaltyAmount;
        const override = logData.drHistory.overrideApplied ? ' (OVERRIDE)' : '';
        
        console.log(`🏥 DR Policy Decision: ${decision} for ${logData.interpreterId}${override}`);
        console.log(`   Mode: ${logData.mode}, Penalty: ${penalty}, Consecutive: ${logData.drHistory.consecutiveCount}`);
        console.log(`   Rationale: ${logData.decisionRationale}`);
        
        if (logData.drHistory.overrideApplied && logData.drHistory.overrideReason) {
          console.log(`   Override Reason: ${logData.drHistory.overrideReason}`);
        }
      }
      
    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown DR policy logging error'),
        context
      );
    }
  }
  
  /**
   * Log pool processing batch results
   */
  async logPoolProcessing(logData: PoolProcessingLogData): Promise<void> {
    const context: LoggingContext = {
      operation: 'logPoolProcessing',
      batchId: logData.batchId,
      correlationId: `pool_${logData.batchId}_${Date.now()}`
    };

    try {
      this.poolLogBuffer.push(logData);
      
      // Console logging for pool processing
      const duration = logData.processingEndTime.getTime() - logData.processingStartTime.getTime();
      console.log(`📊 Pool Batch ${logData.batchId} (${logData.mode}): ${logData.assignedEntries}/${logData.totalEntries} assigned in ${duration}ms`);
      
      if (logData.fairnessImprovement !== undefined) {
        console.log(`   Fairness improvement: ${logData.fairnessImprovement.toFixed(3)}`);
      }
      
      if (logData.errors.length > 0) {
        console.log(`   Errors: ${logData.errors.length} entries failed`);
      }
      
    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown pool processing logging error'),
        context
      );
    }
  }
  
  /**
   * Flush all log buffers to database with resilient error handling
   */
  async flushBuffers(): Promise<void> {
    const context: LoggingContext = {
      operation: 'flushBuffers',
      correlationId: `flush_${Date.now()}`
    };

    try {
      if (!this.isInitialized) {
        console.warn("⚠️ Logger not initialized, skipping buffer flush");
        return;
      }

      const results = await Promise.allSettled([
        this.flushAssignmentLogs(),
        this.flushConflictLogs(),
        this.flushDRPolicyLogs(),
        this.flushPoolLogs()
      ]);

      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`⚠️ ${failures.length} buffer flush operations failed`);
        failures.forEach((failure, index) => {
          if (failure.status === 'rejected') {
            console.error(`Buffer flush ${index} failed:`, failure.reason);
          }
        });
      } else {
        console.log("✅ All log buffers flushed successfully");
      }

    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown buffer flush error'),
        context
      );
    }
  }
  
  /**
   * Flush assignment logs to database with resilient error handling
   */
  private async flushAssignmentLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    let successCount = 0;
    const failedLogs: EnhancedAssignmentLogData[] = [];
    
    for (const logData of logsToFlush) {
      const context: LoggingContext = {
        operation: 'flushAssignmentLog',
        bookingId: logData.bookingId,
        interpreterId: logData.interpreterEmpCode || undefined
      };

      const result = await this.flushAssignmentLogSafely(logData, context);
      if (result) {
        successCount++;
      } else {
        failedLogs.push(logData);
      }
    }

    // Re-add failed logs to buffer for retry (with limit to prevent infinite growth)
    if (failedLogs.length > 0 && this.logBuffer.length < 1000) {
      this.logBuffer.unshift(...failedLogs);
      console.warn(`⚠️ ${failedLogs.length} assignment logs failed to flush, re-queued for retry`);
    }

    if (successCount > 0) {
      console.log(`✅ Flushed ${successCount} assignment logs successfully`);
    }
  }
  
  /**
   * Safely flush single assignment log to database with error handling
   */
  private async flushAssignmentLogSafely(logData: EnhancedAssignmentLogData, context: LoggingContext): Promise<boolean> {
    const writeOperation = async () => {
      return await prisma.assignmentLog.create({
        data: {
          bookingId: logData.bookingId,
          interpreterEmpCode: logData.interpreterEmpCode,
          status: logData.status,
          reason: logData.reason,
          preHoursSnapshot: logData.preHoursSnapshot as Prisma.InputJsonValue,
          postHoursSnapshot: (logData.postHoursSnapshot || {}) as Prisma.InputJsonValue,
          scoreBreakdown: (logData.scoreBreakdown || {}) as Prisma.InputJsonValue,
          maxGapHours: logData.maxGapHours,
          fairnessWindowDays: logData.fairnessWindowDays,
          // Enhanced fields as JSON - safely convert to InputJsonValue
          conflictDetection: logData.conflictDetection ? JSON.parse(JSON.stringify(logData.conflictDetection)) as Prisma.InputJsonValue : undefined,
          drPolicyDecision: logData.drPolicyDecision ? JSON.parse(JSON.stringify(logData.drPolicyDecision)) as Prisma.InputJsonValue : undefined,
          poolProcessing: logData.poolProcessing ? JSON.parse(JSON.stringify(logData.poolProcessing)) as Prisma.InputJsonValue : undefined,
          performance: logData.performance ? JSON.parse(JSON.stringify(logData.performance)) as Prisma.InputJsonValue : undefined,
          systemState: logData.systemState ? JSON.parse(JSON.stringify(logData.systemState)) as Prisma.InputJsonValue : undefined
        }
      });
    };

    const fallbackLog = async (error: Error) => {
      console.error(`❌ Assignment log fallback for booking ${logData.bookingId}:`, {
        bookingId: logData.bookingId,
        interpreterId: logData.interpreterEmpCode,
        status: logData.status,
        reason: logData.reason,
        error: error.message
      });
    };

    const result = await this.resilientLogger.logWithFallback(writeOperation, fallbackLog, context);
    return result !== null;
  }
  
  /**
   * Flush conflict detection logs to database with resilient error handling
   */
  private async flushConflictLogs(): Promise<void> {
    if (this.conflictLogBuffer.length === 0) return;
    
    const logsToFlush = [...this.conflictLogBuffer];
    this.conflictLogBuffer = [];
    
    let successCount = 0;
    const failedLogs: ConflictDetectionLogData[] = [];
    
    for (const logData of logsToFlush) {
      const context: LoggingContext = {
        operation: 'flushConflictLog',
        bookingId: logData.bookingId
      };

      const writeOperation = async () => {
        return await prisma.conflictDetectionLog.create({
          data: {
            bookingId: logData.bookingId,
            timestamp: logData.timestamp,
            requestedTimeStart: logData.requestedTimeStart,
            requestedTimeEnd: logData.requestedTimeEnd,
            totalInterpretersChecked: logData.totalInterpretersChecked,
            availableInterpreters: logData.availableInterpreters,
            conflictedInterpreters: logData.conflictedInterpreters,
            conflicts: JSON.parse(JSON.stringify(logData.conflicts)) as Prisma.InputJsonValue,
            processingTimeMs: logData.processingTimeMs,
            resolutionStrategy: logData.resolutionStrategy,
            outcome: logData.outcome
          }
        });
      };

      const fallbackLog = async (error: Error) => {
        console.error(`❌ Conflict log fallback for booking ${logData.bookingId}:`, {
          bookingId: logData.bookingId,
          conflictedInterpreters: logData.conflictedInterpreters,
          totalChecked: logData.totalInterpretersChecked,
          error: error.message
        });
      };

      const result = await this.resilientLogger.logWithFallback(writeOperation, fallbackLog, context);
      if (result) {
        successCount++;
      } else {
        failedLogs.push(logData);
      }
    }

    // Re-add failed logs to buffer for retry
    if (failedLogs.length > 0 && this.conflictLogBuffer.length < 1000) {
      this.conflictLogBuffer.unshift(...failedLogs);
      console.warn(`⚠️ ${failedLogs.length} conflict logs failed to flush, re-queued for retry`);
    }

    if (successCount > 0) {
      console.log(`✅ Flushed ${successCount} conflict logs successfully`);
    }
  }
  
  /**
   * Flush DR policy logs to database with resilient error handling
   */
  private async flushDRPolicyLogs(): Promise<void> {
    if (this.drPolicyLogBuffer.length === 0) return;
    
    const logsToFlush = [...this.drPolicyLogBuffer];
    this.drPolicyLogBuffer = [];
    
    let successCount = 0;
    const failedLogs: DRPolicyLogData[] = [];
    
    for (const logData of logsToFlush) {
      const context: LoggingContext = {
        operation: 'flushDRPolicyLog',
        bookingId: logData.bookingId,
        interpreterId: logData.interpreterId
      };

      const writeOperation = async () => {
        return await prisma.dRPolicyLog.create({
          data: {
            bookingId: logData.bookingId,
            interpreterId: logData.interpreterId,
            timestamp: logData.timestamp,
            isDRMeeting: logData.isDRMeeting,
            drType: logData.drType,
            mode: logData.mode,
            policyApplied: JSON.parse(JSON.stringify(logData.policyApplied)) as Prisma.InputJsonValue,
            lastGlobalDR: logData.lastGlobalDR ? JSON.parse(JSON.stringify(logData.lastGlobalDR)) as Prisma.InputJsonValue : undefined,
            drHistory: JSON.parse(JSON.stringify(logData.drHistory)) as Prisma.InputJsonValue,
            alternativeInterpreters: logData.alternativeInterpreters,
            finalDecision: logData.finalDecision,
            decisionRationale: logData.decisionRationale
          }
        });
      };

      const fallbackLog = async (error: Error) => {
        console.error(`❌ DR policy log fallback for booking ${logData.bookingId}:`, {
          bookingId: logData.bookingId,
          interpreterId: logData.interpreterId,
          isDRMeeting: logData.isDRMeeting,
          finalDecision: logData.finalDecision,
          error: error.message
        });
      };

      const result = await this.resilientLogger.logWithFallback(writeOperation, fallbackLog, context);
      if (result) {
        successCount++;
      } else {
        failedLogs.push(logData);
      }
    }

    // Re-add failed logs to buffer for retry
    if (failedLogs.length > 0 && this.drPolicyLogBuffer.length < 1000) {
      this.drPolicyLogBuffer.unshift(...failedLogs);
      console.warn(`⚠️ ${failedLogs.length} DR policy logs failed to flush, re-queued for retry`);
    }

    if (successCount > 0) {
      console.log(`✅ Flushed ${successCount} DR policy logs successfully`);
    }
  }
  
  /**
   * Flush pool processing logs to database with resilient error handling
   */
  private async flushPoolLogs(): Promise<void> {
    if (this.poolLogBuffer.length === 0) return;
    
    const logsToFlush = [...this.poolLogBuffer];
    this.poolLogBuffer = [];
    
    let successCount = 0;
    const failedLogs: PoolProcessingLogData[] = [];
    
    for (const logData of logsToFlush) {
      const context: LoggingContext = {
        operation: 'flushPoolLog',
        batchId: logData.batchId
      };

      const writeOperation = async () => {
        return await prisma.poolProcessingLog.create({
          data: {
            batchId: logData.batchId,
            mode: logData.mode,
            processingStartTime: logData.processingStartTime,
            processingEndTime: logData.processingEndTime,
            totalEntries: logData.totalEntries,
            processedEntries: logData.processedEntries,
            assignedEntries: logData.assignedEntries,
            escalatedEntries: logData.escalatedEntries,
            failedEntries: logData.failedEntries,
            fairnessImprovement: logData.fairnessImprovement,
            averageProcessingTimeMs: logData.averageProcessingTimeMs,
            systemLoad: logData.systemLoad,
            errors: JSON.parse(JSON.stringify(logData.errors)) as Prisma.InputJsonValue,
            performance: JSON.parse(JSON.stringify(logData.performance)) as Prisma.InputJsonValue
          }
        });
      };

      const fallbackLog = async (error: Error) => {
        console.error(`❌ Pool processing log fallback for batch ${logData.batchId}:`, {
          batchId: logData.batchId,
          mode: logData.mode,
          totalEntries: logData.totalEntries,
          assignedEntries: logData.assignedEntries,
          error: error.message
        });
      };

      const result = await this.resilientLogger.logWithFallback(writeOperation, fallbackLog, context);
      if (result) {
        successCount++;
      } else {
        failedLogs.push(logData);
      }
    }

    // Re-add failed logs to buffer for retry
    if (failedLogs.length > 0 && this.poolLogBuffer.length < 1000) {
      this.poolLogBuffer.unshift(...failedLogs);
      console.warn(`⚠️ ${failedLogs.length} pool logs failed to flush, re-queued for retry`);
    }

    if (successCount > 0) {
      console.log(`✅ Flushed ${successCount} pool logs successfully`);
    }
  }
  
  /**
   * Enhanced console logging with structured output
   */
  private logAssignmentToConsole(logData: EnhancedAssignmentLogData): void {
    const status = logData.status;
    const bookingId = logData.bookingId;
    const interpreterId = logData.interpreterEmpCode || 'N/A';
    
    // Main assignment result
    const statusIcon = status === 'assigned' ? '✅' : status === 'escalated' ? '❌' : '📥';
    console.log(`${statusIcon} Assignment ${bookingId}: ${status.toUpperCase()} ${interpreterId !== 'N/A' ? `to ${interpreterId}` : ''}`);
    
    // Conflict detection summary
    if (logData.conflictDetection) {
      const cd = logData.conflictDetection;
      console.log(`   🔍 Conflicts: ${cd.conflictedInterpreters}/${cd.totalInterpretersChecked} interpreters unavailable (${cd.processingTimeMs}ms)`);
    }
    
    // DR policy summary
    if (logData.drPolicyDecision?.isDRMeeting) {
      const dr = logData.drPolicyDecision;
      const drHistory = dr.interpreterDRHistory;
      if (drHistory) {
        const penalty = drHistory.penaltyApplied ? ` penalty:${drHistory.penaltyAmount}` : '';
        const override = drHistory.overrideApplied ? ' OVERRIDE' : '';
        console.log(`   🏥 DR Policy: ${drHistory.isBlocked ? 'BLOCKED' : 'ALLOWED'}${penalty}${override}`);
      }
    }
    
    // Pool processing summary
    if (logData.poolProcessing?.wasPooled) {
      const pp = logData.poolProcessing;
      console.log(`   📊 Pool: ${pp.poolMode} mode, priority:${pp.processingPriority}, batch:${pp.batchId}`);
    }
    
    // Performance summary
    if (logData.performance) {
      const perf = logData.performance;
      console.log(`   ⏱️  Performance: ${perf.totalProcessingTimeMs}ms total (conflict:${perf.conflictCheckTimeMs}ms, scoring:${perf.scoringTimeMs}ms)`);
    }
    
    // System state
    if (logData.systemState) {
      const sys = logData.systemState;
      console.log(`   🖥️  System: ${sys.activeInterpreters} interpreters, pool:${sys.poolSize}, load:${sys.systemLoad}`);
    }
  }
}

/**
 * Convenience function to get logger instance
 */
export function getAssignmentLogger(): AssignmentLogger {
  return AssignmentLogger.getInstance();
}

/**
 * Log analysis utilities for troubleshooting
 */
export class LogAnalyzer {
  /**
   * Analyze assignment patterns for a specific time period
   */
  static async analyzeAssignmentPatterns(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAssignments: number;
    successRate: number;
    escalationRate: number;
    averageProcessingTime: number;
    conflictRate: number;
    drOverrideRate: number;
    modeDistribution: Record<string, number>;
    interpreterWorkload: Record<string, number>;
    commonFailureReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const logs = await prisma.assignmentLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          status: true,
          reason: true,
          interpreterEmpCode: true,
          performance: true,
          conflictDetection: true,
          drPolicyDecision: true,
          poolProcessing: true
        }
      });
      
      const totalAssignments = logs.length;
      const successfulAssignments = logs.filter(log => log.status === 'assigned').length;
      const escalatedAssignments = logs.filter(log => log.status === 'escalated').length;
      
      // Calculate rates
      const successRate = totalAssignments > 0 ? successfulAssignments / totalAssignments : 0;
      const escalationRate = totalAssignments > 0 ? escalatedAssignments / totalAssignments : 0;
      
      // Performance analysis
      const performanceLogs = logs.filter(log => log.performance).map(log => log.performance as Record<string, unknown>);
      const averageProcessingTime = performanceLogs.length > 0 
        ? performanceLogs.reduce((sum: number, perf: Record<string, unknown>) => sum + (Number(perf?.totalProcessingTimeMs) || 0), 0) / performanceLogs.length
        : 0;
      
      // Conflict analysis
      const conflictLogs = logs.filter(log => log.conflictDetection).map(log => log.conflictDetection as Record<string, unknown>);
      const conflictRate = conflictLogs.length > 0
        ? conflictLogs.reduce((sum: number, cd: Record<string, unknown>) => sum + (Number(cd?.conflictedInterpreters) > 0 ? 1 : 0), 0) / conflictLogs.length
        : 0;
      
      // DR override analysis
      const drLogs = logs.filter(log => log.drPolicyDecision).map(log => log.drPolicyDecision as Record<string, unknown>);
      const drOverrideCount = drLogs.filter((dr: Record<string, unknown>) => {
        const history = dr?.interpreterDRHistory as Record<string, unknown> | undefined;
        return history?.overrideApplied;
      }).length;
      const drOverrideRate = drLogs.length > 0 ? drOverrideCount / drLogs.length : 0;
      
      // Mode distribution
      const modeDistribution: Record<string, number> = {};
      logs.forEach((log: Record<string, unknown>) => {
        const poolProcessing = log.poolProcessing as Record<string, unknown> | undefined;
        const mode = String(poolProcessing?.poolMode) || 'UNKNOWN';
        modeDistribution[mode] = (modeDistribution[mode] || 0) + 1;
      });
      
      // Interpreter workload
      const interpreterWorkload: Record<string, number> = {};
      logs.forEach((log: Record<string, unknown>) => {
        if (log.interpreterEmpCode && log.status === 'assigned') {
          const empCode = String(log.interpreterEmpCode);
          interpreterWorkload[empCode] = (interpreterWorkload[empCode] || 0) + 1;
        }
      });
      
      // Common failure reasons
      const failureReasons: Record<string, number> = {};
      logs.filter((log: Record<string, unknown>) => log.status === 'escalated').forEach((log: Record<string, unknown>) => {
        const reason = String(log.reason) || 'Unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
      
      const commonFailureReasons = Object.entries(failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return {
        totalAssignments,
        successRate,
        escalationRate,
        averageProcessingTime,
        conflictRate,
        drOverrideRate,
        modeDistribution,
        interpreterWorkload,
        commonFailureReasons
      };
      
    } catch (error) {
      console.error("❌ Error analyzing assignment patterns:", error);
      throw error;
    }
  }
  
  /**
   * Get conflict detection statistics
   */
  static async getConflictStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalConflictChecks: number;
    averageConflictsPerCheck: number;
    mostConflictedInterpreters: Array<{ interpreterId: string; conflictCount: number }>;
    conflictTypeDistribution: Record<string, number>;
    peakConflictTimes: Array<{ hour: number; conflictCount: number }>;
  }> {
    try {
      const conflictLogs = await prisma.conflictDetectionLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      const totalConflictChecks = conflictLogs.length;
      const totalConflicts = conflictLogs.reduce((sum, log) => sum + log.conflictedInterpreters, 0);
      const averageConflictsPerCheck = totalConflictChecks > 0 ? totalConflicts / totalConflictChecks : 0;
      
      // Analyze conflicts by interpreter
      const interpreterConflicts: Record<string, number> = {};
      const conflictTypeDistribution: Record<string, number> = {};
      const hourlyConflicts: Record<number, number> = {};
      
      conflictLogs.forEach(log => {
        const conflicts = log.conflicts as Record<string, unknown>[];
        if (Array.isArray(conflicts)) {
          conflicts.forEach(conflict => {
            const interpreterId = String(conflict.interpreterId);
            const conflictType = String(conflict.conflictType);
            
            // Count by interpreter
            interpreterConflicts[interpreterId] = (interpreterConflicts[interpreterId] || 0) + 1;
            
            // Count by type
            conflictTypeDistribution[conflictType] = (conflictTypeDistribution[conflictType] || 0) + 1;
          });
        }
        
        // Count by hour
        const hour = log.timestamp.getHours();
        hourlyConflicts[hour] = (hourlyConflicts[hour] || 0) + log.conflictedInterpreters;
      });
      
      const mostConflictedInterpreters = Object.entries(interpreterConflicts)
        .map(([interpreterId, conflictCount]) => ({ interpreterId, conflictCount }))
        .sort((a, b) => b.conflictCount - a.conflictCount)
        .slice(0, 10);
      
      const peakConflictTimes = Object.entries(hourlyConflicts)
        .map(([hour, conflictCount]) => ({ hour: parseInt(hour), conflictCount }))
        .sort((a, b) => b.conflictCount - a.conflictCount)
        .slice(0, 5);
      
      return {
        totalConflictChecks,
        averageConflictsPerCheck,
        mostConflictedInterpreters,
        conflictTypeDistribution,
        peakConflictTimes
      };
      
    } catch (error) {
      console.error("❌ Error analyzing conflict statistics:", error);
      throw error;
    }
  }
}