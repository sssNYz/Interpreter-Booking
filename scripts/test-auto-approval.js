/**
 * Test script for Auto-Approval Function
 * Tests system load assessment, automatic mode switching, and configuration
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAutoApprovalFunction() {
  console.log("🧪 Testing Auto-Approval Function...\n");

  try {
    // Test 1: System Load Assessment
    console.log("📊 Test 1: System Load Assessment");
    const loadResponse = await fetch('http://localhost:3000/api/admin/auto-approval/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (loadResponse.ok) {
      const loadData = await loadResponse.json();
      console.log("✅ Load assessment successful");
      console.log(`   Load Level: ${loadData.data.loadAssessment.loadLevel}`);
      console.log(`   Pool Size: ${loadData.data.loadAssessment.poolSize}`);
      console.log(`   Recommended Mode: ${loadData.data.loadAssessment.recommendedMode}`);
      console.log(`   Confidence: ${(loadData.data.loadAssessment.confidence * 100).toFixed(1)}%`);
    } else {
      console.log("❌ Load assessment failed");
      const errorData = await loadResponse.json();
      console.log(`   Error: ${errorData.error}`);
    }

    console.log();

    // Test 2: Get Current Status
    console.log("📋 Test 2: Get Auto-Approval Status");
    const statusResponse = await fetch('http://localhost:3000/api/admin/auto-approval/status');
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log("✅ Status retrieval successful");
      console.log(`   Enabled: ${statusData.data.enabled}`);
      console.log(`   Current Mode: ${statusData.data.currentMode}`);
      console.log(`   Manual Override: ${statusData.data.manualOverride.active ? 'Active' : 'Inactive'}`);
      console.log(`   Recent Switches: ${statusData.data.recentSwitches.length}`);
    } else {
      console.log("❌ Status retrieval failed");
    }

    console.log();

    // Test 3: Configuration Update
    console.log("⚙️ Test 3: Configuration Update");
    const configResponse = await fetch('http://localhost:3000/api/admin/auto-approval/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
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
        }
      })
    });
    
    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log("✅ Configuration update successful");
      console.log(`   Auto-approval enabled: ${configData.data.enabled}`);
      console.log(`   Evaluation interval: ${configData.data.configuration.evaluationIntervalMs}ms`);
    } else {
      console.log("❌ Configuration update failed");
      const errorData = await configResponse.json();
      console.log(`   Error: ${errorData.error}`);
    }

    console.log();

    // Test 4: Manual Override
    console.log("🔒 Test 4: Manual Override");
    const overrideResponse = await fetch('http://localhost:3000/api/admin/auto-approval/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'enable',
        reason: 'Testing manual override functionality',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      })
    });
    
    if (overrideResponse.ok) {
      const overrideData = await overrideResponse.json();
      console.log("✅ Manual override enabled successfully");
      console.log(`   Reason: ${overrideData.data.reason}`);
      console.log(`   Expires: ${overrideData.data.expiresAt}`);
    } else {
      console.log("❌ Manual override failed");
    }

    console.log();

    // Test 5: Automatic Mode Switch (should be blocked by override)
    console.log("🔄 Test 5: Automatic Mode Switch (with override active)");
    const switchResponse = await fetch('http://localhost:3000/api/admin/auto-approval/switch-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetMode: 'URGENT'
      })
    });
    
    if (switchResponse.ok) {
      const switchData = await switchResponse.json();
      if (switchData.success) {
        console.log("✅ Mode switch completed");
        console.log(`   ${switchData.data.switchResult.oldMode} → ${switchData.data.switchResult.newMode}`);
      } else {
        console.log("⚠️ Mode switch blocked (expected due to manual override)");
        console.log(`   Reason: ${switchData.data.switchResult.reason}`);
      }
    } else {
      console.log("❌ Mode switch request failed");
    }

    console.log();

    // Test 6: Disable Manual Override
    console.log("🔓 Test 6: Disable Manual Override");
    const disableOverrideResponse = await fetch('http://localhost:3000/api/admin/auto-approval/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'disable'
      })
    });
    
    if (disableOverrideResponse.ok) {
      console.log("✅ Manual override disabled successfully");
    } else {
      console.log("❌ Failed to disable manual override");
    }

    console.log();

    // Test 7: Automatic Mode Switch (should work now)
    console.log("🔄 Test 7: Automatic Mode Switch (without override)");
    const switchResponse2 = await fetch('http://localhost:3000/api/admin/auto-approval/switch-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetMode: 'BALANCE'
      })
    });
    
    if (switchResponse2.ok) {
      const switchData2 = await switchResponse2.json();
      if (switchData2.success) {
        console.log("✅ Mode switch completed successfully");
        console.log(`   ${switchData2.data.switchResult.oldMode} → ${switchData2.data.switchResult.newMode}`);
        console.log(`   Confidence: ${(switchData2.data.switchResult.confidence * 100).toFixed(1)}%`);
        if (switchData2.data.modeTransition) {
          console.log(`   Affected bookings: ${switchData2.data.modeTransition.pooledBookingsAffected}`);
        }
      } else {
        console.log("⚠️ Mode switch failed");
        console.log(`   Reason: ${switchData2.data.switchResult.reason}`);
      }
    } else {
      console.log("❌ Mode switch request failed");
    }

    console.log();

    // Test 8: Check Auto-Approval Logs
    console.log("📝 Test 8: Check Auto-Approval Logs");
    try {
      const logs = await prisma.autoApprovalLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      if (logs.length > 0) {
        console.log(`✅ Found ${logs.length} auto-approval log entries`);
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.eventType}: ${log.reason} (${log.timestamp.toISOString()})`);
        });
      } else {
        console.log("ℹ️ No auto-approval logs found");
      }
    } catch (error) {
      console.log("❌ Failed to check auto-approval logs:", error.message);
    }

    console.log();

    // Test 9: Final Status Check
    console.log("📊 Test 9: Final Status Check");
    const finalStatusResponse = await fetch('http://localhost:3000/api/admin/auto-approval/status');
    
    if (finalStatusResponse.ok) {
      const finalStatusData = await finalStatusResponse.json();
      console.log("✅ Final status check successful");
      console.log(`   Enabled: ${finalStatusData.data.enabled}`);
      console.log(`   Current Mode: ${finalStatusData.data.currentMode}`);
      console.log(`   Manual Override: ${finalStatusData.data.manualOverride.active ? 'Active' : 'Inactive'}`);
      console.log(`   Last Evaluation: ${finalStatusData.data.lastEvaluation || 'Never'}`);
      console.log(`   Recent Switches: ${finalStatusData.data.recentSwitches.length}`);
      
      if (finalStatusData.data.systemLoad) {
        console.log(`   System Load: ${finalStatusData.data.systemLoad.loadLevel}`);
        console.log(`   Pool Size: ${finalStatusData.data.systemLoad.poolSize}`);
      }
    } else {
      console.log("❌ Final status check failed");
    }

    console.log("\n🎉 Auto-Approval Function testing completed!");

  } catch (error) {
    console.error("❌ Test execution failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testAutoApprovalFunction().catch(console.error);
}

module.exports = { testAutoApprovalFunction };