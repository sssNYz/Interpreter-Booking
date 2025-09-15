const { PrismaClient } = require('@prisma/client');

async function checkConfig() {
  const prisma = new PrismaClient();
  
  try {
    const config = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log('Current auto-assignment config:');
    console.log(JSON.stringify(config, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();