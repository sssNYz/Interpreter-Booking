const { PrismaClient } = require('@prisma/client');

async function testSystemHours() {
  const prisma = new PrismaClient();
  
  try {
    // Get active interpreters (same as system)
    const interpreters = await prisma.employee.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            roleCode: "INTERPRETER"
          }
        }
      },
      select: {
        empCode: true
      }
    });
    
    console.log('Active interpreters:', interpreters.map(i => i.empCode));
    
    // Use the same logic as getInterpreterHours
    const fairnessWindowDays = 14; // From config
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - fairnessWindowDays);
    
    console.log(`\nUsing fairness window: ${fairnessWindowDays} days`);
    console.log(`Cutoff date (createdAt): ${cutoffDate}`);
    
    // Query bookings the same way as the system
    const bookings = await prisma.bookingPlan.findMany({
      where: {
        AND: [
          { createdAt: { gte: cutoffDate } },
          { bookingStatus: { not: 'cancel' } },
          { interpreterEmpCode: { not: null } }
        ]
      },
      select: {
        interpreterEmpCode: true,
        timeStart: true,
        timeEnd: true,
        createdAt: true,
        bookingId: true
      }
    });
    
    console.log(`\nFound ${bookings.length} bookings created in last ${fairnessWindowDays} days:`);
    
    // Calculate hours per interpreter (same as system)
    const hoursMap = {};
    
    for (const booking of bookings) {
      if (!booking.interpreterEmpCode) continue;
      
      const start = new Date(booking.timeStart);
      const end = new Date(booking.timeEnd);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      console.log(`- Booking ${booking.bookingId}: ${booking.interpreterEmpCode}, ${durationHours.toFixed(1)}h (created: ${booking.createdAt.toISOString().split('T')[0]})`);
      
      hoursMap[booking.interpreterEmpCode] = (hoursMap[booking.interpreterEmpCode] || 0) + durationHours;
    }
    
    console.log('\nSystem-calculated hours:');
    Object.entries(hoursMap).forEach(([empCode, hours]) => {
      console.log(`- ${empCode}: ${hours.toFixed(1)} hours`);
    });
    
    // Calculate gap
    const hours = Object.values(hoursMap);
    if (hours.length > 0) {
      const maxHours = Math.max(...hours);
      const minHours = Math.min(...hours);
      const gap = maxHours - minHours;
      
      console.log(`\nSystem fairness gap: ${gap.toFixed(1)} hours (max: ${maxHours.toFixed(1)}, min: ${minHours.toFixed(1)})`);
      
      // Simulate assignment
      console.log('\nSimulating assignment (system method):');
      interpreters.forEach(interpreter => {
        const simulatedHours = { ...hoursMap };
        simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1;
        
        const simHours = Object.values(simulatedHours);
        const simGap = Math.max(...simHours) - Math.min(...simHours);
        
        console.log(`- ${interpreter.empCode}: gap would be ${simGap.toFixed(1)}h (${simGap <= 10 ? '✅ PASS' : '❌ FAIL'})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSystemHours();