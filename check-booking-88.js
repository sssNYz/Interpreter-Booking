const { PrismaClient } = require('@prisma/client');

async function checkBooking88() {
  const prisma = new PrismaClient();
  
  try {
    // Find booking 88
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId: 88 },
      select: {
        bookingId: true,
        timeStart: true,
        timeEnd: true,
        meetingType: true,
        interpreterEmpCode: true,
        bookingStatus: true,
        createdAt: true
      }
    });
    
    if (!booking) {
      console.log('❌ Booking 88 not found');
      return;
    }
    
    console.log('📋 Booking 88 details:');
    console.log(`- Time: ${booking.timeStart} to ${booking.timeEnd}`);
    console.log(`- Meeting Type: ${booking.meetingType}`);
    console.log(`- Status: ${booking.bookingStatus}`);
    console.log(`- Assigned to: ${booking.interpreterEmpCode || 'None'}`);
    console.log(`- Created: ${booking.createdAt}`);
    
    // Check for conflicts with active interpreters
    const activeInterpreters = ['00003', '00001'];
    
    console.log('\n🔍 Checking for conflicts with active interpreters:');
    
    for (const empCode of activeInterpreters) {
      const conflicts = await prisma.bookingPlan.findMany({
        where: {
          interpreterEmpCode: empCode,
          bookingStatus: { in: ['approve', 'waiting'] },
          OR: [
            {
              // Booking starts during our time
              timeStart: {
                gte: booking.timeStart,
                lt: booking.timeEnd
              }
            },
            {
              // Booking ends during our time
              timeEnd: {
                gt: booking.timeStart,
                lte: booking.timeEnd
              }
            },
            {
              // Booking completely contains our time
              timeStart: { lte: booking.timeStart },
              timeEnd: { gte: booking.timeEnd }
            }
          ]
        },
        select: {
          bookingId: true,
          timeStart: true,
          timeEnd: true,
          meetingType: true,
          bookingStatus: true
        }
      });
      
      console.log(`- ${empCode}: ${conflicts.length} conflicts`);
      conflicts.forEach(conflict => {
        console.log(`  * Booking ${conflict.bookingId}: ${conflict.timeStart} to ${conflict.timeEnd} (${conflict.bookingStatus})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBooking88();