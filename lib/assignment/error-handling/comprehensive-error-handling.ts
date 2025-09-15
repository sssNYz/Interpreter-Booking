import { getDatabaseConnectionManager, type TransactionOptions, type TransactionResult } from "./database-connection-manager";
import { getComprehensiveErrorLogger, logErrorWithContext, logResolutionAttempt, type ErrorContext } from "./comprehensive-error-logger";
import { performStartupValidation, validateSystemHealth, type StartupValidationResult } from "../validation/startup-validator";
import { getGracefulDegradationManager, executeAssignmentWithGracefulDegradation, type OperationResult } from "./graceful-degradation";
import { getResilientLogger, type LoggingContext } from "../logging/resilient-logger";
import type { Prisma } from "@prisma/client";

/**
 * Comprehensive error handling and recovery system
 * Integrates all error handling components into a unified interface
 */
export class ComprehensiveErrorHandlingSystem {
  private static instance: ComprehensiveErrorHandlingSystem;
  private connectionManager = getDatabaseConnectionManager();
  private errorLogger = getComprehensiveErrorLogger();
  private degradationManager = getGracefulDegradationManager();
  private resilientLogger = getResilientLogger();
  
  private isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): ComprehensiveErrorHandlingSystem {
    if (!ComprehensiveErrorHandlingSystem.instance) {
      ComprehensiveErrorHandlingSystem.instance = new ComprehensiveErrorHandlingSystem();
    }
    return ComprehensiveErrorHandlingSystem.instance;
  }

  /**
   * Initialize the comprehensive error handling system
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return await this.initializationPromise;
  }

  /**
   * Perform system initialization with validation
   */
  private async performInitialization(): Promise<boolean> {
    console.log('🚀 Initializing comprehensive error handling system...');
    
    try {
      // Perform startup validation
      const validationResult = await performStartupValidation();
      
      if (!validationResult.success) {
        console.error('❌ Startup validation failed:', validationResult.criticalIssues);
        console.log('🔧 Repair recommendations:', validationResult.repairRecommendations.length);
        
        // Log critical issues
        for (const issue of validationResult.criticalIssues) {
          await logErrorWithContext(
            new Error(issue),
            'startup_validation',
            {
              severity: 'CRITICAL',
              category: 'SYSTEM',
              correlationId: `startup_${Date.now()}`
            }
          );
        }
        
        // Continue with degraded functionality
        console.warn('⚠️ Continuing with degraded functionality due to validation failures');
        this.degradationManager.forceDegradationLevel('REDUCED_LOGGING');
      }

      this.isInitialized = true;
      console.log(`✅ Comprehensive error handling system initialized (${validationResult.startupTime}ms)`);
      
      return validationResult.success;

    } catch (error) {
      console.error('❌ Failed to initialize comprehensive error handling system:', error);
      
      // Force emergency mode if initialization fails
      this.degradationManager.forceDegradationLevel('EMERGENCY');
      this.isInitialized = true; // Mark as initialized to prevent retry loops
      
      return false;
    }
  }

  /**
   * Execute database operation with comprehensive error handling
   */
  async executeDatabaseOperation<T>(
    operation: () => Promise<T>,
    context: LoggingContext,
    options: {
      retries?: number;
      fallbackValue?: T;
      criticalOperation?: boolean;
    } = {}
  ): Promise<OperationResult<T>> {
    await this.ensureInitialized();

    const result: OperationResult<T> = {
      success: false,
      degradationLevel: this.degradationManager.getDegradationLevel().level,
      fallbacksUsed: [],
      warnings: []
    };

    try {
      // Execute with connection resilience
      result.data = await this.connectionManager.executeWithReconnection(
        operation,
        context,
        options.retries || 3
      );
      
      result.success = true;
      return result;

    } catch (error) {
      const correlationId = await this.handleOperationError(error, context);
      result.error = error instanceof Error ? error.message : 'Unknown database error';

      // Attempt fallback if available
      if (options.fallbackValue !== undefined) {
        result.data = options.fallbackValue;
        result.success = true;
        result.fallbacksUsed.push('fallback_value');
        result.warnings.push('Using fallback value due to database operation failure');
        
        await logResolutionAttempt(correlationId, 'fallback_value_used', true, 'Fallback value provided successful result');
      }

      return result;
    }
  }

  /**
   * Execute database transaction with comprehensive error handling
   */
  async executeTransaction<T>(
    transactionFn: (tx: Prisma.TransactionClient) => Promise<T>,
    context: LoggingContext,
    options: Partial<TransactionOptions> = {}
  ): Promise<TransactionResult<T>> {
    await this.ensureInitialized();

    try {
      return await this.connectionManager.executeTransaction(transactionFn, context, options);
    } catch (error) {
      await this.handleOperationError(error, context);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transaction error',
        retryAttempts: 0,
        rollbackPerformed: true
      };
    }
  }

  /**
   * Execute assignment with comprehensive error handling and graceful degradation
   */
  async executeAssignment(
    bookingId: number,
    context: Partial<LoggingContext> = {}
  ): Promise<OperationResult<any>> {
    await this.ensureInitialized();

    const operationContext: LoggingContext = {
      operation: 'comprehensive_assignment',
      bookingId,
      correlationId: context.correlationId || `assign_${bookingId}_${Date.now()}`,
      ...context
    };

    try {
      return await executeAssignmentWithGracefulDegradation(bookingId, operationContext);
    } catch (error) {
      await this.handleOperationError(error, operationContext);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown assignment error',
        degradationLevel: this.degradationManager.getDegradationLevel().level,
        fallbacksUsed: [],
        warnings: ['Assignment failed with comprehensive error handling']
      };
    }
  }

  /**
   * Handle operation errors with comprehensive logging and recovery
   */
  private async handleOperationError(error: unknown, context: LoggingContext): Promise<string> {
    const errorObj = error instanceof Error ? error : new Error('Unknown operation error');
    
    // Log error with comprehensive context
    const correlationId = await logErrorWithContext(
      errorObj,
      context.operation,
      {
        ...context,
        severity: this.determineErrorSeverity(errorObj),
        category: this.categorizeError(errorObj),
        timestamp: new Date()
      }
    );

    // Attempt automatic recovery based on error type
    const recoveryAttempted = await this.attemptAutomaticRecovery(errorObj, context, correlationId);
    
    if (recoveryAttempted) {
      await logResolutionAttempt(
        correlationId,
        'automatic_recovery',
        false, // We're in the error handler, so recovery didn't prevent the error
        'Automatic recovery attempted but operation still failed'
      );
    }

    return correlationId;
  }

  /**
   * Attempt automatic recovery based on error type
   */
  private async attemptAutomaticRecovery(
    error: Error,
    context: LoggingContext,
    correlationId: string
  ): Promise<boolean> {
    const errorMessage = error.message.toLowerCase();
    
    try {
      // Database connection errors
      if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
        console.log(`🔄 Attempting database reconnection for ${correlationId}...`);
        await this.connectionManager.checkConnection();
        return true;
      }

      // Memory pressure errors
      if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
        console.log(`🔄 Attempting memory cleanup for ${correlationId}...`);
        if (global.gc) {
          global.gc();
        }
        return true;
      }

      // Logging system errors
      if (errorMessage.includes('log') || errorMessage.includes('buffer')) {
        console.log(`🔄 Attempting logging system recovery for ${correlationId}...`);
        await this.resilientLogger.clearCorruptedBuffers();
        return true;
      }

      return false;

    } catch (recoveryError) {
      console.error(`❌ Automatic recovery failed for ${correlationId}:`, recoveryError);
      return false;
    }
  }

  /**
   * Determine error severity
   */
  private determineErrorSeverity(error: Error): ErrorContext['severity'] {
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
  private categorizeError(error: Error): ErrorContext['category'] {
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
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    await this.ensureInitialized();

    const connectionHealth = this.connectionManager.getConnectionHealth();
    const systemHealth = this.degradationManager.getSystemHealth();
    const degradationLevel = this.degradationManager.getDegradationLevel();
    const loggingHealth = this.resilientLogger.getHealthStatus();
    const errorStats = await this.errorLogger.getErrorStatistics();

    return {
      overall: systemHealth.databaseConnected && systemHealth.loggingHealthy ? 'HEALTHY' : 'DEGRADED',
      database: {
        connected: connectionHealth.isConnected,
        connectionTime: connectionHealth.connectionTime,
        consecutiveFailures: connectionHealth.consecutiveFailures,
        lastError: connectionHealth.error
      },
      logging: {
        healthy: loggingHealth.isHealthy,
        lastHealthCheck: loggingHealth.lastHealthCheck,
        uptime: loggingHealth.uptime
      },
      degradation: {
        level: degradationLevel.level,
        description: degradationLevel.description,
        enabledFeatures: degradationLevel.enabledFeatures,
        disabledFeatures: degradationLevel.disabledFeatures
      },
      errors: {
        totalErrors: errorStats.totalErrors,
        criticalErrors: errorStats.criticalErrors,
        errorRate: systemHealth.errorRate,
        timeWindow: errorStats.timeWindow
      },
      memory: {
        usage: systemHealth.memoryUsage,
        threshold: 512 // MB
      },
      lastSuccessfulOperation: systemHealth.lastSuccessfulOperation,
      initialized: this.isInitialized
    };
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      return await validateSystemHealth();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  /**
   * Get startup validation results
   */
  async getStartupValidationResults(): Promise<StartupValidationResult> {
    return await performStartupValidation();
  }

  /**
   * Ensure system is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown comprehensive error handling system
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down comprehensive error handling system...');
    
    try {
      await this.connectionManager.shutdown();
      this.degradationManager.shutdown();
      
      console.log('✅ Comprehensive error handling system shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Type definitions
export interface SystemStatus {
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  database: {
    connected: boolean;
    connectionTime: number;
    consecutiveFailures: number;
    lastError?: string;
  };
  logging: {
    healthy: boolean;
    lastHealthCheck: Date;
    uptime: number;
  };
  degradation: {
    level: string;
    description: string;
    enabledFeatures: string[];
    disabledFeatures: string[];
  };
  errors: {
    totalErrors: number;
    criticalErrors: number;
    errorRate: number;
    timeWindow: string;
  };
  memory: {
    usage: number;
    threshold: number;
  };
  lastSuccessfulOperation: Date | null;
  initialized: boolean;
}

/**
 * Global instance and convenience functions
 */
let globalErrorHandlingSystem: ComprehensiveErrorHandlingSystem | null = null;

/**
 * Get the global comprehensive error handling system
 */
export function getComprehensiveErrorHandlingSystem(): ComprehensiveErrorHandlingSystem {
  if (!globalErrorHandlingSystem) {
    globalErrorHandlingSystem = ComprehensiveErrorHandlingSystem.getInstance();
  }
  return globalErrorHandlingSystem;
}

/**
 * Initialize comprehensive error handling system
 */
export async function initializeComprehensiveErrorHandling(): Promise<boolean> {
  const system = getComprehensiveErrorHandlingSystem();
  return await system.initialize();
}

/**
 * Execute database operation with comprehensive error handling
 */
export async function executeDatabaseOperationSafely<T>(
  operation: () => Promise<T>,
  context: LoggingContext,
  options?: {
    retries?: number;
    fallbackValue?: T;
    criticalOperation?: boolean;
  }
): Promise<OperationResult<T>> {
  const system = getComprehensiveErrorHandlingSystem();
  return await system.executeDatabaseOperation(operation, context, options);
}

/**
 * Execute assignment with comprehensive error handling
 */
export async function executeAssignmentSafely(
  bookingId: number,
  context?: Partial<LoggingContext>
): Promise<OperationResult<any>> {
  const system = getComprehensiveErrorHandlingSystem();
  return await system.executeAssignment(bookingId, context);
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const system = getComprehensiveErrorHandlingSystem();
  return await system.getSystemStatus();
}

/**
 * Perform system health check
 */
export async function performSystemHealthCheck(): Promise<boolean> {
  const system = getComprehensiveErrorHandlingSystem();
  return await system.performHealthCheck();
}