import prisma from "@/prisma/prisma";
import type { BookingPoolEntry } from "@/types/assignment";
import { getMeetingTypePriority } from "./policy";

/**
 * Simple in-memory pool for storing non-urgent bookings
 * In production, this should be replaced with Redis or a dedicated database table
 */
class BookingPool {
  private pool: Map<number, BookingPoolEntry> = new Map();

  /**
   * Add a booking to the pool
   */
  async addToPool(
    bookingId: number,
    meetingType: string,
    startTime: Date,
    endTime: Date
  ): Promise<BookingPoolEntry> {
    const priority = await getMeetingTypePriority(meetingType);
    if (!priority) {
      throw new Error(`No priority configuration found for meeting type: ${meetingType}`);
    }

    const poolEntry: BookingPoolEntry = {
      bookingId,
      meetingType,
      startTime,
      endTime,
      priorityValue: priority.priorityValue,
      urgentThresholdDays: priority.urgentThresholdDays,
      generalThresholdDays: priority.generalThresholdDays,
      poolEntryTime: new Date(),
      decisionWindowTime: new Date(Date.now() + priority.generalThresholdDays * 24 * 60 * 60 * 1000)
    };

    this.pool.set(bookingId, poolEntry);
    console.log(`📥 Added booking ${bookingId} to pool (${meetingType}, decision window: ${poolEntry.decisionWindowTime.toISOString()})`);
    
    return poolEntry;
  }

  /**
   * Remove a booking from the pool
   */
  removeFromPool(bookingId: number): boolean {
    const removed = this.pool.delete(bookingId);
    if (removed) {
      console.log(`📤 Removed booking ${bookingId} from pool`);
    }
    return removed;
  }

  /**
   * Get all bookings in the pool
   */
  getAllPoolEntries(): BookingPoolEntry[] {
    return Array.from(this.pool.values());
  }

  /**
   * Get bookings that have reached their decision window
   */
  getReadyForAssignment(): BookingPoolEntry[] {
    const now = new Date();
    return Array.from(this.pool.values()).filter(entry => 
      entry.decisionWindowTime <= now
    );
  }

  /**
   * Get a specific booking from the pool
   */
  getPoolEntry(bookingId: number): BookingPoolEntry | undefined {
    return this.pool.get(bookingId);
  }

  /**
   * Check if a booking is in the pool
   */
  isInPool(bookingId: number): boolean {
    return this.pool.has(bookingId);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): { total: number; ready: number; pending: number } {
    const total = this.pool.size;
    const ready = this.getReadyForAssignment().length;
    const pending = total - ready;
    
    return { total, ready, pending };
  }

  /**
   * Clear the entire pool (for testing)
   */
  clearPool(): void {
    this.pool.clear();
    console.log("🧹 Pool cleared");
  }
}

// Export singleton instance
export const bookingPool = new BookingPool();

/**
 * Check if a booking should be assigned immediately or sent to pool
 */
export async function shouldAssignImmediately(
  startTime: Date,
  meetingType: string
): Promise<boolean> {
  const priority = await getMeetingTypePriority(meetingType);
  if (!priority) return false;
  
  const daysUntil = Math.floor((startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return daysUntil <= priority.urgentThresholdDays;
}

/**
 * Process pool entries that are ready for assignment
 */
export async function processPoolEntries(): Promise<BookingPoolEntry[]> {
  const readyEntries = bookingPool.getReadyForAssignment();
  
  if (readyEntries.length > 0) {
    console.log(`🔄 Processing ${readyEntries.length} pool entries ready for assignment`);
    
    // Sort by priority (highest first) and then by decision window time
    readyEntries.sort((a, b) => {
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      return a.decisionWindowTime.getTime() - b.decisionWindowTime.getTime();
    });
  }
  
  return readyEntries;
}

/**
 * Get pool status for monitoring
 */
export function getPoolStatus(): { total: number; ready: number; pending: number; entries: BookingPoolEntry[] } {
  const stats = bookingPool.getPoolStats();
  const entries = bookingPool.getAllPoolEntries();
  
  return {
    ...stats,
    entries
  };
}
