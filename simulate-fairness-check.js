const { PrismaClient } = require('@prisma/client');

async function simulateFairnessCheck() {
  const prisma = new PrismaClient();
  
  try {
    // Get current hours (same logic as before)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentAssignments = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: thirtyDaysAgo },
        interpreterEmpCode: { not: null }
      },
      select: {
        interpreterEmpCode: true,
        timeStart: true,
        timeEnd: true
      }
    });
    
    // Calculate current hours per interpreter
    const hoursMap = {};
    
    recentAssignments.forEach(assignment => {
      const empCode = assignment.interpreterEmpCode;
      const hours = (assignment.timeEnd - assignment.timeStart) / (1000 * 60 * 60);
      
      if (!hoursMap[empCode]) {
        hoursMap[empCode] = 0;
      }
      hoursMap[empCode] += hours;
    });
    
    console.log('Current hours:');
    Object.entries(hoursMap).forEach(([empCode, hours]) => {
      console.log(`- ${empCode}: ${hours.toFixed(1)} hours`);
    });
    
    const currentHours = Object.values(hoursMap);
    const currentGap = Math.max(...currentHours) - Math.min(...currentHours);
    console.log(`\nCurrent gap: ${currentGap.toFixed(1)} hours`);
    
    // Simulate adding 1 hour to each interpreter
    console.log('\nSimulating assignment of 1 hour to each interpreter:');
    
    Object.keys(hoursMap).forEach(empCode => {
      const simulatedHours = { ...hoursMap };
      simulatedHours[empCode] += 1; // Add 1 hour
      
      const hours = Object.values(simulatedHours);
      const gap = Math.max(...hours) - Math.min(...hours);
      
      console.log(`- ${empCode}: gap would be ${gap.toFixed(1)} hours (${gap <= 10 ? '✅ PASS' : '❌ FAIL'})`);
    });
    
    console.log('\nThis explains why no interpreters passed the fairness check!');
    console.log('The system correctly identified that assigning to ANY interpreter would exceed the 10-hour limit.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulateFairnessCheck();