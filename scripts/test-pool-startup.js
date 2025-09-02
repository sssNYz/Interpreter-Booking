const { PrismaClient, PoolStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPoolStartup() {
  console.log('🧪 Testing pool startup and migration system...');
  
  try {
    // Step 1: Test database indexes creation
    console.log('\n1️⃣ Testing database indexes creation...');
    
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
        console.log(`✅ Created/verified index: ${index.name}`);
      } catch (error) {
        if (error.message.includes('Duplicate key name')) {
          console.log(`ℹ️ Index ${index.name} already exists`);
        } else {
          console.log(`⚠️ Index ${index.name} issue: ${error.message}`);
        }
      }
    }
    
    // Step 2: Test pool data cleanup
    console.log('\n2️⃣ Testing pool data cleanup...');
    
    // Reset any stuck processing entries
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const stuckProcessingResult = await prisma.bookingPlan.updateMany({
      where: {
        poolStatus: PoolStatus.processing,
        updatedAt: { lt: oneHourAgo }
      },
      data: {
        poolStatus: PoolStatus.waiting
      }
    });
    
    console.log(`✅ Reset ${stuckProcessingResult.count} stuck processing entries`);
    
    // Clean up pool entries for completed bookings
    const cleanupResult = await prisma.bookingPlan.updateMany({
      where: {
        poolStatus: { not: null },
        bookingStatus: { in: ['approve', 'cancel', 'complet'] }
      },
      data: {
        poolStatus: null,
        poolEntryTime: null,
        poolDeadlineTime: null,
        poolProcessingAttempts: 0
      }
    });
    
    console.log(`✅ Cleaned up ${cleanupResult.count} completed/cancelled pool entries`);
    
    // Step 3: Test pool data validation
    console.log('\n3️⃣ Testing pool data validation...');
    
    const invalidEntries = await prisma.bookingPlan.findMany({
      where: {
        poolStatus: { not: null },
        OR: [
          { poolEntryTime: null },
          { poolDeadlineTime: null }
        ]
      },
      select: { bookingId: true, poolStatus: true }
    });
    
    console.log(`✅ Found ${invalidEntries.length} invalid pool entries`);
    
    if (invalidEntries.length > 0) {
      for (const entry of invalidEntries) {
        await prisma.bookingPlan.update({
          where: { bookingId: entry.bookingId },
          data: {
            poolEntryTime: new Date(),
            poolDeadlineTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
      }
      console.log(`✅ Fixed ${invalidEntries.length} invalid pool entries`);
    }
    
    // Step 4: Test pool statistics
    console.log('\n4️⃣ Testing pool statistics...');
    
    const poolStats = await prisma.bookingPlan.groupBy({
      by: ['poolStatus'],
      where: { poolStatus: { not: null } },
      _count: true
    });
    
    console.log('📊 Pool statistics:');
    poolStats.forEach(stat => {
      console.log(`  - ${stat.poolStatus}: ${stat._count} entries`);
    });
    
    // Step 5: Test migration status
    console.log('\n5️⃣ Testing migration status...');
    
    const totalPoolEntries = await prisma.bookingPlan.count({
      where: { poolStatus: { not: null } }
    });
    
    const oldestEntry = await prisma.bookingPlan.findFirst({
      where: { poolStatus: { not: null } },
      orderBy: { poolEntryTime: 'asc' },
      select: { poolEntryTime: true }
    });
    
    const newestEntry = await prisma.bookingPlan.findFirst({
      where: { poolStatus: { not: null } },
      orderBy: { poolEntryTime: 'desc' },
      select: { poolEntryTime: true }
    });
    
    const avgAttempts = await prisma.bookingPlan.aggregate({
      where: { poolStatus: { not: null } },
      _avg: { poolProcessingAttempts: true }
    });
    
    console.log('📊 Migration status:');
    console.log(`  - Total pool entries: ${totalPoolEntries}`);
    console.log(`  - Oldest entry: ${oldestEntry?.poolEntryTime?.toISOString() || 'None'}`);
    console.log(`  - Newest entry: ${newestEntry?.poolEntryTime?.toISOString() || 'None'}`);
    console.log(`  - Average processing attempts: ${avgAttempts._avg.poolProcessingAttempts?.toFixed(2) || '0'}`);
    
    // Step 6: Test performance queries
    console.log('\n6️⃣ Testing performance queries...');
    
    const start = Date.now();
    
    // Test ready for assignment query
    const readyEntries = await prisma.bookingPlan.findMany({
      where: {
        OR: [
          {
            poolStatus: PoolStatus.waiting,
            poolDeadlineTime: { lte: new Date() }
          },
          { poolStatus: PoolStatus.ready }
        ]
      },
      orderBy: [
        { poolDeadlineTime: 'asc' },
        { poolEntryTime: 'asc' }
      ]
    });
    
    const queryTime = Date.now() - start;
    console.log(`✅ Ready entries query: ${readyEntries.length} entries in ${queryTime}ms`);
    
    // Test deadline entries query
    const start2 = Date.now();
    const deadlineEntries = await prisma.bookingPlan.findMany({
      where: {
        poolStatus: { in: [PoolStatus.waiting, PoolStatus.ready] },
        poolDeadlineTime: { lte: new Date() }
      },
      orderBy: { poolDeadlineTime: 'asc' }
    });
    
    const queryTime2 = Date.now() - start2;
    console.log(`✅ Deadline entries query: ${deadlineEntries.length} entries in ${queryTime2}ms`);
    
    console.log('\n🎉 Pool startup and migration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Pool startup test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPoolStartup()
  .then(() => {
    console.log('✅ All startup tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Startup test failed:', error);
    process.exit(1);
  });