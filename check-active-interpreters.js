const { PrismaClient } = require('@prisma/client');

async function checkActiveInterpreters() {
  const prisma = new PrismaClient();
  
  try {
    // Get active interpreters (same as the assignment system)
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
        empCode: true,
        firstNameEn: true,
        lastNameEn: true,
        isActive: true
      }
    });
    
    console.log(`Found ${interpreters.length} active interpreters:`);
    interpreters.forEach(i => console.log(`- ${i.empCode}: ${i.firstNameEn} ${i.lastNameEn} (active: ${i.isActive})`));
    
    // Check if 00002 is in the active list
    const empCodes = interpreters.map(i => i.empCode);
    console.log('\nActive interpreter codes:', empCodes);
    
    if (!empCodes.includes('00002')) {
      console.log('❌ 00002 is NOT in the active interpreter list - this explains the discrepancy!');
    }
    
    // Now simulate fairness check with only active interpreters
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentAssignments = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: thirtyDaysAgo },
        interpreterEmpCode: { in: empCodes } // Only active interpreters
      },
      select: {
        interpreterEmpCode: true,
        timeStart: true,
        timeEnd: true
      }
    });
    
    // Calculate hours for active interpreters only
    const hoursMap = {};
    empCodes.forEach(code => hoursMap[code] = 0); // Initialize all active interpreters
    
    recentAssignments.forEach(assignment => {
      const empCode = assignment.interpreterEmpCode;
      const hours = (assignment.timeEnd - assignment.timeStart) / (1000 * 60 * 60);
      hoursMap[empCode] += hours;
    });
    
    console.log('\nHours for ACTIVE interpreters only:');
    Object.entries(hoursMap).forEach(([empCode, hours]) => {
      console.log(`- ${empCode}: ${hours.toFixed(1)} hours`);
    });
    
    // Simulate fairness check
    console.log('\nSimulating fairness check for active interpreters:');
    empCodes.forEach(empCode => {
      const simulatedHours = { ...hoursMap };
      simulatedHours[empCode] += 1; // Add 1 hour
      
      const hours = Object.values(simulatedHours);
      const gap = Math.max(...hours) - Math.min(...hours);
      
      console.log(`- ${empCode}: gap would be ${gap.toFixed(1)} hours (${gap <= 10 ? '✅ PASS' : '❌ FAIL'})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkActiveInterpreters();