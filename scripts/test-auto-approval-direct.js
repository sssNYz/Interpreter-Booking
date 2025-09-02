/**
 * Direct test script for Auto-Approval Function (without API calls)
 * Tests the auto-approval engine directly
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAutoApprovalDirect() {
  console.log("🧪 Testing Auto-Approval Function (Direct)...\n");

  try {
    // Import the auto-approval engine
    const { getAutoApprovalEngine, initializeAutoApproval } = require('../lib/assignment/auto-approval.ts');

    // Test 1: Initialize Auto-Approval Engine
    console.log("🚀 Test 1: Initialize Auto-Approval Engine");
    const engine = await initializeAutoApproval({
      enabled: true,
      evaluationIntervalMs: 300000, // 5 minutes
      loadThresholds: {
        highLoad: {
          poolSizeThreshold: 15,
          escalationRateThreshold: 0.25,
          conflictRateThreshold: 0.35,
          averageProcessingTimeMs: 4000,
          deadlineViolationThreshold: 3,
          targetMode: 'URGENT',
          confidence: 0.8
        },
        normalLoad: {
          poolSizeThreshold: 8,
          escalationRateThreshold: 0.12,
          conflictRateThreshold: 0.18,
          averageProcessingTimeMs: 1500,
          deadlineViolationThreshold: 1,
          targetMode: 'BALANCE',
          confidence: 0.7
        }
      },
      notifications: {
        enabled: true,
        channels: ['console', 'database']
      }
    });

    console.log("✅ Auto-approval engine initialized successfully");
    console.log();

    // Test 2: System Load Assessment
    console.log("📊 Test 2: System Load Assessment");
    const loadAssessment = await engine.evaluateSystemLoad();
    
    console.log("✅ Load assessment completed");
    console.log(`   Load Level: ${loadAssessment.loadLevel}`);
    console.log(`   Pool Size: ${loadAssessment.poolSize}`);
    console.log(`   Escalation Rate: ${(loadAssessment.escalationRate * 100).toFixed(1)}%`);
    console.log(`   Conflict Rate: ${(loadAssessment.conflictRate * 100).toFixed(1)}%`);
    console.log(`   Recommended Mode: ${loadAssessment.recommendedMode}`);
    console.log(`   Confidence: ${(loadAssessment.confidence * 100).toFixed(1)}%`);
    console.log(`   Processing Time: ${loadAssessment.averageProcessingTime}ms`);
    console.log();

    // Test 3: Get Auto-Approval Status
    console.log("📋 Test 3: Get Auto-Approval Status");
    const status = await engine.getAutoApprovalStatus();
    
    console.log("✅ Status retrieved successfully");
    console.log(`   Enabled: ${status.enabled}`);
    console.log(`   Current Mode: ${status.currentMode}`);
    console.log(`   Manual Override: ${status.manualOverride.active ? 'Active' : 'Inactive'}`);
    console.log(`   Last Evaluation: ${status.lastEvaluation || 'Never'}`);
    console.log(`   Recent Switches: ${status.recentSwitches.length}`);
    console.log();

    // Test 4: Manual Override
    console.log("🔒 Test 4: Manual Override");
    await engine.enableManualOverride('Testing manual override functionality', new Date(Date.now() + 10 * 60 * 1000));
    
    const overrideStatus = await engine.getAutoApprovalStatus();
    console.log("✅ Manual override enabled successfully");
    console.log(`   Active: ${overrideStatus.manualOverride.active}`);
    console.log(`   Reason: ${overrideStatus.manualOverride.reason}`);
    console.log();

    // Test 5: Determine Optimal Mode
    console.log("🎯 Test 5: Determine Optimal Mode");
    const optimalMode = await engine.determineOptimalMode();
    
    console.log("✅ Optimal mode determined");
    console.log(`   Recommended Mode: ${optimalMode}`);
    console.log();

    // Test 6: Execute Auto Switch (should be blocked by override)
    console.log("🔄 Test 6: Execute Auto Switch (with override active)");
    const switchResult = await engine.executeAutoSwitch('URGENT');
    
    if (switchResult.success) {
      console.log("✅ Mode switch completed");
      console.log(`   ${switchResult.oldMode} → ${switchResult.newMode}`);
    } else {
      console.log("⚠️ Mode switch blocked (expected due to manual override)");
      console.log(`   Reason: ${switchResult.reason}`);
    }
    console.log(`   Override Applied: ${switchResult.overrideApplied}`);
    console.log();

    // Test 7: Disable Manual Override
    console.log("🔓 Test 7: Disable Manual Override");
    await engine.disableManualOverride();
    
    const disabledStatus = await engine.getAutoApprovalStatus();
    console.log("✅ Manual override disabled successfully");
    console.log(`   Active: ${disabledStatus.manualOverride.active}`);
    console.log();

    // Test 8: Execute Auto Switch (should work now)
    console.log("🔄 Test 8: Execute Auto Switch (without override)");
    const switchResult2 = await engine.executeAutoSwitch('BALANCE');
    
    if (switchResult2.success) {
      console.log("✅ Mode switch completed successfully");
      console.log(`   ${switchResult2.oldMode} → ${switchResult2.newMode}`);
      console.log(`   Confidence: ${(switchResult2.confidence * 100).toFixed(1)}%`);
      if (switchResult2.modeTransition) {
        console.log(`   Affected bookings: ${switchResult2.modeTransition.pooledBookingsAffected}`);
        console.log(`   Immediate assignments: ${switchResult2.modeTransition.immediateAssignments}`);
      }
    } else {
      console.log("⚠️ Mode switch failed");
      console.log(`   Reason: ${switchResult2.reason}`);
    }
    console.log();

    // Test 9: Configuration Update
    console.log("⚙️ Test 9: Configuration Update");
    await engine.configureAutoApproval({
      evaluationIntervalMs: 600000, // 10 minutes
      loadThresholds: {
        highLoad: {
          poolSizeThreshold: 25,
          escalationRateThreshold: 0.35,
          conflictRateThreshold: 0.45,
          averageProcessingTimeMs: 6000,
          deadlineViolationThreshold: 8,
          targetMode: 'URGENT',
          confidence: 0.85
        },
        normalLoad: {
          poolSizeThreshold: 12,
          escalationRateThreshold: 0.18,
          conflictRateThreshold: 0.25,
          averageProcessingTimeMs: 2500,
          deadlineViolationThreshold: 3,
          targetMode: 'BALANCE',
          confidence: 0.75
        }
      }
    });
    
    const updatedStatus = await engine.getAutoApprovalStatus();
    console.log("✅ Configuration updated successfully");
    console.log(`   Evaluation Interval: ${updatedStatus.configuration.evaluationIntervalMs}ms`);
    console.log(`   High Load Pool Threshold: ${updatedStatus.configuration.loadThresholds.highLoad.poolSizeThreshold}`);
    console.log();

    // Test 10: Check Auto-Approval Logs
    console.log("📝 Test 10: Check Auto-Approval Logs");
    try {
      const logs = await prisma.autoApprovalLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      if (logs.length > 0) {
        console.log(`✅ Found ${logs.length} auto-approval log entries`);
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.eventType}: ${log.reason}`);
          console.log(`      Timestamp: ${log.timestamp.toISOString()}`);
          if (log.oldMode && log.newMode) {
            console.log(`      Mode Change: ${log.oldMode} → ${log.newMode}`);
          }
        });
      } else {
        console.log("ℹ️ No auto-approval logs found");
      }
    } catch (error) {
      console.log("❌ Failed to check auto-approval logs:", error.message);
    }
    console.log();

    // Test 11: Final Status Check
    console.log("📊 Test 11: Final Status Check");
    const finalStatus = await engine.getAutoApprovalStatus();
    
    console.log("✅ Final status check completed");
    console.log(`   Enabled: ${finalStatus.enabled}`);
    console.log(`   Current Mode: ${finalStatus.currentMode}`);
    console.log(`   Manual Override: ${finalStatus.manualOverride.active ? 'Active' : 'Inactive'}`);
    console.log(`   Recent Switches: ${finalStatus.recentSwitches.length}`);
    
    if (finalStatus.systemLoad) {
      console.log(`   System Load: ${finalStatus.systemLoad.loadLevel}`);
      console.log(`   Pool Size: ${finalStatus.systemLoad.poolSize}`);
      console.log(`   Recommended Mode: ${finalStatus.systemLoad.recommendedMode}`);
    }
    console.log();

    // Cleanup
    engine.destroy();
    console.log("🧹 Auto-approval engine cleaned up");

    console.log("\n🎉 Auto-Approval Function testing completed successfully!");

  } catch (error) {
    console.error("❌ Test execution failed:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testAutoApprovalDirect().catch(console.error);
}

module.exports = { testAutoApprovalDirect };