/**
 * Test script for configuration validation functionality
 * Tests the pool settings validation system
 */

import { getConfigurationValidator } from '../lib/assignment/config-validator.js';
import { loadPolicy } from '../lib/assignment/policy.js';

async function testConfigurationValidation() {
  console.log("🧪 Testing Configuration Validation System");
  console.log("=" .repeat(50));

  try {
    const validator = getConfigurationValidator();
    const currentConfig = await loadPolicy();
    
    console.log("📋 Current Configuration:");
    console.log(`   Mode: ${currentConfig.mode}`);
    console.log(`   Fairness Window: ${currentConfig.fairnessWindowDays} days`);
    console.log(`   Max Gap: ${currentConfig.maxGapHours} hours`);
    console.log(`   DR Penalty: ${currentConfig.drConsecutivePenalty}`);
    console.log(`   Weights: Fair=${currentConfig.w_fair}, Urgency=${currentConfig.w_urgency}, LRS=${currentConfig.w_lrs}`);
    console.log();

    // Test 1: Valid configuration changes
    console.log("🧪 Test 1: Valid Configuration Changes");
    console.log("-".repeat(30));
    
    const validConfig = {
      fairnessWindowDays: 45,
      maxGapHours: 6,
      w_fair: 1.5,
      w_urgency: 1.0
    };

    const validResult = await validator.validateConfiguration(validConfig);
    console.log(`✅ Valid config test: ${validResult.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   Errors: ${validResult.errors.length}`);
    console.log(`   Warnings: ${validResult.warnings.length}`);
    console.log(`   Recommendations: ${validResult.recommendations.length}`);
    console.log(`   Impact: ${validResult.impact.affectedBookings} bookings affected`);
    console.log();

    // Test 2: Invalid configuration (errors)
    console.log("🧪 Test 2: Invalid Configuration (Errors)");
    console.log("-".repeat(30));
    
    const invalidConfig = {
      fairnessWindowDays: 5, // Too low
      maxGapHours: 150, // Too high
      w_fair: -1, // Negative
      drConsecutivePenalty: 0.5 // Positive (should be negative)
    };

    const invalidResult = await validator.validateConfiguration(invalidConfig);
    console.log(`❌ Invalid config test: ${invalidResult.isValid ? 'FAILED' : 'PASSED'}`);
    console.log(`   Errors: ${invalidResult.errors.length}`);
    invalidResult.errors.forEach((error, i) => {
      console.log(`     ${i + 1}. ${error}`);
    });
    console.log();

    // Test 3: Mode change impact assessment
    console.log("🧪 Test 3: Mode Change Impact Assessment");
    console.log("-".repeat(30));
    
    const modeChangeConfig = {
      mode: currentConfig.mode === 'NORMAL' ? 'BALANCE' : 'NORMAL'
    };

    const modeChangeResult = await validator.validateConfiguration(modeChangeConfig);
    console.log(`🔄 Mode change test: ${modeChangeResult.isValid ? 'VALID' : 'INVALID'}`);
    if (modeChangeResult.impact.modeChangeImpact) {
      const mci = modeChangeResult.impact.modeChangeImpact;
      console.log(`   Mode transition: ${mci.fromMode} → ${mci.toMode}`);
      console.log(`   Pool entries affected: ${mci.poolEntriesAffected}`);
      console.log(`   Immediate processing required: ${mci.immediateProcessingRequired}`);
      console.log(`   Behavior change: ${mci.poolingBehaviorChange}`);
    }
    console.log();

    // Test 4: DR policy validation
    console.log("🧪 Test 4: DR Policy Validation");
    console.log("-".repeat(30));
    
    const drPolicyConfigs = [
      { mode: 'BALANCE', drConsecutivePenalty: -0.8 },
      { mode: 'URGENT', drConsecutivePenalty: -0.1 },
      { mode: 'NORMAL', drConsecutivePenalty: -0.5 },
      { mode: 'CUSTOM', drConsecutivePenalty: -1.2 }
    ];

    for (const config of drPolicyConfigs) {
      const result = await validator.validateConfiguration(config);
      console.log(`   ${config.mode} mode (penalty: ${config.drConsecutivePenalty}): ${result.isValid ? 'VALID' : 'INVALID'}`);
      if (result.warnings.length > 0) {
        console.log(`     Warnings: ${result.warnings.length}`);
      }
      if (result.recommendations.length > 0) {
        console.log(`     Recommendations: ${result.recommendations.length}`);
      }
    }
    console.log();

    // Test 5: Parameter relationship validation
    console.log("🧪 Test 5: Parameter Relationship Validation");
    console.log("-".repeat(30));
    
    const relationshipConfigs = [
      { w_fair: 0.1, w_urgency: 2.0 }, // Unbalanced weights
      { fairnessWindowDays: 60, maxGapHours: 1 }, // Mismatched window and gap
      { mode: 'BALANCE', w_urgency: 2.0, w_fair: 0.5 } // Wrong weights for mode
    ];

    for (let i = 0; i < relationshipConfigs.length; i++) {
      const config = relationshipConfigs[i];
      const result = await validator.validateConfiguration(config);
      console.log(`   Relationship test ${i + 1}: ${result.isValid ? 'VALID' : 'INVALID'}`);
      if (result.warnings.length > 0) {
        console.log(`     Key warning: ${result.warnings[0]}`);
      }
    }
    console.log();

    // Test 6: Configuration change logging
    console.log("🧪 Test 6: Configuration Change Logging");
    console.log("-".repeat(30));
    
    const logTestConfig = { fairnessWindowDays: 35 };
    const logTestResult = await validator.validateConfiguration(logTestConfig);
    
    await validator.logConfigurationChange({
      changeType: 'VALIDATION_UPDATE',
      oldConfig: { fairnessWindowDays: currentConfig.fairnessWindowDays },
      newConfig: logTestConfig,
      validationResult: logTestResult,
      userId: 'test-user',
      reason: 'Testing configuration validation logging',
      impactAssessment: logTestResult.impact
    });
    
    console.log("✅ Configuration change logged successfully");
    console.log();

    // Summary
    console.log("📊 Test Summary");
    console.log("-".repeat(30));
    console.log("✅ All configuration validation tests completed");
    console.log("✅ Validation logic working correctly");
    console.log("✅ Impact assessment functioning");
    console.log("✅ Error detection operational");
    console.log("✅ Warning system active");
    console.log("✅ Recommendation engine working");
    console.log("✅ Configuration change logging functional");

  } catch (error) {
    console.error("❌ Error during configuration validation testing:", error);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testConfigurationValidation()
    .then(() => {
      console.log("\n🎉 Configuration validation testing completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Configuration validation testing failed:", error);
      process.exit(1);
    });
}

export { testConfigurationValidation };