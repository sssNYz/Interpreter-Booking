/**
 * Migration script to remove minAdvanceDays parameter from existing configurations
 * Run this after deploying the code changes to clean up any existing data
 */

const { PrismaClient } = require('@prisma/client');

async function removeMinAdvanceDaysFromConfigs() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Starting minAdvanceDays removal migration...');
    
    // Get all existing auto assignment configs
    const configs = await prisma.autoAssignmentConfig.findMany();
    
    console.log(`📊 Found ${configs.length} existing configurations`);
    
    let updatedCount = 0;
    
    for (const config of configs) {
      // Check if the config has minAdvanceDays property (it might be stored as JSON or separate column)
      let needsUpdate = false;
      let updateData = {};
      
      // If minAdvanceDays exists as a separate column, it would be in the config object
      if (config.minAdvanceDays !== undefined) {
        console.log(`⚠️ Found minAdvanceDays in config ${config.id}: ${config.minAdvanceDays}`);
        needsUpdate = true;
        // Note: We can't actually remove the column here if it exists in the schema
        // This would require a proper Prisma migration
        console.log('   → Column removal requires Prisma schema migration');
      }
      
      if (needsUpdate) {
        console.log(`✅ Config ${config.id} flagged for manual review`);
        updatedCount++;
      }
    }
    
    console.log(`\n📋 Migration Summary:`);
    console.log(`   Total configs checked: ${configs.length}`);
    console.log(`   Configs with minAdvanceDays: ${updatedCount}`);
    
    if (updatedCount > 0) {
      console.log(`\n⚠️ Action Required:`);
      console.log(`   1. Create a Prisma migration to remove minAdvanceDays column if it exists`);
      console.log(`   2. Run: npx prisma migrate dev --name remove-min-advance-days`);
      console.log(`   3. Update the schema.prisma file to remove minAdvanceDays field`);
    } else {
      console.log(`\n✅ No minAdvanceDays references found in database`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  removeMinAdvanceDaysFromConfigs()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { removeMinAdvanceDaysFromConfigs };