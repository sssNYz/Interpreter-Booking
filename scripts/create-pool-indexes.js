const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createPoolIndexes() {
  console.log('🔧 Creating pool database indexes...');
  
  const indexes = [
    { name: 'idx_pool_status', sql: 'CREATE INDEX idx_pool_status ON BOOKING_PLAN(POOL_STATUS)' },
    { name: 'idx_pool_deadline', sql: 'CREATE INDEX idx_pool_deadline ON BOOKING_PLAN(POOL_DEADLINE_TIME)' },
    { name: 'idx_pool_ready', sql: 'CREATE INDEX idx_pool_ready ON BOOKING_PLAN(POOL_STATUS, POOL_DEADLINE_TIME)' },
    { name: 'idx_pool_entry_time', sql: 'CREATE INDEX idx_pool_entry_time ON BOOKING_PLAN(POOL_ENTRY_TIME)' },
    { name: 'idx_pool_processing', sql: 'CREATE INDEX idx_pool_processing ON BOOKING_PLAN(POOL_STATUS, POOL_ENTRY_TIME)' }
  ];
  
  for (const index of indexes) {
    try {
      await prisma.$executeRawUnsafe(index.sql);
      console.log(`✅ Created index: ${index.name}`);
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log(`ℹ️ Index ${index.name} already exists, skipping`);
      } else {
        console.error(`❌ Failed to create index ${index.name}:`, error.message);
        // Continue with other indexes rather than failing completely
      }
    }
  }
  
  console.log('✅ Pool index creation process completed');
}

// Run the script
createPoolIndexes()
  .then(() => {
    console.log('🎉 Pool index creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Pool index creation failed:', error);
    process.exit(1);
  });