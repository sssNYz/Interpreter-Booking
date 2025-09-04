import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import { getResilientLogger, type LoggingContext } from "../logging/resilient-logger";

/**
 * Database connection manager with resilience and automatic reconnection
 */
export interface ConnectionHealth {
    isConnected: boolean;
    connectionTime: number;
    lastSuccessfulOperation: Date | null;
    consecutiveFailures: number;
    error?: string;
}

export interface TransactionOptions {
    maxRetries: number;
    timeout: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
}

export interface TransactionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    retryAttempts: number;
    rollbackPerformed: boolean;
}

/**
 * Enhanced database connection manager with automatic reconnection and transaction safety
 */
export class DatabaseConnectionManager {
    private static instance: DatabaseConnectionManager;
    private resilientLogger = getResilientLogger();
    private connectionHealth: ConnectionHealth = {
        isConnected: false,
        connectionTime: 0,
        lastSuccessfulOperation: null,
        consecutiveFailures: 0
    };

    private readonly maxConsecutiveFailures = 5;
    private readonly reconnectionDelayMs = 1000;
    private readonly maxReconnectionDelayMs = 30000;
    private readonly healthCheckIntervalMs = 30000; // 30 seconds
    private readonly connectionTimeoutMs = 10000; // 10 seconds

    private healthCheckTimer: NodeJS.Timeout | null = null;
    private isReconnecting = false;

    private constructor() {
        this.startHealthChecking();
    }

    public static getInstance(): DatabaseConnectionManager {
        if (!DatabaseConnectionManager.instance) {
            DatabaseConnectionManager.instance = new DatabaseConnectionManager();
        }
        return DatabaseConnectionManager.instance;
    }

    /**
     * Execute database operation with automatic reconnection
     */
    async executeWithReconnection<T>(
        operation: () => Promise<T>,
        context: LoggingContext,
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Check connection health before operation
                if (!this.connectionHealth.isConnected && !this.isReconnecting) {
                    await this.ensureConnection(context);
                }

                // Execute the operation
                const result = await this.executeWithTimeout(operation, this.connectionTimeoutMs);

                // Update health on success
                this.connectionHealth.lastSuccessfulOperation = new Date();
                this.connectionHealth.consecutiveFailures = 0;
                this.connectionHealth.isConnected = true;

                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown database error');
                this.connectionHealth.consecutiveFailures++;

                console.warn(`⚠️ Database operation failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);

                // Check if this is a connection-related error
                if (this.isConnectionError(lastError)) {
                    this.connectionHealth.isConnected = false;

                    // Attempt reconnection if not final attempt
                    if (attempt < maxRetries) {
                        await this.attemptReconnection(context);

                        // Wait before retry
                        const delay = Math.min(
                            this.reconnectionDelayMs * Math.pow(2, attempt),
                            this.maxReconnectionDelayMs
                        );
                        await this.sleep(delay);
                    }
                } else if (attempt < maxRetries) {
                    // Non-connection error, just wait and retry
                    await this.sleep(1000 * (attempt + 1));
                }
            }
        }

        // All attempts failed
        this.connectionHealth.isConnected = false;
        this.connectionHealth.error = lastError?.message;

        throw new Error(`Database operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
    }

    /**
     * Execute database transaction with proper rollback handling
     */
    async executeTransaction<T>(
        transactionFn: (tx: Prisma.TransactionClient) => Promise<T>,
        context: LoggingContext,
        options: Partial<TransactionOptions> = {}
    ): Promise<TransactionResult<T>> {
        const config: TransactionOptions = {
            maxRetries: 3,
            timeout: 30000, // 30 seconds
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            ...options
        };

        let retryAttempts = 0;
        let rollbackPerformed = false;

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            retryAttempts = attempt;

            try {
                console.log(`🔄 Starting transaction attempt ${attempt + 1}/${config.maxRetries + 1} for ${context.operation}`);

                const result = await this.executeWithReconnection(
                    async () => {
                        return await prisma.$transaction(
                            transactionFn,
                            {
                                timeout: config.timeout,
                                isolationLevel: config.isolationLevel
                            }
                        );
                    },
                    {
                        ...context,
                        operation: `transaction_${context.operation}`
                    }
                );

                console.log(`✅ Transaction completed successfully for ${context.operation}`);

                return {
                    success: true,
                    data: result,
                    retryAttempts,
                    rollbackPerformed
                };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown transaction error';
                console.error(`❌ Transaction failed for ${context.operation} (attempt ${attempt + 1}): ${errorMessage}`);

                // Log transaction error
                await this.resilientLogger.handleLoggingError(
                    error instanceof Error ? error : new Error(errorMessage),
                    {
                        ...context,
                        operation: `transaction_error_${context.operation}`,
                        correlationId: context.correlationId || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    }
                );

                // Check if this is a retryable error
                if (this.isRetryableTransactionError(error) && attempt < config.maxRetries) {
                    rollbackPerformed = true;
                    console.log(`🔄 Transaction will be retried due to retryable error: ${errorMessage}`);

                    // Wait before retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    await this.sleep(delay);
                    continue;
                }

                // Non-retryable error or max retries reached
                rollbackPerformed = true;
                return {
                    success: false,
                    error: errorMessage,
                    retryAttempts,
                    rollbackPerformed
                };
            }
        }

        // This should never be reached, but TypeScript requires it
        return {
            success: false,
            error: 'Unexpected transaction completion',
            retryAttempts,
            rollbackPerformed
        };
    }

    /**
     * Execute operation with timeout
     */
    private async executeWithTimeout<T>(
        operation: () => Promise<T>,
        timeoutMs: number
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            operation()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Ensure database connection is established
     */
    private async ensureConnection(context: LoggingContext): Promise<void> {
        if (this.isReconnecting) {
            // Wait for ongoing reconnection
            while (this.isReconnecting) {
                await this.sleep(100);
            }
            return;
        }

        try {
            console.log("🔌 Ensuring database connection...");

            // Test connection with a simple query
            await this.executeWithTimeout(
                () => prisma.$queryRaw`SELECT 1 as test`,
                this.connectionTimeoutMs
            );

            this.connectionHealth.isConnected = true;
            this.connectionHealth.consecutiveFailures = 0;
            this.connectionHealth.connectionTime = Date.now();

            console.log("✅ Database connection verified");

        } catch (error) {
            console.error("❌ Database connection verification failed:", error);
            this.connectionHealth.isConnected = false;
            this.connectionHealth.error = error instanceof Error ? error.message : 'Connection failed';

            throw error;
        }
    }

    /**
     * Attempt to reconnect to database
     */
    private async attemptReconnection(context: LoggingContext): Promise<void> {
        if (this.isReconnecting) {
            return;
        }

        this.isReconnecting = true;

        try {
            console.log("🔄 Attempting database reconnection...");

            // Disconnect and reconnect Prisma client
            await prisma.$disconnect();
            await this.sleep(1000); // Wait before reconnecting

            // Test new connection
            await this.ensureConnection(context);

            console.log("✅ Database reconnection successful");

        } catch (error) {
            console.error("❌ Database reconnection failed:", error);
            this.connectionHealth.isConnected = false;
            this.connectionHealth.error = error instanceof Error ? error.message : 'Reconnection failed';

            // Log reconnection failure
            await this.resilientLogger.handleLoggingError(
                error instanceof Error ? error : new Error('Reconnection failed'),
                {
                    ...context,
                    operation: 'database_reconnection',
                    correlationId: `reconnect_${Date.now()}`
                }
            );

        } finally {
            this.isReconnecting = false;
        }
    }

    /**
     * Start periodic health checking
     */
    private startHealthChecking(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.healthCheckIntervalMs);

        // Perform initial health check
        setTimeout(() => this.performHealthCheck(), 1000);
    }

    /**
     * Perform database health check
     */
    private async performHealthCheck(): Promise<void> {
        const context: LoggingContext = {
            operation: 'health_check',
            correlationId: `health_${Date.now()}`
        };

        try {
            const startTime = Date.now();

            // Simple health check query
            await prisma.$queryRaw`SELECT 1 as health_check`;

            const connectionTime = Date.now() - startTime;

            // Update health status
            const wasConnected = this.connectionHealth.isConnected;
            this.connectionHealth.isConnected = true;
            this.connectionHealth.connectionTime = connectionTime;
            this.connectionHealth.lastSuccessfulOperation = new Date();
            this.connectionHealth.consecutiveFailures = 0;
            this.connectionHealth.error = undefined;

            if (!wasConnected) {
                console.log(`✅ Database connection restored (${connectionTime}ms)`);
            }

        } catch (error) {
            const wasConnected = this.connectionHealth.isConnected;
            this.connectionHealth.isConnected = false;
            this.connectionHealth.consecutiveFailures++;
            this.connectionHealth.error = error instanceof Error ? error.message : 'Health check failed';

            if (wasConnected) {
                console.warn(`⚠️ Database connection lost: ${this.connectionHealth.error}`);
            }

            // Attempt reconnection if consecutive failures exceed threshold
            if (this.connectionHealth.consecutiveFailures >= this.maxConsecutiveFailures) {
                console.warn(`🚨 Too many consecutive failures (${this.connectionHealth.consecutiveFailures}), attempting reconnection...`);
                await this.attemptReconnection(context);
            }
        }
    }

    /**
     * Check if error is connection-related
     */
    private isConnectionError(error: Error): boolean {
        const connectionErrorPatterns = [
            'connection',
            'connect',
            'timeout',
            'network',
            'econnrefused',
            'enotfound',
            'etimedout',
            'socket',
            'server has gone away',
            'lost connection'
        ];

        const errorMessage = error.message.toLowerCase();
        return connectionErrorPatterns.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Check if transaction error is retryable
     */
    private isRetryableTransactionError(error: unknown): boolean {
        if (!(error instanceof Error)) return false;

        const retryablePatterns = [
            'deadlock',
            'lock wait timeout',
            'connection',
            'timeout',
            'serialization failure',
            'could not serialize access'
        ];

        const errorMessage = error.message.toLowerCase();
        return retryablePatterns.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Get current connection health
     */
    getConnectionHealth(): ConnectionHealth {
        return { ...this.connectionHealth };
    }

    /**
     * Force connection check
     */
    async checkConnection(): Promise<ConnectionHealth> {
        await this.performHealthCheck();
        return this.getConnectionHealth();
    }

    /**
     * Gracefully shutdown connection manager
     */
    async shutdown(): Promise<void> {
        console.log("🔌 Shutting down database connection manager...");

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        try {
            await prisma.$disconnect();
            console.log("✅ Database connection manager shutdown complete");
        } catch (error) {
            console.error("❌ Error during database shutdown:", error);
        }
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Convenience function to get database connection manager
 */
export function getDatabaseConnectionManager(): DatabaseConnectionManager {
    return DatabaseConnectionManager.getInstance();
}

/**
 * Database operation wrapper with enhanced error handling
 */
export class SafeDatabaseOperations {
    private static connectionManager = getDatabaseConnectionManager();

    /**
     * Safe database read operation
     */
    static async safeRead<T>(
        operation: () => Promise<T>,
        context: LoggingContext,
        fallbackValue?: T
    ): Promise<T | undefined> {
        try {
            return await this.connectionManager.executeWithReconnection(operation, context);
        } catch (error) {
            console.error(`❌ Safe read operation failed for ${context.operation}:`, error);

            if (fallbackValue !== undefined) {
                console.log(`🔄 Using fallback value for ${context.operation}`);
                return fallbackValue;
            }

            return undefined;
        }
    }

    /**
     * Safe database write operation
     */
    static async safeWrite<T>(
        operation: () => Promise<T>,
        context: LoggingContext
    ): Promise<T | null> {
        try {
            return await this.connectionManager.executeWithReconnection(operation, context);
        } catch (error) {
            console.error(`❌ Safe write operation failed for ${context.operation}:`, error);
            return null;
        }
    }

    /**
     * Safe transaction execution
     */
    static async safeTransaction<T>(
        transactionFn: (tx: Prisma.TransactionClient) => Promise<T>,
        context: LoggingContext,
        options?: Partial<TransactionOptions>
    ): Promise<TransactionResult<T>> {
        return await this.connectionManager.executeTransaction(transactionFn, context, options);
    }
}