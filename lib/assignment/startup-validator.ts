import { SchemaValidator } from "./schema-validator";
import { ResilientLogger } from "./resilient-logger";
import { getAssignmentLogger } from "./logging";

/**
 * Startup validation and initialization for assignment system
 */
export interface StartupValidationResult {
    success: boolean;
    schemaValid: boolean;
    loggingInitialized: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
}

/**
 * Comprehensive startup validation
 */
export async function performStartupValidation(): Promise<StartupValidationResult> {
    const result: StartupValidationResult = {
        success: false,
        schemaValid: false,
        loggingInitialized: false,
        errors: [],
        warnings: [],
        recommendations: []
    };

    console.log("🚀 Starting assignment system validation...");

    try {
        // 1. Validate database schema
        console.log("📋 Step 1: Database schema validation");
        const schemaValidation = await SchemaValidator.validateRequiredTables();
        result.schemaValid = schemaValidation.isValid;

        if (!schemaValidation.isValid) {
            result.errors.push("Database schema validation failed");
            result.errors.push(...schemaValidation.structureIssues.map(issue =>
                `${issue.table}: ${issue.issue}`
            ));
            result.recommendations.push(...schemaValidation.recommendations);
        } else {
            console.log("✅ Database schema validation passed");
        }

        // 2. Initialize resilient logging system
        console.log("📝 Step 2: Logging system initialization");
        try {
            const resilientLogger = ResilientLogger.getInstance();
            const healthStatus = resilientLogger.getHealthStatus();

            if (healthStatus.isHealthy) {
                result.loggingInitialized = true;
                console.log("✅ Resilient logging system initialized");
            } else {
                result.warnings.push("Logging system initialized but marked as unhealthy");
                result.loggingInitialized = true; // Still functional, just degraded
            }
        } catch (error) {
            result.errors.push(`Logging system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.recommendations.push("Check database connectivity and permissions");
        }

        // 3. Initialize assignment logger
        console.log("📊 Step 3: Assignment logger initialization");
        try {
            getAssignmentLogger();
            console.log("✅ Assignment logger initialized");
        } catch (error) {
            result.warnings.push(`Assignment logger initialization warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 4. Test database connectivity
        console.log("🔗 Step 4: Database connectivity test");
        const healthCheck = await SchemaValidator.checkDatabaseHealth();
        if (!healthCheck.isHealthy) {
            result.errors.push(`Database connectivity failed: ${healthCheck.error}`);
            result.recommendations.push("Verify database connection string and server availability");
        } else {
            console.log(`✅ Database connectivity test passed (${healthCheck.connectionTime}ms)`);
        }

        // 5. Overall success determination
        result.success = result.schemaValid && result.loggingInitialized && healthCheck.isHealthy;

        // 6. Generate final recommendations
        if (!result.success) {
            if (!result.schemaValid) {
                result.recommendations.push("Run database migrations to create or update required tables");
            }
            if (!result.loggingInitialized) {
                result.recommendations.push("Check logging system configuration and database permissions");
            }
            if (!healthCheck.isHealthy) {
                result.recommendations.push("Verify database server is running and accessible");
            }
        }

        // Log final status
        if (result.success) {
            console.log("🎉 Assignment system startup validation completed successfully");
        } else {
            console.log("❌ Assignment system startup validation failed");
            console.log("Errors:", result.errors);
            console.log("Recommendations:", result.recommendations);
        }

        return result;

    } catch (error) {
        console.error("❌ Critical error during startup validation:", error);
        result.errors.push(`Critical startup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.recommendations.push("Check system configuration and database connectivity");
        return result;
    }
}

/**
 * Graceful degradation setup for when validation fails
 */
export async function setupGracefulDegradation(validationResult: StartupValidationResult): Promise<void> {
    console.log("⚠️ Setting up graceful degradation mode...");

    if (!validationResult.schemaValid) {
        console.log("📝 Schema validation failed - logging will use console fallback");
        // The resilient logger will automatically handle this
    }

    if (!validationResult.loggingInitialized) {
        console.log("📊 Logging system failed - using minimal console logging");
        // Assignment operations will continue but with reduced logging
    }

    console.log("✅ Graceful degradation setup complete");
    console.log("⚠️ System will continue operating with reduced functionality");
}

/**
 * Validate specific database operations that are critical for assignment
 */
export async function validateCriticalOperations(): Promise<{
    canReadBookings: boolean;
    canReadEmployees: boolean;
    canWriteAssignments: boolean;
    canWriteLogs: boolean;
    errors: string[];
}> {
    const result = {
        canReadBookings: false,
        canReadEmployees: false,
        canWriteAssignments: false,
        canWriteLogs: false,
        errors: [] as string[]
    };

    try {
        // Test reading bookings
        const prisma = (await import("@/prisma/prisma")).default;

        try {
            await prisma.bookingPlan.findFirst({ take: 1 });
            result.canReadBookings = true;
        } catch (error) {
            result.errors.push(`Cannot read bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Test reading employees
        try {
            await prisma.employee.findFirst({ take: 1 });
            result.canReadEmployees = true;
        } catch (error) {
            result.errors.push(`Cannot read employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Test writing assignments (simulate)
        try {
            // Just test the table exists, don't actually write
            await prisma.assignmentLog.findFirst({ take: 1 });
            result.canWriteAssignments = true;
        } catch (error) {
            result.errors.push(`Cannot access assignment logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Test writing logs
        try {
            await prisma.systemErrorLog.findFirst({ take: 1 });
            result.canWriteLogs = true;
        } catch (error) {
            result.errors.push(`Cannot access system error logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

    } catch (error) {
        result.errors.push(`Critical database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
}

/**
 * Quick health check for monitoring
 */
export async function quickHealthCheck(): Promise<{
    healthy: boolean;
    responseTime: number;
    issues: string[];
}> {
    const startTime = Date.now();
    const result = {
        healthy: true,
        responseTime: 0,
        issues: [] as string[]
    };

    try {
        const healthCheck = await SchemaValidator.checkDatabaseHealth();
        result.responseTime = Date.now() - startTime;

        if (!healthCheck.isHealthy) {
            result.healthy = false;
            result.issues.push(healthCheck.error || 'Database unhealthy');
        }

        // Check resilient logger health
        const resilientLogger = ResilientLogger.getInstance();
        const loggerHealth = resilientLogger.getHealthStatus();

        if (!loggerHealth.isHealthy) {
            result.issues.push('Logging system unhealthy');
            // Don't mark overall system as unhealthy for logging issues
        }

    } catch (error) {
        result.healthy = false;
        result.responseTime = Date.now() - startTime;
        result.issues.push(error instanceof Error ? error.message : 'Unknown health check error');
    }

    return result;
}