import { initializePoolScheduler } from "./pool-scheduler";
import { validateSchemaOnStartup } from "./schema-validator";
import { initializeDailyPoolProcessor } from "./daily-pool-processor";

/**
 * Initialize all assignment system components on application startup
 */
export async function initializeAssignmentSystem(): Promise<void> {
  console.log("🚀 Initializing assignment system...");

  try {
    // 1. Validate database schema
    console.log("🔍 Validating database schema...");
    const schemaValid = await validateSchemaOnStartup();
    
    if (!schemaValid) {
      console.warn("⚠️ Schema validation failed - some features may not work correctly");
    } else {
      console.log("✅ Database schema validation passed");
    }

    // 2. Initialize pool processing scheduler (legacy - for backward compatibility)
    console.log("⏰ Initializing pool processing scheduler...");
    await initializePoolScheduler();
    console.log("✅ Pool processing scheduler initialized");

    // 3. Initialize daily pool processor (new implementation)
    console.log("📅 Initializing daily pool processor...");
    await initializeDailyPoolProcessor();
    console.log("✅ Daily pool processor initialized");

    console.log("🎉 Assignment system initialization complete");

  } catch (error) {
    console.error("❌ Failed to initialize assignment system:", error);
    
    // Don't throw the error - allow the application to start even if initialization fails
    // The system should degrade gracefully
    console.log("🔄 Assignment system will continue with limited functionality");
  }
}

/**
 * Graceful shutdown of assignment system components
 */
export async function shutdownAssignmentSystem(): Promise<void> {
  console.log("🛑 Shutting down assignment system...");

  try {
    // Stop daily pool processor
    const { stopDailyPoolProcessor } = await import("./daily-pool-processor");
    stopDailyPoolProcessor();
    console.log("✅ Daily pool processor stopped");

    // Stop legacy pool scheduler
    const { stopPoolScheduler } = await import("./pool-scheduler");
    stopPoolScheduler();
    console.log("✅ Pool scheduler stopped");

    // Flush any remaining logs
    const { getAssignmentLogger } = await import("./logging");
    const logger = getAssignmentLogger();
    await logger.flushBuffers();
    console.log("✅ Log buffers flushed");

    console.log("🎉 Assignment system shutdown complete");

  } catch (error) {
    console.error("❌ Error during assignment system shutdown:", error);
  }
}

/**
 * Health check for assignment system components
 */
export async function checkAssignmentSystemHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: 'healthy' | 'unhealthy';
    scheduler: 'healthy' | 'stopped' | 'error';
    logging: 'healthy' | 'degraded';
  };
  details: {
    database?: string;
    scheduler?: string;
    logging?: string;
  };
}> {
  const components = {
    database: 'unhealthy' as const,
    scheduler: 'stopped' as const,
    logging: 'degraded' as const
  };
  
  const details: Record<string, string> = {};

  try {
    // Check database connectivity
    const { validateSchemaOnStartup } = await import("./schema-validator");
    const dbHealthy = await validateSchemaOnStartup();
    components.database = dbHealthy ? 'healthy' : 'unhealthy';
    if (!dbHealthy) {
      details.database = 'Schema validation failed or database connectivity issues';
    }

    // Check scheduler status
    const { getPoolScheduler } = await import("./pool-scheduler");
    const scheduler = getPoolScheduler();
    
    if (!scheduler) {
      components.scheduler = 'stopped';
      details.scheduler = 'Scheduler not initialized';
    } else {
      const status = scheduler.getStatus();
      if (status.isRunning) {
        if (status.recentErrors.length > 0) {
          components.scheduler = 'error';
          details.scheduler = `Running with ${status.recentErrors.length} recent errors`;
        } else {
          components.scheduler = 'healthy';
        }
      } else {
        components.scheduler = 'stopped';
        details.scheduler = 'Scheduler is not running';
      }
    }

    // Check logging system
    components.logging = 'healthy'; // Assume healthy unless we detect issues
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    
    if (components.database === 'healthy' && components.scheduler === 'healthy' && components.logging === 'healthy') {
      overall = 'healthy';
    } else if (components.database === 'unhealthy') {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    return {
      overall,
      components,
      details
    };

  } catch (error) {
    console.error("❌ Error checking assignment system health:", error);
    
    return {
      overall: 'unhealthy',
      components,
      details: {
        ...details,
        system: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}