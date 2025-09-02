import { initializeAutoApproval, type AutoApprovalConfig } from "./auto-approval";

/**
 * Initialize auto-approval engine on server startup
 */
export async function initializeAutoApprovalOnStartup(): Promise<void> {
  console.log("🚀 Initializing auto-approval engine on server startup...");

  try {
    // Default configuration for production
    const defaultConfig: Partial<AutoApprovalConfig> = {
      enabled: false, // Start disabled by default for safety
      evaluationIntervalMs: 5 * 60 * 1000, // 5 minutes
      loadThresholds: {
        highLoad: {
          poolSizeThreshold: 20,
          escalationRateThreshold: 0.3,
          conflictRateThreshold: 0.4,
          averageProcessingTimeMs: 5000,
          deadlineViolationThreshold: 5,
          targetMode: 'URGENT',
          confidence: 0.8
        },
        normalLoad: {
          poolSizeThreshold: 10,
          escalationRateThreshold: 0.15,
          conflictRateThreshold: 0.2,
          averageProcessingTimeMs: 2000,
          deadlineViolationThreshold: 2,
          targetMode: 'BALANCE',
          confidence: 0.7
        }
      },
      modePreferences: [
        {
          mode: 'URGENT',
          priority: 1,
          conditions: {
            minPoolSize: 15,
            maxEscalationRate: 0.5,
            maxConflictRate: 0.6
          }
        },
        {
          mode: 'BALANCE',
          priority: 2,
          conditions: {
            minPoolSize: 5,
            maxPoolSize: 25,
            maxEscalationRate: 0.25,
            maxConflictRate: 0.3
          }
        },
        {
          mode: 'NORMAL',
          priority: 3,
          conditions: {
            maxPoolSize: 15,
            maxEscalationRate: 0.2,
            maxConflictRate: 0.25
          }
        }
      ],
      notifications: {
        enabled: true,
        channels: ['console', 'database']
      },
      manualOverride: {
        enabled: false
      }
    };

    // Initialize the engine
    const engine = await initializeAutoApproval(defaultConfig);

    console.log("✅ Auto-approval engine initialized successfully");
    console.log(`   Enabled: ${defaultConfig.enabled}`);
    console.log(`   Evaluation Interval: ${defaultConfig.evaluationIntervalMs}ms`);
    console.log(`   High Load Threshold: ${defaultConfig.loadThresholds?.highLoad.poolSizeThreshold} pool size`);
    console.log(`   Normal Load Threshold: ${defaultConfig.loadThresholds?.normalLoad.poolSizeThreshold} pool size`);

    // Perform initial load assessment
    console.log("📊 Performing initial system load assessment...");
    const initialAssessment = await engine.evaluateSystemLoad();
    
    console.log(`   Initial Load Level: ${initialAssessment.loadLevel}`);
    console.log(`   Pool Size: ${initialAssessment.poolSize}`);
    console.log(`   Recommended Mode: ${initialAssessment.recommendedMode}`);
    console.log(`   Confidence: ${(initialAssessment.confidence * 100).toFixed(1)}%`);

    // Log successful initialization
    console.log("🎉 Auto-approval system ready for use");
    console.log("   Use admin API endpoints to enable and configure auto-approval");

  } catch (error) {
    console.error("❌ Failed to initialize auto-approval engine:", error);
    console.error("   Auto-approval functionality will not be available");
    
    // Don't throw error to prevent server startup failure
    // Auto-approval is an enhancement, not a critical feature
  }
}

/**
 * Shutdown auto-approval engine gracefully
 */
export async function shutdownAutoApproval(): Promise<void> {
  console.log("🛑 Shutting down auto-approval engine...");

  try {
    const { getAutoApprovalEngine } = await import("./auto-approval");
    const engine = getAutoApprovalEngine();
    
    // Cleanup resources
    engine.destroy();
    
    console.log("✅ Auto-approval engine shutdown completed");
  } catch (error) {
    console.error("❌ Error during auto-approval shutdown:", error);
  }
}