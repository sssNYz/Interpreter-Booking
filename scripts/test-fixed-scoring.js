import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFixedScoring() {
  try {
    console.log('🧪 Testing fixed scoring algorithm...');
    
    // Create a test booking
    const testBooking = await prisma.bookingPlan.create({
      data: {
        ownerEmpCode: "TEST001",
        ownerGroup: "software",
        meetingRoom: "Test Room",
        meetingType: "General",
        meetingDetail: "Fixed scoring test",
        timeStart: new Date("2025-08-29 14:00:00"),
        timeEnd: new Date("2025-08-29 15:00:00"),
        bookingStatus: "waiting",
      }
    });
    
    console.log('✅ Test booking created:', testBooking.bookingId);
    
    // Now manually trigger auto-assignment
    console.log('\n🚀 Manually triggering auto-assignment...');
    
    // Import and run the auto-assignment
    const { run } = await import('../lib/assignment/run.js');
    const result = await run(testBooking.bookingId);
    
    console.log('\n📊 Auto-assignment result:', result);
    
    // Check if it was assigned
    if (result.status === 'assigned') {
      console.log(`✅ Successfully assigned interpreter: ${result.interpreterId}`);
      
      // Verify in database
      const updated = await prisma.bookingPlan.findUnique({
        where: { bookingId: testBooking.bookingId },
        select: { 
          interpreterEmpCode: true,
          bookingStatus: true 
        }
      });
      console.log('🔍 Database verification:', updated);
      
      // Verify business rule
      if (updated.interpreterEmpCode && updated.bookingStatus === 'approve') {
        console.log('✅ Business rule verified: bookingStatus correctly set to "approve"');
      }
      
      // Check which interpreter was chosen and why
      if (result.breakdown) {
        console.log('\n📋 Score breakdown:');
        result.breakdown.forEach(candidate => {
          console.log(`   ${candidate.empCode}:`);
          console.log(`     Hours: ${candidate.currentHours}`);
          console.log(`     Eligible: ${candidate.eligible}`);
          if (candidate.scores) {
            console.log(`     Fairness: ${candidate.scores.fairness?.toFixed(3) || 'N/A'}`);
            console.log(`     Total: ${candidate.scores.total?.toFixed(3) || 'N/A'}`);
          }
          if (candidate.reason) {
            console.log(`     Reason: ${candidate.reason}`);
          }
        });
      }
    } else {
      console.log(`❌ Auto-assignment failed: ${result.reason}`);
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.bookingPlan.delete({
      where: { bookingId: testBooking.bookingId }
    });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFixedScoring();
