import prisma from "@/prisma/prisma";
import { PoolStatus } from "@prisma/client";
import { bookingPool, type EnhancedPoolEntry } from "../pool/pool";
import { runAssignment } from "../core/run";
import { getAssignmentLogger, type PoolProcessingLogData } from "../logging/logging";
import { loadPolicy } from "../config/policy";

/**
 * Pool processing error recovery and reliability system
 * Implements retry logic, error isolation, corruption detection, and fallback mechanisms
 */
export class PoolErrorRecoveryManager {
  private logger = getAssignmentLogger();
  private maxRetryAttempts: number = 3;
  private baseRetryDelayMs: number = 1000; // 1 second base delay
  private maxRetryDelayMs: number = 30000; // 30 seconds max delay
  private corruptionDetectionEnabled: boolean = true;
  private fallbackToImmediateAssignment: boolean = true;
  private healthCheckIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private lastHealthCheck: Date | null = null;
  private healthCheckResults: HealthCheckResult[] = [];

  /**
   * Process pool entries with comprehensive error recovery
   */
  async processWithErrorRecovery(entries: EnhancedPoolEntry[]): Promise<ProcessingResult[]> {
    const batchId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    console.log(`🛡️ Starting error recovery processing for ${entries.length} entries (batch: ${batchId})`);

    // Pre-processing health check
    const healthCheck = await this.performHealthCheck();
    if (!healthCheck.isHealthy) {
      console.warn(`⚠️ Health check failed before processing: ${healthCheck.issues.join(', ')}`);
    }

    const results: ProcessingResult[] = [];
    const failedEntries: EnhancedPoolEntry[] = [];
    const corruptedEntries: EnhancedPoolEntry[] = [];

    // Process entries with error isolation
    for (const entry of entries) {
      try {
        // Check for corruption before processing
        const corruptionCheck = await this.detectEntryCorruption(entry);
        if (corruptionCheck.isCorrupted) {
          console.warn(`🔍 Corrupted entry detected: ${entry.bookingId} - ${corruptionCheck.reason}`);
          corruptedEntries.push(entry);
          
          const cleanupResult = await this.cleanupCorruptedEntry(entry, corruptionCheck);
          results.push({
            bookingId: entry.bookingId,
            status: cleanupResult.recovered ? 'recovered' : 'failed',
            reason: cleanupResult.recovered ? 
              `Corruption detected and recovered: ${corruptionCheck.reason}` :
              `Corruption detected, cleanup failed: ${corruptionCheck.reason}`,
            processingTime: 0,
            retryAttempts: 0,
            errorType: 'CORRUPTION',
            recoveryAction: cleanupResult.action
          });
          continue;
        }

        // Process entry with retry logic
        const result = await this.processEntryWithRetry(entry, batchId);
        results.push(result);

        // Track failed entries for batch retry
        if (result.status === 'failed' && result.retryAttempts >= this.maxRetryAttempts) {
          failedEntries.push(entry);
        }

      } catch (error) {
        console.error(`❌ Critical error processing entry ${entry.bookingId}:`, error);
        
        results.push({
          bookingId: entry.bookingId,
          status: 'failed',
          reason: `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTime: 0,
          retryAttempts: 0,
          errorType: 'CRITICAL',
          recoveryAction: 'ESCALATED'
        });
        
        failedEntries.push(entry);
      }
    }

    // Handle consistently failed entries with fallback
    if (failedEntries.length > 0 && this.fallbackToImmediateAssignment) {
      console.log(`🔄 Attempting fallback to immediate assignment for ${failedEntries.length} failed entries`);
      
      const fallbackResults = await this.fallbackToImmediateProcessing(failedEntries, batchId);
      
      // Update results with fallback outcomes
      for (const fallbackResult of fallbackResults) {
        const existingResultIndex = results.findIndex(r => r.bookingId === fallbackResult.bookingId);
        if (existingResultIndex >= 0) {
          results[existingResultIndex] = {
            ...results[existingResultIndex],
            status: fallbackResult.status,
            reason: `Pool processing failed, fallback: ${fallbackResult.reason}`,
            recoveryAction: 'FALLBACK_IMMEDIATE'
          };
        }
      }
    }

    // Log comprehensive processing results
    await this.logErrorRecoveryResults(batchId, startTime, results, corruptedEntries, healthCheck);

    console.log(`✅ Error recovery processing completed: ${results.filter(r => r.status === 'assigned').length} assigned, ${results.filter(r => r.status === 'failed').length} failed, ${corruptedEntries.length} corrupted`);

    return results;
  }

  /**
   * Process a single entry with exponential backoff retry logic
   */
  private async processEntryWithRetry(entry: EnhancedPoolEntry, batchId: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryAttempts = 0;

    // Get current retry count from database
    const currentEntry = await prisma.bookingPlan.findUnique({
      where: { bookingId: entry.bookingId },
      select: { poolProcessingAttempts: true }
    });

    const existingAttempts = currentEntry?.poolProcessingAttempts || 0;

    for (let attempt = 0; attempt < this.maxRetryAttempts; attempt++) {
      retryAttempts = attempt + 1;
      const totalAttempts = existingAttempts + retryAttempts;

      try {
        console.log(`🔄 Processing entry ${entry.bookingId} (attempt ${retryAttempts}/${this.maxRetryAttempts}, total: ${totalAttempts})`);

        // Mark as processing in database
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolStatus: PoolStatus.processing,
            poolProcessingAttempts: totalAttempts
          }
        });

        // Attempt assignment
        const assignmentResult = await runAssignment(entry.bookingId);

        if (assignmentResult.status === 'assigned') {
          // Success - remove from pool
          await bookingPool.removeFromPool(entry.bookingId);
          
          return {
            bookingId: entry.bookingId,
            status: 'assigned',
            interpreterId: assignmentResult.interpreterId,
            reason: assignmentResult.reason || 'Successfully assigned with retry',
            processingTime: Date.now() - startTime,
            retryAttempts,
            errorType: 'NONE',
            recoveryAction: retryAttempts > 1 ? 'RETRY_SUCCESS' : 'FIRST_ATTEMPT_SUCCESS'
          };
        } else if (assignmentResult.status === 'escalated') {
          // Escalated - remove from pool and mark as escalated
          await bookingPool.removeFromPool(entry.bookingId);
          
          return {
            bookingId: entry.bookingId,
            status: 'escalated',
            reason: assignmentResult.reason || 'Escalated during retry processing',
            processingTime: Date.now() - startTime,
            retryAttempts,
            errorType: 'BUSINESS_LOGIC',
            recoveryAction: 'ESCALATED'
          };
        } else {
          // Other status - treat as retriable error
          throw new Error(`Assignment returned unexpected status: ${assignmentResult.status}`);
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ Attempt ${retryAttempts} failed for entry ${entry.bookingId}: ${lastError.message}`);

        // Update processing attempts in database
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolProcessingAttempts: totalAttempts,
            poolStatus: PoolStatus.waiting // Reset to waiting for next attempt
          }
        }).catch(dbError => {
          console.error(`❌ Failed to update processing attempts for ${entry.bookingId}:`, dbError);
        });

        // Calculate exponential backoff delay
        if (attempt < this.maxRetryAttempts - 1) {
          const delay = Math.min(
            this.baseRetryDelayMs * Math.pow(2, attempt),
            this.maxRetryDelayMs
          );
          
          console.log(`⏳ Waiting ${delay}ms before retry attempt ${retryAttempts + 1}`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted - mark as failed
    await prisma.bookingPlan.update({
      where: { bookingId: entry.bookingId },
      data: {
        poolStatus: PoolStatus.failed,
        poolProcessingAttempts: existingAttempts + retryAttempts
      }
    }).catch(dbError => {
      console.error(`❌ Failed to mark entry ${entry.bookingId} as failed:`, dbError);
    });

    return {
      bookingId: entry.bookingId,
      status: 'failed',
      reason: `All ${this.maxRetryAttempts} retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`,
      processingTime: Date.now() - startTime,
      retryAttempts,
      errorType: this.categorizeError(lastError),
      recoveryAction: 'MAX_RETRIES_EXCEEDED'
    };
  }

  /**
   * Detect corruption in pool entries
   */
  private async detectEntryCorruption(entry: EnhancedPoolEntry): Promise<CorruptionCheckResult> {
    if (!this.corruptionDetectionEnabled) {
      return { isCorrupted: false, reason: '', severity: 'NONE' };
    }

    const issues: string[] = [];
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    try {
      // Check if booking exists in database
      const booking = await prisma.bookingPlan.findUnique({
        where: { bookingId: entry.bookingId }
      });

      if (!booking) {
        issues.push('Booking not found in database');
        severity = 'CRITICAL';
      } else {
        // Check for data consistency issues
        if (booking.timeStart.getTime() !== entry.startTime.getTime()) {
          issues.push('Start time mismatch between pool entry and database');
          severity = Math.max(severity === 'LOW' ? 1 : severity === 'MEDIUM' ? 2 : severity === 'HIGH' ? 3 : 4, 2) === 2 ? 'MEDIUM' : 'HIGH';
        }

        if (booking.timeEnd.getTime() !== entry.endTime.getTime()) {
          issues.push('End time mismatch between pool entry and database');
          severity = Math.max(severity === 'LOW' ? 1 : severity === 'MEDIUM' ? 2 : severity === 'HIGH' ? 3 : 4, 2) === 2 ? 'MEDIUM' : 'HIGH';
        }

        if (booking.meetingType !== entry.meetingType) {
          issues.push('Meeting type mismatch between pool entry and database');
          severity = 'HIGH';
        }

        // Check for invalid pool status
        if (booking.poolStatus === null) {
          issues.push('Pool entry exists but booking has no pool status');
          severity = 'HIGH';
        }

        // Check for excessive processing attempts
        if ((booking.poolProcessingAttempts || 0) > this.maxRetryAttempts * 2) {
          issues.push(`Excessive processing attempts: ${booking.poolProcessingAttempts}`);
          severity = 'MEDIUM';
        }

        // Check for invalid deadline times
        if (entry.deadlineTime && entry.deadlineTime.getTime() > entry.startTime.getTime()) {
          issues.push('Deadline time is after meeting start time');
          severity = 'HIGH';
        }

        // Check for already assigned bookings in pool
        if (booking.interpreterEmpCode) {
          issues.push('Booking already has interpreter assigned but still in pool');
          severity = 'HIGH';
        }
      }

      // Check for logical inconsistencies
      if (entry.startTime.getTime() <= Date.now()) {
        issues.push('Meeting start time is in the past');
        severity = 'CRITICAL';
      }

      if (entry.endTime.getTime() <= entry.startTime.getTime()) {
        issues.push('Meeting end time is before or equal to start time');
        severity = 'CRITICAL';
      }

    } catch (error) {
      issues.push(`Database error during corruption check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      severity = 'MEDIUM';
    }

    return {
      isCorrupted: issues.length > 0,
      reason: issues.join('; '),
      severity,
      issues
    };
  }

  /**
   * Clean up corrupted pool entries
   */
  private async cleanupCorruptedEntry(entry: EnhancedPoolEntry, corruption: CorruptionCheckResult): Promise<CleanupResult> {
    console.log(`🧹 Cleaning up corrupted entry ${entry.bookingId}: ${corruption.reason}`);

    try {
      if (corruption.severity === 'CRITICAL') {
        // Critical corruption - remove from pool entirely
        await bookingPool.removeFromPool(entry.bookingId);
        
        return {
          recovered: false,
          action: 'REMOVED_FROM_POOL',
          reason: `Critical corruption detected: ${corruption.reason}`
        };
      }

      // For non-critical corruption, attempt to fix
      const booking = await prisma.bookingPlan.findUnique({
        where: { bookingId: entry.bookingId }
      });

      if (!booking) {
        // Booking doesn't exist - remove from pool
        await bookingPool.removeFromPool(entry.bookingId);
        
        return {
          recovered: false,
          action: 'REMOVED_FROM_POOL',
          reason: 'Booking not found in database'
        };
      }

      // Check if already assigned
      if (booking.interpreterEmpCode) {
        await bookingPool.removeFromPool(entry.bookingId);
        
        return {
          recovered: true,
          action: 'REMOVED_ALREADY_ASSIGNED',
          reason: 'Booking already assigned, removed from pool'
        };
      }

      // Reset processing attempts if excessive
      if ((booking.poolProcessingAttempts || 0) > this.maxRetryAttempts * 2) {
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolProcessingAttempts: 0,
            poolStatus: PoolStatus.waiting
          }
        });

        return {
          recovered: true,
          action: 'RESET_PROCESSING_ATTEMPTS',
          reason: 'Reset excessive processing attempts'
        };
      }

      // Fix pool status if missing
      if (booking.poolStatus === null) {
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolStatus: PoolStatus.waiting,
            poolEntryTime: entry.poolEntryTime,
            poolDeadlineTime: entry.deadlineTime
          }
        });

        return {
          recovered: true,
          action: 'FIXED_POOL_STATUS',
          reason: 'Fixed missing pool status'
        };
      }

      return {
        recovered: true,
        action: 'NO_ACTION_NEEDED',
        reason: 'Minor corruption, no action required'
      };

    } catch (error) {
      console.error(`❌ Failed to cleanup corrupted entry ${entry.bookingId}:`, error);
      
      return {
        recovered: false,
        action: 'CLEANUP_FAILED',
        reason: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Fallback to immediate assignment when pool processing consistently fails
   */
  private async fallbackToImmediateProcessing(entries: EnhancedPoolEntry[], batchId: string): Promise<ProcessingResult[]> {
    console.log(`🚨 Fallback processing: attempting immediate assignment for ${entries.length} failed entries`);

    const results: ProcessingResult[] = [];

    for (const entry of entries) {
      const startTime = Date.now();

      try {
        // Remove from pool first to prevent further pool processing
        await bookingPool.removeFromPool(entry.bookingId);

        // Reset pool status to allow immediate assignment
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolStatus: null,
            poolEntryTime: null,
            poolDeadlineTime: null,
            poolProcessingAttempts: 0
          }
        });

        // Attempt immediate assignment
        const assignmentResult = await runAssignment(entry.bookingId);

        results.push({
          bookingId: entry.bookingId,
          status: assignmentResult.status === 'assigned' ? 'assigned' : 
                 assignmentResult.status === 'escalated' ? 'escalated' : 'failed',
          interpreterId: assignmentResult.interpreterId,
          reason: assignmentResult.reason || 'Fallback immediate assignment',
          processingTime: Date.now() - startTime,
          retryAttempts: 0,
          errorType: 'NONE',
          recoveryAction: 'FALLBACK_IMMEDIATE'
        });

        if (assignmentResult.status === 'assigned') {
          console.log(`✅ Fallback success: ${entry.bookingId} assigned to ${assignmentResult.interpreterId}`);
        } else {
          console.log(`❌ Fallback failed: ${entry.bookingId} - ${assignmentResult.reason}`);
        }

      } catch (error) {
        console.error(`❌ Fallback processing failed for ${entry.bookingId}:`, error);

        results.push({
          bookingId: entry.bookingId,
          status: 'failed',
          reason: `Fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTime: Date.now() - startTime,
          retryAttempts: 0,
          errorType: 'FALLBACK_FAILURE',
          recoveryAction: 'FALLBACK_FAILED'
        });
      }
    }

    return results;
  }

  /**
   * Perform comprehensive health check of pool processing system
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const warnings: string[] = [];
    let isHealthy = true;

    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      issues.push('Database connectivity failed');
      isHealthy = false;
    }

    try {
      // Check pool table integrity
      const poolCount = await prisma.bookingPlan.count({
        where: {
          poolStatus: { not: null }
        }
      });

      // Check for stuck processing entries
      const stuckProcessing = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.processing,
          poolEntryTime: {
            lt: new Date(Date.now() - 60 * 60 * 1000) // Older than 1 hour
          }
        }
      });

      if (stuckProcessing > 0) {
        warnings.push(`${stuckProcessing} entries stuck in processing status`);
      }

      // Check for excessive failed entries
      const failedCount = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.failed
        }
      });

      if (failedCount > poolCount * 0.1) { // More than 10% failed
        warnings.push(`High failure rate: ${failedCount} failed entries out of ${poolCount} total`);
      }

      // Check for entries with excessive retry attempts
      const excessiveRetries = await prisma.bookingPlan.count({
        where: {
          poolProcessingAttempts: {
            gt: this.maxRetryAttempts * 2
          }
        }
      });

      if (excessiveRetries > 0) {
        warnings.push(`${excessiveRetries} entries with excessive retry attempts`);
      }

    } catch (error) {
      issues.push(`Pool integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isHealthy = false;
    }

    // Check system resources and performance
    try {
      const policy = await loadPolicy();
      if (!policy.autoAssignEnabled) {
        warnings.push('Auto-assignment is disabled');
      }
    } catch (error) {
      issues.push('Failed to load assignment policy');
      isHealthy = false;
    }

    const result: HealthCheckResult = {
      isHealthy: isHealthy && warnings.length < 3, // Consider unhealthy if too many warnings
      issues,
      warnings,
      checkTime: Date.now() - startTime,
      timestamp: new Date()
    };

    this.lastHealthCheck = new Date();
    this.healthCheckResults.push(result);

    // Keep only last 10 health check results
    if (this.healthCheckResults.length > 10) {
      this.healthCheckResults = this.healthCheckResults.slice(-10);
    }

    return result;
  }

  /**
   * Get pool processing status with health information
   */
  async getPoolProcessingStatus(): Promise<PoolProcessingStatusWithHealth> {
    const poolStats = await bookingPool.getPoolStats();
    const healthCheck = await this.performHealthCheck();
    
    // Get recent error statistics
    const recentErrors = await this.getRecentErrorStatistics();

    return {
      poolSize: poolStats.totalInPool,
      readyForProcessing: poolStats.readyForProcessing,
      currentlyProcessing: poolStats.currentlyProcessing,
      failedEntries: poolStats.failedEntries,
      oldestEntry: poolStats.oldestEntry,
      healthStatus: {
        isHealthy: healthCheck.isHealthy,
        lastHealthCheck: this.lastHealthCheck,
        recentIssues: healthCheck.issues.length,
        recentWarnings: healthCheck.warnings.length
      },
      errorRecovery: {
        maxRetryAttempts: this.maxRetryAttempts,
        baseRetryDelayMs: this.baseRetryDelayMs,
        corruptionDetectionEnabled: this.corruptionDetectionEnabled,
        fallbackEnabled: this.fallbackToImmediateAssignment
      },
      recentErrors
    };
  }

  /**
   * Get recent error statistics for monitoring
   */
  private async getRecentErrorStatistics(): Promise<ErrorStatistics> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const totalFailures = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.failed,
          poolEntryTime: { gte: last24Hours }
        }
      });

      const highRetryAttempts = await prisma.bookingPlan.count({
        where: {
          poolProcessingAttempts: { gt: this.maxRetryAttempts },
          poolEntryTime: { gte: last24Hours }
        }
      });

      const stuckProcessing = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.processing,
          poolEntryTime: { lt: new Date(Date.now() - 60 * 60 * 1000) }
        }
      });

      return {
        totalFailures,
        highRetryAttempts,
        stuckProcessing,
        timeWindow: '24h',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Failed to get error statistics:', error);
      return {
        totalFailures: 0,
        highRetryAttempts: 0,
        stuckProcessing: 0,
        timeWindow: '24h',
        timestamp: new Date()
      };
    }
  }

  /**
   * Log comprehensive error recovery results
   */
  private async logErrorRecoveryResults(
    batchId: string,
    startTime: Date,
    results: ProcessingResult[],
    corruptedEntries: EnhancedPoolEntry[],
    healthCheck: HealthCheckResult
  ): Promise<void> {
    const endTime = new Date();
    const totalProcessingTime = endTime.getTime() - startTime.getTime();

    const logData: PoolProcessingLogData = {
      batchId,
      processingType: 'ERROR_RECOVERY',
      mode: 'ERROR_RECOVERY',
      processingStartTime: startTime,
      processingEndTime: endTime,
      totalEntries: results.length,
      processedEntries: results.length,
      assignedEntries: results.filter(r => r.status === 'assigned').length,
      escalatedEntries: results.filter(r => r.status === 'escalated').length,
      failedEntries: results.filter(r => r.status === 'failed').length,
      averageProcessingTimeMs: results.length > 0 ? totalProcessingTime / results.length : 0,
      systemLoad: healthCheck.isHealthy ? 'LOW' : 'HIGH',
      errors: results
        .filter(r => r.status === 'failed')
        .map(r => ({
          bookingId: r.bookingId,
          error: r.reason,
          timestamp: new Date()
        })),
      performance: {
        conflictDetectionTimeMs: 0,
        scoringTimeMs: 0,
        dbOperationTimeMs: 0,
        totalTimeMs: totalProcessingTime
      },
      // Additional error recovery specific data
      errorRecoveryData: {
        corruptedEntries: corruptedEntries.length,
        fallbackAttempts: results.filter(r => r.recoveryAction === 'FALLBACK_IMMEDIATE').length,
        retrySuccesses: results.filter(r => r.recoveryAction === 'RETRY_SUCCESS').length,
        healthCheckResult: healthCheck
      }
    };

    await this.logger.logPoolProcessing(logData);
  }

  /**
   * Categorize error types for better handling
   */
  private categorizeError(error: Error | null): ErrorType {
    if (!error) return 'UNKNOWN';

    const message = error.message.toLowerCase();

    if (message.includes('database') || message.includes('connection')) {
      return 'DATABASE';
    } else if (message.includes('conflict') || message.includes('availability')) {
      return 'CONFLICT';
    } else if (message.includes('timeout')) {
      return 'TIMEOUT';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION';
    } else if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK';
    } else {
      return 'BUSINESS_LOGIC';
    }
  }

  /**
   * Utility function for async sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure error recovery settings
   */
  configure(options: Partial<ErrorRecoveryConfig>): void {
    if (options.maxRetryAttempts !== undefined) {
      this.maxRetryAttempts = Math.max(1, Math.min(10, options.maxRetryAttempts));
    }
    if (options.baseRetryDelayMs !== undefined) {
      this.baseRetryDelayMs = Math.max(100, options.baseRetryDelayMs);
    }
    if (options.maxRetryDelayMs !== undefined) {
      this.maxRetryDelayMs = Math.max(this.baseRetryDelayMs, options.maxRetryDelayMs);
    }
    if (options.corruptionDetectionEnabled !== undefined) {
      this.corruptionDetectionEnabled = options.corruptionDetectionEnabled;
    }
    if (options.fallbackToImmediateAssignment !== undefined) {
      this.fallbackToImmediateAssignment = options.fallbackToImmediateAssignment;
    }

    console.log(`🔧 Error recovery configured: maxRetries=${this.maxRetryAttempts}, baseDelay=${this.baseRetryDelayMs}ms, corruption=${this.corruptionDetectionEnabled}, fallback=${this.fallbackToImmediateAssignment}`);
  }
}

// Type definitions
export interface ProcessingResult {
  bookingId: number;
  status: 'assigned' | 'escalated' | 'failed' | 'recovered';
  interpreterId?: string;
  reason: string;
  processingTime: number;
  retryAttempts: number;
  errorType: ErrorType;
  recoveryAction: RecoveryAction;
}

export interface CorruptionCheckResult {
  isCorrupted: boolean;
  reason: string;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issues?: string[];
}

export interface CleanupResult {
  recovered: boolean;
  action: string;
  reason: string;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  issues: string[];
  warnings: string[];
  checkTime: number;
  timestamp: Date;
}

export interface PoolProcessingStatusWithHealth {
  poolSize: number;
  readyForProcessing: number;
  currentlyProcessing: number;
  failedEntries: number;
  oldestEntry: Date | null;
  healthStatus: {
    isHealthy: boolean;
    lastHealthCheck: Date | null;
    recentIssues: number;
    recentWarnings: number;
  };
  errorRecovery: {
    maxRetryAttempts: number;
    baseRetryDelayMs: number;
    corruptionDetectionEnabled: boolean;
    fallbackEnabled: boolean;
  };
  recentErrors: ErrorStatistics;
}

export interface ErrorStatistics {
  totalFailures: number;
  highRetryAttempts: number;
  stuckProcessing: number;
  timeWindow: string;
  timestamp: Date;
}

export interface ErrorRecoveryConfig {
  maxRetryAttempts: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  corruptionDetectionEnabled: boolean;
  fallbackToImmediateAssignment: boolean;
}

export type ErrorType = 
  | 'NONE'
  | 'DATABASE'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'VALIDATION'
  | 'NETWORK'
  | 'BUSINESS_LOGIC'
  | 'CORRUPTION'
  | 'CRITICAL'
  | 'FALLBACK_FAILURE'
  | 'UNKNOWN';

export type RecoveryAction =
  | 'FIRST_ATTEMPT_SUCCESS'
  | 'RETRY_SUCCESS'
  | 'MAX_RETRIES_EXCEEDED'
  | 'FALLBACK_IMMEDIATE'
  | 'FALLBACK_FAILED'
  | 'ESCALATED'
  | 'REMOVED_FROM_POOL'
  | 'REMOVED_ALREADY_ASSIGNED'
  | 'RESET_PROCESSING_ATTEMPTS'
  | 'FIXED_POOL_STATUS'
  | 'NO_ACTION_NEEDED'
  | 'CLEANUP_FAILED';

// Global instance
let globalErrorRecoveryManager: PoolErrorRecoveryManager | null = null;

/**
 * Get the global error recovery manager instance
 */
export function getPoolErrorRecoveryManager(): PoolErrorRecoveryManager {
  if (!globalErrorRecoveryManager) {
    globalErrorRecoveryManager = new PoolErrorRecoveryManager();
  }
  return globalErrorRecoveryManager;
}