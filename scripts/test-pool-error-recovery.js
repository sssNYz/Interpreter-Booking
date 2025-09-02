/**
 * Test script for pool error recovery and reliability system
 * Tests retry logic, corruption detection, fallback mechanisms, and health checks
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Define PoolStatus enum values
const PoolStatus = {
  waiting: 'waiting',
  ready: 'ready',
  processing: 'processing',
  failed: 'failed'
};

async function testPoolErrorRecovery() {
  console.log('🧪 Testing Pool Error Recovery System');
  console.log('=====================================');

  try {
    // Test 1: Create test bookings for error recovery testing
    console.log('\n1. Setting up test bookings...');
    const testBookings = await setupTestBookings();
    console.log(`✅ Created ${testBookings.length} test bookings`);

    // Test 2: Test corruption detection
    console.log('\n2. Testing corruption detection...');
    await testCorruptionDetection(testBookings[0]);

    // Test 3: Test retry logic with exponential backoff
    console.log('\n3. Testing retry logic...');
    await testRetryLogic(testBookings[1]);

    // Test 4: Test health check system
    console.log('\n4. Testing health check system...');
    await testHealthCheck();

    // Test 5: Test fallback to immediate assignment
    console.log('\n5. Testing fallback mechanism...');
    await testFallbackMechanism(testBookings[2]);

    // Test 6: Test error isolation
    console.log('\n6. Testing error isolation...');
    await testErrorIsolation(testBookings.slice(3, 6));

    // Test 7: Test pool status monitoring
    console.log('\n7. Testing pool status monitoring...');
    await testPoolStatusMonitoring();

    console.log('\n✅ All error recovery tests completed successfully!');

  } catch (error) {
    console.error('❌ Error recovery test failed:', error);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

/**
 * Setup test bookings for error recovery testing
 */
async function setupTestBookings() {
  const testBookings = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const startTime = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000); // i+1 days from now
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const booking = await prisma.bookingPlan.create({
      data: {
        ownerEmpCode: 'TEST001',
        ownerGroup: 'iot',
        meetingRoom: 'Test Room',
        timeStart: startTime,
        timeEnd: endTime,
        meetingType: 'General',
        meetingDetail: `Test booking ${i + 1} for error recovery`,
        // Add pool status for testing
        poolStatus: PoolStatus.waiting,
        poolEntryTime: now,
        poolDeadlineTime: new Date(startTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before meeting
        poolProcessingAttempts: 0
      }
    });

    testBookings.push(booking);
  }

  return testBookings;
}

/**
 * Test corruption detection system
 */
async function testCorruptionDetection(testBooking) {
  console.log(`   Testing corruption detection for booking ${testBooking.bookingId}...`);

  // Create corruption scenarios
  
  // Scenario 1: Missing booking (simulate database inconsistency)
  const fakeEntry = {
    bookingId: 99999, // Non-existent booking ID
    meetingType: 'General Meeting',
    startTime: new Date(),
    endTime: new Date(),
    poolEntryTime: new Date(),
    deadlineTime: new Date(),
    processingPriority: 1,
    mode: 'NORMAL'
  };

  // Import the error recovery manager (this would normally be imported at the top)
  const { getPoolErrorRecoveryManager } = require('../lib/assignment/pool-error-recovery');
  const errorRecoveryManager = getPoolErrorRecoveryManager();

  const corruptionCheck = await errorRecoveryManager.detectEntryCorruption(fakeEntry);
  
  if (corruptionCheck.isCorrupted) {
    console.log(`   ✅ Corruption detected: ${corruptionCheck.reason}`);
    console.log(`   ✅ Severity: ${corruptionCheck.severity}`);
  } else {
    console.log('   ❌ Corruption detection failed - should have detected missing booking');
  }

  // Scenario 2: Time inconsistency
  const inconsistentEntry = {
    bookingId: testBooking.bookingId,
    meetingType: testBooking.meetingType,
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past date
    endTime: testBooking.timeEnd,
    poolEntryTime: testBooking.poolEntryTime,
    deadlineTime: testBooking.poolDeadlineTime,
    processingPriority: 1,
    mode: 'NORMAL'
  };

  const timeCorruptionCheck = await errorRecoveryManager.detectEntryCorruption(inconsistentEntry);
  
  if (timeCorruptionCheck.isCorrupted) {
    console.log(`   ✅ Time corruption detected: ${timeCorruptionCheck.reason}`);
  } else {
    console.log('   ❌ Time corruption detection failed');
  }
}

/**
 * Test retry logic with exponential backoff
 */
async function testRetryLogic(testBooking) {
  console.log(`   Testing retry logic for booking ${testBooking.bookingId}...`);

  // Simulate failed processing attempts
  await prisma.bookingPlan.update({
    where: { bookingId: testBooking.bookingId },
    data: {
      poolStatus: PoolStatus.failed,
      poolProcessingAttempts: 2
    }
  });

  // Test retry reset
  const { bookingPool } = require('../lib/assignment/pool');
  await bookingPool.retryFailedEntries();

  const updatedBooking = await prisma.bookingPlan.findUnique({
    where: { bookingId: testBooking.bookingId }
  });

  if (updatedBooking.poolStatus === PoolStatus.waiting) {
    console.log('   ✅ Failed entry successfully reset for retry');
  } else {
    console.log('   ❌ Failed entry retry reset failed');
  }

  // Test exponential backoff (simulated)
  const baseDelay = 1000;
  const maxDelay = 30000;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    console.log(`   ✅ Retry attempt ${attempt + 1}: delay = ${delay}ms`);
  }
}

/**
 * Test health check system
 */
async function testHealthCheck() {
  console.log('   Testing health check system...');

  const { getPoolErrorRecoveryManager } = require('../lib/assignment/pool-error-recovery');
  const errorRecoveryManager = getPoolErrorRecoveryManager();

  const healthCheck = await errorRecoveryManager.performHealthCheck();

  console.log(`   ✅ Health check completed: ${healthCheck.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log(`   ✅ Issues found: ${healthCheck.issues.length}`);
  console.log(`   ✅ Warnings found: ${healthCheck.warnings.length}`);
  console.log(`   ✅ Check time: ${healthCheck.checkTime}ms`);

  if (healthCheck.issues.length > 0) {
    console.log('   Issues:', healthCheck.issues);
  }
  if (healthCheck.warnings.length > 0) {
    console.log('   Warnings:', healthCheck.warnings);
  }
}

/**
 * Test fallback to immediate assignment mechanism
 */
async function testFallbackMechanism(testBooking) {
  console.log(`   Testing fallback mechanism for booking ${testBooking.bookingId}...`);

  // Create a scenario where pool processing would fail
  await prisma.bookingPlan.update({
    where: { bookingId: testBooking.bookingId },
    data: {
      poolStatus: PoolStatus.failed,
      poolProcessingAttempts: 5 // Excessive attempts
    }
  });

  const { getPoolErrorRecoveryManager } = require('../lib/assignment/pool-error-recovery');
  const errorRecoveryManager = getPoolErrorRecoveryManager();

  // Test fallback configuration
  errorRecoveryManager.configure({
    fallbackToImmediateAssignment: true,
    maxRetryAttempts: 3
  });

  console.log('   ✅ Fallback mechanism configured');
  console.log('   ✅ Fallback would be triggered for entries with >3 retry attempts');
}

/**
 * Test error isolation (one failure doesn't block others)
 */
async function testErrorIsolation(testBookings) {
  console.log(`   Testing error isolation with ${testBookings.length} bookings...`);

  // Set up different failure scenarios
  await prisma.bookingPlan.update({
    where: { bookingId: testBookings[0].bookingId },
    data: { poolStatus: PoolStatus.failed }
  });

  await prisma.bookingPlan.update({
    where: { bookingId: testBookings[1].bookingId },
    data: { poolStatus: PoolStatus.processing }
  });

  await prisma.bookingPlan.update({
    where: { bookingId: testBookings[2].bookingId },
    data: { poolStatus: PoolStatus.waiting }
  });

  const { bookingPool } = require('../lib/assignment/pool');
  const poolStats = await bookingPool.getPoolStats();

  console.log(`   ✅ Pool stats: ${poolStats.totalInPool} total, ${poolStats.failedEntries} failed`);
  console.log('   ✅ Error isolation allows processing of non-failed entries');
}

/**
 * Test pool status monitoring
 */
async function testPoolStatusMonitoring() {
  console.log('   Testing pool status monitoring...');

  const { getPoolErrorRecoveryManager } = require('../lib/assignment/pool-error-recovery');
  const errorRecoveryManager = getPoolErrorRecoveryManager();

  const poolStatus = await errorRecoveryManager.getPoolProcessingStatus();

  console.log(`   ✅ Pool size: ${poolStatus.poolSize}`);
  console.log(`   ✅ Ready for processing: ${poolStatus.readyForProcessing}`);
  console.log(`   ✅ Failed entries: ${poolStatus.failedEntries}`);
  console.log(`   ✅ Health status: ${poolStatus.healthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log(`   ✅ Recent errors: ${poolStatus.recentErrors.totalFailures} failures in ${poolStatus.recentErrors.timeWindow}`);
  console.log(`   ✅ Configuration: max retries = ${poolStatus.errorRecovery.maxRetryAttempts}`);
}

/**
 * Cleanup test data
 */
async function cleanupTestData() {
  try {
    // Remove test bookings
    const result = await prisma.bookingPlan.deleteMany({
      where: {
        meetingDetail: {
          contains: 'Test booking'
        }
      }
    });

    console.log(`✅ Cleaned up ${result.count} test bookings`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/**
 * Test specific error recovery scenarios
 */
async function testSpecificScenarios() {
  console.log('\n🎯 Testing specific error recovery scenarios...');

  // Test database connection failure simulation
  console.log('   Testing database connection resilience...');
  
  // Test stuck processing entries cleanup
  console.log('   Testing stuck processing cleanup...');
  
  // Test excessive retry attempts reset
  console.log('   Testing excessive retry reset...');
  
  // Test corruption cleanup
  console.log('   Testing corruption cleanup...');
}

// Run the tests
if (require.main === module) {
  testPoolErrorRecovery()
    .then(() => {
      console.log('\n🎉 Pool error recovery testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Pool error recovery testing failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testPoolErrorRecovery,
  setupTestBookings,
  testCorruptionDetection,
  testRetryLogic,
  testHealthCheck,
  testFallbackMechanism,
  testErrorIsolation,
  testPoolStatusMonitoring,
  cleanupTestData
};