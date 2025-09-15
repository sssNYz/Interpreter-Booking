import { validateSchemaOnStartup } from "../validation/schema-validator";

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

    // Pool system removed: no schedulers or daily processors to initialize

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
    // No pool components to stop

    // Flush any remaining logs
    const { getAssignmentLogger } = await import("../logging/logging");
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
    scheduler: 'stopped';
    logging: 'healthy' | 'degraded';
  };
  details: {
    database?: string;
    scheduler?: string;
    logging?: string;
  };
}> {
  const components: { database: 'healthy' | 'unhealthy'; scheduler: 'stopped'; logging: 'healthy' | 'degraded' } = {
    database: 'unhealthy',
    scheduler: 'stopped',
    logging: 'degraded'
  };
  
  const details: Record<string, string> = {};

  try {
    // Check database connectivity
    const { validateSchemaOnStartup } = await import("../validation/schema-validator");
    const dbHealthy = await validateSchemaOnStartup();
    components.database = dbHealthy ? 'healthy' : 'unhealthy';
    if (!dbHealthy) {
      details.database = 'Schema validation failed or database connectivity issues';
    }

    // Scheduler removed
    components.scheduler = 'stopped';
    details.scheduler = 'Scheduler removed';

    // Check logging system
    components.logging = 'healthy'; // Assume healthy unless we detect issues
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    
    if (components.database === 'healthy' && components.logging === 'healthy') {
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
      details
    };
  }
}