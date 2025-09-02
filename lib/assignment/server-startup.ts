import { initializeDailyPoolProcessor } from "./daily-pool-processor";
import { initializeAssignmentSystem } from "./startup";
import { initializePoolSystem } from "./pool-startup";

/**
 * Server startup service that initializes all assignment system components
 * This should be called when the Next.js server starts (npm run dev)
 */
export class ServerStartupService {
  private static initialized = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * Initialize all assignment system components on server startup
   */
  static async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initialized) {
      console.log("ℹ️ Assignment system already initialized, skipping");
      return;
    }

    console.log("🚀 Starting server initialization for assignment system...");

    this.initializationPromise = this.performInitialization();
    
    try {
      await this.initializationPromise;
      this.initialized = true;
      console.log("🎉 Server initialization completed successfully");
    } catch (error) {
      console.error("❌ Server initialization failed:", error);
      // Reset promise so initialization can be retried
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual initialization steps
   */
  private static async performInitialization(): Promise<void> {
    try {
      // Step 1: Initialize core assignment system (schema validation, logging)
      console.log("📋 Step 1: Initializing core assignment system...");
      await initializeAssignmentSystem();
      console.log("✅ Core assignment system initialized");

      // Step 2: Initialize database-persistent pool system
      console.log("🗄️ Step 2: Initializing pool system...");
      await initializePoolSystem();
      console.log("✅ Pool system initialized");

      // Step 3: Initialize daily pool processing scheduler
      console.log("⏰ Step 3: Initializing daily pool processor...");
      await initializeDailyPoolProcessor();
      console.log("✅ Daily pool processor initialized");

      // Step 4: Perform health check
      console.log("🔍 Step 4: Performing system health check...");
      const healthStatus = await this.performHealthCheck();
      
      if (healthStatus.overall === 'healthy') {
        console.log("✅ System health check passed");
      } else {
        console.warn(`⚠️ System health check completed with status: ${healthStatus.overall}`);
        console.warn("Issues found:", healthStatus.issues);
      }

      console.log("🎯 Assignment system is ready for operation");

    } catch (error) {
      console.error("❌ Initialization step failed:", error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check after initialization
   */
  private static async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      database: 'healthy' | 'unhealthy';
      poolSystem: 'healthy' | 'degraded' | 'unhealthy';
      dailyProcessor: 'healthy' | 'stopped' | 'error';
      logging: 'healthy' | 'degraded';
    };
    issues: string[];
  }> {
    const issues: string[] = [];
    const components = {
      database: 'unhealthy' as const,
      poolSystem: 'unhealthy' as const,
      dailyProcessor: 'stopped' as const,
      logging: 'degraded' as const
    };

    try {
      // Check database connectivity
      const { validateSchemaOnStartup } = await import("./schema-validator");
      const dbHealthy = await validateSchemaOnStartup();
      components.database = dbHealthy ? 'healthy' : 'unhealthy';
      if (!dbHealthy) {
        issues.push('Database schema validation failed');
      }

      // Check pool system
      const { getPoolSystemStatus } = await import("./pool-startup");
      const poolStatus = await getPoolSystemStatus();
      
      if (poolStatus.systemHealth === 'healthy') {
        components.poolSystem = 'healthy';
      } else if (poolStatus.systemHealth === 'warning') {
        components.poolSystem = 'degraded';
        issues.push(...poolStatus.issues);
      } else {
        components.poolSystem = 'unhealthy';
        issues.push(...poolStatus.issues);
      }

      // Check daily processor
      const { getDailyPoolProcessor } = await import("./daily-pool-processor");
      const dailyProcessor = getDailyPoolProcessor();
      
      if (!dailyProcessor) {
        components.dailyProcessor = 'stopped';
        issues.push('Daily pool processor not initialized');
      } else {
        const processorStatus = dailyProcessor.getStatus();
        if (processorStatus.isRunning) {
          if (processorStatus.recentErrors.length > 0) {
            components.dailyProcessor = 'error';
            issues.push(`Daily processor has ${processorStatus.recentErrors.length} recent errors`);
          } else {
            components.dailyProcessor = 'healthy';
          }
        } else {
          components.dailyProcessor = 'stopped';
          issues.push('Daily processor is not running');
        }
      }

      // Check logging system
      components.logging = 'healthy'; // Assume healthy unless we detect issues

      // Determine overall health
      let overall: 'healthy' | 'degraded' | 'unhealthy';
      
      if (components.database === 'unhealthy' || components.poolSystem === 'unhealthy') {
        overall = 'unhealthy';
      } else if (
        components.database === 'healthy' && 
        components.poolSystem === 'healthy' && 
        components.dailyProcessor === 'healthy' && 
        components.logging === 'healthy'
      ) {
        overall = 'healthy';
      } else {
        overall = 'degraded';
      }

      return {
        overall,
        components,
        issues
      };

    } catch (error) {
      console.error("❌ Health check failed:", error);
      issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        overall: 'unhealthy',
        components,
        issues
      };
    }
  }

  /**
   * Graceful shutdown of all assignment system components
   */
  static async shutdown(): Promise<void> {
    if (!this.initialized) {
      console.log("ℹ️ Assignment system not initialized, nothing to shutdown");
      return;
    }

    console.log("🛑 Starting graceful shutdown of assignment system...");

    try {
      // Stop daily processor
      const { stopDailyPoolProcessor } = await import("./daily-pool-processor");
      stopDailyPoolProcessor();
      console.log("✅ Daily pool processor stopped");

      // Shutdown core assignment system
      const { shutdownAssignmentSystem } = await import("./startup");
      await shutdownAssignmentSystem();
      console.log("✅ Core assignment system shutdown");

      this.initialized = false;
      this.initializationPromise = null;
      
      console.log("🎉 Assignment system shutdown completed");

    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
  }

  /**
   * Check if the server is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force re-initialization (for development/testing)
   */
  static async forceReinitialize(): Promise<void> {
    console.log("🔄 Forcing re-initialization of assignment system...");
    
    await this.shutdown();
    this.initialized = false;
    this.initializationPromise = null;
    
    await this.initialize();
  }

  /**
   * Get current system status
   */
  static async getSystemStatus(): Promise<{
    initialized: boolean;
    health: any;
    uptime: number;
    components: {
      dailyProcessor: any;
      poolSystem: any;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const health = this.initialized ? await this.performHealthCheck() : null;
      
      // Get component statuses
      let dailyProcessorStatus = null;
      let poolSystemStatus = null;
      
      if (this.initialized) {
        try {
          const { getDailyPoolProcessor, getDailyProcessingStatistics } = await import("./daily-pool-processor");
          const processor = getDailyPoolProcessor();
          if (processor) {
            dailyProcessorStatus = {
              ...processor.getStatus(),
              statistics: await getDailyProcessingStatistics()
            };
          }
        } catch (error) {
          console.error("Error getting daily processor status:", error);
        }

        try {
          const { getPoolSystemStatus } = await import("./pool-startup");
          poolSystemStatus = await getPoolSystemStatus();
        } catch (error) {
          console.error("Error getting pool system status:", error);
        }
      }

      return {
        initialized: this.initialized,
        health,
        uptime: Date.now() - startTime,
        components: {
          dailyProcessor: dailyProcessorStatus,
          poolSystem: poolSystemStatus
        }
      };

    } catch (error) {
      console.error("❌ Error getting system status:", error);
      
      return {
        initialized: this.initialized,
        health: { overall: 'unhealthy', issues: [error instanceof Error ? error.message : 'Unknown error'] },
        uptime: Date.now() - startTime,
        components: {
          dailyProcessor: null,
          poolSystem: null
        }
      };
    }
  }
}

/**
 * Convenience function to initialize the server
 */
export async function initializeServer(): Promise<void> {
  return ServerStartupService.initialize();
}

/**
 * Convenience function to shutdown the server
 */
export async function shutdownServer(): Promise<void> {
  return ServerStartupService.shutdown();
}

/**
 * Convenience function to get server status
 */
export async function getServerStatus(): Promise<any> {
  return ServerStartupService.getSystemStatus();
}

/**
 * Auto-initialization hook for Next.js
 * This will be called when the module is imported
 */
if (typeof window === 'undefined') { // Only run on server side
  // Initialize on server startup with a small delay to ensure other systems are ready
  setTimeout(async () => {
    try {
      console.log("🔄 Auto-initializing assignment system on server startup...");
      await initializeServer();
    } catch (error) {
      console.error("❌ Auto-initialization failed:", error);
      console.log("⚠️ Assignment system will need to be manually initialized");
    }
  }, 1000); // 1 second delay
}