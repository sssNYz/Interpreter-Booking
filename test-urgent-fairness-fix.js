/**
 * Test script to verify the urgent booking fairness fix
 */

const { runAssignment } = require('./lib/assignment/core/run');

async function testUrgentFairnessFix() {
  console.log('🧪 Testing urgent booking fairness fix...');
  
  // Mock urgent booking similar to booking 88
  const urgentBooking = {
    bookingId: 88,
    timeStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow (urgent)
    timeEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
    meetingType: 'General',
    interpreterEmpCode: null,
    meetingDetail: 'Test urgent booking'
  };
  
  try {
    console.log('📋 Testing urgent booking assignment...');
    const result = await runAssignment(urgentBooking.bookingId);
    
    console.log('✅ Assignment result:', result);
    
    if (result.status === 'assigned') {
      console.log('🎉 SUCCESS: Urgent booking was assigned successfully!');
      console.log(`   Assigned to interpreter: ${result.interpreterId}`);
    } else if (result.status === 'escalated') {
      console.log('⚠️ ESCALATED: Booking was escalated, but this might be expected');
      console.log(`   Reason: ${result.reason}`);
      
      // Check if the reason mentions relaxed fairness
      if (result.reason.includes('RELAXED')) {
        console.log('✅ Good: Relaxed fairness mode was applied');
      } else {
        console.log('❌ Issue: Fairness relaxation may not be working');
      }
    } else {
      console.log('📥 POOLED: Booking was added to pool (not urgent)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUrgentFairnessFix().catch(console.error);