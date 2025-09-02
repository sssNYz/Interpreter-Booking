import { processPool } from "./run";
import { bookingPool, getPoolStatus, type EnhancedPoolEntry } from "./pool";
import { getAssignmentLogger, type PoolProcessingLogData } from "./logging";
import { loadPolicy } from "./policy";
import { getPoolProcessingEngine, type ProcessingResult } from "./pool-engine";

/**
 * Daily pool processing service that runs on server startup
 * Handles automatic scheduling and processing of pool entries at configured intervals
 */
export class DailyPoolProcessor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private processingIntervalMs: number;
  private lastProcessingTime: Date | null = null;
  private nextProcessingTime: Date | null = null;
  private processingErrors: Array<{ timestamp: Date; error: string }> = [];
  private maxRetries: number = 3;
  private retryDelayMs: number = 5000; // 5 seconds
  private logger = getAssignmentLogger();

  constructor(intervalMs: number = 24 * 60 * 60 * 1000) { // Default: 24 hours (daily)
    this.processingIntervalMs = intervalMs;
  }

  /**
   * Start the daily pool processing service
   */
  start(): void {
    if (this.isRunning) {
      console.log("⚠️ Daily pool processor is already running");
      return;
    }

    console.log(`🚀 Starting daily pool processing service (interval: ${this.processingIntervalMs / (60 * 60 * 1000)}h)`);
    
    this.isRunning = true;
    this.scheduleNextProcessing();
    
    // Run initial processing immediately on startup
    console.log("⚡ Running initial pool processing on startup...");
    this.runDailyPoolCheck();
  }

  /**
   * Stop the daily pool processing service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log("⚠️ Daily pool processor is not running");
      return;
    }

    console.log("🛑 Stopping daily pool processing service");
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.nextProcessingTime = null;
  }

  /**
   * Schedule the next daily processing run
   */
  private scheduleNextProcessing(): void {
    if (!this.isRunning) return;

    this.nextProcessingTime = new Date(Date.now() + this.processingIntervalMs);
    
    console.log(`📅 Next daily pool processing scheduled for: ${this.nextProcessingTime.toISOString()}`);
    
    this.intervalId = setTimeout(() => {
      this.runDailyPoolCheck();
      this.scheduleNextProcessing(); // Schedule the next run
    }, this.processingIntervalMs);
  }

  /**
   * Run daily pool check and processing
   */
  async runDailyPoolCheck(): Promise<DailyProcessingResult> {
    const startTime = new Date();
    const batchId = `daily_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📊 Starting daily pool check (batch: ${batchId})`);

    try {
      // Get current pool status
      const poolStats = await bookingPool.getPoolStats();
      console.log(`📈 Pool status: ${poolStats.totalInPool} total, ${poolStats.readyForProcessing} ready, ${poolStats.failedEntries} failed`);

      if (poolStats.totalInPool === 0) {
        console.log("📭 No entries in pool, skipping daily processing");
        return this.createEmptyResult(batchId, startTime);
      }

      // Process different types of entries with priority
      const engine = getPoolProcessingEngine();
      
      // 1. First process deadline entries (critical)
      console.log("🚨 Processing deadline entries...");
      const deadlineResults = await engine.processDeadlineEntries();
      
      // 2. Then process ready entries (threshold reached)
      console.log("⏰ Processing threshold entries...");
      const readyResults = await engine.processReadyEntries();
      
      // 3. Retry failed entries
      console.log("🔄 Retrying failed entries...");
      await bookingPool.retryFailedEntries();
      const retryResults = await engine.processReadyEntries(); // Process newly retried entries
      
      // Combine all results
      const allResults = [...deadlineResults, ...readyResults, ...retryResults];
      
      const result = this.processResults(allResults, batchId, startTime);
      
      this.lastProcessingTime = new Date();
      
      // Log successful processing
      console.log(`✅ Daily pool processing completed: ${result.assignedCount} assigned, ${result.escalatedCount} escalated, ${result.failedCount} failed (${result.processingTime}ms)`);
      
      // Clear processing errors on successful run
      if (this.processingErrors.length > 0) {
        console.log(`🧹 Clearing ${this.processingErrors.length} previous processing errors after successful run`);
        this.processingErrors = [];
      }

      // Log the daily processing results
      await this.logDailyProcessing(result, allResults);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Daily pool processing failed:`, errorMessage);
      
      // Record the error
      this.processingErrors.push({
        timestamp: new Date(),
        error: errorMessage
      });
      
      // Keep only the last 10 errors
      if (this.processingErrors.length > 10) {
        this.processingErrors = this.processingErrors.slice(-10);
      }

      const failedResult: DailyProcessingResult = {
        processedCount: 0,
        assignedCount: 0,
        escalatedCount: 0,
        failedCount: 1,
        processingTime: Date.now() - startTime.getTime(),
        nextScheduledRun: this.nextProcessingTime || new Date(),
        batchId,
        errors: [errorMessage],
        poolStatusBefore: await bookingPool.getPoolStats(),
        poolStatusAfter: await bookingPool.getPoolStats()
      };

      // Log the failure
      await this.logDailyProcessing(failedResult, []);

      return failedResult;
    }
  }

  /**
   * Process assignment results and create daily processing result
   */
  private processResults(
    results: ProcessingResult[], 
    batchId: string, 
    startTime: Date
  ): DailyProcessingResult {
    const assignedCount = results.filter(r => r.status === 'assigned').length;
    const escalatedCount = results.filter(r => r.status === 'escalated').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime.getTime();

    return {
      processedCount: results.length,
      assignedCount,
      escalatedCount,
      failedCount,
      processingTime,
      nextScheduledRun: this.nextProcessingTime || new Date(),
      batchId,
      errors: results
        .filter(r => r.status === 'failed')
        .map(r => `Booking ${r.bookingId}: ${r.reason}`),
      poolStatusBefore: null, // Will be set by caller
      poolStatusAfter: null // Will be set by caller
    };
  }

  /**
   * Create empty result when no processing is needed
   */
  private createEmptyResult(batchId: string, startTime: Date): DailyProcessingResult {
    return {
      processedCount: 0,
      assignedCount: 0,
      escalatedCount: 0,
      failedCount: 0,
      processingTime: Date.now() - startTime.getTime(),
      nextScheduledRun: this.nextProcessingTime || new Date(),
      batchId,
      errors: [],
      poolStatusBefore: null,
      poolStatusAfter: null
    };
  }

  /**
   * Log daily processing results
   */
  private async logDailyProcessing(
    result: DailyProcessingResult, 
    processingResults: ProcessingResult[]
  ): Promise<void> {
    const logData: PoolProcessingLogData = {
      batchId: result.batchId,
      mode: 'DAILY_PROCESSING',
      processingStartTime: new Date(Date.now() - result.processingTime),
      processingEndTime: new Date(),
      totalEntries: result.processedCount,
      processedEntries: result.processedCount,
      assignedEntries: result.assignedCount,
      escalatedEntries: result.escalatedCount,
      failedEntries: result.failedCount,
      averageProcessingTimeMs: result.processedCount > 0 ? result.processingTime / result.processedCount : 0,
      systemLoad: result.failedCount > result.processedCount * 0.3 ? 'HIGH' : 
                  result.escalatedCount > result.processedCount * 0.2 ? 'MEDIUM' : 'LOW',
      errors: result.errors.map((error, index) => ({
        bookingId: processingResults[index]?.bookingId || 0,
        error,
        timestamp: new Date()
      })),
      performance: {
        conflictDetectionTimeMs: 0, // Aggregated from individual processing
        scoringTimeMs: 0, // Aggregated from individual processing
        dbOperationTimeMs: 0, // Aggregated from individual processing
        totalTimeMs: result.processingTime
      }
    };

    await this.logger.logPoolProcessing(logData);
  }

  /**
   * Force immediate daily processing (manual trigger)
   */
  async processNow(): Promise<DailyProcessingResult> {
    console.log("⚡ Manual daily pool processing triggered");
    return await this.runDailyPoolCheck();
  }

  /**
   * Get current processor status
   */
  getStatus(): DailyProcessorStatus {
    return {
      isRunning: this.isRunning,
      processingIntervalMs: this.processingIntervalMs,
      lastProcessingTime: this.lastProcessingTime,
      nextProcessingTime: this.nextProcessingTime,
      recentErrors: [...this.processingErrors],
      poolStats: null // Will be populated by caller if needed
    };
  }

  /**
   * Update processing interval (requires restart to take effect)
   */
  setProcessingInterval(intervalMs: number): void {
    this.processingIntervalMs = intervalMs;
    console.log(`📝 Daily processing interval updated to ${intervalMs / (60 * 60 * 1000)}h (restart required)`);
  }

  /**
   * Check if daily processing is needed based on current pool status
   */
  async isProcessingNeeded(): Promise<boolean> {
    const poolStats = await bookingPool.getPoolStats();
    return poolStats.totalInPool > 0 && (poolStats.readyForProcessing > 0 || poolStats.failedEntries > 0);
  }

  /**
   * Get comprehensive processing statistics
   */
  async getProcessingStatistics(): Promise<ProcessingStatistics> {
    const poolStats = await bookingPool.getPoolStats();
    const readyEntries = await bookingPool.getReadyForAssignment();
    const deadlineEntries = await bookingPool.getDeadlineEntries();
    const failedEntries = await bookingPool.getFailedEntries();

    return {
      poolSize: poolStats.totalInPool,
      readyForProcessing: poolStats.readyForProcessing,
      deadlineEntries: deadlineEntries.length,
      failedEntries: poolStats.failedEntries,
      oldestEntry: poolStats.oldestEntry,
      processingNeeded: poolStats.readyForProcessing > 0 || deadlineEntries.length > 0,
      lastProcessingTime: this.lastProcessingTime,
      nextProcessingTime: this.nextProcessingTime,
      recentErrorCount: this.processingErrors.length
    };
  }
}

/**
 * Daily processing result interface
 */
export interface DailyProcessingResult {
  processedCount: number;
  assignedCount: number;
  escalatedCount: number;
  failedCount: number;
  processingTime: number;
  nextScheduledRun: Date;
  batchId: string;
  errors: string[];
  poolStatusBefore: any;
  poolStatusAfter: any;
}

/**
 * Daily processor status interface
 */
export interface DailyProcessorStatus {
  isRunning: boolean;
  processingIntervalMs: number;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  recentErrors: Array<{ timestamp: Date; error: string }>;
  poolStats: any;
}

/**
 * Processing statistics interface
 */
export interface ProcessingStatistics {
  poolSize: number;
  readyForProcessing: number;
  deadlineEntries: number;
  failedEntries: number;
  oldestEntry: Date | null;
  processingNeeded: boolean;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  recentErrorCount: number;
}

/**
 * Global daily processor instance
 */
let globalDailyProcessor: DailyPoolProcessor | null = null;

/**
 * Initialize daily pool processing service
 */
export async function initializeDailyPoolProcessor(): Promise<void> {
  try {
    const policy = await loadPolicy();
    
    // Calculate processing interval based on mode and configuration
    let intervalMs: number;
    
    switch (policy.mode) {
      case 'URGENT':
        intervalMs = 4 * 60 * 60 * 1000; // 4 hours for urgent mode
        break;
      case 'BALANCE':
        intervalMs = 12 * 60 * 60 * 1000; // 12 hours for balance mode
        break;
      case 'NORMAL':
      case 'CUSTOM':
      default:
        intervalMs = 24 * 60 * 60 * 1000; // 24 hours for normal/custom mode
        break;
    }

    console.log(`🔧 Initializing daily pool processor for ${policy.mode} mode (${intervalMs / (60 * 60 * 1000)}h interval)`);
    
    globalDailyProcessor = new DailyPoolProcessor(intervalMs);
    globalDailyProcessor.start();
    
    console.log("✅ Daily pool processor initialized and started");
    
  } catch (error) {
    console.error("❌ Failed to initialize daily pool processor:", error);
    
    // Fallback to default processor
    console.log("🔄 Starting fallback daily processor with default settings");
    globalDailyProcessor = new DailyPoolProcessor();
    globalDailyProcessor.start();
  }
}

/**
 * Stop daily pool processing service
 */
export function stopDailyPoolProcessor(): void {
  if (!globalDailyProcessor) {
    console.log("⚠️ No daily pool processor to stop");
    return;
  }

  globalDailyProcessor.stop();
  globalDailyProcessor = null;
  console.log("🛑 Daily pool processor stopped");
}

/**
 * Get the global daily processor instance
 */
export function getDailyPoolProcessor(): DailyPoolProcessor | null {
  return globalDailyProcessor;
}

/**
 * Force immediate daily processing
 */
export async function processDailyPoolNow(): Promise<DailyProcessingResult> {
  if (!globalDailyProcessor) {
    console.log("⚠️ No daily processor available, creating temporary processor for immediate processing");
    const tempProcessor = new DailyPoolProcessor();
    return await tempProcessor.processNow();
  }

  return await globalDailyProcessor.processNow();
}

/**
 * Get daily processing statistics
 */
export async function getDailyProcessingStatistics(): Promise<ProcessingStatistics | null> {
  if (!globalDailyProcessor) {
    return null;
  }

  return await globalDailyProcessor.getProcessingStatistics();
}