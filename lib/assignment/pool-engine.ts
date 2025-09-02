import { bookingPool, type EnhancedPoolEntry } from "./pool";
import { processPool } from "./run";
import { getAssignmentLogger, type PoolProcessingLogData } from "./logging";
import { loadPolicy } from "./policy";

/**
 * Pool processing engine that handles threshold monitoring and deadline processing
 */
export class PoolProcessingEngine {
  private logger = getAssignmentLogger();

  /**
   * Process entries that have reached their threshold time
   */
  async processReadyEntries(): Promise<ProcessingResult[]> {
    console.log("🔄 Processing entries that have reached their threshold...");
    
    const readyEntries = bookingPool.getReadyForAssignment();
    
    if (readyEntries.length === 0) {
      console.log("📭 No entries ready for threshold processing");
      return [];
    }

    console.log(`📊 Found ${readyEntries.length} entries ready for threshold processing`);
    
    return await this.processEntries(readyEntries, 'THRESHOLD');
  }

  /**
   * Process entries that are approaching or have passed their deadline
   */
  async processDeadlineEntries(): Promise<ProcessingResult[]> {
    console.log("🚨 Processing entries approaching or past deadline...");
    
    const deadlineEntries = bookingPool.getDeadlineEntries();
    
    if (deadlineEntries.length === 0) {
      console.log("📭 No entries at deadline for processing");
      return [];
    }

    console.log(`🚨 Found ${deadlineEntries.length} entries at or past deadline`);
    
    return await this.processEntries(deadlineEntries, 'DEADLINE');
  }

  /**
   * Emergency processing - process all pooled entries immediately
   */
  async processEmergencyOverride(): Promise<ProcessingResult[]> {
    console.log("🚨 Emergency processing - processing ALL pooled entries immediately");
    
    const allEntries = bookingPool.getAllPoolEntries();
    
    if (allEntries.length === 0) {
      console.log("📭 No entries in pool for emergency processing");
      return [];
    }

    console.log(`🚨 Emergency processing ${allEntries.length} pooled entries`);
    
    return await this.processEntries(allEntries, 'EMERGENCY');
  }

  /**
   * Process a list of pool entries with detailed logging
   */
  private async processEntries(
    entries: EnhancedPoolEntry[], 
    processingType: 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY'
  ): Promise<ProcessingResult[]> {
    const startTime = new Date();
    const batchId = `${processingType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const results: ProcessingResult[] = [];
    let assignedCount = 0;
    let escalatedCount = 0;
    let failedCount = 0;
    const errors: Array<{ bookingId: number; error: string; timestamp: Date }> = [];

    console.log(`🔄 Starting ${processingType} processing batch ${batchId} with ${entries.length} entries`);

    // Sort entries by processing priority and deadline urgency
    const sortedEntries = entries.sort((a, b) => {
      // First by processing priority (1 = highest)
      if (a.processingPriority !== b.processingPriority) {
        return a.processingPriority - b.processingPriority;
      }
      // Then by deadline proximity (closer deadlines first)
      return a.deadlineTime.getTime() - b.deadlineTime.getTime();
    });

    // Process each entry
    for (const entry of sortedEntries) {
      const entryStartTime = Date.now();
      
      try {
        console.log(`🎯 Processing ${processingType} entry: booking ${entry.bookingId} (priority: ${entry.processingPriority})`);
        
        // Use the existing processPool function but for individual entries
        // We'll simulate this by temporarily filtering the pool to just this entry
        const originalPool = bookingPool.getAllPoolEntries();
        
        // Clear pool and add only this entry
        bookingPool.clearPool();
        await bookingPool.addToPool(
          entry.bookingId,
          entry.meetingType,
          entry.startTime,
          entry.endTime,
          entry.mode
        );
        
        // Process this single entry
        const entryResults = await processPool();
        
        // Restore original pool (minus processed entries)
        bookingPool.clearPool();
        for (const originalEntry of originalPool) {
          if (originalEntry.bookingId !== entry.bookingId) {
            await bookingPool.addToPool(
              originalEntry.bookingId,
              originalEntry.meetingType,
              originalEntry.startTime,
              originalEntry.endTime,
              originalEntry.mode
            );
          }
        }
        
        // Process results
        if (entryResults.length > 0) {
          const result = entryResults[0];
          const processingTime = Date.now() - entryStartTime;
          
          const processedResult: ProcessingResult = {
            bookingId: entry.bookingId,
            status: result.status === 'assigned' ? 'assigned' : 
                   result.status === 'escalated' ? 'escalated' : 'failed',
            interpreterId: result.interpreterId,
            reason: result.reason || `${processingType} processing`,
            processingTime,
            processingType,
            urgencyLevel: this.determineUrgencyLevel(entry),
            batchId
          };
          
          results.push(processedResult);
          
          if (result.status === 'assigned') {
            assignedCount++;
            console.log(`✅ ${processingType} entry ${entry.bookingId} assigned to ${result.interpreterId}`);
          } else {
            escalatedCount++;
            console.log(`❌ ${processingType} entry ${entry.bookingId} escalated: ${result.reason}`);
          }
        } else {
          // No results returned - treat as failed
          failedCount++;
          const error = `No processing result returned for ${processingType} entry`;
          errors.push({
            bookingId: entry.bookingId,
            error,
            timestamp: new Date()
          });
          
          results.push({
            bookingId: entry.bookingId,
            status: 'failed',
            reason: error,
            processingTime: Date.now() - entryStartTime,
            processingType,
            urgencyLevel: this.determineUrgencyLevel(entry),
            batchId
          });
        }

      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`❌ Error processing ${processingType} entry ${entry.bookingId}:`, errorMessage);
        
        errors.push({
          bookingId: entry.bookingId,
          error: errorMessage,
          timestamp: new Date()
        });
        
        results.push({
          bookingId: entry.bookingId,
          status: 'failed',
          reason: `Error: ${errorMessage}`,
          processingTime: Date.now() - entryStartTime,
          processingType,
          urgencyLevel: this.determineUrgencyLevel(entry),
          batchId
        });
      }
    }

    const endTime = new Date();
    const totalProcessingTime = endTime.getTime() - startTime.getTime();
    const averageProcessingTime = entries.length > 0 ? totalProcessingTime / entries.length : 0;

    // Log the batch processing results
    const logData: PoolProcessingLogData = {
      batchId,
      mode: `${processingType}_PROCESSING`,
      processingStartTime: startTime,
      processingEndTime: endTime,
      totalEntries: entries.length,
      processedEntries: entries.length,
      assignedEntries: assignedCount,
      escalatedEntries: escalatedCount,
      failedEntries: failedCount,
      averageProcessingTimeMs: averageProcessingTime,
      systemLoad: failedCount > entries.length * 0.3 ? 'HIGH' : 
                  escalatedCount > entries.length * 0.2 ? 'MEDIUM' : 'LOW',
      errors,
      performance: {
        conflictDetectionTimeMs: 0, // Will be aggregated from individual processing
        scoringTimeMs: 0, // Will be aggregated from individual processing
        dbOperationTimeMs: 0, // Will be aggregated from individual processing
        totalTimeMs: totalProcessingTime
      }
    };

    await this.logger.logPoolProcessing(logData);

    console.log(`✅ ${processingType} processing batch ${batchId} completed: ${assignedCount} assigned, ${escalatedCount} escalated, ${failedCount} failed (${totalProcessingTime}ms)`);

    return results;
  }

  /**
   * Determine urgency level for a pool entry
   */
  private determineUrgencyLevel(entry: EnhancedPoolEntry): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const now = new Date();
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
   * Get processing status for monitoring
   */
  getProcessingStatus(): PoolProcessingStatus {
    const poolStatus = bookingPool.getPoolStats();
    const readyEntries = bookingPool.getReadyForAssignment();
    const deadlineEntries = bookingPool.getDeadlineEntries();
    
    return {
      isRunning: false, // This would be set by the scheduler
      lastProcessingTime: null, // This would be tracked by the scheduler
      nextProcessingTime: null, // This would be set by the scheduler
      poolSize: poolStatus.total,
      readyForProcessing: readyEntries.length,
      deadlineEntries: deadlineEntries.length,
      processingErrors: [], // This would be tracked by the scheduler
      modeBreakdown: poolStatus.byMode
    };
  }

  /**
   * Check if any entries need immediate processing
   */
  needsImmediateProcessing(): boolean {
    const deadlineEntries = bookingPool.getDeadlineEntries();
    const readyEntries = bookingPool.getReadyForAssignment();
    
    return deadlineEntries.length > 0 || readyEntries.length > 0;
  }

  /**
   * Get entries that need processing with priority information
   */
  getEntriesNeedingProcessing(): {
    deadline: EnhancedPoolEntry[];
    ready: EnhancedPoolEntry[];
    pending: EnhancedPoolEntry[];
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  } {
    const allEntries = bookingPool.getAllPoolEntries();
    const readyEntries = bookingPool.getReadyForAssignment();
    const deadlineEntries = bookingPool.getDeadlineEntries();
    
    const pendingEntries = allEntries.filter(entry => 
      !readyEntries.includes(entry) && !deadlineEntries.includes(entry)
    );

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

    return {
      deadline: deadlineEntries,
      ready: readyEntries,
      pending: pendingEntries,
      summary
    };
  }
}

/**
 * Processing result interface
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
}

/**
 * Pool processing status interface
 */
export interface PoolProcessingStatus {
  isRunning: boolean;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  poolSize: number;
  readyForProcessing: number;
  deadlineEntries: number;
  processingErrors: Array<{ timestamp: Date; error: string }>;
  modeBreakdown: Record<string, { total: number; ready: number; deadline: number }>;
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