const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkConfig() {
  try {
    console.log('🔍 Checking auto-assignment configuration...');
    
    const config = await prisma.autoAssignmentConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (config) {
      console.log('✅ Current configuration:');
      console.log(`   ID: ${config.id}`);
      console.log(`   Auto-assign enabled: ${config.autoAssignEnabled}`);
      console.log(`   Fairness window days: ${config.fairnessWindowDays}`);
      console.log(`   Max gap hours: ${config.maxGapHours}`);
      console.log(`   Min advance days: ${config.minAdvanceDays}`);
      console.log(`   W_fair: ${config.w_fair}`);
      console.log(`   W_urgency: ${config.w_urgency}`);
      console.log(`   W_lrs: ${config.w_lrs}`);
      console.log(`   Updated at: ${config.updatedAt}`);
    } else {
      console.log('❌ No configuration found');
    }
    
    // Check if there are multiple configs
    const allConfigs = await prisma.autoAssignmentConfig.findMany();
    console.log(`\n📊 Total config records: ${allConfigs.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
