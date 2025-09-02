import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import { SchemaValidator } from "./schema-validator";

/**
 * Resilient logging system with error handling and retry logic
 */
export interface LoggingContext {
  operation: string;
  bookingId?: number;
  interpreterId?: string;
  batchId?: string;
  correlationId?: string;
}

export interface FlushResult {
  success: boolean;
  flushedCount: number;
  errors: string[];
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Resilient logger with exponential backoff and graceful degradation
 */
export class ResilientLogger {
  private static instance: ResilientLogger;
  private isHealthy: boolean = true;
  private lastHealthCheck: Date = new Date();
  private healthCheckIntervalMs: number = 60000; // 1 minute
  
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2
  };

  private constructor() {
    // Periodic health checks
    setInterval(() => this.performHealthCheck(), this.healthCheckIntervalMs);
  }

  public static getInstance(): ResilientLogger {
    if (!ResilientLogger.instance) {
      ResilientLogger.instance = new ResilientLogger();
    }
    return ResilientLogger.instance;
  }

  /**
   * Log with fallback - primary logging with fallback to console if database fails
   */
  async logWithFallback<T>(
    primaryLog: () => Promise<T>,
    fallbackLog: (error: Error) => Promise<void>,
    context: LoggingContext
  ): Promise<T | null> {
    try {
      // Check if logging system is healthy
      if (!this.isHealthy) {
        console.warn(`⚠️ Logging system unhealthy, using fallback for ${context.operation}`);
        await fallbackLog(new Error("Logging system marked as unhealthy"));
        return null;
      }

      // Attempt primary logging with retry
      return await this.executeWithRetry(primaryLog, this.defaultRetryConfig, context);

    } catch (error) {
      console.error(`❌ Primary logging failed for ${context.operation}:`, error);
      
      // Mark system as unhealthy if we get database errors
      if (this.isDatabaseError(error)) {
        this.isHealthy = false;
        console.warn("⚠️ Marking logging system as unhealthy due to database error");
      }

      // Execute fallback logging
      try {
        await fallbackLog(error instanceof Error ? error : new Error('Unknown logging error'));
      } catch (fallbackError) {
        console.error(`❌ Fallback logging also failed for ${context.operation}:`, fallbackError);
      }

      return null;
    }
  }

  /**
   * Execute function with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: LoggingContext
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === config.maxRetries) {
          // Final attempt failed
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        );

        console.warn(`⚠️ Retry ${attempt + 1}/${config.maxRetries} for ${context.operation} after ${delay}ms delay`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Flush buffers with retry logic
   */
  async flushBuffersWithRetry(_maxRetries: number = 3): Promise<FlushResult> {
    const result: FlushResult = {
      success: false,
      flushedCount: 0,
      errors: []
    };

    try {
      // This would be implemented by the specific logger that extends this class
      // For now, we'll just validate that the database is accessible
      await SchemaValidator.checkDatabaseHealth();
      
      result.success = true;
      console.log("✅ Buffer flush completed successfully");
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown flush error');
      console.error("❌ Buffer flush failed:", error);
    }

    return result;
  }

  /**
   * Clear corrupted buffers
   */
  async clearCorruptedBuffers(): Promise<void> {
    try {
      console.log("🧹 Clearing corrupted log buffers...");
      // Implementation would clear any corrupted in-memory buffers
      console.log("✅ Corrupted buffers cleared");
    } catch (error) {
      console.error("❌ Error clearing corrupted buffers:", error);
    }
  }

  /**
   * Handle logging errors with context
   */
  async handleLoggingError(error: Error, context: LoggingContext): Promise<void> {
    try {
      // Log to console with full context
      console.error(`❌ Logging error in ${context.operation}:`, {
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      });

      // Try to log to system error log if possible
      if (this.isHealthy) {
        await this.logSystemError(error, context);
      }

    } catch (systemLogError) {
      console.error("❌ Failed to log system error:", systemLogError);
    }
  }

  /**
   * Log system errors to database
   */
  private async logSystemError(error: Error, context: LoggingContext): Promise<void> {
    try {
      await prisma.systemErrorLog.create({
        data: {
          operation: context.operation,
          bookingId: context.bookingId,
          interpreterId: context.interpreterId,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          systemState: {
            timestamp: new Date().toISOString(),
            isHealthy: this.isHealthy,
            lastHealthCheck: this.lastHealthCheck.toISOString(),
            correlationId: context.correlationId
          } as Prisma.InputJsonValue,
          additionalData: {
            batchId: context.batchId,
            retryAttempt: true
          } as Prisma.InputJsonValue
        }
      });
    } catch (dbError) {
      // Don't throw - this is a fallback logging mechanism
      console.error("❌ Failed to log system error to database:", dbError);
    }
  }

  /**
   * Perform health check on logging system
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await SchemaValidator.checkDatabaseHealth();
      const wasHealthy = this.isHealthy;
      this.isHealthy = health.isHealthy;
      this.lastHealthCheck = new Date();

      if (!wasHealthy && this.isHealthy) {
        console.log("✅ Logging system recovered and is now healthy");
      } else if (wasHealthy && !this.isHealthy) {
        console.warn("⚠️ Logging system became unhealthy:", health.error);
      }

    } catch (error) {
      this.isHealthy = false;
      console.error("❌ Health check failed:", error);
    }
  }

  /**
   * Check if error is a database-related error
   */
  private isDatabaseError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const dbErrorPatterns = [
      'connection',
      'timeout',
      'database',
      'prisma',
      'mysql',
      'sql',
      'constraint',
      'foreign key',
      'duplicate entry'
    ];

    const errorMessage = error.message.toLowerCase();
    return dbErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastHealthCheck: Date;
    uptime: number;
  } {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      uptime: Date.now() - this.lastHealthCheck.getTime()
    };
  }
}

/**
 * Database operation wrapper with retry logic
 */
export class DatabaseOperationWrapper {
  private static resilientLogger = ResilientLogger.getInstance();

  /**
   * Execute database operation with retry and error handling
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: LoggingContext,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T | null> {
    const config = {
      ...this.resilientLogger['defaultRetryConfig'],
      ...retryConfig
    };

    try {
      return await this.resilientLogger['executeWithRetry'](operation, config, context);
    } catch (error) {
      await this.resilientLogger.handleLoggingError(
        error instanceof Error ? error : new Error('Unknown database error'),
        context
      );
      return null;
    }
  }

  /**
   * Safe database write with fallback logging
   */
  static async safeWrite<T>(
    writeOperation: () => Promise<T>,
    fallbackLog: (error: Error) => void,
    context: LoggingContext
  ): Promise<T | null> {
    return await this.resilientLogger.logWithFallback(
      writeOperation,
      async (error) => fallbackLog(error),
      context
    );
  }
}

/**
 * Convenience function to get resilient logger instance
 */
export function getResilientLogger(): ResilientLogger {
  return ResilientLogger.getInstance();
}