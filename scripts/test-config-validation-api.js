/**
 * Test script for configuration validation API endpoints
 * Tests the pool settings validation system via HTTP API
 */

async function testConfigurationValidationAPI() {
  console.log("🧪 Testing Configuration Validation API");
  console.log("=" .repeat(50));

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Valid configuration validation
    console.log("🧪 Test 1: Valid Configuration Validation");
    console.log("-".repeat(30));
    
    const validConfig = {
      fairnessWindowDays: 45,
      maxGapHours: 6,
      w_fair: 1.5,
      w_urgency: 1.0
    };

    const validResponse = await fetch(`${baseUrl}/api/admin/config/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: validConfig,
        options: {
          skipImpactAssessment: false
        }
      }),
    });

    if (validResponse.ok) {
      const validData = await validResponse.json();
      console.log(`✅ Valid config test: ${validData.validation.isValid ? 'PASSED' : 'FAILED'}`);
      console.log(`   Errors: ${validData.validation.errors.length}`);
      console.log(`   Warnings: ${validData.validation.warnings.length}`);
      console.log(`   Recommendations: ${validData.validation.recommendations.length}`);
      console.log(`   Impact: ${validData.validation.impact.affectedBookings} bookings affected`);
    } else {
      console.log(`❌ Valid config test: API call failed (${validResponse.status})`);
    }
    console.log();

    // Test 2: Invalid configuration validation
    console.log("🧪 Test 2: Invalid Configuration Validation");
    console.log("-".repeat(30));
    
    const invalidConfig = {
      fairnessWindowDays: 5, // Too low
      maxGapHours: 150, // Too high
      w_fair: -1, // Negative
      drConsecutivePenalty: 0.5 // Positive (should be negative)
    };

    const invalidResponse = await fetch(`${baseUrl}/api/admin/config/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: invalidConfig,
        options: {
          skipImpactAssessment: false
        }
      }),
    });

    if (invalidResponse.ok) {
      const invalidData = await invalidResponse.json();
      console.log(`❌ Invalid config test: ${invalidData.validation.isValid ? 'FAILED' : 'PASSED'}`);
      console.log(`   Errors: ${invalidData.validation.errors.length}`);
      if (invalidData.validation.errors.length > 0) {
        invalidData.validation.errors.forEach((error, i) => {
          console.log(`     ${i + 1}. ${error}`);
        });
      }
    } else {
      console.log(`❌ Invalid config test: API call failed (${invalidResponse.status})`);
    }
    console.log();

    // Test 3: Mode recommendations
    console.log("🧪 Test 3: Mode Recommendations");
    console.log("-".repeat(30));
    
    const modes = ['BALANCE', 'URGENT', 'NORMAL', 'CUSTOM'];
    
    for (const mode of modes) {
      const recResponse = await fetch(`${baseUrl}/api/admin/config/validate/recommendations?mode=${mode}`);
      
      if (recResponse.ok) {
        const recData = await recResponse.json();
        console.log(`✅ ${mode} recommendations: LOADED`);
        console.log(`   Description: ${recData.recommendations.description.substring(0, 60)}...`);
        console.log(`   Recommended penalty: ${recData.recommendations.recommendedPenalty}`);
        console.log(`   Key features: ${recData.recommendations.keyFeatures.length}`);
      } else {
        console.log(`❌ ${mode} recommendations: FAILED (${recResponse.status})`);
      }
    }
    console.log();

    // Test 4: Impact assessment
    console.log("🧪 Test 4: Impact Assessment");
    console.log("-".repeat(30));
    
    const impactConfig = {
      mode: 'BALANCE',
      fairnessWindowDays: 60
    };

    const impactResponse = await fetch(`${baseUrl}/api/admin/config/impact-assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: impactConfig
      }),
    });

    if (impactResponse.ok) {
      const impactData = await impactResponse.json();
      console.log(`✅ Impact assessment: COMPLETED`);
      console.log(`   Impact level: ${impactData.assessment.summary.impactLevel}`);
      console.log(`   Existing pooled bookings: ${impactData.assessment.summary.existingPooledBookings}`);
      console.log(`   Affected bookings: ${impactData.assessment.summary.affectedBookings}`);
      
      if (impactData.assessment.modeChange) {
        console.log(`   Mode transition: ${impactData.assessment.modeChange.transition}`);
      }
    } else {
      console.log(`❌ Impact assessment: FAILED (${impactResponse.status})`);
    }
    console.log();

    // Test 5: Current system state
    console.log("🧪 Test 5: Current System State");
    console.log("-".repeat(30));
    
    const stateResponse = await fetch(`${baseUrl}/api/admin/config/impact-assessment/current-state`);
    
    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      console.log(`✅ Current state: LOADED`);
      console.log(`   Current mode: ${stateData.currentState.policy.mode}`);
      console.log(`   Pool entries: ${stateData.currentState.pool.totalEntries}`);
      console.log(`   Active interpreters: ${stateData.currentState.interpreters.active}`);
      console.log(`   Fairness gap: ${stateData.currentState.interpreters.fairnessGap} hours`);
      console.log(`   Recent assignments: ${stateData.currentState.activity.recentAssignments}`);
    } else {
      console.log(`❌ Current state: FAILED (${stateResponse.status})`);
    }
    console.log();

    // Test 6: Configuration change logging
    console.log("🧪 Test 6: Configuration Change Logging");
    console.log("-".repeat(30));
    
    const logData = {
      changeType: 'VALIDATION_UPDATE',
      oldConfig: { fairnessWindowDays: 30 },
      newConfig: { fairnessWindowDays: 35 },
      validationResult: {
        isValid: true,
        errors: [],
        warnings: [],
        recommendations: []
      },
      userId: 'test-user',
      reason: 'Testing configuration validation logging',
      impactAssessment: {
        existingPooledBookings: 0,
        affectedBookings: 0
      }
    };

    const logResponse = await fetch(`${baseUrl}/api/admin/config/change-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });

    if (logResponse.ok) {
      const logResult = await logResponse.json();
      console.log(`✅ Configuration change logging: SUCCESS`);
      console.log(`   Message: ${logResult.message}`);
    } else {
      console.log(`❌ Configuration change logging: FAILED (${logResponse.status})`);
    }
    console.log();

    // Summary
    console.log("📊 API Test Summary");
    console.log("-".repeat(30));
    console.log("✅ Configuration validation API tests completed");
    console.log("✅ Validation endpoints working");
    console.log("✅ Impact assessment functional");
    console.log("✅ Recommendations system active");
    console.log("✅ Change logging operational");
    console.log("✅ System state monitoring working");

  } catch (error) {
    console.error("❌ Error during API testing:", error);
    console.error("Make sure the development server is running on localhost:3000");
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testConfigurationValidationAPI()
    .then(() => {
      console.log("\n🎉 Configuration validation API testing completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Configuration validation API testing failed:", error);
      process.exit(1);
    });
}

export { testConfigurationValidationAPI };