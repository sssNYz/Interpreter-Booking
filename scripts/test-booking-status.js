const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBookingStatusRule() {
  try {
    console.log('🧪 Testing business rule: bookingStatus must be "approve" when interpreterEmpCode is assigned...');
    
    // Create a test booking
    const testBooking = await prisma.bookingPlan.create({
      data: {
        ownerEmpCode: "TEST001",
        ownerGroup: "software",
        meetingRoom: "Test Room",
        meetingType: "General",
        meetingDetail: "Business rule test",
        timeStart: new Date("2025-08-29 14:00:00"),
        timeEnd: new Date("2025-08-29 15:00:00"),
        bookingStatus: "waiting",
        // No interpreter specified - should trigger auto-assignment
      }
    });
    
    console.log('✅ Test booking created:', testBooking);
    console.log(`📋 Booking ID: ${testBooking.bookingId}`);
    console.log(`🔍 Initial status: ${testBooking.bookingStatus}`);
    console.log(`🔍 Interpreter: ${testBooking.interpreterEmpCode || 'Not assigned yet'}`);
    
    // Now manually trigger auto-assignment
    console.log('\n🚀 Manually triggering auto-assignment...');
    
    // Import and run the auto-assignment
    const { run } = await import('../lib/assignment/run.js');
    const result = await run(testBooking.bookingId);
    
    console.log('📊 Auto-assignment result:', result);
    
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
      
      // Verify business rule: when interpreterEmpCode is assigned, bookingStatus should be "approve"
      if (updated.interpreterEmpCode && updated.bookingStatus === 'approve') {
        console.log('✅ Business rule verified: bookingStatus correctly set to "approve" when interpreter assigned');
        console.log(`   interpreterEmpCode: ${updated.interpreterEmpCode}`);
        console.log(`   bookingStatus: ${updated.bookingStatus}`);
      } else {
        console.log('❌ Business rule violation: bookingStatus not set to "approve" when interpreter assigned');
        console.log(`   Expected: bookingStatus = "approve", Got: ${updated.bookingStatus}`);
        console.log(`   interpreterEmpCode: ${updated.interpreterEmpCode}`);
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

testBookingStatusRule();
