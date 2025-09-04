/**
 * Test the urgent booking fairness fix
 */

async function testFairnessLogic() {
  console.log('🧪 Testing fairness logic fix...');
  
  // Simulate the exact scenario from the log
  const policy = {
    maxGapHours: 10,
    mode: 'URGENT'
  };
  
  const isUrgent = true; // Booking 88 was detected as urgent
  
  // Current hours for active interpreters (from our analysis)
  const preHoursSnapshot = {
    '00003': 14.0,
    '00001': 11.5
  };
  
  const availableInterpreters = [
    { empCode: '00003' },
    { empCode: '00001' }
  ];
  
  console.log('📊 Current hours:', preHoursSnapshot);
  console.log('⚡ Booking is urgent:', isUrgent);
  console.log('🔧 Policy maxGapHours:', policy.maxGapHours);
  
  // Apply the fix logic
  const effectiveMaxGapHours = isUrgent ? policy.maxGapHours * 2 : policy.maxGapHours;
  const fairnessMode = isUrgent ? 'RELAXED' : 'STRICT';
  
  console.log(`\n🔍 Fairness check mode: ${fairnessMode} (maxGap: ${effectiveMaxGapHours}h)`);
  
  const eligibleIds = [];
  
  for (const interpreter of availableInterpreters) {
    const simulatedHours = { ...preHoursSnapshot };
    simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1; // assume 1 hour
    
    const hours = Object.values(simulatedHours);
    const gap = Math.max(...hours) - Math.min(...hours);
    
    console.log(`- ${interpreter.empCode}: simulated gap = ${gap.toFixed(1)}h (${gap <= effectiveMaxGapHours ? '✅ PASS' : '❌ FAIL'})`);
    
    if (gap <= effectiveMaxGapHours) {
      eligibleIds.push(interpreter.empCode);
    }
  }
  
  console.log(`\n📋 Eligible interpreters: ${eligibleIds.length > 0 ? eligibleIds.join(', ') : 'None'}`);
  
  if (eligibleIds.length === 0) {
    if (isUrgent) {
      console.log('⚠️ Urgent booking: No interpreters meet relaxed fairness criteria, bypassing fairness for coverage');
      eligibleIds.push(...availableInterpreters.map(i => i.empCode));
      console.log(`📋 After bypass: ${eligibleIds.join(', ')}`);
    } else {
      console.log('❌ No interpreters meet fairness criteria - assignment would escalate');
    }
  }
  
  if (eligibleIds.length > 0) {
    console.log('🎉 SUCCESS: Assignment should proceed with eligible interpreters!');
  } else {
    console.log('❌ FAILURE: Assignment would still escalate');
  }
}

testFairnessLogic().catch(console.error);