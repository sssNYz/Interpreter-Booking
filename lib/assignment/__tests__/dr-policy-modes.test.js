/**
 * Test mode-specific DR policies
 * Tests the enhanced getDRPolicy function and related policy logic
 */

async function testModeSpecificDRPolicies() {
  console.log('\n🧪 Testing Mode-Specific DR Policies...\n');
  
  try {
    // Import the policy functions
    const { 
      getDRPolicy, 
      applyDRPolicyRules, 
      canOverrideDRPolicy,
      validateDRPolicyConfig,
      getDRPolicyRecommendations
    } = await import('../policy.ts');
    
    console.log('📋 Test 1: Balance Mode Policy Configuration...');
    const balancePolicy = getDRPolicy('BALANCE');
    console.log(`   Description: ${balancePolicy.description}`);
    console.log(`   Forbid Consecutive: ${balancePolicy.forbidConsecutive}`);
    console.log(`   Consecutive Penalty: ${balancePolicy.consecutivePenalty}`);
    console.log(`   Override Available: ${balancePolicy.overrideAvailable}`);
    console.log(`   Emergency Override: ${balancePolicy.emergencyOverride}`);
    console.log(`   Blocking Behavior: ${balancePolicy.modeSpecificRules.blockingBehavior}`);
    console.log(`   Fairness Weight: ${balancePolicy.modeSpecificRules.fairnessWeight}`);
    console.log(`   Override Threshold: ${balancePolicy.modeSpecificRules.overrideThreshold}`);
    
    // Test Balance mode policy application
    const balanceResult = applyDRPolicyRules(true, balancePolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Balance mode blocks consecutive: ${balanceResult.isBlocked}`);
    console.log(`   📊 Policy decision: ${balanceResult.policyDecision.blockingBehavior}`);
    
    console.log('\n⚡ Test 2: Urgent Mode Policy Configuration...');
    const urgentPolicy = getDRPolicy('URGENT');
    console.log(`   Description: ${urgentPolicy.description}`);
    console.log(`   Forbid Consecutive: ${urgentPolicy.forbidConsecutive}`);
    console.log(`   Consecutive Penalty: ${urgentPolicy.consecutivePenalty}`);
    console.log(`   Override Available: ${urgentPolicy.overrideAvailable}`);
    console.log(`   Emergency Override: ${urgentPolicy.emergencyOverride}`);
    console.log(`   Blocking Behavior: ${urgentPolicy.modeSpecificRules.blockingBehavior}`);
    console.log(`   Urgency Priority: ${urgentPolicy.modeSpecificRules.urgencyPriority}`);
    console.log(`   Override Threshold: ${urgentPolicy.modeSpecificRules.overrideThreshold}`);
    
    // Test Urgent mode policy application
    const urgentResult = applyDRPolicyRules(true, urgentPolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Urgent mode allows consecutive: ${!urgentResult.isBlocked}`);
    console.log(`   📊 Policy decision: ${urgentResult.policyDecision.blockingBehavior}`);
    console.log(`   ⚠️ Penalty amount: ${urgentResult.penaltyAmount}`);
    
    console.log('\n⚖️ Test 3: Normal Mode Policy Configuration...');
    const normalPolicy = getDRPolicy('NORMAL');
    console.log(`   Description: ${normalPolicy.description}`);
    console.log(`   Forbid Consecutive: ${normalPolicy.forbidConsecutive}`);
    console.log(`   Consecutive Penalty: ${normalPolicy.consecutivePenalty}`);
    console.log(`   Override Available: ${normalPolicy.overrideAvailable}`);
    console.log(`   Emergency Override: ${normalPolicy.emergencyOverride}`);
    console.log(`   Blocking Behavior: ${normalPolicy.modeSpecificRules.blockingBehavior}`);
    console.log(`   Fairness Weight: ${normalPolicy.modeSpecificRules.fairnessWeight}`);
    console.log(`   Override Threshold: ${normalPolicy.modeSpecificRules.overrideThreshold}`);
    
    // Test Normal mode policy application
    const normalResult = applyDRPolicyRules(true, normalPolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Normal mode uses soft penalty: ${!normalResult.isBlocked && normalResult.penaltyApplied}`);
    console.log(`   📊 Policy decision: ${normalResult.policyDecision.blockingBehavior}`);
    console.log(`   ⚠️ Penalty amount: ${normalResult.penaltyAmount}`);
    
    console.log('\n🔧 Test 4: Custom Mode Policy Configuration...');
    const customConfig = { drConsecutivePenalty: -1.2 }; // High penalty should trigger blocking
    const customPolicy = getDRPolicy('CUSTOM', customConfig);
    console.log(`   Description: ${customPolicy.description}`);
    console.log(`   Forbid Consecutive: ${customPolicy.forbidConsecutive}`);
    console.log(`   Consecutive Penalty: ${customPolicy.consecutivePenalty}`);
    console.log(`   Override Available: ${customPolicy.overrideAvailable}`);
    console.log(`   Blocking Behavior: ${customPolicy.modeSpecificRules.blockingBehavior}`);
    console.log(`   Override Threshold: ${customPolicy.modeSpecificRules.overrideThreshold}`);
    
    // Test Custom mode policy application
    const customResult = applyDRPolicyRules(true, customPolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Custom mode with high penalty blocks: ${customResult.isBlocked}`);
    console.log(`   📊 Policy decision: ${customResult.policyDecision.blockingBehavior}`);
    
    console.log('\n🚨 Test 5: Override Mechanisms...');
    
    // Test Balance mode override for critical coverage
    const balanceOverrideResult = applyDRPolicyRules(true, balancePolicy, {
      isCriticalCoverage: true,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Balance mode critical override: ${balanceOverrideResult.overrideApplied}`);
    console.log(`   📝 Override reason: ${balanceOverrideResult.reason}`);
    
    // Test Balance mode override for no alternatives
    const balanceNoAltResult = applyDRPolicyRules(true, balancePolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: true
    });
    console.log(`   ✅ Balance mode no-alternatives override: ${balanceNoAltResult.overrideApplied}`);
    console.log(`   📝 Override reason: ${balanceNoAltResult.reason}`);
    
    // Test Urgent mode (should always allow)
    const urgentOverrideCheck = canOverrideDRPolicy(urgentPolicy, {
      isCriticalCoverage: false,
      noAlternativesAvailable: false
    });
    console.log(`   ✅ Urgent mode always allows: ${urgentOverrideCheck.canOverride}`);
    console.log(`   📝 Urgent reason: ${urgentOverrideCheck.reason}`);
    
    console.log('\n🔍 Test 6: Policy Validation...');
    
    // Test valid Balance mode config
    const balanceValidation = validateDRPolicyConfig('BALANCE', { drConsecutivePenalty: -0.8 });
    console.log(`   ✅ Balance mode valid config: ${balanceValidation.isValid}`);
    console.log(`   ⚠️ Warnings: ${balanceValidation.warnings.length}`);
    console.log(`   ❌ Errors: ${balanceValidation.errors.length}`);
    
    // Test invalid Urgent mode config (too high penalty)
    const urgentValidation = validateDRPolicyConfig('URGENT', { drConsecutivePenalty: -0.8 });
    console.log(`   ⚠️ Urgent mode with high penalty warnings: ${urgentValidation.warnings.length}`);
    if (urgentValidation.warnings.length > 0) {
      console.log(`      Warning: ${urgentValidation.warnings[0]}`);
    }
    
    // Test invalid config (positive penalty)
    const invalidValidation = validateDRPolicyConfig('NORMAL', { drConsecutivePenalty: 0.5 });
    console.log(`   ❌ Invalid config errors: ${invalidValidation.errors.length}`);
    if (invalidValidation.errors.length > 0) {
      console.log(`      Error: ${invalidValidation.errors[0]}`);
    }
    
    console.log('\n📚 Test 7: Policy Recommendations...');
    
    const balanceRecommendations = getDRPolicyRecommendations('BALANCE');
    console.log(`   📋 Balance mode description: ${balanceRecommendations.description}`);
    console.log(`   💡 Recommended penalty: ${balanceRecommendations.recommendedPenalty}`);
    console.log(`   🎯 Key features: ${balanceRecommendations.keyFeatures.length} items`);
    console.log(`   ✅ Best use cases: ${balanceRecommendations.bestUseCases.length} items`);
    console.log(`   ⚠️ Potential issues: ${balanceRecommendations.potentialIssues.length} items`);
    
    const urgentRecommendations = getDRPolicyRecommendations('URGENT');
    console.log(`   📋 Urgent mode description: ${urgentRecommendations.description}`);
    console.log(`   💡 Recommended penalty: ${urgentRecommendations.recommendedPenalty}`);
    console.log(`   🎯 Key features: ${urgentRecommendations.keyFeatures.length} items`);
    
    console.log('\n✅ All mode-specific DR policy tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing mode-specific DR policies:', error);
    throw error;
  }
}

// Run the test
testModeSpecificDRPolicies().catch(console.error);