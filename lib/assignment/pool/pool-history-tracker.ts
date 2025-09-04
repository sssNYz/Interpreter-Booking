import prisma from "@/prisma/prisma";
import { type EnhancedPoolEntry } from "./pool";

/**
 * Pool entry history tracker for debugging and monitoring
 */
export class PoolHistoryTracker {
  private static instance: PoolHistoryTracker;

  private constructor() {}

  public static getInstance(): PoolHistoryTracker {
    if (!PoolHistoryTracker.instance) {
      PoolHistoryTracker.instance = new PoolHistoryTracker();
    }
    return PoolHistoryTracker.instance;
  }

  /**
   * Track pool entry addition
   */
  async trackPoolEntry(
    bookingId: number,
    deadlineTime: Date,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'POOL_ENTRY',
        newStatus: 'waiting',
        processingAttempts: 0,
        systemState: {
          deadlineTime: deadlineTime.toISOString(),
          entryTime: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked pool entry: booking ${bookingId}`);
    } catch (error) {
      console.error(`❌ Error tracking pool entry for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track pool entry status change
   */
  async trackStatusChange(
    bookingId: number,
    previousStatus: string,
    newStatus: string,
    processingAttempts: number = 0,
    errorMessage?: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'STATUS_CHANGE',
        previousStatus,
        newStatus,
        processingAttempts,
        errorMessage,
        systemState: {
          timestamp: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked status change: booking ${bookingId} ${previousStatus} → ${newStatus}`);
    } catch (error) {
      console.error(`❌ Error tracking status change for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track processing attempt
   */
  async trackProcessingAttempt(
    bookingId: number,
    attemptNumber: number,
    success: boolean,
    processingTime: number,
    errorMessage?: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'PROCESSING_ATTEMPT',
        processingAttempts: attemptNumber,
        errorMessage: success ? undefined : errorMessage,
        systemState: {
          success,
          processingTimeMs: processingTime,
          attemptNumber,
          timestamp: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked processing attempt: booking ${bookingId} attempt ${attemptNumber} ${success ? 'success' : 'failed'}`);
    } catch (error) {
      console.error(`❌ Error tracking processing attempt for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track pool entry removal
   */
  async trackPoolRemoval(
    bookingId: number,
    reason: 'ASSIGNED' | 'ESCALATED' | 'FAILED' | 'CANCELLED',
    interpreterId?: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'POOL_REMOVAL',
        previousStatus: 'processing',
        newStatus: reason.toLowerCase(),
        systemState: {
          reason,
          interpreterId,
          removalTime: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked pool removal: booking ${bookingId} reason ${reason}`);
    } catch (error) {
      console.error(`❌ Error tracking pool removal for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track error recovery action
   */
  async trackErrorRecovery(
    bookingId: number,
    recoveryAction: string,
    success: boolean,
    errorMessage?: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'ERROR_RECOVERY',
        errorMessage: success ? undefined : errorMessage,
        systemState: {
          recoveryAction,
          success,
          timestamp: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked error recovery: booking ${bookingId} action ${recoveryAction} ${success ? 'success' : 'failed'}`);
    } catch (error) {
      console.error(`❌ Error tracking error recovery for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track corruption detection
   */
  async trackCorruptionDetection(
    bookingId: number,
    corruptionType: string,
    cleanupAction?: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId,
        action: 'CORRUPTION_DETECTED',
        errorMessage: `Corruption detected: ${corruptionType}`,
        systemState: {
          corruptionType,
          cleanupAction,
          detectionTime: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked corruption detection: booking ${bookingId} type ${corruptionType}`);
    } catch (error) {
      console.error(`❌ Error tracking corruption detection for booking ${bookingId}:`, error);
    }
  }

  /**
   * Track batch processing
   */
  async trackBatchProcessing(
    batchId: string,
    processingType: 'THRESHOLD' | 'DEADLINE' | 'EMERGENCY',
    entryCount: number,
    successCount: number,
    failureCount: number,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId: 0, // Use 0 for batch operations
        action: 'BATCH_PROCESSING',
        systemState: {
          batchId,
          processingType,
          entryCount,
          successCount,
          failureCount,
          timestamp: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked batch processing: ${batchId} ${processingType} ${successCount}/${entryCount} success`);
    } catch (error) {
      console.error(`❌ Error tracking batch processing for batch ${batchId}:`, error);
    }
  }

  /**
   * Track system event
   */
  async trackSystemEvent(
    eventType: 'SCHEDULER_START' | 'SCHEDULER_STOP' | 'MODE_SWITCH' | 'EMERGENCY_PROCESSING' | 'HEALTH_CHECK',
    details: string,
    systemState?: any
  ): Promise<void> {
    try {
      await this.createHistoryEntry({
        bookingId: 0, // Use 0 for system events
        action: 'SYSTEM_EVENT',
        systemState: {
          eventType,
          details,
          timestamp: new Date().toISOString(),
          ...systemState
        }
      });

      console.log(`📝 Tracked system event: ${eventType} - ${details}`);
    } catch (error) {
      console.error(`❌ Error tracking system event ${eventType}:`, error);
    }
  }

  /**
   * Get entry history for a specific booking
   */
  async getEntryHistory(
    bookingId: number,
    limit: number = 50
  ): Promise<PoolHistoryEntry[]> {
    try {
      const history = await prisma.poolEntryHistory.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          bookingPlan: {
            select: {
              meetingType: true,
              timeStart: true,
              timeEnd: true,
              bookingStatus: true,
              poolStatus: true
            }
          }
        }
      });

      return history.map(entry => ({
        id: entry.id,
        bookingId: entry.bookingId,
        action: entry.action,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        processingAttempts: entry.processingAttempts,
        errorMessage: entry.errorMessage,
        systemState: entry.systemState as any,
        timestamp: entry.createdAt,
        booking: {
          meetingType: entry.bookingPlan.meetingType,
          startTime: entry.bookingPlan.timeStart,
          endTime: entry.bookingPlan.timeEnd,
          bookingStatus: entry.bookingPlan.bookingStatus,
          poolStatus: entry.bookingPlan.poolStatus
        }
      }));
    } catch (error) {
      console.error(`❌ Error getting entry history for booking ${bookingId}:`, error);
      return [];
    }
  }

  /**
   * Get recent system events
   */
  async getRecentSystemEvents(limit: number = 20): Promise<PoolHistoryEntry[]> {
    try {
      const events = await prisma.poolEntryHistory.findMany({
        where: {
          bookingId: 0, // System events use bookingId 0
          action: {
            in: ['SYSTEM_EVENT', 'BATCH_PROCESSING']
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return events.map(entry => ({
        id: entry.id,
        bookingId: entry.bookingId,
        action: entry.action,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        processingAttempts: entry.processingAttempts,
        errorMessage: entry.errorMessage,
        systemState: entry.systemState as any,
        timestamp: entry.createdAt,
        booking: null
      }));
    } catch (error) {
      console.error("❌ Error getting recent system events:", error);
      return [];
    }
  }

  /**
   * Get error summary for debugging
   */
  async getErrorSummary(days: number = 7): Promise<{
    totalErrors: number;
    errorsByAction: Record<string, number>;
    errorsByBooking: Record<number, number>;
    recentErrors: Array<{
      bookingId: number;
      action: string;
      errorMessage: string;
      timestamp: Date;
    }>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const errors = await prisma.poolEntryHistory.findMany({
        where: {
          createdAt: { gte: startDate },
          errorMessage: { not: null }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      const errorsByAction = errors.reduce((acc, error) => {
        acc[error.action] = (acc[error.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const errorsByBooking = errors.reduce((acc, error) => {
        if (error.bookingId > 0) { // Exclude system events
          acc[error.bookingId] = (acc[error.bookingId] || 0) + 1;
        }
        return acc;
      }, {} as Record<number, number>);

      return {
        totalErrors: errors.length,
        errorsByAction,
        errorsByBooking,
        recentErrors: errors.slice(0, 20).map(error => ({
          bookingId: error.bookingId,
          action: error.action,
          errorMessage: error.errorMessage || '',
          timestamp: error.createdAt
        }))
      };
    } catch (error) {
      console.error("❌ Error getting error summary:", error);
      return {
        totalErrors: 0,
        errorsByAction: {},
        errorsByBooking: {},
        recentErrors: []
      };
    }
  }

  /**
   * Create a history entry in the database
   */
  private async createHistoryEntry(data: {
    bookingId: number;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    processingAttempts?: number;
    errorMessage?: string;
    systemState?: any;
  }): Promise<void> {
    await prisma.poolEntryHistory.create({
      data: {
        bookingId: data.bookingId,
        action: data.action,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        processingAttempts: data.processingAttempts || 0,
        errorMessage: data.errorMessage,
        systemState: data.systemState || {}
      }
    });
  }
}

// Type definitions
export interface PoolHistoryEntry {
  id: number;
  bookingId: number;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  processingAttempts: number;
  errorMessage: string | null;
  systemState: any;
  timestamp: Date;
  booking: {
    meetingType: string;
    startTime: Date;
    endTime: Date;
    bookingStatus: string;
    poolStatus: string | null;
  } | null;
}

/**
 * Get the global pool history tracker instance
 */
export function getPoolHistoryTracker(): PoolHistoryTracker {
  return PoolHistoryTracker.getInstance();
}