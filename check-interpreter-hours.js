const { PrismaClient } = require('@prisma/client');

async function checkInterpreterHours() {
  const prisma = new PrismaClient();
  
  try {
    // Get active interpreters
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
        lastNameEn: true
      }
    });
    
    console.log(`Found ${interpreters.length} active interpreters:`);
    interpreters.forEach(i => console.log(`- ${i.empCode}: ${i.firstNameEn} ${i.lastNameEn}`));
    
    // Get recent assignments to calculate hours
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
    
    console.log(`\nFound ${recentAssignments.length} recent assignments`);
    
    // Calculate hours per interpreter
    const hoursMap = {};
    
    recentAssignments.forEach(assignment => {
      const empCode = assignment.interpreterEmpCode;
      const hours = (assignment.timeEnd - assignment.timeStart) / (1000 * 60 * 60);
      
      if (!hoursMap[empCode]) {
        hoursMap[empCode] = 0;
      }
      hoursMap[empCode] += hours;
    });
    
    console.log('\nHours per interpreter (last 30 days):');
    const hours = Object.values(hoursMap);
    const maxHours = Math.max(...hours);
    const minHours = Math.min(...hours);
    const gap = maxHours - minHours;
    
    Object.entries(hoursMap).forEach(([empCode, hours]) => {
      console.log(`- ${empCode}: ${hours.toFixed(1)} hours`);
    });
    
    console.log(`\nFairness gap: ${gap.toFixed(1)} hours (max: ${maxHours.toFixed(1)}, min: ${minHours.toFixed(1)})`);
    console.log(`Current maxGapHours limit: 10 hours`);
    
    if (gap > 10) {
      console.log('❌ Current gap exceeds maxGapHours limit - this explains the assignment failure');
    } else {
      console.log('✅ Current gap is within maxGapHours limit');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInterpreterHours();