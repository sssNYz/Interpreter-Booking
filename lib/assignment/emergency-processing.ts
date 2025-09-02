import { bookingPool, type EnhancedPoolEntry } from "./pool";
import { getPoolProcessingEngine, type ProcessingResult } from "./pool-engine";
import { getAssignmentLogger } from "./logging";
import { getPoolErrorRecoveryManager } from "./pool-error-recovery";
import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Emergency processing result with detailed reporting
 */
export interface EmergencyProcessingResult {
  success: boolean;
  batchId: string;
  processingStartTime: Date;
  processingEndTime: Date;
  totalEntries: number;
  processedEntries: number;
  assignedEntries: number;
  escalatedEntries: number;
  failedEntries: number;
  manualEscalationEntries: number;
  processingTimeMs: number;
  averageProcessingTimeMs: number;
  priorityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  detailedResults: EmergencyProcessingEntry[];
  auditLog: EmergencyAuditLogEntry;
  recommendations: string[];
  errors: EmergencyProcessingError[];
}

/**
 * Emergency processing entry with priority and escalation details
 */
export interface EmergencyProcessingEntry {
  bookingId: number;
  status: 'assigned' | 'escalated' | 'failed' | 'manual_escalation';
  interpreterId?: string;
  reason: string;
  processingTimeMs: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priorityScore: number;
  originalDeadline: Date;
  timeToDeadline: number; // milliseconds
  retryAttempts: number;
  errorType?: string;
  escalationReason?: string;
  manualAssignmentRequired: boolean;
}

/**
 * Emergency processing error with context
 */
export interface EmergencyProcessingError {
  bookingId: number;
  error: string;
  errorType: 'ASSIGNMENT_FAILED' | 'DATABASE_ERROR' | 'CORRUPTION' | 'TIMEOUT' | 'UNKNOWN';
  timestamp: Date;
  retryAttempts: number;
  escalatedToManual: boolean;
  context?: {
    interpreterId?: string;
    urgencyLevel?: string;
    timeToDeadline?: number;
  };
}

/**
 * Emergency audit log entry for compliance and tracking
 */
export interface EmergencyAuditLogEntry {
  id: string;
  timestamp: Date;
  triggeredBy: string; // 'ADMIN' | 'SYSTEM' | 'AUTO_APPROVAL'
  reason: string;
  systemState: {
    poolSize: number;
    criticalEntries: number;
    deadlineEntries: number;
    failedEntries: number;
    systemLoad: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  processingConfiguration: {
    maxRetryAttempts: number;
    priorityBasedProcessing: boolean;
    manualEscalationEnabled: boolean;
    timeoutMs: number;
  };
  results: {
    totalProcessed: number;
    successRate: number;
    manualEscalationRate: number;
    averageProcessingTime: number;
  };
  impact: {
    poolSizeReduction: number;
    criticalEntriesCleared: number;
    deadlineEntriesCleared: number;
    systemLoadImprovement: string;
  };
}

/**
 * Emergency Pool Processing Manager
 * Handles emergency processing with priority-based processing, detailed reporting,
 * audit logging, and manual escalation for failed entries
 */
export class EmergencyPoolProcessingManager {
  private logger = getAssignmentLogger();
  private static instance: EmergencyPoolProcessingManager;

  public static getInstance(): EmergencyPoolProcessingManager {
    if (!EmergencyPoolProcessingManager.instance) {
      EmergencyPoolProcessingManager.instance = new EmergencyPoolProcessingManager();
    }
    return EmergencyPoolProcessingManager.instance;
  }

  /**
   * Execute emergency processing with priority-based processing and detailed reporting
   */
  async executeEmergencyProcessing(
    triggeredBy: string = 'ADMIN',
    reason: string = 'Manual emergency processing triggered'
  ): Promise<EmergencyProcessingResult> {
    const batchId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingStartTime = new Date();
    
    console.log(`🚨 Starting emergency processing - Batch ID: ${batchId}`);
    console.log(`🚨 Triggered by: ${triggeredBy}, Reason: ${reason}`);

    try {
      // Get current system state for audit logging
      const systemState = await this.getSystemState();
      
      // Get all pool entries and sort by priority
      const allEntries = await bookingPool.getAllPoolEntries();
      
      if (allEntries.length === 0) {
        return this.createEmptyResult(batchId, processingStartTime, triggeredBy, reason, systemState);
      }

      console.log(`🚨 Processing ${allEntries.length} pool entries with priority-based ordering`);

      // Sort entries by priority (critical first, then by deadline proximity)
      const prioritizedEntries = this.prioritizeEntriesForEmergencyProcessing(allEntries);
      
      // Process entries with enhanced error handling and manual escalation
      const processingResults = await this.processEntriesWithPriorityAndEscalation(
        prioritizedEntries,
        batchId
      );

      const processingEndTime = new Date();
      const processingTimeMs = processingEndTime.getTime() - processingStartTime.getTime();

      // Calculate results summary
      const summary = this.calculateProcessingSummary(processingResults, processingTimeMs);
      
      // Create audit log entry
      const auditLog = await this.createAuditLogEntry(
        batchId,
        triggeredBy,
        reason,
        systemState,
        summary,
        processingStartTime,
        processingEndTime
      );

      // Log to database
      await this.logEmergencyProcessingToDatabase(
        batchId,
        processingStartTime,
        processingEndTime,
        summary,
        processingResults
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(summary, processingResults);

      const result: EmergencyProcessingResult = {
        success: true,
        batchId,
        processingStartTime,
        processingEndTime,
        totalEntries: allEntries.length,
        processedEntries: processingResults.length,
        assignedEntries: summary.assignedCount,
        escalatedEntries: summary.escalatedCount,
        failedEntries: summary.failedCount,
        manualEscalationEntries: summary.manualEscalationCount,
        processingTimeMs,
        averageProcessingTimeMs: processingResults.length > 0 ? processingTimeMs / processingResults.length : 0,
        priorityBreakdown: summary.priorityBreakdown,
        detailedResults: processingResults,
        auditLog,
        recommendations,
        errors: summary.errors
      };

      console.log(`✅ Emergency processing completed: ${summary.assignedCount}/${allEntries.length} assigned, ${summary.manualEscalationCount} escalated to manual`);
      
      return result;

    } catch (error) {
      console.error(`❌ Emergency processing failed for batch ${batchId}:`, error);
      
      const processingEndTime = new Date();
      const processingTimeMs = processingEndTime.getTime() - processingStartTime.getTime();
      
      // Create failure audit log
      const systemState = await this.getSystemState().catch(() => ({
        poolSize: 0,
        criticalEntries: 0,
        deadlineEntries: 0,
        failedEntries: 0,
        systemLoad: 'UNKNOWN' as const
      }));

      const auditLog = await this.createFailureAuditLogEntry(
        batchId,
        triggeredBy,
        reason,
        systemState,
        error,
        processingStartTime,
        processingEndTime
      );

      return {
        success: false,
        batchId,
        processingStartTime,
        processingEndTime,
        totalEntries: 0,
        processedEntries: 0,
        assignedEntries: 0,
        escalatedEntries: 0,
        failedEntries: 0,
        manualEscalationEntries: 0,
        processingTimeMs,
        averageProcessingTimeMs: 0,
        priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        detailedResults: [],
        auditLog,
        recommendations: [
          'Emergency processing failed completely',
          'Check system logs for detailed error information',
          'Consider manual assignment for all pooled bookings',
          'Verify database connectivity and system health'
        ],
        errors: [{
          bookingId: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'UNKNOWN',
          timestamp: new Date(),
          retryAttempts: 0,
          escalatedToManual: false
        }]
      };
    }
  }

  /**
   * Prioritize entries for emergency processing based on urgency and deadline proximity
   */
  private prioritizeEntriesForEmergencyProcessing(entries: EnhancedPoolEntry[]): EnhancedPoolEntry[] {
    const now = new Date();
    
    return entries.sort((a, b) => {
      // Calculate priority scores
      const scoreA = this.calculateEmergencyPriorityScore(a, now);
      const scoreB = this.calculateEmergencyPriorityScore(b, now);
      
      // Higher priority score comes first
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate emergency priority score for an entry
   */
  private calculateEmergencyPriorityScore(entry: EnhancedPoolEntry, now: Date): number {
    const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
    const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
    
    let priorityScore = 0;
    
    // Deadline urgency (higher score for closer deadlines)
    if (now >= entry.deadlineTime) {
      priorityScore += 1000; // Past deadline - highest priority
    } else if (hoursToDeadline <= 2) {
      priorityScore += 800; // Within 2 hours
    } else if (hoursToDeadline <= 6) {
      priorityScore += 600; // Within 6 hours
    } else if (hoursToDeadline <= 24) {
      priorityScore += 400; // Within 24 hours
    } else {
      priorityScore += Math.max(0, 200 - hoursToDeadline); // Decreasing priority
    }
    
    // Meeting type priority
    switch (entry.meetingType) {
      case 'DR':
        priorityScore += 200;
        break;
      case 'VIP':
        priorityScore += 150;
        break;
      case 'Augent':
        priorityScore += 100;
        break;
      case 'Weekly':
        priorityScore += 50;
        break;
      default:
        priorityScore += 25;
    }
    
    // Processing attempts penalty (entries that failed multiple times get lower priority)
    priorityScore -= (entry.processingAttempts || 0) * 10;
    
    return priorityScore;
  }

  /**
   * Process entries with priority-based processing and manual escalation
   */
  private async processEntriesWithPriorityAndEscalation(
    entries: EnhancedPoolEntry[],
    batchId: string
  ): Promise<EmergencyProcessingEntry[]> {
    const results: EmergencyProcessingEntry[] = [];
    const errorRecoveryManager = getPoolErrorRecoveryManager();
    
    // Configure error recovery for emergency processing
    errorRecoveryManager.configure({
      maxRetryAttempts: 5, // More aggressive retries
      baseRetryDelayMs: 500, // Faster retries
      fallbackToImmediateAssignment: true
    });

    console.log(`🔄 Processing ${entries.length} entries in priority order...`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryStartTime = Date.now();
      
      console.log(`🔄 Processing entry ${i + 1}/${entries.length}: Booking ${entry.bookingId} (Priority: ${this.calculateEmergencyPriorityScore(entry, new Date()).toFixed(0)})`);

      try {
        // Attempt processing with error recovery
        const recoveryResults = await errorRecoveryManager.processWithErrorRecovery([entry]);
        const recoveryResult = recoveryResults[0];
        
        const processingTimeMs = Date.now() - entryStartTime;
        const now = new Date();
        const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
        const urgencyLevel = this.determineUrgencyLevel(entry, now);
        const priorityScore = this.calculateEmergencyPriorityScore(entry, now);

        if (recoveryResult && recoveryResult.status === 'recovered') {
          // Successfully assigned
          results.push({
            bookingId: entry.bookingId,
            status: 'assigned',
            interpreterId: recoveryResult.interpreterId,
            reason: recoveryResult.reason,
            processingTimeMs,
            urgencyLevel,
            priorityScore,
            originalDeadline: entry.deadlineTime,
            timeToDeadline,
            retryAttempts: recoveryResult.retryAttempts,
            manualAssignmentRequired: false
          });
          
        } else if (recoveryResult && recoveryResult.status === 'escalated') {
          // Escalated through normal process
          results.push({
            bookingId: entry.bookingId,
            status: 'escalated',
            reason: recoveryResult.reason,
            processingTimeMs,
            urgencyLevel,
            priorityScore,
            originalDeadline: entry.deadlineTime,
            timeToDeadline,
            retryAttempts: recoveryResult.retryAttempts,
            escalationReason: 'Normal escalation process',
            manualAssignmentRequired: true
          });
          
        } else {
          // Failed - escalate to manual assignment
          const escalationReason = this.determineEscalationReason(recoveryResult, entry);
          
          results.push({
            bookingId: entry.bookingId,
            status: 'manual_escalation',
            reason: recoveryResult?.reason || 'Processing failed',
            processingTimeMs,
            urgencyLevel,
            priorityScore,
            originalDeadline: entry.deadlineTime,
            timeToDeadline,
            retryAttempts: recoveryResult?.retryAttempts || 0,
            errorType: recoveryResult?.errorType || 'UNKNOWN',
            escalationReason,
            manualAssignmentRequired: true
          });
          
          // Log manual escalation
          console.warn(`⚠️ Booking ${entry.bookingId} escalated to manual assignment: ${escalationReason}`);
        }

      } catch (error) {
        // Critical error - escalate to manual assignment
        const processingTimeMs = Date.now() - entryStartTime;
        const now = new Date();
        const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
        const urgencyLevel = this.determineUrgencyLevel(entry, now);
        const priorityScore = this.calculateEmergencyPriorityScore(entry, now);
        
        results.push({
          bookingId: entry.bookingId,
          status: 'manual_escalation',
          reason: `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTimeMs,
          urgencyLevel,
          priorityScore,
          originalDeadline: entry.deadlineTime,
          timeToDeadline,
          retryAttempts: 0,
          errorType: 'UNKNOWN',
          escalationReason: 'Critical processing error',
          manualAssignmentRequired: true
        });
        
        console.error(`❌ Critical error processing booking ${entry.bookingId}:`, error);
      }
    }

    // Reset error recovery configuration
    errorRecoveryManager.configure({
      maxRetryAttempts: 3,
      baseRetryDelayMs: 1000,
      fallbackToImmediateAssignment: true
    });

    return results;
  }

  /**
   * Determine urgency level for emergency processing
   */
  private determineUrgencyLevel(entry: EnhancedPoolEntry, now: Date): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const timeToDeadline = entry.deadlineTime.getTime() - now.getTime();
    const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
    
    if (now >= entry.deadlineTime) {
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
   * Determine escalation reason for failed entries
   */
  private determineEscalationReason(recoveryResult: any, entry: EnhancedPoolEntry): string {
    if (!recoveryResult) {
      return 'Processing failed with no recovery result';
    }
    
    if (recoveryResult.errorType === 'CORRUPTION') {
      return 'Pool entry data corruption detected';
    }
    
    if (recoveryResult.errorType === 'DATABASE') {
      return 'Database connectivity issues during processing';
    }
    
    if (recoveryResult.retryAttempts >= 5) {
      return 'Maximum retry attempts exceeded';
    }
    
    if (entry.processingAttempts && entry.processingAttempts > 10) {
      return 'Entry has excessive processing attempts';
    }
    
    return `Processing failed: ${recoveryResult.reason || 'Unknown reason'}`;
  }

  /**
   * Calculate processing summary from results
   */
  private calculateProcessingSummary(
    results: EmergencyProcessingEntry[],
    processingTimeMs: number
  ): {
    assignedCount: number;
    escalatedCount: number;
    failedCount: number;
    manualEscalationCount: number;
    priorityBreakdown: { critical: number; high: number; medium: number; low: number };
    errors: EmergencyProcessingError[];
  } {
    const assignedCount = results.filter(r => r.status === 'assigned').length;
    const escalatedCount = results.filter(r => r.status === 'escalated').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const manualEscalationCount = results.filter(r => r.status === 'manual_escalation').length;
    
    const priorityBreakdown = {
      critical: results.filter(r => r.urgencyLevel === 'CRITICAL').length,
      high: results.filter(r => r.urgencyLevel === 'HIGH').length,
      medium: results.filter(r => r.urgencyLevel === 'MEDIUM').length,
      low: results.filter(r => r.urgencyLevel === 'LOW').length
    };
    
    const errors: EmergencyProcessingError[] = results
      .filter(r => r.status === 'failed' || r.status === 'manual_escalation')
      .map(r => ({
        bookingId: r.bookingId,
        error: r.reason,
        errorType: (r.errorType as any) || 'UNKNOWN',
        timestamp: new Date(),
        retryAttempts: r.retryAttempts,
        escalatedToManual: r.manualAssignmentRequired,
        context: {
          interpreterId: r.interpreterId,
          urgencyLevel: r.urgencyLevel,
          timeToDeadline: r.timeToDeadline
        }
      }));
    
    return {
      assignedCount,
      escalatedCount,
      failedCount,
      manualEscalationCount,
      priorityBreakdown,
      errors
    };
  }

  /**
   * Get current system state for audit logging
   */
  private async getSystemState(): Promise<{
    poolSize: number;
    criticalEntries: number;
    deadlineEntries: number;
    failedEntries: number;
    systemLoad: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }> {
    try {
      const poolStats = await bookingPool.getPoolStats();
      const allEntries = await bookingPool.getAllPoolEntries();
      const now = new Date();
      
      const criticalEntries = allEntries.filter(entry => 
        this.determineUrgencyLevel(entry, now) === 'CRITICAL'
      ).length;
      
      const deadlineEntries = allEntries.filter(entry => 
        now >= entry.deadlineTime
      ).length;
      
      // Determine system load based on pool size and critical entries
      let systemLoad: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (criticalEntries > 10 || deadlineEntries > 5) {
        systemLoad = 'CRITICAL';
      } else if (poolStats.totalInPool > 50 || criticalEntries > 5) {
        systemLoad = 'HIGH';
      } else if (poolStats.totalInPool > 20 || criticalEntries > 0) {
        systemLoad = 'MEDIUM';
      } else {
        systemLoad = 'LOW';
      }
      
      return {
        poolSize: poolStats.totalInPool,
        criticalEntries,
        deadlineEntries,
        failedEntries: poolStats.failedEntries,
        systemLoad
      };
      
    } catch (error) {
      console.error('Error getting system state:', error);
      return {
        poolSize: 0,
        criticalEntries: 0,
        deadlineEntries: 0,
        failedEntries: 0,
        systemLoad: 'UNKNOWN' as any
      };
    }
  }

  /**
   * Create audit log entry for successful processing
   */
  private async createAuditLogEntry(
    batchId: string,
    triggeredBy: string,
    reason: string,
    systemState: any,
    summary: any,
    processingStartTime: Date,
    processingEndTime: Date
  ): Promise<EmergencyAuditLogEntry> {
    const auditLog: EmergencyAuditLogEntry = {
      id: batchId,
      timestamp: processingStartTime,
      triggeredBy,
      reason,
      systemState,
      processingConfiguration: {
        maxRetryAttempts: 5,
        priorityBasedProcessing: true,
        manualEscalationEnabled: true,
        timeoutMs: 30000
      },
      results: {
        totalProcessed: summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount,
        successRate: summary.assignedCount / (summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount),
        manualEscalationRate: summary.manualEscalationCount / (summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount),
        averageProcessingTime: (processingEndTime.getTime() - processingStartTime.getTime()) / (summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount)
      },
      impact: {
        poolSizeReduction: systemState.poolSize - (summary.failedCount + summary.manualEscalationCount),
        criticalEntriesCleared: Math.max(0, systemState.criticalEntries - summary.priorityBreakdown.critical),
        deadlineEntriesCleared: Math.max(0, systemState.deadlineEntries - summary.errors.filter((e: any) => e.context?.timeToDeadline <= 0).length),
        systemLoadImprovement: this.calculateSystemLoadImprovement(systemState.systemLoad, summary)
      }
    };

    // Log audit entry to database
    try {
      await prisma.autoApprovalLog.create({
        data: {
          timestamp: auditLog.timestamp,
          eventType: 'EMERGENCY_PROCESSING',
          reason: auditLog.reason,
          currentMode: 'EMERGENCY',
          loadAssessment: JSON.stringify({
            poolSize: systemState.poolSize,
            systemLoad: systemState.systemLoad,
            criticalEntries: systemState.criticalEntries,
            deadlineEntries: systemState.deadlineEntries
          }),
          confidence: auditLog.results.successRate,
          overrideApplied: false,
          modeTransition: JSON.stringify({
            batchId: auditLog.id,
            triggeredBy: auditLog.triggeredBy,
            processingConfiguration: auditLog.processingConfiguration,
            results: auditLog.results,
            impact: auditLog.impact
          })
        }
      });
    } catch (error) {
      console.error('Failed to log emergency processing audit entry:', error);
    }

    return auditLog;
  }

  /**
   * Create audit log entry for failed processing
   */
  private async createFailureAuditLogEntry(
    batchId: string,
    triggeredBy: string,
    reason: string,
    systemState: any,
    error: any,
    processingStartTime: Date,
    processingEndTime: Date
  ): Promise<EmergencyAuditLogEntry> {
    const auditLog: EmergencyAuditLogEntry = {
      id: batchId,
      timestamp: processingStartTime,
      triggeredBy,
      reason: `FAILED: ${reason}`,
      systemState,
      processingConfiguration: {
        maxRetryAttempts: 5,
        priorityBasedProcessing: true,
        manualEscalationEnabled: true,
        timeoutMs: 30000
      },
      results: {
        totalProcessed: 0,
        successRate: 0,
        manualEscalationRate: 1,
        averageProcessingTime: processingEndTime.getTime() - processingStartTime.getTime()
      },
      impact: {
        poolSizeReduction: 0,
        criticalEntriesCleared: 0,
        deadlineEntriesCleared: 0,
        systemLoadImprovement: 'NONE'
      }
    };

    // Log failure audit entry to database
    try {
      await prisma.autoApprovalLog.create({
        data: {
          timestamp: auditLog.timestamp,
          eventType: 'EMERGENCY_PROCESSING_FAILED',
          reason: auditLog.reason,
          currentMode: 'EMERGENCY',
          loadAssessment: JSON.stringify({
            poolSize: systemState.poolSize,
            systemLoad: systemState.systemLoad,
            error: error instanceof Error ? error.message : 'Unknown error'
          }),
          confidence: 0,
          overrideApplied: false,
          modeTransition: JSON.stringify({
            batchId: auditLog.id,
            triggeredBy: auditLog.triggeredBy,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: auditLog.results.averageProcessingTime
          })
        }
      });
    } catch (dbError) {
      console.error('Failed to log emergency processing failure audit entry:', dbError);
    }

    return auditLog;
  }

  /**
   * Calculate system load improvement description
   */
  private calculateSystemLoadImprovement(originalLoad: string, summary: any): string {
    const successRate = summary.assignedCount / (summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount);
    
    if (successRate >= 0.9) {
      return 'SIGNIFICANT';
    } else if (successRate >= 0.7) {
      return 'MODERATE';
    } else if (successRate >= 0.5) {
      return 'MINOR';
    } else {
      return 'MINIMAL';
    }
  }

  /**
   * Log emergency processing to database
   */
  private async logEmergencyProcessingToDatabase(
    batchId: string,
    processingStartTime: Date,
    processingEndTime: Date,
    summary: any,
    results: EmergencyProcessingEntry[]
  ): Promise<void> {
    try {
      // Create main pool processing log entry
      const poolProcessingLog = await prisma.poolProcessingLog.create({
        data: {
          batchId,
          processingType: 'EMERGENCY',
          processingStartTime,
          processingEndTime,
          totalEntries: results.length,
          processedEntries: results.length,
          assignedEntries: summary.assignedCount,
          escalatedEntries: summary.escalatedCount + summary.manualEscalationCount,
          failedEntries: summary.failedCount,
          averageProcessingTimeMs: results.length > 0 ? results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length : 0,
          systemLoad: 'HIGH', // Emergency processing always indicates high load
          fairnessImprovement: null, // Not applicable for emergency processing
          errors: JSON.stringify(summary.errors)
        }
      });

      // Create individual entry logs
      for (const result of results) {
        await prisma.poolProcessingLogEntry.create({
          data: {
            logId: poolProcessingLog.id,
            bookingId: result.bookingId,
            status: result.status,
            interpreterId: result.interpreterId,
            reason: result.reason,
            processingTimeMs: result.processingTimeMs,
            urgencyLevel: result.urgencyLevel,
            errorRecovery: result.retryAttempts > 0 ? JSON.stringify({
              retryAttempts: result.retryAttempts,
              errorType: result.errorType,
              escalationReason: result.escalationReason,
              manualAssignmentRequired: result.manualAssignmentRequired
            }) : null
          }
        });
      }

      console.log(`✅ Emergency processing logged to database: ${poolProcessingLog.id}`);

    } catch (error) {
      console.error('Failed to log emergency processing to database:', error);
      // Don't throw - logging failure shouldn't fail the entire operation
    }
  }

  /**
   * Generate recommendations based on processing results
   */
  private generateRecommendations(
    summary: any,
    results: EmergencyProcessingEntry[]
  ): string[] {
    const recommendations: string[] = [];
    
    const totalEntries = summary.assignedCount + summary.escalatedCount + summary.failedCount + summary.manualEscalationCount;
    const successRate = summary.assignedCount / totalEntries;
    const manualEscalationRate = summary.manualEscalationCount / totalEntries;
    
    if (successRate >= 0.9) {
      recommendations.push('Emergency processing was highly successful. System is operating well under emergency conditions.');
    } else if (successRate >= 0.7) {
      recommendations.push('Emergency processing was moderately successful. Some system optimization may be beneficial.');
    } else {
      recommendations.push('Emergency processing had limited success. System health check recommended.');
    }
    
    if (manualEscalationRate > 0.3) {
      recommendations.push('High manual escalation rate detected. Review system configuration and interpreter availability.');
    }
    
    if (summary.priorityBreakdown.critical > 0) {
      recommendations.push(`${summary.priorityBreakdown.critical} critical entries remain. Immediate manual review recommended.`);
    }
    
    if (summary.errors.length > 0) {
      const errorTypes = [...new Set(summary.errors.map((e: any) => e.errorType))];
      recommendations.push(`Processing errors detected: ${errorTypes.join(', ')}. System diagnostics recommended.`);
    }
    
    if (results.some(r => r.retryAttempts > 3)) {
      recommendations.push('Some entries required excessive retries. Database performance review recommended.');
    }
    
    if (totalEntries > 50) {
      recommendations.push('Large pool size processed. Consider adjusting pool processing frequency to prevent future backlogs.');
    }
    
    return recommendations;
  }

  /**
   * Create empty result for when no entries need processing
   */
  private createEmptyResult(
    batchId: string,
    processingStartTime: Date,
    triggeredBy: string,
    reason: string,
    systemState: any
  ): EmergencyProcessingResult {
    const processingEndTime = new Date();
    
    return {
      success: true,
      batchId,
      processingStartTime,
      processingEndTime,
      totalEntries: 0,
      processedEntries: 0,
      assignedEntries: 0,
      escalatedEntries: 0,
      failedEntries: 0,
      manualEscalationEntries: 0,
      processingTimeMs: processingEndTime.getTime() - processingStartTime.getTime(),
      averageProcessingTimeMs: 0,
      priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
      detailedResults: [],
      auditLog: {
        id: batchId,
        timestamp: processingStartTime,
        triggeredBy,
        reason,
        systemState,
        processingConfiguration: {
          maxRetryAttempts: 5,
          priorityBasedProcessing: true,
          manualEscalationEnabled: true,
          timeoutMs: 30000
        },
        results: {
          totalProcessed: 0,
          successRate: 1,
          manualEscalationRate: 0,
          averageProcessingTime: 0
        },
        impact: {
          poolSizeReduction: 0,
          criticalEntriesCleared: 0,
          deadlineEntriesCleared: 0,
          systemLoadImprovement: 'NONE'
        }
      },
      recommendations: [
        'No entries in pool required emergency processing',
        'System is operating normally',
        'Emergency processing capability verified and ready'
      ],
      errors: []
    };
  }
}

/**
 * Get the global emergency processing manager instance
 */
export function getEmergencyProcessingManager(): EmergencyPoolProcessingManager {
  return EmergencyPoolProcessingManager.getInstance();
}