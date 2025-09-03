import { processPool } from "./run";
import { bookingPool, getPoolStatus } from "./pool";
import { getAssignmentLogger } from "./logging";
import { loadPolicy } from "./policy";
import { getPoolProcessingEngine, type ProcessingResult } from "./pool-engine";

/**
 * Pool processing scheduler that runs at regular intervals
 */
export class PoolProcessingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private processingIntervalMs: number;
  private lastProcessingTime: Date | null = null;
  private nextProcessingTime: Date | null = null;
  private processingErrors: Array<{ timestamp: Date; error: string }> = [];
  private maxRetries: number = 3;
  private retryDelayMs: number = 5000; // 5 seconds

  constructor(intervalMs: number = 30 * 60 * 1000) { // Default: 30 minutes
    this.processingIntervalMs = intervalMs;
  }

  /**
   * Start the scheduled pool processing
   */
  start(): void {
    if (this.isRunning) {
      console.log("⚠️ Pool processing scheduler is already running");
      return;
    }

    console.log(`🚀 Starting pool processing scheduler (interval: ${this.processingIntervalMs / 1000}s)`);
    
    this.isRunning = true;
    this.scheduleNextProcessing();
    
    // Also run an initial processing immediately
    this.processPoolWithRetry();
  }

  /**
   * Stop the scheduled pool processing
   */
  stop(): void {
    if (!this.isRunning) {
      console.log("⚠️ Pool processing scheduler is not running");
      return;
    }

    console.log("🛑 Stopping pool processing scheduler");
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.nextProcessingTime = null;
  }

  /**
   * Schedule the next processing run
   */
  private scheduleNextProcessing(): void {
    if (!this.isRunning) return;

    this.nextProcessingTime = new Date(Date.now() + this.processingIntervalMs);
    
    this.intervalId = setTimeout(() => {
      this.processPoolWithRetry();
      this.scheduleNextProcessing(); // Schedule the next run
    }, this.processingIntervalMs);
  }

  /**
   * Process pool with retry logic and error handling
   */
  private async processPoolWithRetry(retryCount: number = 0): Promise<void> {
    try {
      console.log(`🔄 Pool processing scheduler: Starting processing run ${retryCount > 0 ? `(retry ${retryCount})` : ''}`);
      
      const startTime = Date.now();
      const engine = getPoolProcessingEngine();
      
      // Process different types of entries with priority
      const deadlineResults = await engine.processDeadlineEntries();
      const readyResults = await engine.processReadyEntries();
      
      const allResults = [...deadlineResults, ...readyResults];
      const processingTime = Date.now() - startTime;
      
      this.lastProcessingTime = new Date();
      
      // Log successful processing
      const assignedCount = allResults.filter(r => r.status === 'assigned').length;
      const escalatedCount = allResults.filter(r => r.status === 'escalated').length;
      const failedCount = allResults.filter(r => r.status === 'failed').length;
      
      console.log(`✅ Pool processing completed: ${assignedCount} assigned, ${escalatedCount} escalated, ${failedCount} failed (${processingTime}ms)`);
      
      if (deadlineResults.length > 0) {
        console.log(`🚨 Processed ${deadlineResults.length} deadline entries`);
      }
      if (readyResults.length > 0) {
        console.log(`⏰ Processed ${readyResults.length} threshold entries`);
      }
      
      // Clear any previous errors on successful processing
      if (this.processingErrors.length > 0) {
        console.log(`🧹 Clearing ${this.processingErrors.length} previous processing errors after successful run`);
        this.processingErrors = [];
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Pool processing failed (attempt ${retryCount + 1}/${this.maxRetries}):`, errorMessage);
      
      // Record the error
      this.processingErrors.push({
        timestamp: new Date(),
        error: errorMessage
      });
      
      // Keep only the last 10 errors
      if (this.processingErrors.length > 10) {
        this.processingErrors = this.processingErrors.slice(-10);
      }
      
      // Retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries - 1) {
        console.log(`🔄 Retrying pool processing in ${this.retryDelayMs / 1000}s...`);
        
        setTimeout(() => {
          this.processPoolWithRetry(retryCount + 1);
        }, this.retryDelayMs);
      } else {
        console.error(`❌ Pool processing failed after ${this.maxRetries} attempts, will retry on next scheduled run`);
        
        // Log the failure for monitoring
        const logger = getAssignmentLogger();
        await logger.logPoolProcessing({
          batchId: `failed_${Date.now()}`,
          processingType: 'SCHEDULER_FAILURE',
          mode: 'SCHEDULER_FAILURE',
          processingStartTime: new Date(),
          processingEndTime: new Date(),
          totalEntries: 0,
          processedEntries: 0,
          assignedEntries: 0,
          escalatedEntries: 0,
          failedEntries: 1,
          averageProcessingTimeMs: 0,
          systemLoad: 'HIGH',
          errors: [{
            bookingId: 0,
            error: `Scheduler processing failed after ${this.maxRetries} retries: ${errorMessage}`,
            timestamp: new Date()
          }],
          performance: {
            conflictDetectionTimeMs: 0,
            scoringTimeMs: 0,
            dbOperationTimeMs: 0,
            totalTimeMs: 0
          }
        });
      }
    }
  }

  /**
   * Force immediate pool processing (manual trigger)
   */
  async processNow(): Promise<void> {
    console.log("⚡ Manual pool processing triggered");
    await this.processPoolWithRetry();
  }

  /**
   * Get current scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    processingIntervalMs: number;
    lastProcessingTime: Date | null;
    nextProcessingTime: Date | null;
    recentErrors: Array<{ timestamp: Date; error: string }>;
    poolStatus: ReturnType<typeof getPoolStatus>;
  } {
    return {
      isRunning: this.isRunning,
      processingIntervalMs: this.processingIntervalMs,
      lastProcessingTime: this.lastProcessingTime,
      nextProcessingTime: this.nextProcessingTime,
      recentErrors: [...this.processingErrors],
      poolStatus: getPoolStatus()
    };
  }

  /**
   * Update processing interval (requires restart to take effect)
   */
  setProcessingInterval(intervalMs: number): void {
    this.processingIntervalMs = intervalMs;
    console.log(`📝 Pool processing interval updated to ${intervalMs / 1000}s (restart required)`);
  }

  /**
   * Check if pool processing is needed based on current pool status
   */
  isProcessingNeeded(): boolean {
    const poolStatus = getPoolStatus();
    return poolStatus.ready > 0 || poolStatus.deadline > 0;
  }
}

/**
 * Global scheduler instance
 */
let globalScheduler: PoolProcessingScheduler | null = null;

/**
 * Start the global pool processing scheduler
 */
export function startPoolScheduler(intervalMs?: number): PoolProcessingScheduler {
  if (globalScheduler && globalScheduler.getStatus().isRunning) {
    console.log("⚠️ Global pool scheduler is already running");
    return globalScheduler;
  }

  globalScheduler = new PoolProcessingScheduler(intervalMs);
  globalScheduler.start();
  
  console.log("🚀 Global pool processing scheduler started");
  return globalScheduler;
}

/**
 * Stop the global pool processing scheduler
 */
export function stopPoolScheduler(): void {
  if (!globalScheduler) {
    console.log("⚠️ No global pool scheduler to stop");
    return;
  }

  globalScheduler.stop();
  console.log("🛑 Global pool processing scheduler stopped");
}

/**
 * Get the global scheduler instance
 */
export function getPoolScheduler(): PoolProcessingScheduler | null {
  return globalScheduler;
}

/**
 * Force immediate pool processing via global scheduler
 */
export async function processPoolNow(): Promise<void> {
  if (!globalScheduler) {
    console.log("⚠️ No global scheduler available, creating temporary scheduler for immediate processing");
    const tempScheduler = new PoolProcessingScheduler();
    await tempScheduler.processNow();
    return;
  }

  await globalScheduler.processNow();
}

/**
 * Initialize pool scheduler based on policy configuration
 */
export async function initializePoolScheduler(): Promise<void> {
  try {
    const policy = await loadPolicy();
    
    // Calculate processing interval based on mode
    let intervalMs: number;
    
    switch (policy.mode) {
      case 'URGENT':
        intervalMs = 5 * 60 * 1000; // 5 minutes for urgent mode
        break;
      case 'BALANCE':
        intervalMs = 15 * 60 * 1000; // 15 minutes for balance mode
        break;
      case 'NORMAL':
      case 'CUSTOM':
      default:
        intervalMs = 30 * 60 * 1000; // 30 minutes for normal/custom mode
        break;
    }

    console.log(`🔧 Initializing pool scheduler for ${policy.mode} mode (${intervalMs / 1000}s interval)`);
    
    startPoolScheduler(intervalMs);
    
  } catch (error) {
    console.error("❌ Failed to initialize pool scheduler:", error);
    
    // Fallback to default scheduler
    console.log("🔄 Starting fallback scheduler with default settings");
    startPoolScheduler();
  }
}