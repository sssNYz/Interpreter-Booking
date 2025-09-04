import prisma from "@/prisma/prisma";
import type { BookingPoolEntry, AssignmentPolicy } from "@/types/assignment";
import { getMeetingTypePriority, loadPolicy } from "../config/policy";
import { getModeSpecificThreshold } from "../config/mode-thresholds";
import { PoolStatus } from "@prisma/client";

// Enhanced pool entry with mode-specific information
export interface EnhancedPoolEntry extends BookingPoolEntry {
  mode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM';
  thresholdDays: number;
  deadlineTime: Date;
  batchId?: string;
  processingPriority: number;
}

// Pool processing result for monitoring
export interface PoolProcessingResult {
  processedCount: number;
  assignedCount: number;
  escalatedCount: number;
  remainingCount: number;
  processingMode: string;
  batchId: string;
  processingTime: Date;
  modeSpecificData?: {
    balanceMode?: {
      batchSize: number;
      fairnessOptimized: boolean;
      workloadDistribution: Record<string, number>;
    };
    urgentMode?: {
      immediateProcessing: boolean;
      emergencyOverrides: number;
    };
  };
}

// Database pool manager interface
export interface DatabasePoolManager {
  addToPool(bookingId: number, deadlineTime: Date): Promise<void>;
  getReadyForAssignment(): Promise<EnhancedPoolEntry[]>;
  markAsProcessing(bookingId: number): Promise<void>;
  removeFromPool(bookingId: number): Promise<void>;
  getPoolStats(): Promise<PoolStats>;
  getFailedEntries(): Promise<EnhancedPoolEntry[]>;
  retryFailedEntries(): Promise<void>;
  resetProcessingStatus(bookingId: number): Promise<void>;
}

export interface PoolStats {
  totalInPool: number;
  readyForProcessing: number;
  currentlyProcessing: number;
  failedEntries: number;
  oldestEntry: Date | null;
}

/**
 * Database-persistent pool for storing bookings with mode-specific processing logic
 * Replaces memory-based Map with database operations using BookingPlan table
 */
class DatabaseBookingPool implements DatabasePoolManager {

  /**
   * Add a booking to the database pool with mode-specific processing logic
   */
  async addToPool(bookingId: number, deadlineTime: Date): Promise<void> {
    try {
      await prisma.bookingPlan.update({
        where: { bookingId },
        data: {
          poolStatus: PoolStatus.waiting,
          poolEntryTime: new Date(),
          poolDeadlineTime: deadlineTime,
          poolProcessingAttempts: 0
        }
      });
      
      console.log(`📥 Added booking ${bookingId} to database pool (deadline: ${deadlineTime.toISOString()})`);
    } catch (error) {
      console.error(`❌ Failed to add booking ${bookingId} to pool:`, error);
      throw error;
    }
  }

  /**
   * Add a booking to the pool with mode-specific processing logic (enhanced version)
   */
  async addToPoolEnhanced(
    bookingId: number,
    meetingType: string,
    startTime: Date,
    endTime: Date,
    mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
  ): Promise<EnhancedPoolEntry> {
    
    const priority = await getMeetingTypePriority(meetingType);
    if (!priority) {
      throw new Error(`No priority configuration found for meeting type: ${meetingType}`);
    }

    const policy = await loadPolicy();
    const assignmentMode = mode || policy.mode;
    
    // Get mode-specific thresholds
    const modeThresholds = await getModeSpecificThreshold(meetingType, assignmentMode);
    
    // Calculate mode-specific thresholds and deadlines using the mode-specific values
    const { thresholdDays, deadlineTime, processingPriority } = this.calculateModeSpecificTiming(
      startTime,
      modeThresholds,
      assignmentMode
    );

    const poolEntry: EnhancedPoolEntry = {
      bookingId,
      meetingType,
      startTime,
      endTime,
      priorityValue: priority.priorityValue,
      urgentThresholdDays: modeThresholds.urgentThresholdDays,
      generalThresholdDays: modeThresholds.generalThresholdDays,
      poolEntryTime: new Date(),
      decisionWindowTime: new Date(Date.now() + modeThresholds.generalThresholdDays * 24 * 60 * 60 * 1000),
      mode: assignmentMode,
      thresholdDays,
      deadlineTime,
      processingPriority
    };

    // Store in database instead of memory
    try {
      await prisma.bookingPlan.update({
        where: { bookingId },
        data: {
          poolStatus: PoolStatus.waiting,
          poolEntryTime: poolEntry.poolEntryTime,
          poolDeadlineTime: deadlineTime,
          poolProcessingAttempts: 0
        }
      });

      console.log(`📥 Added booking ${bookingId} to database pool (${meetingType}, mode: ${assignmentMode}, threshold: ${thresholdDays} days, deadline: ${deadlineTime.toISOString()})`);
    } catch (error) {
      console.error(`❌ Failed to add booking ${bookingId} to database pool:`, error);
      throw error;
    }
    
    return poolEntry;
  }


  /**
   * Calculate mode-specific timing and priority for pool entries
   */
  private calculateModeSpecificTiming(
    startTime: Date,
    priority: { urgentThresholdDays: number; generalThresholdDays: number },
    mode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
  ): { thresholdDays: number; deadlineTime: Date; processingPriority: number } {
    const daysUntilMeeting = Math.floor((startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    switch (mode) {
      case 'BALANCE':
        // Balance mode: Use longer threshold for batch optimization, earlier deadline
        const balanceThreshold = Math.max(priority.generalThresholdDays, 3);
        const balanceDeadline = new Date(startTime.getTime() - (priority.urgentThresholdDays + 1) * 24 * 60 * 60 * 1000);
        return {
          thresholdDays: balanceThreshold,
          deadlineTime: balanceDeadline,
          processingPriority: 2 // Medium priority for batch processing
        };
        
      case 'URGENT':
        // Urgent mode: Immediate processing, very short threshold
        const urgentDeadline = new Date(startTime.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
        return {
          thresholdDays: 0, // Process immediately
          deadlineTime: urgentDeadline,
          processingPriority: 1 // Highest priority
        };
        
      case 'NORMAL':
        // Normal mode: Standard thresholds
        const normalDeadline = new Date(startTime.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
        return {
          thresholdDays: priority.generalThresholdDays,
          deadlineTime: normalDeadline,
          processingPriority: 3 // Standard priority
        };
        
      case 'CUSTOM':
        // Custom mode: Use configured thresholds
        const customDeadline = new Date(startTime.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
        return {
          thresholdDays: priority.generalThresholdDays,
          deadlineTime: customDeadline,
          processingPriority: 3 // Standard priority
        };
        
      default:
        // Fallback to normal mode
        const defaultDeadline = new Date(startTime.getTime() - priority.urgentThresholdDays * 24 * 60 * 60 * 1000);
        return {
          thresholdDays: priority.generalThresholdDays,
          deadlineTime: defaultDeadline,
          processingPriority: 3
        };
    }
  }

  /**
   * Remove a booking from the database pool
   */
  async removeFromPool(bookingId: number): Promise<void> {
    try {
      await prisma.bookingPlan.update({
        where: { bookingId },
        data: {
          poolStatus: null,
          poolEntryTime: null,
          poolDeadlineTime: null,
          poolProcessingAttempts: 0
        }
      });
      
      console.log(`📤 Removed booking ${bookingId} from database pool`);
    } catch (error) {
      console.error(`❌ Failed to remove booking ${bookingId} from pool:`, error);
      throw error;
    }
  }

  /**
   * Mark a booking as currently being processed
   */
  async markAsProcessing(bookingId: number): Promise<void> {
    try {
      await prisma.bookingPlan.update({
        where: { bookingId },
        data: {
          poolStatus: PoolStatus.processing,
          poolProcessingAttempts: {
            increment: 1
          }
        }
      });
      
      console.log(`🔄 Marked booking ${bookingId} as processing`);
    } catch (error) {
      console.error(`❌ Failed to mark booking ${bookingId} as processing:`, error);
      throw error;
    }
  }

  /**
   * Get all bookings in the database pool
   */
  async getAllPoolEntries(): Promise<EnhancedPoolEntry[]> {
    try {
      const pooledBookings = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: {
            not: null
          }
        },
        orderBy: {
          poolEntryTime: 'asc'
        }
      });

      return this.convertToEnhancedEntries(pooledBookings);
    } catch (error) {
      console.error('❌ Failed to get all pool entries:', error);
      return [];
    }
  }

  /**
   * Get bookings from database that are ready for assignment
   */
  async getReadyForAssignment(): Promise<EnhancedPoolEntry[]> {
    try {
      const now = new Date();
      
      const readyBookings = await prisma.bookingPlan.findMany({
        where: {
          OR: [
            // Bookings with waiting status that have reached their deadline
            {
              poolStatus: PoolStatus.waiting,
              poolDeadlineTime: {
                lte: now
              }
            },
            // Bookings with ready status
            {
              poolStatus: PoolStatus.ready
            }
          ]
        },
        orderBy: [
          { poolDeadlineTime: 'asc' },
          { poolEntryTime: 'asc' }
        ]
      });

      console.log(`🔍 Found ${readyBookings.length} bookings ready for assignment`);
      return this.convertToEnhancedEntries(readyBookings);
    } catch (error) {
      console.error('❌ Failed to get ready assignments:', error);
      return [];
    }
  }

  /**
   * Get bookings that have reached their decision window or threshold (mode-specific)
   */
  async getReadyForAssignmentByMode(mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'): Promise<EnhancedPoolEntry[]> {
    const allReady = await this.getReadyForAssignment();
    
    if (mode) {
      // Filter by specific mode based on enhanced entry data
      return allReady.filter(entry => entry.mode === mode);
    }
    
    return allReady;
  }

  /**
   * Check if an entry is ready for processing based on mode-specific logic
   */
  private isReadyForProcessing(entry: EnhancedPoolEntry, now: Date): boolean {
    switch (entry.mode) {
      case 'URGENT':
        // Urgent mode: Process immediately
        return true;
        
      case 'BALANCE':
        // Balance mode: Wait for threshold or deadline
        const thresholdTime = new Date(entry.poolEntryTime.getTime() + entry.thresholdDays * 24 * 60 * 60 * 1000);
        return now >= thresholdTime || now >= entry.deadlineTime;
        
      case 'NORMAL':
      case 'CUSTOM':
        // Normal/Custom mode: Use decision window or deadline
        return now >= entry.decisionWindowTime || now >= entry.deadlineTime;
        
      default:
        // Fallback to decision window
        return now >= entry.decisionWindowTime;
    }
  }

  /**
   * Get bookings that have reached their deadline (emergency processing)
   */
  async getDeadlineEntries(): Promise<EnhancedPoolEntry[]> {
    try {
      const now = new Date();
      
      const deadlineBookings = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: {
            in: [PoolStatus.waiting, PoolStatus.ready]
          },
          poolDeadlineTime: {
            lte: now
          }
        },
        orderBy: {
          poolDeadlineTime: 'asc'
        }
      });

      console.log(`🚨 Found ${deadlineBookings.length} bookings past deadline`);
      return this.convertToEnhancedEntries(deadlineBookings);
    } catch (error) {
      console.error('❌ Failed to get deadline entries:', error);
      return [];
    }
  }

  /**
   * Get failed pool entries for retry processing
   */
  async getFailedEntries(): Promise<EnhancedPoolEntry[]> {
    try {
      const failedBookings = await prisma.bookingPlan.findMany({
        where: {
          poolStatus: PoolStatus.failed
        },
        orderBy: {
          poolEntryTime: 'asc'
        }
      });

      return this.convertToEnhancedEntries(failedBookings);
    } catch (error) {
      console.error('❌ Failed to get failed entries:', error);
      return [];
    }
  }

  /**
   * Retry failed pool entries
   */
  async retryFailedEntries(): Promise<void> {
    try {
      const result = await prisma.bookingPlan.updateMany({
        where: {
          poolStatus: PoolStatus.failed,
          poolProcessingAttempts: {
            lt: 3 // Only retry entries with less than 3 attempts
          }
        },
        data: {
          poolStatus: PoolStatus.waiting
        }
      });

      console.log(`🔄 Reset ${result.count} failed entries for retry`);
    } catch (error) {
      console.error('❌ Failed to retry failed entries:', error);
      throw error;
    }
  }

  /**
   * Reset processing status for a stuck entry
   */
  async resetProcessingStatus(bookingId: number): Promise<void> {
    try {
      await prisma.bookingPlan.update({
        where: { bookingId },
        data: {
          poolStatus: PoolStatus.waiting,
          poolProcessingAttempts: 0
        }
      });

      console.log(`✅ Reset processing status for booking ${bookingId}`);
    } catch (error) {
      console.error(`❌ Error resetting processing status for booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Get entries by mode for batch processing
   */
  async getEntriesByMode(mode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'): Promise<EnhancedPoolEntry[]> {
    const allEntries = await this.getAllPoolEntries();
    return allEntries.filter(entry => entry.mode === mode);
  }

  /**
   * Convert database BookingPlan records to EnhancedPoolEntry objects
   */
  private async convertToEnhancedEntries(bookings: Array<{
    bookingId: number;
    meetingType: string;
    timeStart: Date;
    timeEnd: Date;
    poolEntryTime?: Date | null;
    poolDeadlineTime?: Date | null;
  }>): Promise<EnhancedPoolEntry[]> {
    const entries: EnhancedPoolEntry[] = [];
    
    for (const booking of bookings) {
      try {
        const priority = await getMeetingTypePriority(booking.meetingType);
        const policy = await loadPolicy();
        
        if (!priority) {
          console.warn(`⚠️ No priority found for meeting type: ${booking.meetingType}`);
          continue;
        }

        const assignmentMode = policy.mode as 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM';
        
        // Get mode-specific thresholds
        const modeThresholds = await getModeSpecificThreshold(booking.meetingType, assignmentMode);

        const { thresholdDays, processingPriority } = this.calculateModeSpecificTiming(
          booking.timeStart,
          modeThresholds,
          assignmentMode
        );

        const entry: EnhancedPoolEntry = {
          bookingId: booking.bookingId,
          meetingType: booking.meetingType,
          startTime: booking.timeStart,
          endTime: booking.timeEnd,
          priorityValue: priority.priorityValue,
          urgentThresholdDays: modeThresholds.urgentThresholdDays,
          generalThresholdDays: modeThresholds.generalThresholdDays,
          poolEntryTime: booking.poolEntryTime || new Date(),
          decisionWindowTime: booking.poolDeadlineTime || new Date(),
          mode: assignmentMode,
          thresholdDays,
          deadlineTime: booking.poolDeadlineTime || new Date(),
          processingPriority
        };

        entries.push(entry);
      } catch (error) {
        console.error(`❌ Failed to convert booking ${booking.bookingId} to enhanced entry:`, error);
      }
    }

    return entries;
  }

  /**
   * Get a specific booking from the database pool
   */
  async getPoolEntry(bookingId: number): Promise<EnhancedPoolEntry | null> {
    try {
      const booking = await prisma.bookingPlan.findFirst({
        where: {
          bookingId,
          poolStatus: {
            not: null
          }
        }
      });

      if (!booking) return null;

      const entries = await this.convertToEnhancedEntries([booking]);
      return entries[0] || null;
    } catch (error) {
      console.error(`❌ Failed to get pool entry ${bookingId}:`, error);
      return null;
    }
  }

  /**
   * Check if a booking is in the database pool
   */
  async isInPool(bookingId: number): Promise<boolean> {
    try {
      const booking = await prisma.bookingPlan.findFirst({
        where: {
          bookingId,
          poolStatus: {
            not: null
          }
        },
        select: { bookingId: true }
      });

      return booking !== null;
    } catch (error) {
      console.error(`❌ Failed to check if booking ${bookingId} is in pool:`, error);
      return false;
    }
  }

  /**
   * Get enhanced pool statistics from database
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      const now = new Date();
      
      // Get total count
      const totalInPool = await prisma.bookingPlan.count({
        where: {
          poolStatus: {
            not: null
          }
        }
      });

      // Get ready for processing count
      const readyForProcessing = await prisma.bookingPlan.count({
        where: {
          OR: [
            {
              poolStatus: PoolStatus.waiting,
              poolDeadlineTime: {
                lte: now
              }
            },
            {
              poolStatus: PoolStatus.ready
            }
          ]
        }
      });

      // Get currently processing count
      const currentlyProcessing = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.processing
        }
      });

      // Get failed entries count
      const failedEntries = await prisma.bookingPlan.count({
        where: {
          poolStatus: PoolStatus.failed
        }
      });

      // Get oldest entry
      const oldestEntry = await prisma.bookingPlan.findFirst({
        where: {
          poolStatus: {
            not: null
          }
        },
        orderBy: {
          poolEntryTime: 'asc'
        },
        select: {
          poolEntryTime: true
        }
      });

      return {
        totalInPool,
        readyForProcessing,
        currentlyProcessing,
        failedEntries,
        oldestEntry: oldestEntry?.poolEntryTime || null
      };
    } catch (error) {
      console.error('❌ Failed to get pool stats:', error);
      return {
        totalInPool: 0,
        readyForProcessing: 0,
        currentlyProcessing: 0,
        failedEntries: 0,
        oldestEntry: null
      };
    }
  }

  /**
   * Clear the entire database pool (for testing)
   */
  async clearPool(): Promise<void> {
    try {
      const result = await prisma.bookingPlan.updateMany({
        where: {
          poolStatus: {
            not: null
          }
        },
        data: {
          poolStatus: null,
          poolEntryTime: null,
          poolDeadlineTime: null,
          poolProcessingAttempts: 0
        }
      });

      console.log(`🧹 Cleared ${result.count} entries from database pool`);
    } catch (error) {
      console.error('❌ Failed to clear pool:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const bookingPool = new DatabaseBookingPool();


//Check if a booking should be assigned immediately or sent to pool based on mode
export async function shouldAssignImmediately(
  startTime: Date,
  meetingType: string,
  mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
): Promise<boolean> {

  //load policy again for make sure its up to date
  const policy = await loadPolicy();
  const assignmentMode = mode || policy.mode;
  
  // Get mode-specific thresholds
  const modeThresholds = await getModeSpecificThreshold(meetingType, assignmentMode);
  // Find difference between start time and now 
  const daysUntil = Math.floor((startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  // Switch on assignment mode for find is it urgent or not
  switch (assignmentMode) {
    case 'URGENT':
      // Urgent mode: Assign immediately if within urgent threshold or very close
      return daysUntil <= Math.max(modeThresholds.urgentThresholdDays, 1);
      
    case 'BALANCE':
      // Balance mode: Only assign immediately if at deadline
      return daysUntil <= modeThresholds.urgentThresholdDays;
      
    case 'NORMAL':
    case 'CUSTOM':
      // Normal/Custom mode: Standard urgent threshold
      return daysUntil <= modeThresholds.urgentThresholdDays;
      
    default:
      // Fallback to standard logic
      return daysUntil <= modeThresholds.urgentThresholdDays;
  }
}

/**
 * Process pool entries with mode-specific logic
 */
export async function processPoolEntries(mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'): Promise<EnhancedPoolEntry[]> {
  const policy = await loadPolicy();
  const processingMode = mode || policy.mode;
  
  switch (processingMode) {
    case 'URGENT':
      return await processUrgentModeEntries();
      
    case 'BALANCE':
      return await processBalanceModeEntries();
      
    case 'NORMAL':
    case 'CUSTOM':
      return await processNormalModeEntries();
      
    default:
      return await processNormalModeEntries();
  }
}

/**
 * Process entries for Urgent mode - immediate processing with priority sorting
 */
async function processUrgentModeEntries(): Promise<EnhancedPoolEntry[]> {
  const urgentEntries = await bookingPool.getReadyForAssignmentByMode('URGENT');
  const deadlineEntries = (await bookingPool.getDeadlineEntries()).filter(entry => entry.mode !== 'URGENT');
  
  // Combine urgent entries with deadline entries from other modes
  const allEntries = [...urgentEntries, ...deadlineEntries];
  
  if (allEntries.length > 0) {
    console.log(`⚡ Processing ${allEntries.length} entries in URGENT mode (${urgentEntries.length} urgent, ${deadlineEntries.length} deadline)`);
    
    // Sort by processing priority (1 = highest) and then by deadline
    allEntries.sort((a, b) => {
      if (a.processingPriority !== b.processingPriority) {
        return a.processingPriority - b.processingPriority;
      }
      return a.deadlineTime.getTime() - b.deadlineTime.getTime();
    });
  }
  
  return allEntries;
}

/**
 * Process entries for Balance mode - batch processing with fairness optimization
 */
async function processBalanceModeEntries(): Promise<EnhancedPoolEntry[]> {
  const balanceEntries = await bookingPool.getReadyForAssignmentByMode('BALANCE');
  const deadlineEntries = await bookingPool.getDeadlineEntries();
  
  // Always process deadline entries immediately regardless of mode
  const immediateEntries = deadlineEntries;
  
  if (balanceEntries.length > 0) {
    console.log(`⚖️ Processing ${balanceEntries.length} entries in BALANCE mode for batch optimization`);
    
    // Check if emergency processing should be triggered
    const emergencyCheck = detectEmergencyProcessing(balanceEntries);
    
    if (emergencyCheck.shouldTrigger) {
      console.log(`🚨 Emergency processing triggered: ${emergencyCheck.reason}`);
      
      // Process with batch optimization but emergency priority
      const batchResult = await processBatchForBalanceMode(balanceEntries, {
        maxBatchSize: 15, // Larger batch for emergency
        fairnessOptimization: true,
        workloadDistribution: true,
        emergencyProcessing: true
      });
      
      console.log(`⚡ Emergency batch processed: ${batchResult.assignments.filter(a => a.status === 'assigned').length} assigned, ${batchResult.emergencyOverrides} overrides`);
    } else {
      // Standard batch processing for fairness
      const batchResult = await processBatchForBalanceMode(balanceEntries, {
        maxBatchSize: 10,
        fairnessOptimization: true,
        workloadDistribution: true,
        emergencyProcessing: false
      });
      
      console.log(`⚖️ Standard batch processed: ${batchResult.assignments.filter(a => a.status === 'assigned').length} assigned, fairness improvement: ${batchResult.fairnessMetrics.fairnessImprovement.toFixed(2)}`);
    }
    
    // Sort balance entries for optimal fairness distribution
    balanceEntries.sort((a, b) => {
      // First by meeting type priority
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      // Then by how long they've been waiting
      return a.poolEntryTime.getTime() - b.poolEntryTime.getTime();
    });
  }
  
  if (immediateEntries.length > 0) {
    console.log(`🚨 Processing ${immediateEntries.length} deadline entries immediately`);
  }
  
  // Return deadline entries first, then balance entries
  return [...immediateEntries, ...balanceEntries];
}

/**
 * Process entries for Normal/Custom mode - standard processing
 */
async function processNormalModeEntries(): Promise<EnhancedPoolEntry[]> {
  const readyEntries = await bookingPool.getReadyForAssignment();
  
  if (readyEntries.length > 0) {
    console.log(`🔄 Processing ${readyEntries.length} pool entries in NORMAL mode`);
    
    // Sort by processing priority, then by priority value, then by decision window time
    readyEntries.sort((a, b) => {
      // First by processing priority (deadline entries first)
      if (a.processingPriority !== b.processingPriority) {
        return a.processingPriority - b.processingPriority;
      }
      // Then by meeting type priority
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      // Finally by decision window time
      return a.decisionWindowTime.getTime() - b.decisionWindowTime.getTime();
    });
  }
  
  return readyEntries;
}

/**
 * Get enhanced pool status for monitoring with mode-specific information
 */
export async function getPoolStatus(): Promise<{ 
  stats: PoolStats;
  entries: EnhancedPoolEntry[];
}> {
  const stats = await bookingPool.getPoolStats();
  const entries = await bookingPool.getAllPoolEntries();
  
  return {
    stats,
    entries
  };
}

/**
 * Get threshold day calculations for a booking based on mode
 */
export async function calculateThresholdDays(
  startTime: Date,
  meetingType: string,
  mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'
): Promise<{ thresholdDays: number; deadlineTime: Date; shouldProcessImmediately: boolean }> {
  const policy = await loadPolicy();
  const assignmentMode = mode || policy.mode;
  
  // Get mode-specific thresholds
  const modeThresholds = await getModeSpecificThreshold(meetingType, assignmentMode);
  
  const daysUntilMeeting = Math.floor((startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  switch (assignmentMode) {
    case 'BALANCE':
      const balanceThreshold = Math.max(modeThresholds.generalThresholdDays, 3);
      const balanceDeadline = new Date(startTime.getTime() - (modeThresholds.urgentThresholdDays + 1) * 24 * 60 * 60 * 1000);
      return {
        thresholdDays: balanceThreshold,
        deadlineTime: balanceDeadline,
        shouldProcessImmediately: daysUntilMeeting <= modeThresholds.urgentThresholdDays
      };
      
    case 'URGENT':
      const urgentDeadline = new Date(startTime.getTime() - modeThresholds.urgentThresholdDays * 24 * 60 * 60 * 1000);
      return {
        thresholdDays: 0, // Process immediately
        deadlineTime: urgentDeadline,
        shouldProcessImmediately: true
      };
      
    case 'NORMAL':
    case 'CUSTOM':
      const normalDeadline = new Date(startTime.getTime() - modeThresholds.urgentThresholdDays * 24 * 60 * 60 * 1000);
      return {
        thresholdDays: modeThresholds.generalThresholdDays,
        deadlineTime: normalDeadline,
        shouldProcessImmediately: daysUntilMeeting <= modeThresholds.urgentThresholdDays
      };
      
    default:
      const defaultDeadline = new Date(startTime.getTime() - modeThresholds.urgentThresholdDays * 24 * 60 * 60 * 1000);
      return {
        thresholdDays: modeThresholds.generalThresholdDays,
        deadlineTime: defaultDeadline,
        shouldProcessImmediately: daysUntilMeeting <= modeThresholds.urgentThresholdDays
      };
  }
}

/**
 * Check if deadline override should be applied
 */
export function shouldApplyDeadlineOverride(
  entry: EnhancedPoolEntry,
  currentTime: Date = new Date()
): { shouldOverride: boolean; reason: string; urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  const timeToDeadline = entry.deadlineTime.getTime() - currentTime.getTime();
  const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
  
  if (currentTime >= entry.deadlineTime) {
    return {
      shouldOverride: true,
      reason: "Deadline has passed - immediate assignment required",
      urgencyLevel: 'CRITICAL'
    };
  }
  
  if (hoursToDeadline <= 2) {
    return {
      shouldOverride: true,
      reason: "Within 2 hours of deadline - emergency processing",
      urgencyLevel: 'CRITICAL'
    };
  }
  
  if (hoursToDeadline <= 6) {
    return {
      shouldOverride: true,
      reason: "Within 6 hours of deadline - high priority processing",
      urgencyLevel: 'HIGH'
    };
  }
  
  if (hoursToDeadline <= 24) {
    return {
      shouldOverride: entry.mode === 'BALANCE',
      reason: "Within 24 hours of deadline - consider override for Balance mode",
      urgencyLevel: 'MEDIUM'
    };
  }
  
  return {
    shouldOverride: false,
    reason: "No deadline override needed",
    urgencyLevel: 'LOW'
  };
}

// Batch processing interfaces and types
export interface BatchProcessingOptions {
  maxBatchSize?: number;
  fairnessOptimization?: boolean;
  workloadDistribution?: boolean;
  emergencyProcessing?: boolean;
}

export interface WorkloadDistribution {
  interpreterId: string;
  currentHours: number;
  projectedHours: number;
  assignmentCount: number;
  fairnessScore: number;
}

export interface BatchAssignmentResult {
  batchId: string;
  processedEntries: EnhancedPoolEntry[];
  assignments: Array<{
    bookingId: number;
    interpreterId?: string;
    status: 'assigned' | 'escalated' | 'deferred';
    reason: string;
    fairnessImpact: number;
  }>;
  workloadDistribution: WorkloadDistribution[];
  fairnessMetrics: {
    preProcessingGap: number;
    postProcessingGap: number;
    fairnessImprovement: number;
  };
  processingTime: Date;
  emergencyOverrides: number;
}

/**
 * Process Balance mode entries with batch optimization for fairness
 */
export async function processBatchForBalanceMode(
  entries: EnhancedPoolEntry[],
  options: BatchProcessingOptions = {}
): Promise<BatchAssignmentResult> {
  const {
    maxBatchSize = 10,
    fairnessOptimization = true,
    workloadDistribution = true,
    emergencyProcessing = false
  } = options;

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const processingTime = new Date();
  
  console.log(`⚖️ Starting batch processing for Balance mode (batch: ${batchId}, entries: ${entries.length})`);

  // Limit batch size for performance
  const batchEntries = entries.slice(0, maxBatchSize);
  
  // Separate emergency entries that need immediate processing
  const emergencyEntries = batchEntries.filter(entry => {
    const override = shouldApplyDeadlineOverride(entry);
    return override.urgencyLevel === 'CRITICAL' || override.urgencyLevel === 'HIGH';
  });
  
  const regularEntries = batchEntries.filter(entry => {
    const override = shouldApplyDeadlineOverride(entry);
    return override.urgencyLevel !== 'CRITICAL' && override.urgencyLevel !== 'HIGH';
  });

  console.log(`🚨 Emergency entries: ${emergencyEntries.length}, Regular entries: ${regularEntries.length}`);

  // Get current workload distribution for fairness optimization
  const workloadDist = await calculateWorkloadDistribution();
  const preProcessingGap = calculateWorkloadGap(workloadDist);

  const assignments: BatchAssignmentResult['assignments'] = [];
  let emergencyOverrides = 0;

  // Process emergency entries first (individual assignment)
  for (const entry of emergencyEntries) {
    console.log(`🚨 Processing emergency entry ${entry.bookingId}`);
    
    const assignment = await processIndividualEntry(entry, workloadDist, true);
    assignments.push(assignment);
    
    if (assignment.status === 'assigned') {
      emergencyOverrides++;
      // Update workload distribution for next assignment
      updateWorkloadDistribution(workloadDist, assignment.interpreterId!, 1);
    }
  }

  // Process regular entries with batch optimization
  if (regularEntries.length > 0 && fairnessOptimization) {
    console.log(`⚖️ Optimizing ${regularEntries.length} regular entries for fairness`);
    
    const optimizedAssignments = await optimizeBatchForFairness(regularEntries, workloadDist);
    assignments.push(...optimizedAssignments);
  } else {
    // Process regular entries individually if no optimization
    for (const entry of regularEntries) {
      const assignment = await processIndividualEntry(entry, workloadDist, false);
      assignments.push(assignment);
      
      if (assignment.status === 'assigned') {
        updateWorkloadDistribution(workloadDist, assignment.interpreterId!, 1);
      }
    }
  }

  // Calculate final fairness metrics
  const postProcessingGap = calculateWorkloadGap(workloadDist);
  const fairnessImprovement = preProcessingGap - postProcessingGap;

  const result: BatchAssignmentResult = {
    batchId,
    processedEntries: batchEntries,
    assignments,
    workloadDistribution: workloadDist,
    fairnessMetrics: {
      preProcessingGap: preProcessingGap,
      postProcessingGap: postProcessingGap,
      fairnessImprovement: fairnessImprovement
    },
    processingTime,
    emergencyOverrides
  };

  console.log(`✅ Batch processing complete (${batchId}): ${assignments.filter(a => a.status === 'assigned').length} assigned, fairness improvement: ${fairnessImprovement.toFixed(2)}`);

  return result;
}

/**
 * Optimize batch assignments for maximum fairness
 */
async function optimizeBatchForFairness(
  entries: EnhancedPoolEntry[],
  workloadDist: WorkloadDistribution[]
): Promise<BatchAssignmentResult['assignments']> {
  console.log(`🧮 Optimizing ${entries.length} entries for fairness distribution`);

  // Sort entries by priority and waiting time for fair processing order
  const sortedEntries = entries.sort((a, b) => {
    // First by priority value (higher priority first)
    if (a.priorityValue !== b.priorityValue) {
      return b.priorityValue - a.priorityValue;
    }
    // Then by how long they've been waiting (longer wait first)
    return a.poolEntryTime.getTime() - b.poolEntryTime.getTime();
  });

  const assignments: BatchAssignmentResult['assignments'] = [];
  const tempWorkload = [...workloadDist]; // Work with a copy for optimization

  // Try different assignment combinations to find the most fair distribution
  for (const entry of sortedEntries) {
    console.log(`🎯 Finding optimal assignment for booking ${entry.bookingId}`);
    
    // Find the interpreter that would result in the best fairness after assignment
    const bestAssignment = findOptimalAssignment(entry, tempWorkload);
    
    if (bestAssignment.interpreterId) {
      // Update temporary workload for next optimization
      updateWorkloadDistribution(tempWorkload, bestAssignment.interpreterId, 1);
    }
    
    assignments.push(bestAssignment);
  }

  return assignments;
}

/**
 * Find the optimal interpreter assignment for fairness
 */
function findOptimalAssignment(
  entry: EnhancedPoolEntry,
  workloadDist: WorkloadDistribution[]
): BatchAssignmentResult['assignments'][0] {
  // Sort interpreters by current workload (lowest first for fairness)
  const sortedInterpreters = workloadDist
    .filter(w => w.fairnessScore > 0) // Only consider available interpreters
    .sort((a, b) => {
      // Primary: current hours (lower is better for fairness)
      if (a.currentHours !== b.currentHours) {
        return a.currentHours - b.currentHours;
      }
      // Secondary: fairness score (higher is better)
      return b.fairnessScore - a.fairnessScore;
    });

  if (sortedInterpreters.length === 0) {
    return {
      bookingId: entry.bookingId,
      status: 'escalated',
      reason: 'No available interpreters for batch optimization',
      fairnessImpact: 0
    };
  }

  // Select the interpreter with the lowest workload for maximum fairness
  const selectedInterpreter = sortedInterpreters[0];
  
  // Calculate fairness impact of this assignment
  const currentGap = calculateWorkloadGap(workloadDist);
  const tempWorkload = [...workloadDist];
  updateWorkloadDistribution(tempWorkload, selectedInterpreter.interpreterId, 1);
  const newGap = calculateWorkloadGap(tempWorkload);
  const fairnessImpact = currentGap - newGap; // Positive means improvement

  return {
    bookingId: entry.bookingId,
    interpreterId: selectedInterpreter.interpreterId,
    status: 'assigned',
    reason: `Batch optimized assignment for fairness (gap improvement: ${fairnessImpact.toFixed(2)})`,
    fairnessImpact
  };
}

/**
 * Process an individual entry (for emergency or non-batch processing)
 */
async function processIndividualEntry(
  entry: EnhancedPoolEntry,
  workloadDist: WorkloadDistribution[],
  isEmergency: boolean
): Promise<BatchAssignmentResult['assignments'][0]> {
  // For individual processing, select the most available interpreter
  const availableInterpreters = workloadDist
    .filter(w => w.fairnessScore > 0)
    .sort((a, b) => {
      if (isEmergency) {
        // For emergency, prioritize availability over fairness
        return b.fairnessScore - a.fairnessScore;
      } else {
        // For regular, balance fairness and availability
        return a.currentHours - b.currentHours;
      }
    });

  if (availableInterpreters.length === 0) {
    return {
      bookingId: entry.bookingId,
      status: 'escalated',
      reason: isEmergency ? 'No interpreters available for emergency assignment' : 'No interpreters available',
      fairnessImpact: 0
    };
  }

  const selectedInterpreter = availableInterpreters[0];
  
  return {
    bookingId: entry.bookingId,
    interpreterId: selectedInterpreter.interpreterId,
    status: 'assigned',
    reason: isEmergency ? 'Emergency assignment' : 'Individual assignment',
    fairnessImpact: 0 // Individual assignments don't optimize for fairness
  };
}

/**
 * Calculate current workload distribution for fairness optimization
 */
async function calculateWorkloadDistribution(): Promise<WorkloadDistribution[]> {
  // This would normally query the database for current interpreter workloads
  // For now, return a mock distribution
  console.log('📊 Calculating current workload distribution...');
  
  // Mock data - in real implementation, this would query interpreter hours
  return [
    { interpreterId: 'INT001', currentHours: 10, projectedHours: 11, assignmentCount: 5, fairnessScore: 0.8 },
    { interpreterId: 'INT002', currentHours: 8, projectedHours: 9, assignmentCount: 4, fairnessScore: 0.9 },
    { interpreterId: 'INT003', currentHours: 12, projectedHours: 13, assignmentCount: 6, fairnessScore: 0.7 },
    { interpreterId: 'INT004', currentHours: 6, projectedHours: 7, assignmentCount: 3, fairnessScore: 1.0 },
  ];
}

/**
 * Calculate workload gap for fairness measurement
 */
function calculateWorkloadGap(workloadDist: WorkloadDistribution[]): number {
  if (workloadDist.length === 0) return 0;
  
  const hours = workloadDist.map(w => w.currentHours);
  const maxHours = Math.max(...hours);
  const minHours = Math.min(...hours);
  
  return maxHours - minHours;
}

/**
 * Update workload distribution after assignment
 */
function updateWorkloadDistribution(
  workloadDist: WorkloadDistribution[],
  interpreterId: string,
  additionalHours: number
): void {
  const interpreter = workloadDist.find(w => w.interpreterId === interpreterId);
  if (interpreter) {
    interpreter.currentHours += additionalHours;
    interpreter.projectedHours += additionalHours;
    interpreter.assignmentCount += 1;
    
    // Recalculate fairness score (simple inverse of current hours)
    const maxHours = Math.max(...workloadDist.map(w => w.currentHours));
    interpreter.fairnessScore = maxHours > 0 ? (maxHours - interpreter.currentHours) / maxHours : 1.0;
  }
}

/**
 * Detect if emergency processing should be triggered
 */
export function detectEmergencyProcessing(entries: EnhancedPoolEntry[]): {
  shouldTrigger: boolean;
  reason: string;
  criticalCount: number;
  highPriorityCount: number;
} {
  let criticalCount = 0;
  let highPriorityCount = 0;
  
  for (const entry of entries) {
    const override = shouldApplyDeadlineOverride(entry);
    if (override.urgencyLevel === 'CRITICAL') {
      criticalCount++;
    } else if (override.urgencyLevel === 'HIGH') {
      highPriorityCount++;
    }
  }
  
  const totalUrgent = criticalCount + highPriorityCount;
  const shouldTrigger = criticalCount > 0 || totalUrgent >= 3;
  
  let reason = '';
  if (criticalCount > 0) {
    reason = `${criticalCount} critical deadline entries require immediate processing`;
  } else if (totalUrgent >= 3) {
    reason = `${totalUrgent} high-priority entries trigger emergency batch processing`;
  } else {
    reason = 'No emergency processing needed';
  }
  
  return {
    shouldTrigger,
    reason,
    criticalCount,
    highPriorityCount
  };
}

/**
 * Process pool entries with enhanced batch processing and return detailed results
 */
export async function processPoolEntriesWithBatchResults(mode?: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM'): Promise<{
  entries: EnhancedPoolEntry[];
  batchResults?: BatchAssignmentResult[];
  processingMode: string;
  summary: {
    totalProcessed: number;
    totalAssigned: number;
    totalEscalated: number;
    emergencyOverrides: number;
    fairnessImprovement?: number;
  };
}> {
  const policy = await loadPolicy();
  const processingMode = mode || policy.mode;
  
  const entries = await processPoolEntries(processingMode);
  const batchResults: BatchAssignmentResult[] = [];
  let totalAssigned = 0;
  let totalEscalated = 0;
  let emergencyOverrides = 0;
  let fairnessImprovement = 0;
  
  // If Balance mode and entries exist, get batch processing results
  if (processingMode === 'BALANCE' && entries.length > 0) {
    const balanceEntries = entries.filter(e => e.mode === 'BALANCE');
    
    if (balanceEntries.length > 0) {
      const emergencyCheck = detectEmergencyProcessing(balanceEntries);
      
      const batchResult = await processBatchForBalanceMode(balanceEntries, {
        maxBatchSize: emergencyCheck.shouldTrigger ? 15 : 10,
        fairnessOptimization: true,
        workloadDistribution: true,
        emergencyProcessing: emergencyCheck.shouldTrigger
      });
      
      batchResults.push(batchResult);
      totalAssigned += batchResult.assignments.filter(a => a.status === 'assigned').length;
      totalEscalated += batchResult.assignments.filter(a => a.status === 'escalated').length;
      emergencyOverrides += batchResult.emergencyOverrides;
      fairnessImprovement += batchResult.fairnessMetrics.fairnessImprovement;
    }
  }
  
  return {
    entries,
    batchResults: batchResults.length > 0 ? batchResults : undefined,
    processingMode,
    summary: {
      totalProcessed: entries.length,
      totalAssigned,
      totalEscalated,
      emergencyOverrides,
      fairnessImprovement: batchResults.length > 0 ? fairnessImprovement : undefined
    }
  };
}
