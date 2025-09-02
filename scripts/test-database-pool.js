const { PrismaClient, PoolStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabasePool() {
  console.log('🧪 Testing database-persistent pool implementation...');
  
  try {
    // Step 1: Test basic database pool operations
    console.log('\n1️⃣ Testing basic database pool operations...');
    
    // Create a test employee first
    const testEmployee = await prisma.employee.create({
      data: {
        empCode: 'TEST001',
        firstNameEn: 'Test',
        lastNameEn: 'User',
        email: 'test@example.com',
        isActive: true
      }
    });
    
    console.log(`✅ Created test employee: ${testEmployee.empCode}`);
    
    // Create a test booking
    const testBooking = await prisma.bookingPlan.create({
      data: {
        ownerEmpCode: 'TEST001',
        ownerGroup: 'software',
        meetingRoom: 'TEST_ROOM',
        meetingType: 'General',
        timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour meeting
        bookingStatus: 'waiting'
      }
    });
    
    console.log(`✅ Created test booking: ${testBooking.bookingId}`);
    
    // Step 2: Test adding to database pool
    console.log('\n2️⃣ Testing adding to database pool...');
    const deadlineTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    
    await prisma.bookingPlan.update({
      where: { bookingId: testBooking.bookingId },
      data: {
        poolStatus: PoolStatus.waiting,
        poolEntryTime: new Date(),
        poolDeadlineTime: deadlineTime,
        poolProcessingAttempts: 0
      }
    });
    
    console.log('✅ Added booking to database pool');
    
    // Step 3: Test checking if in pool
    console.log('\n3️⃣ Testing pool queries...');
    const pooledBooking = await prisma.bookingPlan.findFirst({
      where: {
        bookingId: testBooking.bookingId,
        poolStatus: { not: null }
      }
    });
    
    console.log(`✅ Is in pool check: ${pooledBooking ? 'found' : 'not found'}`);
    
    // Step 4: Test getting pool statistics
    console.log('\n4️⃣ Testing pool statistics...');
    const totalInPool = await prisma.bookingPlan.count({
      where: { poolStatus: { not: null } }
    });
    
    const readyForProcessing = await prisma.bookingPlan.count({
      where: {
        OR: [
          {
            poolStatus: PoolStatus.waiting,
            poolDeadlineTime: { lte: new Date() }
          },
          { poolStatus: PoolStatus.ready }
        ]
      }
    });
    
    console.log(`✅ Pool stats - Total: ${totalInPool}, Ready: ${readyForProcessing}`);
    
    // Step 5: Test marking as processing
    console.log('\n5️⃣ Testing status updates...');
    await prisma.bookingPlan.update({
      where: { bookingId: testBooking.bookingId },
      data: {
        poolStatus: PoolStatus.processing,
        poolProcessingAttempts: { increment: 1 }
      }
    });
    
    console.log('✅ Marked as processing');
    
    // Step 6: Test getting ready entries with deadline
    console.log('\n6️⃣ Testing deadline queries...');
    const now = new Date();
    const deadlineEntries = await prisma.bookingPlan.findMany({
      where: {
        poolStatus: { in: [PoolStatus.waiting, PoolStatus.ready] },
        poolDeadlineTime: { lte: now }
      }
    });
    
    console.log(`✅ Deadline entries: ${deadlineEntries.length}`);
    
    // Step 7: Test pool indexes performance
    console.log('\n7️⃣ Testing pool indexes...');
    const start = Date.now();
    
    await prisma.bookingPlan.findMany({
      where: {
        poolStatus: PoolStatus.waiting,
        poolDeadlineTime: { lte: new Date() }
      },
      orderBy: [
        { poolDeadlineTime: 'asc' },
        { poolEntryTime: 'asc' }
      ]
    });
    
    const queryTime = Date.now() - start;
    console.log(`✅ Pool query completed in ${queryTime}ms`);
    
    // Step 8: Clean up test data
    console.log('\n8️⃣ Cleaning up test data...');
    await prisma.bookingPlan.update({
      where: { bookingId: testBooking.bookingId },
      data: {
        poolStatus: null,
        poolEntryTime: null,
        poolDeadlineTime: null,
        poolProcessingAttempts: 0
      }
    });
    
    await prisma.bookingPlan.delete({
      where: { bookingId: testBooking.bookingId }
    });
    
    await prisma.employee.delete({
      where: { empCode: 'TEST001' }
    });
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 Database-persistent pool test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database pool test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabasePool()
  .then(() => {
    console.log('✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });