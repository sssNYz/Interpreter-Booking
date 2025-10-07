import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import { getDatabaseConnectionManager, type SafeDatabaseOperations } from "./database-connection-manager";
import { getResilientLogger, type LoggingContext } from "../logging/resilient-logger";

/**
 * Comprehensive error logging with context and correlation IDs
 */
export interface ErrorContext extends LoggingContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SystemState {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  nodeVersion: string;
  platform: string;
  loadAverage?: number[];
  databaseHealth: {
    isConnected: boolean;
    connectionTime: number;
    consecutiveFailures: number;
  };
  activeConnections?: number;
  poolSize?: number;
}

export interface ErrorLogEntry {
  id?: string;
  correlationId: string;
  operation: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  context: ErrorContext;
  systemState: SystemState;
  relatedErrors?: string[];
  resolutionAttempts?: ResolutionAttempt[];
  createdAt: Date;
}

export interface ResolutionAttempt {
  timestamp: Date;
  action: string;
  success: boolean;
  details?: string;
}

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ErrorCategory = 
  | 'DATABASE'
  | 'NETWORK'
  | 'VALIDATION'
  | 'BUSINESS_LOGIC'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'CONFIGURATION'
  | 'SYSTEM'
  | 'EXTERNAL_SERVICE'
  | 'UNKNOWN';

/**
 * Comprehensive error logger with advanced context tracking
 */
export class ComprehensiveErrorLogger {
  private static instance: ComprehensiveErrorLogger;
  private connectionManager = getDatabaseConnectionManager();
  private resilientLogger = getResilientLogger();
  private errorBuffer: ErrorLogEntry[] = [];
  private correlationMap = new Map<string, string[]>(); // Track related errors
  private maxBufferSize = 1000;
  private flushIntervalMs = 30300; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startPeriodicFlush();
    
    // Handle process termination gracefully
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  public static getInstance(): ComprehensiveErrorLogger {
    if (!ComprehensiveErrorLogger.instance) {
      ComprehensiveErrorLogger.instance = new ComprehensiveErrorLogger();
    }
    return ComprehensiveErrorLogger.instance;
  }

  /**
   * Log error with comprehensive context
   */
  async logError(
    error: Error,
    context: Partial<ErrorContext>,
    relatedCorrelationIds?: string[]
  ): Promise<string> {
    const correlationId = context.correlationId || this.generateCorrelationId();
    
    // Build comprehensive error context
    const errorContext: ErrorContext = {
      operation: context.operation || 'unknown',
      bookingId: context.bookingId,
      interpreterId: context.interpreterId,
      batchId: context.batchId,
      correlationId,
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      timestamp: new Date(),
      severity: context.severity || this.determineSeverity(error),
      category: context.category || this.categorizeError(error),
      tags: context.tags || [],
      metadata: context.metadata || {}
    };

    // Capture system state
    const systemState = await this.captureSystemState();

    // Create error log entry
    const errorLogEntry: ErrorLogEntry = {
      correlationId,
      operation: errorContext.operation,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context: errorContext,
      systemState,
      relatedErrors: relatedCorrelationIds,
      resolutionAttempts: [],
      createdAt: new Date()
    };

    // Track correlation relationships
    if (relatedCorrelationIds) {
      this.correlationMap.set(correlationId, relatedCorrelationIds);
    }

    // Add to buffer
    this.errorBuffer.push(errorLogEntry);

    // Immediate flush for critical errors
    if (errorContext.severity === 'CRITICAL') {
      await this.flushErrorToDatabase(errorLogEntry);
    }

    // Console logging with context
    this.logToConsole(errorLogEntry);

    // Manage buffer size
    if (this.errorBuffer.length > this.maxBufferSize) {
      await this.flushBuffer();
    }

    return correlationId;
  }

  /**
   * Log resolution attempt for an error
   */
  async logResolutionAttempt(
    correlationId: string,
    action: string,
    success: boolean,
    details?: string
  ): Promise<void> {
    const resolutionAttempt: ResolutionAttempt = {
      timestamp: new Date(),
      action,
      success,
      details
    };

    // Find error in buffer and add resolution attempt
    const errorEntry = this.errorBuffer.find(entry => entry.correlationId === correlationId);
    if (errorEntry) {
      if (!errorEntry.resolutionAttempts) {
        errorEntry.resolutionAttempts = [];
      }
      errorEntry.resolutionAttempts.push(resolutionAttempt);
    }

    // Also try to update in database
    try {
      await this.connectionManager.executeWithReconnection(
        async () => {
          const existingLog = await prisma.systemErrorLog.findFirst({
            where: { additionalData: { path: ['correlationId'], equals: correlationId } }
          });

          if (existingLog) {
            const additionalData = existingLog.additionalData as any || {};
            const resolutionAttempts = additionalData.resolutionAttempts || [];
            resolutionAttempts.push(resolutionAttempt);

            await prisma.systemErrorLog.update({
              where: { id: existingLog.id },
              data: {
                additionalData: {
                  ...additionalData,
                  resolutionAttempts
                } as Prisma.InputJsonValue
              }
            });
          }
        },
        {
          operation: 'log_resolution_attempt',
          correlationId
        }
      );

      console.log(`📝 Resolution attempt logged for ${correlationId}: ${action} (${success ? 'SUCCESS' : 'FAILED'})`);
      
    } catch (error) {
      console.error(`❌ Failed to log resolution attempt for ${correlationId}:`, error);
    }
  }

  /**
   * Get error chain by correlation ID
   */
  async getErrorChain(correlationId: string): Promise<ErrorLogEntry[]> {
    const chain: ErrorLogEntry[] = [];
    const visited = new Set<string>();
    
    await this.buildErrorChain(correlationId, chain, visited);
    
    return chain.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get error statistics for monitoring
   */
  async getErrorStatistics(timeWindow: number = 24 * 60 * 60 * 1000): Promise<ErrorStatistics> {
    const since = new Date(Date.now() - timeWindow);
    
    try {
      const stats = await this.connectionManager.executeWithReconnection(
        async () => {
          const totalErrors = await prisma.systemErrorLog.count({
            where: { createdAt: { gte: since } }
          });

          const errorsByCategory = await prisma.systemErrorLog.groupBy({
            by: ['errorName'],
            where: { createdAt: { gte: since } },
            _count: { id: true }
          });

          const criticalErrors = await prisma.systemErrorLog.count({
            where: {
              createdAt: { gte: since },
              additionalData: { path: ['context', 'severity'], equals: 'CRITICAL' }
            }
          });

          return {
            totalErrors,
            criticalErrors,
            errorsByCategory: errorsByCategory.map(item => ({
              category: item.errorName,
              count: item._count.id
            })),
            timeWindow: `${timeWindow / (60 * 60 * 1000)}h`,
            timestamp: new Date()
          };
        },
        {
          operation: 'get_error_statistics',
          correlationId: `stats_${Date.now()}`
        }
      );

      return stats || {
        totalErrors: 0,
        criticalErrors: 0,
        errorsByCategory: [],
        timeWindow: `${timeWindow / (60 * 60 * 1000)}h`,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Failed to get error statistics:', error);
      return {
        totalErrors: 0,
        criticalErrors: 0,
        errorsByCategory: [],
        timeWindow: `${timeWindow / (60 * 60 * 1000)}h`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Flush error buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.errorBuffer.length === 0) return;

    const errorsToFlush = [...this.errorBuffer];
    this.errorBuffer = [];

    console.log(`📤 Flushing ${errorsToFlush.length} errors to database...`);

    let successCount = 0;
    const failedErrors: ErrorLogEntry[] = [];

    for (const errorEntry of errorsToFlush) {
      try {
        await this.flushErrorToDatabase(errorEntry);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to flush error ${errorEntry.correlationId}:`, error);
        failedErrors.push(errorEntry);
      }
    }

    // Re-add failed errors to buffer (with limit)
    if (failedErrors.length > 0 && this.errorBuffer.length < this.maxBufferSize / 2) {
      this.errorBuffer.unshift(...failedErrors);
      console.warn(`⚠️ ${failedErrors.length} errors failed to flush, re-queued for retry`);
    }

    console.log(`✅ Successfully flushed ${successCount}/${errorsToFlush.length} errors`);
  }

  /**
   * Flush single error to database
   */
  private async flushErrorToDatabase(errorEntry: ErrorLogEntry): Promise<void> {
    await this.connectionManager.executeWithReconnection(
      async () => {
        await prisma.systemErrorLog.create({
          data: {
            operation: errorEntry.operation,
            bookingId: errorEntry.context.bookingId,
            interpreterId: errorEntry.context.interpreterId,
            errorName: errorEntry.errorName,
            errorMessage: errorEntry.errorMessage,
            errorStack: errorEntry.errorStack,
            systemState: errorEntry.systemState as Prisma.InputJsonValue,
            additionalData: {
              correlationId: errorEntry.correlationId,
              context: errorEntry.context,
              relatedErrors: errorEntry.relatedErrors,
              resolutionAttempts: errorEntry.resolutionAttempts
            } as Prisma.InputJsonValue,
            createdAt: errorEntry.createdAt
          }
        });
      },
      {
        operation: 'flush_error_to_database',
        correlationId: errorEntry.correlationId
      }
    );
  }

  /**
   * Build error chain recursively
   */
  private async buildErrorChain(
    correlationId: string,
    chain: ErrorLogEntry[],
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(correlationId)) return;
    visited.add(correlationId);

    // Check buffer first
    const bufferEntry = this.errorBuffer.find(entry => entry.correlationId === correlationId);
    if (bufferEntry) {
      chain.push(bufferEntry);
      
      // Follow related errors
      if (bufferEntry.relatedErrors) {
        for (const relatedId of bufferEntry.relatedErrors) {
          await this.buildErrorChain(relatedId, chain, visited);
        }
      }
      return;
    }

    // Check database
    try {
      const dbEntry = await this.connectionManager.executeWithReconnection(
        async () => {
          return await prisma.systemErrorLog.findFirst({
            where: { additionalData: { path: ['correlationId'], equals: correlationId } }
          });
        },
        {
          operation: 'get_error_chain',
          correlationId
        }
      );

      if (dbEntry) {
        const additionalData = dbEntry.additionalData as any || {};
        const errorEntry: ErrorLogEntry = {
          id: dbEntry.id.toString(),
          correlationId,
          operation: dbEntry.operation,
          errorName: dbEntry.errorName,
          errorMessage: dbEntry.errorMessage,
          errorStack: dbEntry.errorStack || undefined,
          context: additionalData.context || {},
          systemState: dbEntry.systemState as SystemState,
          relatedErrors: additionalData.relatedErrors,
          resolutionAttempts: additionalData.resolutionAttempts,
          createdAt: dbEntry.createdAt
        };

        chain.push(errorEntry);

        // Follow related errors
        if (errorEntry.relatedErrors) {
          for (const relatedId of errorEntry.relatedErrors) {
            await this.buildErrorChain(relatedId, chain, visited);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Failed to get error chain for ${correlationId}:`, error);
    }
  }

  /**
   * Capture current system state
   */
  private async captureSystemState(): Promise<SystemState> {
    const connectionHealth = this.connectionManager.getConnectionHealth();
    
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : undefined,
      databaseHealth: {
        isConnected: connectionHealth.isConnected,
        connectionTime: connectionHealth.connectionTime,
        consecutiveFailures: connectionHealth.consecutiveFailures
      }
    };
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal') || message.includes('corruption')) {
      return 'CRITICAL';
    } else if (message.includes('database') || message.includes('connection') || message.includes('timeout')) {
      return 'HIGH';
    } else if (message.includes('validation') || message.includes('conflict')) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Categorize error
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('database') || message.includes('sql') || message.includes('prisma')) {
      return 'DATABASE';
    } else if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'NETWORK';
    } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'VALIDATION';
    } else if (message.includes('auth') || message.includes('login') || message.includes('token')) {
      return 'AUTHENTICATION';
    } else if (message.includes('permission') || message.includes('access') || message.includes('forbidden')) {
      return 'AUTHORIZATION';
    } else if (message.includes('config') || message.includes('setting') || message.includes('environment')) {
      return 'CONFIGURATION';
    } else if (message.includes('system') || message.includes('memory') || message.includes('resource')) {
      return 'SYSTEM';
    } else if (message.includes('api') || message.includes('service') || message.includes('external')) {
      return 'EXTERNAL_SERVICE';
    } else {
      return 'UNKNOWN';
    }
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(errorEntry: ErrorLogEntry): void {
    const severity = errorEntry.context.severity;
    const icon = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '❌' : severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
    
    console.error(`${icon} [${severity}] ${errorEntry.context.category} Error in ${errorEntry.operation}`);
    console.error(`   Correlation ID: ${errorEntry.correlationId}`);
    console.error(`   Message: ${errorEntry.errorMessage}`);
    
    if (errorEntry.context.bookingId) {
      console.error(`   Booking ID: ${errorEntry.context.bookingId}`);
    }
    
    if (errorEntry.context.interpreterId) {
      console.error(`   Interpreter ID: ${errorEntry.context.interpreterId}`);
    }
    
    if (errorEntry.relatedErrors && errorEntry.relatedErrors.length > 0) {
      console.error(`   Related Errors: ${errorEntry.relatedErrors.join(', ')}`);
    }
    
    if (errorEntry.context.tags && errorEntry.context.tags.length > 0) {
      console.error(`   Tags: ${errorEntry.context.tags.join(', ')}`);
    }
  }

  /**
   * Start periodic buffer flushing
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      await this.flushBuffer();
    }, this.flushIntervalMs);
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    console.log('🔄 Comprehensive error logger shutting down...');
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining errors
    await this.flushBuffer();
    
    console.log('✅ Comprehensive error logger shutdown complete');
  }
}

// Type definitions
export interface ErrorStatistics {
  totalErrors: number;
  criticalErrors: number;
  errorsByCategory: Array<{
    category: string;
    count: number;
  }>;
  timeWindow: string;
  timestamp: Date;
}

/**
 * Convenience function to get comprehensive error logger
 */
export function getComprehensiveErrorLogger(): ComprehensiveErrorLogger {
  return ComprehensiveErrorLogger.getInstance();
}

/**
 * Utility function to log error with context
 */
export async function logErrorWithContext(
  error: Error,
  operation: string,
  context: Partial<ErrorContext> = {},
  relatedCorrelationIds?: string[]
): Promise<string> {
  const logger = getComprehensiveErrorLogger();
  return await logger.logError(error, { ...context, operation }, relatedCorrelationIds);
}

/**
 * Utility function to log resolution attempt
 */
export async function logResolutionAttempt(
  correlationId: string,
  action: string,
  success: boolean,
  details?: string
): Promise<void> {
  const logger = getComprehensiveErrorLogger();
  await logger.logResolutionAttempt(correlationId, action, success, details);
}