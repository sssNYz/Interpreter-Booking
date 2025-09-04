import { runAssignment } from "../core/run";
import { getDatabaseConnectionManager } from "./database-connection-manager";
import { getComprehensiveErrorLogger, logErrorWithContext } from "./comprehensive-error-logger";
import { getResilientLogger, type LoggingContext } from "../logging/resilient-logger";

/**
 * Graceful degradation system that continues core operations when logging fails
 */
export interface DegradationLevel {
  level: 'NORMAL' | 'REDUCED_LOGGING' | 'MINIMAL_LOGGING' | 'NO_LOGGING' | 'EMERGENCY';
  description: string;
  enabledFeatures: string[];
  disabledFeatures: string[];
  fallbackMethods: string[];
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  degradationLevel: DegradationLevel['level'];
  fallbacksUsed: string[];
  warnings: string[];
}

export interface SystemHealth {
  databaseConnected: boolean;
  loggingHealthy: boolean;
  memoryUsage: number;
  errorRate: number;
  lastSuccessfulOperation: Date | null;
  degradationLevel: DegradationLevel['level'];
}

/**
 * Graceful degradation manager for maintaining core functionality
 */
export class GracefulDegradationManager {
  private static instance: GracefulDegradationManager;
  private connectionManager = getDatabaseConnectionManager();
  private errorLogger = getComprehensiveErrorLogger();
  private resilientLogger = getResilientLogger();
  
  private currentDegradationLevel: DegradationLevel['level'] = 'NORMAL';
  private systemHealth: SystemHealth = {
    databaseConnected: true,
    loggingHealthy: true,
    memoryUsage: 0,
    errorRate: 0,
    lastSuccessfulOperation: null,
    degradationLevel: 'NORMAL'
  };
  
  private errorCount = 0;
  private operationCount = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly maxErrorRate = 0.1; // 10% error rate threshold
  private readonly healthCheckIntervalMs = 60000; // 1 minute

  private constructor() {
    this.startHealthMonitoring();
  }

  public static getInstance(): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager();
    }
    return GracefulDegradationManager.instance;
  }

  /**
   * Execute assignment with graceful degradation
   */
  async executeAssignmentWithDegradation(
    bookingId: number,
    context: Partial<LoggingContext> = {}
  ): Promise<OperationResult<any>> {
    const operationContext: LoggingContext = {
      operation: 'assignment_with_degradation',
      bookingId,
      correlationId: context.correlationId || `assign_${bookingId}_${Date.now()}`,
      ...context
    };

    const result: OperationResult<any> = {
      success: false,
      degradationLevel: this.currentDegradationLevel,
      fallbacksUsed: [],
      warnings: []
    };

    this.operationCount++;

    try {
      // Check current system health and adjust degradation level
      await this.assessSystemHealth();

      // Execute assignment based on degradation level
      switch (this.currentDegradationLevel) {
        case 'NORMAL':
          result.data = await this.executeNormalAssignment(bookingId, operationContext);
          break;
          
        case 'REDUCED_LOGGING':
          result.data = await this.executeWithReducedLogging(bookingId, operationContext);
          result.fallbacksUsed.push('reduced_logging');
          result.warnings.push('Operating with reduced logging due to system issues');
          break;
          
        case 'MINIMAL_LOGGING':
          result.data = await this.executeWithMinimalLogging(bookingId, operationContext);
          result.fallbacksUsed.push('minimal_logging');
          result.warnings.push('Operating with minimal logging - only critical errors logged');
          break;
          
        case 'NO_LOGGING':
          result.data = await this.executeWithoutLogging(bookingId, operationContext);
          result.fallbacksUsed.push('no_logging');
          result.warnings.push('Operating without database logging - console only');
          break;
          
        case 'EMERGENCY':
          result.data = await this.executeEmergencyMode(bookingId, operationContext);
          result.fallbacksUsed.push('emergency_mode');
          result.warnings.push('Operating in emergency mode - minimal functionality');
          break;
      }

      result.success = true;
      this.systemHealth.lastSuccessfulOperation = new Date();
      
      console.log(`✅ Assignment completed for booking ${bookingId} (degradation: ${this.currentDegradationLevel})`);

    } catch (error) {
      this.errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown assignment error';
      
      result.error = errorMessage;
      result.success = false;

      // Try fallback assignment methods
      const fallbackResult = await this.attemptFallbackAssignment(bookingId, operationContext, error);
      if (fallbackResult.success) {
        result.success = true;
        result.data = fallbackResult.data;
        result.fallbacksUsed.push(...fallbackResult.fallbacksUsed);
        result.warnings.push('Primary assignment failed, fallback successful');
      }

      // Log error with appropriate degradation
      await this.logErrorWithDegradation(error, operationContext);
    }

    return result;
  }

  /**
   * Execute normal assignment with full logging
   */
  private async executeNormalAssignment(bookingId: number, context: LoggingContext): Promise<any> {
    return await this.connectionManager.executeWithReconnection(
      () => runAssignment(bookingId),
      context
    );
  }

  /**
   * Execute assignment with reduced logging
   */
  private async executeWithReducedLogging(bookingId: number, context: LoggingContext): Promise<any> {
    try {
      // Skip detailed logging, only log critical events
      return await runAssignment(bookingId);
    } catch (error) {
      // Only log critical errors
      if (this.isCriticalError(error)) {
        await this.logErrorWithDegradation(error, context);
      }
      throw error;
    }
  }

  /**
   * Execute assignment with minimal logging
   */
  private async executeWithMinimalLogging(bookingId: number, context: LoggingContext): Promise<any> {
    try {
      // Disable most logging, only console output
      console.log(`🔄 Processing assignment for booking ${bookingId} (minimal logging mode)`);
      
      const result = await runAssignment(bookingId);
      
      console.log(`✅ Assignment result for booking ${bookingId}: ${result.status}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Assignment failed for booking ${bookingId}:`, error);
      throw error;
    }
  }

  /**
   * Execute assignment without database logging
   */
  private async executeWithoutLogging(bookingId: number, context: LoggingContext): Promise<any> {
    try {
      console.log(`🚨 Processing assignment for booking ${bookingId} (no database logging)`);
      
      // Execute assignment without any database logging
      const result = await runAssignment(bookingId);
      
      // Only console logging
      console.log(`✅ Assignment completed for booking ${bookingId}: ${JSON.stringify({
        status: result.status,
        interpreterId: result.interpreterId,
        reason: result.reason
      })}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Assignment failed for booking ${bookingId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        context
      });
      throw error;
    }
  }

  /**
   * Execute assignment in emergency mode
   */
  private async executeEmergencyMode(bookingId: number, context: LoggingContext): Promise<any> {
    console.log(`🚨 EMERGENCY MODE: Processing critical assignment for booking ${bookingId}`);
    
    try {
      // Simplified assignment logic with minimal dependencies
      const result = await this.executeSimplifiedAssignment(bookingId);
      
      console.log(`🚨 EMERGENCY: Assignment result for booking ${bookingId}: ${result.status}`);
      return result;
      
    } catch (error) {
      console.error(`🚨 EMERGENCY: Assignment failed for booking ${bookingId}:`, error);
      
      // Last resort: mark for manual assignment
      return {
        status: 'escalated',
        reason: 'Emergency mode: automatic assignment failed, requires manual intervention',
        interpreterId: null
      };
    }
  }

  /**
   * Simplified assignment logic for emergency mode
   */
  private async executeSimplifiedAssignment(bookingId: number): Promise<any> {
    try {
      // Try to get booking details with minimal database operations
      const booking = await this.connectionManager.executeWithReconnection(
        async () => {
          return await prisma.bookingPlan.findUnique({
            where: { bookingId },
            select: {
              bookingId: true,
              meetingType: true,
              timeStart: true,
              timeEnd: true,
              bookingStatus: true
            }
          });
        },
        {
          operation: 'emergency_get_booking',
          bookingId
        }
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Simple assignment logic - just mark as escalated for manual handling
      return {
        status: 'escalated',
        reason: 'Emergency mode: simplified processing, requires manual assignment',
        interpreterId: null,
        bookingDetails: booking
      };

    } catch (error) {
      throw new Error(`Emergency assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Attempt fallback assignment methods
   */
  private async attemptFallbackAssignment(
    bookingId: number,
    context: LoggingContext,
    originalError: unknown
  ): Promise<OperationResult<any>> {
    const result: OperationResult<any> = {
      success: false,
      degradationLevel: this.currentDegradationLevel,
      fallbacksUsed: [],
      warnings: []
    };

    console.log(`🔄 Attempting fallback assignment for booking ${bookingId}...`);

    // Fallback 1: Retry with higher degradation level
    if (this.currentDegradationLevel !== 'EMERGENCY') {
      try {
        const previousLevel = this.currentDegradationLevel;
        this.currentDegradationLevel = 'EMERGENCY';
        
        result.data = await this.executeEmergencyMode(bookingId, context);
        result.success = true;
        result.fallbacksUsed.push('emergency_mode_fallback');
        
        // Restore previous level
        this.currentDegradationLevel = previousLevel;
        
        return result;
        
      } catch (fallbackError) {
        console.error(`❌ Emergency mode fallback failed for booking ${bookingId}:`, fallbackError);
      }
    }

    // Fallback 2: Mark for manual assignment
    try {
      console.log(`🔄 Final fallback: marking booking ${bookingId} for manual assignment`);
      
      result.data = {
        status: 'escalated',
        reason: `Automatic assignment failed: ${originalError instanceof Error ? originalError.message : 'Unknown error'}. Requires manual intervention.`,
        interpreterId: null,
        fallbackReason: 'All automatic assignment methods failed'
      };
      
      result.success = true;
      result.fallbacksUsed.push('manual_escalation');
      
      return result;
      
    } catch (escalationError) {
      console.error(`❌ Manual escalation fallback failed for booking ${bookingId}:`, escalationError);
    }

    return result;
  }

  /**
   * Log error with appropriate degradation level
   */
  private async logErrorWithDegradation(error: unknown, context: LoggingContext): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    
    switch (this.currentDegradationLevel) {
      case 'NORMAL':
      case 'REDUCED_LOGGING':
        try {
          await logErrorWithContext(errorObj, context.operation, {
            ...context,
            severity: 'HIGH',
            category: 'SYSTEM'
          });
        } catch (loggingError) {
          console.error('❌ Error logging failed, falling back to console:', loggingError);
          this.logToConsoleWithContext(errorObj, context);
        }
        break;
        
      case 'MINIMAL_LOGGING':
        if (this.isCriticalError(errorObj)) {
          this.logToConsoleWithContext(errorObj, context);
        }
        break;
        
      case 'NO_LOGGING':
      case 'EMERGENCY':
        this.logToConsoleWithContext(errorObj, context);
        break;
    }
  }

  /**
   * Log to console with context
   */
  private logToConsoleWithContext(error: Error, context: LoggingContext): void {
    console.error(`❌ [${this.currentDegradationLevel}] Error in ${context.operation}:`, {
      message: error.message,
      stack: error.stack,
      bookingId: context.bookingId,
      interpreterId: context.interpreterId,
      correlationId: context.correlationId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const criticalPatterns = [
      'critical',
      'fatal',
      'corruption',
      'security',
      'authentication',
      'authorization'
    ];
    
    const message = error.message.toLowerCase();
    return criticalPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Assess system health and adjust degradation level
   */
  private async assessSystemHealth(): Promise<void> {
    try {
      // Update system health metrics
      const memoryUsage = process.memoryUsage();
      this.systemHealth.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
      this.systemHealth.errorRate = this.operationCount > 0 ? this.errorCount / this.operationCount : 0;
      
      // Check database connection
      const connectionHealth = this.connectionManager.getConnectionHealth();
      this.systemHealth.databaseConnected = connectionHealth.isConnected;
      
      // Check logging system health
      const loggingHealth = this.resilientLogger.getHealthStatus();
      this.systemHealth.loggingHealthy = loggingHealth.isHealthy;
      
      // Determine appropriate degradation level
      const newLevel = this.determineDegradationLevel();
      
      if (newLevel !== this.currentDegradationLevel) {
        console.log(`🔄 Degradation level changed: ${this.currentDegradationLevel} → ${newLevel}`);
        this.currentDegradationLevel = newLevel;
        this.systemHealth.degradationLevel = newLevel;
      }
      
    } catch (error) {
      console.error('❌ Error assessing system health:', error);
      // If we can't assess health, assume worst case
      this.currentDegradationLevel = 'EMERGENCY';
      this.systemHealth.degradationLevel = 'EMERGENCY';
    }
  }

  /**
   * Determine appropriate degradation level based on system health
   */
  private determineDegradationLevel(): DegradationLevel['level'] {
    // Critical system issues
    if (!this.systemHealth.databaseConnected) {
      return 'EMERGENCY';
    }
    
    // High error rate
    if (this.systemHealth.errorRate > this.maxErrorRate * 2) {
      return 'EMERGENCY';
    }
    
    // High memory usage
    if (this.systemHealth.memoryUsage > 1024) { // Over 1GB
      return 'MINIMAL_LOGGING';
    }
    
    // Logging system issues
    if (!this.systemHealth.loggingHealthy) {
      return 'NO_LOGGING';
    }
    
    // Moderate error rate
    if (this.systemHealth.errorRate > this.maxErrorRate) {
      return 'REDUCED_LOGGING';
    }
    
    // Memory pressure
    if (this.systemHealth.memoryUsage > 512) { // Over 512MB
      return 'REDUCED_LOGGING';
    }
    
    return 'NORMAL';
  }

  /**
   * Get current degradation level details
   */
  getDegradationLevel(): DegradationLevel {
    const levels: Record<DegradationLevel['level'], DegradationLevel> = {
      NORMAL: {
        level: 'NORMAL',
        description: 'All systems operational',
        enabledFeatures: ['full_logging', 'error_tracking', 'performance_monitoring', 'detailed_diagnostics'],
        disabledFeatures: [],
        fallbackMethods: []
      },
      REDUCED_LOGGING: {
        level: 'REDUCED_LOGGING',
        description: 'Reduced logging to improve performance',
        enabledFeatures: ['critical_logging', 'error_tracking', 'basic_diagnostics'],
        disabledFeatures: ['detailed_logging', 'performance_monitoring'],
        fallbackMethods: ['console_logging']
      },
      MINIMAL_LOGGING: {
        level: 'MINIMAL_LOGGING',
        description: 'Minimal logging - critical errors only',
        enabledFeatures: ['critical_error_logging'],
        disabledFeatures: ['detailed_logging', 'performance_monitoring', 'debug_logging'],
        fallbackMethods: ['console_logging', 'error_buffering']
      },
      NO_LOGGING: {
        level: 'NO_LOGGING',
        description: 'No database logging - console only',
        enabledFeatures: ['console_logging'],
        disabledFeatures: ['database_logging', 'error_tracking', 'performance_monitoring'],
        fallbackMethods: ['console_only', 'memory_buffering']
      },
      EMERGENCY: {
        level: 'EMERGENCY',
        description: 'Emergency mode - minimal functionality',
        enabledFeatures: ['basic_assignment', 'console_logging'],
        disabledFeatures: ['database_logging', 'error_tracking', 'performance_monitoring', 'detailed_diagnostics'],
        fallbackMethods: ['simplified_assignment', 'manual_escalation']
      }
    };
    
    return levels[this.currentDegradationLevel];
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Force degradation level (for testing or manual override)
   */
  forceDegradationLevel(level: DegradationLevel['level']): void {
    console.log(`🔧 Forcing degradation level to: ${level}`);
    this.currentDegradationLevel = level;
    this.systemHealth.degradationLevel = level;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.assessSystemHealth();
    }, this.healthCheckIntervalMs);

    // Initial health check
    setTimeout(() => this.assessSystemHealth(), 1000);
  }

  /**
   * Shutdown graceful degradation manager
   */
  shutdown(): void {
    console.log('🔄 Shutting down graceful degradation manager...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('✅ Graceful degradation manager shutdown complete');
  }
}

/**
 * Convenience function to get graceful degradation manager
 */
export function getGracefulDegradationManager(): GracefulDegradationManager {
  return GracefulDegradationManager.getInstance();
}

/**
 * Convenience function to execute assignment with degradation
 */
export async function executeAssignmentWithGracefulDegradation(
  bookingId: number,
  context?: Partial<LoggingContext>
): Promise<OperationResult<any>> {
  const manager = getGracefulDegradationManager();
  return await manager.executeAssignmentWithDegradation(bookingId, context);
}