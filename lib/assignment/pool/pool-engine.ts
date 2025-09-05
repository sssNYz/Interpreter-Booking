import { bookingPool, type EnhancedPoolEntry } from "./pool";
import { processPool } from "../core/run";
import { getAssignmentLogger, type PoolProcessingLogData } from "../logging/logging";
import { loadPolicy } from "../config/policy";
import { getPoolErrorRecoveryManager, type ProcessingResult as ErrorRecoveryResult } from "../error-handling/pool-error-recovery";

/**
 * Pool processing engine that handles threshold monitoring and deadline processing
 */
export class PoolProcessingEngine {
  private logger = getAssignmentLogger();

  /**
   * Process entries that have reached their threshold time with error recovery
   */
  async processReadyEntries(): Promise<ProcessingResult[]> {
    console.log("🔄 Processing entries that have reached their threshold...");
    
    const readyEntries = await bookingPool.getReadyForAssignment();
    
    if (readyEntries.length === 0) {
      console.log("📭 No entries ready for threshold processing");
      return [];
    }

    console.log(`📊 Found ${readyEntries.length} entries ready for threshold processing`);
    
    // Use error recovery system for reliable processing
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const recoveryResults = await errorRecoveryManager.processWithErrorRecovery(readyEntries);
    
    // Convert error recovery results to processing results
    return this.convertErrorRecoveryResults(recoveryResults, 'THRESHOLD');
  }

  /**
   * Process entries that are approaching or have passed their deadline with error recovery
   */
  async processDeadlineEntries(): Promise<ProcessingResult[]> {
    console.log("🚨 Processing entries approaching or past deadline...");
    
    const deadlineEntries = await bookingPool.getDeadlineEntries();
    
    if (deadlineEntries.length === 0) {
      console.log("📭 No entries at deadline for processing");
      return [];
    }

    console.log(`🚨 Found ${deadlineEntries.length} entries at or past deadline`);
    
    // Use error recovery system with higher priority for deadline entries
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const recoveryResults = await errorRecoveryManager.processWithErrorRecovery(deadlineEntries);
    
    // Convert error recovery results to processing results
    return this.convertErrorRecoveryResults(recoveryResults, 'DEADLINE');
  }

  /**
   * Emergency processing - process all pooled entries immediately with maximum error recovery
   */
  async processEmergencyOverride(): Promise<ProcessingResult[]> {
    console.log("🚨 Emergency processing - processing ALL pooled entries immediately");
    
    const allEntries = await bookingPool.getAllPoolEntries();
    
    if (allEntries.length === 0) {
      console.log("📭 No entries in pool for emergency processing");
      return [];
    }

    console.log(`🚨 Emergency processing ${allEntries.length} pooled entries`);
    
    // Use error recovery system with emergency configuration
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    
    // Configure for emergency processing (more aggressive recovery)
    errorRecoveryManager.configure({
      maxRetryAttempts: 5, // More retries for emergency
      baseRetryDelayMs: 500, // Faster retries
      fallbackToImmediateAssignment: true // Always fallback
    });
    
    const recoveryResults = await errorRecoveryManager.processWithErrorRecovery(allEntries);
    
    // Reset to default configuration
    errorRecoveryManager.configure({
      maxRetryAttempts: 3,
      baseRetryDelayMs: 1000,
      fallbackToImmediateAssignment: true
    });
    
    // Convert error recovery results to processing results
    return this.convertErrorRecoveryResults(recoveryResults, 'EMERGENCY');
  }



  /**
   * Determine urgency level for a pool entry
   * Using simple time comparison to avoid timezone issues
   */
  private determineUrgencyLevel(entry: EnhancedPoolEntry): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Use the deadline time directly from database without creating new Date()
    // Calculate hours to deadline using simple math
    const deadlineTimestamp = entry.deadlineTime.getTime();
    const currentTimestamp = Date.now(); // This is UTC timestamp, safe to use
    const timeToDeadline = deadlineTimestamp - currentTimestamp;
    const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
    
    if (timeToDeadline <= 0) {
      return 'CRITICAL';
    } else if (hoursToDeadline <= 2) {
      return 'CRITICAL';
    } else if (hoursToDeadline <= 6) {
      return 'HIGH';
    } else if (hoursToDeadline <= 24) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Convert error recovery results to processing results
   */
  private convertErrorRecoveryResults(
    recoveryResults: ErrorRecoveryResult[], 
    processingType: 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY'
  ): ProcessingResult[] {
    return recoveryResults.map(result => ({
      bookingId: result.bookingId,
      status: result.status === 'recovered' ? 'assigned' : result.status,
      interpreterId: result.interpreterId,
      reason: result.reason,
      processingTime: result.processingTime,
      processingType,
      urgencyLevel: this.determineUrgencyLevelFromResult(result),
      batchId: `${processingType.toLowerCase()}_recovery_${Date.now()}`,
      errorRecovery: {
        retryAttempts: result.retryAttempts,
        errorType: result.errorType,
        recoveryAction: result.recoveryAction
      }
    }));
  }

  /**
   * Determine urgency level from error recovery result
   */
  private determineUrgencyLevelFromResult(result: ErrorRecoveryResult): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (result.errorType === 'CRITICAL' || result.errorType === 'CORRUPTION') {
      return 'CRITICAL';
    } else if (result.retryAttempts > 2 || result.errorType === 'DATABASE') {
      return 'HIGH';
    } else if (result.retryAttempts > 0 || result.errorType !== 'NONE') {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Get processing status for monitoring with error recovery information
   */
  async getProcessingStatus(): Promise<PoolProcessingStatusWithRecovery> {
    const poolStats = await bookingPool.getPoolStats();
    const readyEntries = await bookingPool.getReadyForAssignment();
    const deadlineEntries = await bookingPool.getDeadlineEntries();
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const recoveryStatus = await errorRecoveryManager.getPoolProcessingStatus();
    
    return {
      isRunning: false, // This would be set by the scheduler
      lastProcessingTime: null, // This would be tracked by the scheduler
      nextProcessingTime: null, // This would be set by the scheduler
      poolSize: poolStats.totalInPool,
      readyForProcessing: readyEntries.length,
      deadlineEntries: deadlineEntries.length,
      failedEntries: poolStats.failedEntries,
      processingErrors: [], // This would be tracked by the scheduler
      errorRecovery: {
        healthStatus: recoveryStatus.healthStatus,
        recentErrors: recoveryStatus.recentErrors,
        configuration: recoveryStatus.errorRecovery
      }
    };
  }

  /**
   * Check if any entries need immediate processing with health check
   */
  async needsImmediateProcessing(): Promise<boolean> {
    const deadlineEntries = await bookingPool.getDeadlineEntries();
    const readyEntries = await bookingPool.getReadyForAssignment();
    
    // Also check for stuck processing entries that need recovery
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const healthCheck = await errorRecoveryManager.performHealthCheck();
    
    const hasStuckEntries = healthCheck.warnings.some(warning => 
      warning.includes('stuck in processing')
    );
    
    return deadlineEntries.length > 0 || readyEntries.length > 0 || hasStuckEntries;
  }

  /**
   * Get entries that need processing with priority information and error recovery status
   */
  async getEntriesNeedingProcessing(): Promise<{
    deadline: EnhancedPoolEntry[];
    ready: EnhancedPoolEntry[];
    pending: EnhancedPoolEntry[];
    failed: EnhancedPoolEntry[];
    corrupted: EnhancedPoolEntry[];
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    errorRecovery: {
      needsRecovery: number;
      stuckProcessing: number;
      excessiveRetries: number;
    };
  }> {
    const allEntries = await bookingPool.getAllPoolEntries();
    const readyEntries = await bookingPool.getReadyForAssignment();
    const deadlineEntries = await bookingPool.getDeadlineEntries();
    const failedEntries = await bookingPool.getFailedEntries();
    
    const pendingEntries = allEntries.filter(entry => 
      !readyEntries.includes(entry) && 
      !deadlineEntries.includes(entry) && 
      !failedEntries.includes(entry)
    );

    // Check for corrupted entries
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    const corruptedEntries: EnhancedPoolEntry[] = [];
    
    for (const entry of allEntries) {
      const corruptionCheck = await errorRecoveryManager.detectEntryCorruption(entry);
      if (corruptionCheck.isCorrupted) {
        corruptedEntries.push(entry);
      }
    }

    // Count by urgency level
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const entry of allEntries) {
      const urgency = this.determineUrgencyLevel(entry);
      summary[urgency.toLowerCase() as keyof typeof summary]++;
    }

    // Get error recovery statistics
    const recoveryStatus = await errorRecoveryManager.getPoolProcessingStatus();

    return {
      deadline: deadlineEntries,
      ready: readyEntries,
      pending: pendingEntries,
      failed: failedEntries,
      corrupted: corruptedEntries,
      summary,
      errorRecovery: {
        needsRecovery: failedEntries.length + corruptedEntries.length,
        stuckProcessing: recoveryStatus.recentErrors.stuckProcessing,
        excessiveRetries: recoveryStatus.recentErrors.highRetryAttempts
      }
    };
  }
}

/**
 * Processing result interface with error recovery information
 */
export interface ProcessingResult {
  bookingId: number;
  status: 'assigned' | 'escalated' | 'failed';
  interpreterId?: string;
  reason: string;
  processingTime: number;
  processingType: 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY';
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  batchId: string;
  errorRecovery?: {
    retryAttempts: number;
    errorType: string;
    recoveryAction: string;
  };
}

/**
 * Pool processing status interface with error recovery information
 */
export interface PoolProcessingStatusWithRecovery {
  isRunning: boolean;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  poolSize: number;
  readyForProcessing: number;
  deadlineEntries: number;
  failedEntries: number;
  processingErrors: Array<{ timestamp: Date; error: string }>;
  errorRecovery: {
    healthStatus: {
      isHealthy: boolean;
      lastHealthCheck: Date | null;
      recentIssues: number;
      recentWarnings: number;
    };
    recentErrors: {
      totalFailures: number;
      highRetryAttempts: number;
      stuckProcessing: number;
      timeWindow: string;
      timestamp: Date;
    };
    configuration: {
      maxRetryAttempts: number;
      baseRetryDelayMs: number;
      corruptionDetectionEnabled: boolean;
      fallbackEnabled: boolean;
    };
  };
}

/**
 * Global pool processing engine instance
 */
let globalEngine: PoolProcessingEngine | null = null;

/**
 * Get the global pool processing engine
 */
export function getPoolProcessingEngine(): PoolProcessingEngine {
  if (!globalEngine) {
    globalEngine = new PoolProcessingEngine();
  }
  return globalEngine;
}