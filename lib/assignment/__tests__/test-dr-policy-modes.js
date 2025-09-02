// Simple test for mode-specific DR policies
async function testDRPolicyModes() {
  console.log('🧪 Testing Mode-Specific DR Policies...');
  
  try {
    // Import the policy functions
    const { getDRPolicy, applyDRPolicyRules, canOverrideDRPolicy } = await import('../policy.ts');
    
    console.log('\n📋 Test 1: Balance Mode Policy...');
    const balancePolicy = getDRPolicy('BALANCE');
    console.log(`   Description: ${balancePolicy.description}`);
    console.log(`   Forbid Consecutive: ${balancePolicy.forbidConsecutive}`);
    console.log(`   Penalty: ${balancePolicy.consecutivePenalty}`);
    console.log(`   Override Available: ${balancePolicy.overrideAvailable}`);
    
    // Test Balance mode blocking
    const balanceResult = applyDRPolicyRules(true, balancePolicy);
    console.log(`   Consecutive Result: Blocked=${balanceResult.isBlocked}, Penalty=${balanceResult.penaltyApplied}`);
    console.log(`   Reason: ${balanceResult.reason}`);
    
    if (balancePolicy.forbidConsecutive && balanceResult.isBlocked) {
      console.log('✅ Balance mode correctly blocks consecutive assignments');
    } else {
      console.log('❌ Balance mode blocking issue');
    }

    console.log('\n⚡ Test 2: Urgent Mode Policy...');
    const urgentPolicy = getDRPolicy('URGENT');
    console.log(`   Description: ${urgentPolicy.description}`);
    console.log(`   Forbid Consecutive: ${urgentPolicy.forbidConsecutive}`);
    console.log(`   Penalty: ${urgentPolicy.consecutivePenalty}`);
    console.log(`   Include Pending: ${urgentPolicy.includePendingInGlobal}`);
    
    // Test Urgent mode penalty only
    const urgentResult = applyDRPolicyRules(true, urgentPolicy);
    console.log(`   Consecutive Result: Blocked=${urgentResult.isBlocked}, Penalty=${urgentResult.penaltyApplied}`);
    console.log(`   Reason: ${urgentResult.reason}`);
    
    if (!urgentPolicy.forbidConsecutive && !urgentResult.isBlocked && urgentResult.penaltyApplied) {
      console.log('✅ Urgent mode correctly applies penalty without blocking');
    } else {
      console.log('❌ Urgent mode penalty issue');
    }

    console.log('\n⚖️ Test 3: Normal Mode Policy...');
    const normalPolicy = getDRPolicy('NORMAL');
    console.log(`   Description: ${normalPolicy.description}`);
    console.log(`   Forbid Consecutive: ${normalPolicy.forbidConsecutive}`);
    console.log(`   Penalty: ${normalPolicy.consecutivePenalty}`);
    
    // Test Normal mode penalty
    const normalResult = applyDRPolicyRules(true, normalPolicy);
    console.log(`   Consecutive Result: Blocked=${normalResult.isBlocked}, Penalty=${normalResult.penaltyApplied}`);
    console.log(`   Reason: ${normalResult.reason}`);
    
    if (!normalPolicy.forbidConsecutive && !normalResult.isBlocked && normalResult.penaltyApplied) {
      console.log('✅ Normal mode correctly applies penalty without blocking');
    } else {
      console.log('❌ Normal mode penalty issue');
    }

    console.log('\n🔧 Test 4: Custom Mode Policy...');
    const customConfig = { drConsecutivePenalty: -1.2 }; // High penalty should trigger blocking
    const customPolicy = getDRPolicy('CUSTOM', customConfig);
    console.log(`   Description: ${customPolicy.description}`);
    console.log(`   Forbid Consecutive: ${customPolicy.forbidConsecutive}`);
    console.log(`   Penalty: ${customPolicy.consecutivePenalty}`);
    
    // Test Custom mode with high penalty
    const customResult = applyDRPolicyRules(true, customPolicy);
    console.log(`   Consecutive Result: Blocked=${customResult.isBlocked}, Penalty=${customResult.penaltyApplied}`);
    console.log(`   Reason: ${customResult.reason}`);
    
    if (customPolicy.forbidConsecutive && customResult.isBlocked) {
      console.log('✅ Custom mode correctly blocks with high penalty setting');
    } else {
      console.log('❌ Custom mode blocking issue');
    }

    console.log('\n🚨 Test 5: Emergency Override...');
    // Test emergency override for Balance mode
    const emergencyResult = applyDRPolicyRules(true, balancePolicy, {
      isCriticalCoverage: true,
      noAlternativesAvailable: true
    });
    console.log(`   Emergency Override: Blocked=${emergencyResult.isBlocked}, Override=${emergencyResult.overrideApplied}`);
    console.log(`   Reason: ${emergencyResult.reason}`);
    
    if (!emergencyResult.isBlocked && emergencyResult.overrideApplied) {
      console.log('✅ Emergency override correctly unblocks critical coverage');
    } else {
      console.log('❌ Emergency override issue');
    }

    console.log('\n🔍 Test 6: Override Availability Check...');
    const balanceOverride = canOverrideDRPolicy(balancePolicy, false);
    const urgentOverride = canOverrideDRPolicy(urgentPolicy, false);
    
    console.log(`   Balance Override Available: ${balanceOverride.canOverride} (${balanceOverride.reason})`);
    console.log(`   Urgent Override Available: ${urgentOverride.canOverride} (${urgentOverride.reason})`);
    
    if (balanceOverride.canOverride && urgentOverride.canOverride) {
      console.log('✅ Override availability checks working correctly');
    } else {
      console.log('❌ Override availability issue');
    }

    console.log('\n🎉 All DR policy mode tests completed!');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testDRPolicyModes().catch(console.error);