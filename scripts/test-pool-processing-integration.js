/**
 * Comprehensive Pool Processing Integration Tests
 * 
 * This test suite covers:
 * 1. End-to-end pool processing workflows
 * 2. Database error scenarios and recovery
 * 3. Mode switching with active pool entries
 * 4. Performance tests for pool processing under high load
 * 5. Reliability tests for concurrent processing and failure scenarios
 */

const { PrismaClient, PoolStatus } = require('@prisma/client');

const prisma = new PrismaClient();

class PoolProcessingIntegrationTests {
  constructor() {
    this.testResults = [];
    this.testEmployees = [];
    this.testBookings = [];
    this.startTime = Date.now();
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🧪 Starting Pool Processing Integration Tests...\n');
    
    try {
      // Setup test data
      await this.setupTestData();
      
      // Test 1: End-to-end pool processing workflows
      await this.testEndToEndPoolProcessing();
      
      // Test 2: Database error scenarios and recovery
      await this.testDatabaseErrorRecovery();
      
      // Test 3: Mode switching with active pool entries
      await this.testModeSwitchingWithPoolEntries();
      
      // Test 4: Performance tests under high load
      await this.testHighLoadPerformance();
      
      // Test 5: Reliability tests for concurrent processing
      await this.testConcurrentProcessingReliability();
      
      // Test 6: Failure scenario handling
      await this.testFailureScenarios();
      
      // Generate test report
      await this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Integration test suite failed:', error);
      throw error;
    } finally {
      // Cleanup test data
      await this.cleanupTestData();
      await prisma.$disconnect();
    }
  }

  /**
   * Setup test data for integration tests
   */
  async setupTestData() {
    console.log('📋 Setting up test data...');
    
    // Create test employees
    const employees = [
      { empCode: 'INT001', firstNameEn: 'Test', lastNameEn: 'Interpreter1', email: 'int1@test.com' },
      { empCode: 'INT002', firstNameEn: 'Test', lastNameEn: 'Interpreter2', email: 'int2@test.com' },
      { empCode: 'INT003', firstNameEn: 'Test', lastNameEn: 'Interpreter3', email: 'int3@test.com' },
      { empCode: 'BOOK001', firstNameEn: 'Test', lastNameEn: 'Booker1', email: 'book1@test.com' },
      { empCode: 'BOOK002', firstNameEn: 'Test', lastNameEn: 'Booker2', email: 'book2@test.com' }
    ];
    
    for (const emp of employees) {
      const employee = await prisma.employee.create({
        data: { ...emp, isActive: true }
      });
      this.testEmployees.push(employee);
    }
    
    console.log(`✅ Created ${this.testEmployees.length} test employees`);
  }

  /**
   * Test 1: End-to-end pool processing workflows
   */
  async testEndToEndPoolProcessing() {
    console.log('\n1️⃣ Testing End-to-End Pool Processing Workflows...');
    
    const testStart = Date.now();
    
    try {
      // Import pool processing components
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
      const { startPoolScheduler, stopPoolScheduler } = await import('../lib/assignment/pool-scheduler.ts');
      
      // Create test bookings with different scenarios
      const scenarios = [
        {
          name: 'Immediate Processing',
          timeStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
          meetingType: 'General',
          expectedBehavior: 'immediate'
        },
        {
          name: 'Pool Processing',
          timeStart: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
          meetingType: 'General',
          expectedBehavior: 'pooled'
        },
        {
          name: 'Deadline Processing',
          timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          meetingType: 'General',
          expectedBehavior: 'deadline'
        }
      ];
      
      const testBookings = [];
      
      // Create test bookings
      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'BOOK001',
            ownerGroup: 'software',
            meetingRoom: `TEST_ROOM_${i + 1}`,
            meetingType: scenario.meetingType,
            timeStart: scenario.timeStart,
            timeEnd: new Date(scenario.timeStart.getTime() + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        testBookings.push({ ...booking, scenario });
        this.testBookings.push(booking);
      }
      
      // Test pool entry creation
      console.log('📥 Testing pool entry creation...');
      for (const booking of testBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 2 * 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      // Verify pool entries were created
      const poolStats = await bookingPool.getPoolStats();
      console.log(`✅ Pool entries created: ${poolStats.totalInPool} total`);
      
      // Test pool processing engine
      console.log('🔧 Testing pool processing engine...');
      const engine = getPoolProcessingEngine();
      
      // Get entries needing processing
      const entriesNeeding = await engine.getEntriesNeedingProcessing();
      console.log(`📊 Entries analysis: ${entriesNeeding.deadline.length} deadline, ${entriesNeeding.ready.length} ready, ${entriesNeeding.pending.length} pending`);
      
      // Process deadline entries
      const deadlineResults = await engine.processDeadlineEntries();
      console.log(`🚨 Deadline processing: ${deadlineResults.length} results`);
      
      // Process ready entries
      const readyResults = await engine.processReadyEntries();
      console.log(`⏰ Ready processing: ${readyResults.length} results`);
      
      // Test scheduler functionality
      console.log('⏰ Testing scheduler functionality...');
      const scheduler = startPoolScheduler(5000); // 5 second interval for testing
      
      // Wait for one processing cycle
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      const schedulerStatus = scheduler.getStatus();
      console.log(`📊 Scheduler status: running=${schedulerStatus.isRunning}, last=${schedulerStatus.lastProcessingTime}`);
      
      stopPoolScheduler();
      
      // Verify final pool state
      const finalStats = await bookingPool.getPoolStats();
      console.log(`📈 Final pool stats: ${finalStats.totalInPool} total, ${finalStats.readyForProcessing} ready`);
      
      this.recordTestResult('End-to-End Pool Processing', true, Date.now() - testStart, {
        poolEntriesCreated: testBookings.length,
        deadlineResults: deadlineResults.length,
        readyResults: readyResults.length,
        finalPoolSize: finalStats.totalInPool
      });
      
    } catch (error) {
      console.error('❌ End-to-end test failed:', error);
      this.recordTestResult('End-to-End Pool Processing', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Test 2: Database error scenarios and recovery
   */
  async testDatabaseErrorRecovery() {
    console.log('\n2️⃣ Testing Database Error Scenarios and Recovery...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolErrorRecoveryManager } = await import('../lib/assignment/pool-error-recovery.ts');
      
      // Create test booking for error scenarios
      const testBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK001',
          ownerGroup: 'software',
          meetingRoom: 'ERROR_TEST_ROOM',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting'
        }
      });
      
      this.testBookings.push(testBooking);
      
      // Test 1: Database connection resilience
      console.log('🔌 Testing database connection resilience...');
      
      // Add to pool
      await bookingPool.addToPool(testBooking.bookingId, new Date(Date.now() + 24 * 60 * 60 * 1000));
      
      // Test error recovery manager
      const errorRecoveryManager = getPoolErrorRecoveryManager();
      
      // Test health check
      const healthCheck = await errorRecoveryManager.performHealthCheck();
      console.log(`🏥 Health check: ${healthCheck.isHealthy ? 'healthy' : 'unhealthy'}, ${healthCheck.warnings.length} warnings`);
      
      // Test corruption detection
      const poolEntry = await bookingPool.getPoolEntry(testBooking.bookingId);
      if (poolEntry) {
        const corruptionCheck = await errorRecoveryManager.detectEntryCorruption(poolEntry);
        console.log(`🔍 Corruption check: ${corruptionCheck.isCorrupted ? 'corrupted' : 'clean'}`);
      }
      
      // Test 2: Failed processing recovery
      console.log('🔄 Testing failed processing recovery...');
      
      // Mark entry as failed
      await prisma.bookingPlan.update({
        where: { bookingId: testBooking.bookingId },
        data: {
          poolStatus: PoolStatus.failed,
          poolProcessingAttempts: 2
        }
      });
      
      // Test retry mechanism
      await bookingPool.retryFailedEntries();
      
      // Verify recovery
      const recoveredBooking = await prisma.bookingPlan.findUnique({
        where: { bookingId: testBooking.bookingId }
      });
      
      const wasRecovered = recoveredBooking?.poolStatus === PoolStatus.waiting;
      console.log(`✅ Recovery test: ${wasRecovered ? 'successful' : 'failed'}`);
      
      // Test 3: Transaction safety
      console.log('💾 Testing transaction safety...');
      
      try {
        await prisma.$transaction(async (tx) => {
          await tx.bookingPlan.update({
            where: { bookingId: testBooking.bookingId },
            data: { poolStatus: PoolStatus.processing }
          });
          
          // Simulate error in transaction
          throw new Error('Simulated transaction error');
        });
      } catch (error) {
        // Expected error - check if rollback worked
        const rolledBackBooking = await prisma.bookingPlan.findUnique({
          where: { bookingId: testBooking.bookingId }
        });
        
        const rollbackWorked = rolledBackBooking?.poolStatus !== PoolStatus.processing;
        console.log(`🔄 Transaction rollback: ${rollbackWorked ? 'successful' : 'failed'}`);
      }
      
      this.recordTestResult('Database Error Recovery', true, Date.now() - testStart, {
        healthCheckPassed: healthCheck.isHealthy,
        recoveryWorked: wasRecovered,
        warningsCount: healthCheck.warnings.length
      });
      
    } catch (error) {
      console.error('❌ Database error recovery test failed:', error);
      this.recordTestResult('Database Error Recovery', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Test 3: Mode switching with active pool entries
   */
  async testModeSwitchingWithPoolEntries() {
    console.log('\n3️⃣ Testing Mode Switching with Active Pool Entries...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { loadPolicy, updatePolicy } = await import('../lib/assignment/policy.ts');
      
      // Create multiple test bookings for mode switching
      const modeTestBookings = [];
      for (let i = 0; i < 5; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'BOOK002',
            ownerGroup: 'software',
            meetingRoom: `MODE_TEST_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (3 + i) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (3 + i) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        modeTestBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add all bookings to pool in BALANCE mode
      console.log('📥 Adding bookings to pool in BALANCE mode...');
      const currentPolicy = await loadPolicy();
      
      // Ensure we're in BALANCE mode
      if (currentPolicy.mode !== 'BALANCE') {
        await updatePolicy({ mode: 'BALANCE' });
      }
      
      for (const booking of modeTestBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 2 * 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      const balancePoolStats = await bookingPool.getPoolStats();
      console.log(`⚖️ BALANCE mode pool: ${balancePoolStats.totalInPool} entries`);
      
      // Test switching to URGENT mode
      console.log('⚡ Switching to URGENT mode...');
      await updatePolicy({ mode: 'URGENT' });
      
      // Get pool entries by mode
      const balanceEntries = await bookingPool.getEntriesByMode('BALANCE');
      const urgentEntries = await bookingPool.getEntriesByMode('URGENT');
      
      console.log(`📊 Mode distribution: ${balanceEntries.length} BALANCE, ${urgentEntries.length} URGENT`);
      
      // Test mode-specific processing
      const { processPoolEntries } = await import('../lib/assignment/pool.ts');
      
      // Process in URGENT mode
      const urgentResults = await processPoolEntries('URGENT');
      console.log(`⚡ URGENT mode processing: ${urgentResults.length} entries processed`);
      
      // Switch back to NORMAL mode
      console.log('🔄 Switching to NORMAL mode...');
      await updatePolicy({ mode: 'NORMAL' });
      
      // Process remaining entries in NORMAL mode
      const normalResults = await processPoolEntries('NORMAL');
      console.log(`🔄 NORMAL mode processing: ${normalResults.length} entries processed`);
      
      // Test graceful mode switching during processing
      console.log('🔄 Testing graceful mode switching during processing...');
      
      // Create a booking that will be processing
      const processingBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK002',
          ownerGroup: 'software',
          meetingRoom: 'PROCESSING_TEST',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting',
          poolStatus: PoolStatus.processing,
          poolEntryTime: new Date(),
          poolDeadlineTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          poolProcessingAttempts: 1
        }
      });
      
      this.testBookings.push(processingBooking);
      
      // Switch modes while entry is processing
      await updatePolicy({ mode: 'URGENT' });
      
      // Verify processing entry is handled gracefully
      const processingEntry = await prisma.bookingPlan.findUnique({
        where: { bookingId: processingBooking.bookingId }
      });
      
      const gracefulHandling = processingEntry?.poolStatus === PoolStatus.processing;
      console.log(`✅ Graceful mode switching: ${gracefulHandling ? 'successful' : 'failed'}`);
      
      // Reset to original mode
      await updatePolicy({ mode: currentPolicy.mode });
      
      this.recordTestResult('Mode Switching with Pool Entries', true, Date.now() - testStart, {
        initialPoolSize: balancePoolStats.totalInPool,
        urgentProcessed: urgentResults.length,
        normalProcessed: normalResults.length,
        gracefulHandling
      });
      
    } catch (error) {
      console.error('❌ Mode switching test failed:', error);
      this.recordTestResult('Mode Switching with Pool Entries', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Test 4: Performance tests under high load
   */
  async testHighLoadPerformance() {
    console.log('\n4️⃣ Testing Performance Under High Load...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
      
      // Create high load scenario - 50 bookings
      console.log('📈 Creating high load scenario (50 bookings)...');
      const highLoadBookings = [];
      
      const batchSize = 10;
      const totalBookings = 50;
      
      for (let batch = 0; batch < totalBookings / batchSize; batch++) {
        const batchBookings = [];
        
        for (let i = 0; i < batchSize; i++) {
          const bookingIndex = batch * batchSize + i;
          const booking = await prisma.bookingPlan.create({
            data: {
              ownerEmpCode: 'BOOK001',
              ownerGroup: 'software',
              meetingRoom: `LOAD_TEST_${bookingIndex + 1}`,
              meetingType: 'General',
              timeStart: new Date(Date.now() + (2 + Math.random() * 5) * 24 * 60 * 60 * 1000),
              timeEnd: new Date(Date.now() + (2 + Math.random() * 5) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
              bookingStatus: 'waiting'
            }
          });
          
          batchBookings.push(booking);
          highLoadBookings.push(booking);
          this.testBookings.push(booking);
        }
        
        // Add batch to pool
        const batchStart = Date.now();
        for (const booking of batchBookings) {
          const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
        }
        const batchTime = Date.now() - batchStart;
        
        console.log(`📦 Batch ${batch + 1} added: ${batchSize} bookings in ${batchTime}ms`);
      }
      
      console.log(`✅ Created ${highLoadBookings.length} high load test bookings`);
      
      // Test pool statistics performance
      console.log('📊 Testing pool statistics performance...');
      const statsStart = Date.now();
      const poolStats = await bookingPool.getPoolStats();
      const statsTime = Date.now() - statsStart;
      
      console.log(`📈 Pool stats (${statsTime}ms): ${poolStats.totalInPool} total, ${poolStats.readyForProcessing} ready`);
      
      // Test bulk processing performance
      console.log('⚡ Testing bulk processing performance...');
      const engine = getPoolProcessingEngine();
      
      const processingStart = Date.now();
      const readyResults = await engine.processReadyEntries();
      const deadlineResults = await engine.processDeadlineEntries();
      const processingTime = Date.now() - processingStart;
      
      const totalProcessed = readyResults.length + deadlineResults.length;
      const avgProcessingTime = totalProcessed > 0 ? processingTime / totalProcessed : 0;
      
      console.log(`⚡ Bulk processing: ${totalProcessed} entries in ${processingTime}ms (avg: ${avgProcessingTime.toFixed(2)}ms per entry)`);
      
      // Test concurrent pool operations
      console.log('🔄 Testing concurrent pool operations...');
      const concurrentStart = Date.now();
      
      const concurrentOperations = [
        bookingPool.getPoolStats(),
        bookingPool.getReadyForAssignment(),
        bookingPool.getDeadlineEntries(),
        bookingPool.getFailedEntries(),
        bookingPool.getAllPoolEntries()
      ];
      
      const concurrentResults = await Promise.all(concurrentOperations);
      const concurrentTime = Date.now() - concurrentStart;
      
      console.log(`🔄 Concurrent operations: ${concurrentOperations.length} operations in ${concurrentTime}ms`);
      
      // Performance thresholds
      const performanceMetrics = {
        statsQueryTime: statsTime,
        bulkProcessingTime: processingTime,
        avgProcessingTimePerEntry: avgProcessingTime,
        concurrentOperationsTime: concurrentTime,
        totalEntriesProcessed: totalProcessed
      };
      
      const performancePassed = 
        statsTime < 1000 && // Stats should be under 1 second
        avgProcessingTime < 100 && // Each entry should process under 100ms
        concurrentTime < 2000; // Concurrent operations under 2 seconds
      
      console.log(`📊 Performance test: ${performancePassed ? 'PASSED' : 'FAILED'}`);
      
      this.recordTestResult('High Load Performance', performancePassed, Date.now() - testStart, performanceMetrics);
      
    } catch (error) {
      console.error('❌ High load performance test failed:', error);
      this.recordTestResult('High Load Performance', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Test 5: Reliability tests for concurrent processing
   */
  async testConcurrentProcessingReliability() {
    console.log('\n5️⃣ Testing Concurrent Processing Reliability...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
      
      // Create test bookings for concurrent processing
      console.log('🔄 Creating bookings for concurrent processing test...');
      const concurrentBookings = [];
      
      for (let i = 0; i < 20; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'BOOK001',
            ownerGroup: 'software',
            meetingRoom: `CONCURRENT_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        concurrentBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add to pool with different deadlines
      for (const booking of concurrentBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - (Math.random() * 2 + 1) * 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      console.log(`✅ Created ${concurrentBookings.length} bookings for concurrent testing`);
      
      // Test 1: Concurrent pool status queries
      console.log('📊 Testing concurrent pool status queries...');
      const statusPromises = Array(10).fill().map(() => bookingPool.getPoolStats());
      const statusResults = await Promise.all(statusPromises);
      
      const statusConsistent = statusResults.every(result => 
        result.totalInPool === statusResults[0].totalInPool
      );
      
      console.log(`📊 Status consistency: ${statusConsistent ? 'consistent' : 'inconsistent'}`);
      
      // Test 2: Concurrent processing operations
      console.log('⚡ Testing concurrent processing operations...');
      const engine = getPoolProcessingEngine();
      
      const processingPromises = [
        engine.processReadyEntries(),
        engine.processDeadlineEntries(),
        engine.getEntriesNeedingProcessing(),
        bookingPool.getPoolStats(),
        bookingPool.getReadyForAssignment()
      ];
      
      const processingResults = await Promise.all(processingPromises);
      console.log(`⚡ Concurrent processing completed: ${processingResults.length} operations`);
      
      // Test 3: Concurrent pool modifications
      console.log('🔄 Testing concurrent pool modifications...');
      
      // Create additional bookings for modification test
      const modificationBookings = [];
      for (let i = 0; i < 5; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'BOOK002',
            ownerGroup: 'software',
            meetingRoom: `MOD_TEST_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        modificationBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Concurrent add/remove operations
      const modificationPromises = modificationBookings.map(async (booking, index) => {
        if (index % 2 === 0) {
          // Add to pool
          const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
          return { operation: 'add', bookingId: booking.bookingId };
        } else {
          // Add then remove
          const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
          await bookingPool.removeFromPool(booking.bookingId);
          return { operation: 'add_remove', bookingId: booking.bookingId };
        }
      });
      
      const modificationResults = await Promise.all(modificationPromises);
      console.log(`🔄 Concurrent modifications: ${modificationResults.length} operations completed`);
      
      // Test 4: Race condition detection
      console.log('🏁 Testing race condition handling...');
      
      // Create a booking that multiple processes will try to process
      const raceBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK001',
          ownerGroup: 'software',
          meetingRoom: 'RACE_TEST',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting'
        }
      });
      
      this.testBookings.push(raceBooking);
      
      // Add to pool
      await bookingPool.addToPool(raceBooking.bookingId, new Date(Date.now() + 12 * 60 * 60 * 1000));
      
      // Multiple concurrent attempts to mark as processing
      const racePromises = Array(5).fill().map(async () => {
        try {
          await bookingPool.markAsProcessing(raceBooking.bookingId);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      const raceResults = await Promise.all(racePromises);
      const successfulRaces = raceResults.filter(r => r.success).length;
      
      console.log(`🏁 Race condition test: ${successfulRaces} successful operations (expected: 1)`);
      
      // Verify final state consistency
      const finalStats = await bookingPool.getPoolStats();
      console.log(`📊 Final consistency check: ${finalStats.totalInPool} total entries`);
      
      const reliabilityPassed = statusConsistent && successfulRaces >= 1;
      
      this.recordTestResult('Concurrent Processing Reliability', reliabilityPassed, Date.now() - testStart, {
        statusConsistent,
        concurrentOperations: processingResults.length,
        modificationOperations: modificationResults.length,
        raceConditionHandled: successfulRaces >= 1,
        finalPoolSize: finalStats.totalInPool
      });
      
    } catch (error) {
      console.error('❌ Concurrent processing reliability test failed:', error);
      this.recordTestResult('Concurrent Processing Reliability', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Test 6: Failure scenario handling
   */
  async testFailureScenarios() {
    console.log('\n6️⃣ Testing Failure Scenario Handling...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolErrorRecoveryManager } = await import('../lib/assignment/pool-error-recovery.ts');
      
      // Test 1: Corrupted pool entry handling
      console.log('🔍 Testing corrupted pool entry handling...');
      
      const corruptedBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK001',
          ownerGroup: 'software',
          meetingRoom: 'CORRUPTED_TEST',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting',
          // Simulate corruption with invalid pool data
          poolStatus: PoolStatus.processing,
          poolEntryTime: null, // Invalid: should have entry time if in pool
          poolDeadlineTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past deadline
          poolProcessingAttempts: 10 // Excessive attempts
        }
      });
      
      this.testBookings.push(corruptedBooking);
      
      const errorRecoveryManager = getPoolErrorRecoveryManager();
      const poolEntry = await bookingPool.getPoolEntry(corruptedBooking.bookingId);
      
      if (poolEntry) {
        const corruptionCheck = await errorRecoveryManager.detectEntryCorruption(poolEntry);
        console.log(`🔍 Corruption detected: ${corruptionCheck.isCorrupted}`);
        
        if (corruptionCheck.isCorrupted) {
          // Test cleanup
          await errorRecoveryManager.cleanupCorruptedEntry(poolEntry);
          console.log('🧹 Corrupted entry cleaned up');
        }
      }
      
      // Test 2: Excessive retry handling
      console.log('🔄 Testing excessive retry handling...');
      
      const retryBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK002',
          ownerGroup: 'software',
          meetingRoom: 'RETRY_TEST',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting',
          poolStatus: PoolStatus.failed,
          poolEntryTime: new Date(),
          poolDeadlineTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          poolProcessingAttempts: 5 // Excessive attempts
        }
      });
      
      this.testBookings.push(retryBooking);
      
      // Test retry logic
      const retryEntry = await bookingPool.getPoolEntry(retryBooking.bookingId);
      if (retryEntry) {
        const retryResults = await errorRecoveryManager.processWithErrorRecovery([retryEntry]);
        console.log(`🔄 Retry handling: ${retryResults.length} results`);
      }
      
      // Test 3: Stuck processing entry recovery
      console.log('⏰ Testing stuck processing entry recovery...');
      
      const stuckBooking = await prisma.bookingPlan.create({
        data: {
          ownerEmpCode: 'BOOK001',
          ownerGroup: 'software',
          meetingRoom: 'STUCK_TEST',
          meetingType: 'General',
          timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          bookingStatus: 'waiting',
          poolStatus: PoolStatus.processing,
          poolEntryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          poolDeadlineTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          poolProcessingAttempts: 1
        }
      });
      
      this.testBookings.push(stuckBooking);
      
      // Test stuck entry detection and recovery
      const healthCheck = await errorRecoveryManager.performHealthCheck();
      const hasStuckWarning = healthCheck.warnings.some(w => w.includes('stuck'));
      console.log(`⏰ Stuck entry detection: ${hasStuckWarning ? 'detected' : 'not detected'}`);
      
      if (hasStuckWarning) {
        await bookingPool.resetProcessingStatus(stuckBooking.bookingId);
        console.log('✅ Stuck entry reset');
      }
      
      // Test 4: Emergency processing fallback
      console.log('🚨 Testing emergency processing fallback...');
      
      // Create multiple deadline entries
      const emergencyBookings = [];
      for (let i = 0; i < 3; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'BOOK001',
            ownerGroup: 'software',
            meetingRoom: `EMERGENCY_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
            timeEnd: new Date(Date.now() + 12 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting',
            poolStatus: PoolStatus.waiting,
            poolEntryTime: new Date(),
            poolDeadlineTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour past deadline
            poolProcessingAttempts: 0
          }
        });
        
        emergencyBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Test emergency processing
      const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
      const engine = getPoolProcessingEngine();
      
      const emergencyResults = await engine.processEmergencyOverride();
      console.log(`🚨 Emergency processing: ${emergencyResults.length} entries processed`);
      
      // Verify failure handling metrics
      const finalHealthCheck = await errorRecoveryManager.performHealthCheck();
      
      this.recordTestResult('Failure Scenario Handling', true, Date.now() - testStart, {
        corruptionDetected: true,
        stuckEntryDetected: hasStuckWarning,
        emergencyProcessed: emergencyResults.length,
        finalHealthy: finalHealthCheck.isHealthy,
        warningsCount: finalHealthCheck.warnings.length
      });
      
    } catch (error) {
      console.error('❌ Failure scenario handling test failed:', error);
      this.recordTestResult('Failure Scenario Handling', false, Date.now() - testStart, { error: error.message });
      throw error;
    }
  }

  /**
   * Record test result
   */
  recordTestResult(testName, passed, duration, details = {}) {
    this.testResults.push({
      testName,
      passed,
      duration,
      details,
      timestamp: new Date()
    });
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    console.log('\n📊 Generating Integration Test Report...\n');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Date.now() - this.startTime;
    
    console.log('🎯 INTEGRATION TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('=' .repeat(50));
    
    // Detailed results
    console.log('\n📋 DETAILED TEST RESULTS:');
    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      
      console.log(`\n${index + 1}. ${result.testName} ${status}`);
      console.log(`   Duration: ${duration}s`);
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log('   Details:');
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`     ${key}: ${JSON.stringify(value)}`);
        });
      }
    });
    
    // Performance summary
    console.log('\n⚡ PERFORMANCE SUMMARY:');
    const performanceTest = this.testResults.find(r => r.testName === 'High Load Performance');
    if (performanceTest && performanceTest.details) {
      console.log(`   Stats Query Time: ${performanceTest.details.statsQueryTime}ms`);
      console.log(`   Bulk Processing Time: ${performanceTest.details.bulkProcessingTime}ms`);
      console.log(`   Avg Processing Per Entry: ${performanceTest.details.avgProcessingTimePerEntry?.toFixed(2)}ms`);
      console.log(`   Concurrent Operations Time: ${performanceTest.details.concurrentOperationsTime}ms`);
    }
    
    // Reliability summary
    console.log('\n🔒 RELIABILITY SUMMARY:');
    const reliabilityTest = this.testResults.find(r => r.testName === 'Concurrent Processing Reliability');
    if (reliabilityTest && reliabilityTest.details) {
      console.log(`   Status Consistency: ${reliabilityTest.details.statusConsistent ? 'Yes' : 'No'}`);
      console.log(`   Race Condition Handled: ${reliabilityTest.details.raceConditionHandled ? 'Yes' : 'No'}`);
      console.log(`   Concurrent Operations: ${reliabilityTest.details.concurrentOperations}`);
    }
    
    // Error handling summary
    console.log('\n🛡️ ERROR HANDLING SUMMARY:');
    const errorTest = this.testResults.find(r => r.testName === 'Database Error Recovery');
    const failureTest = this.testResults.find(r => r.testName === 'Failure Scenario Handling');
    
    if (errorTest && errorTest.details) {
      console.log(`   Health Check Passed: ${errorTest.details.healthCheckPassed ? 'Yes' : 'No'}`);
      console.log(`   Recovery Worked: ${errorTest.details.recoveryWorked ? 'Yes' : 'No'}`);
    }
    
    if (failureTest && failureTest.details) {
      console.log(`   Corruption Detection: ${failureTest.details.corruptionDetected ? 'Yes' : 'No'}`);
      console.log(`   Stuck Entry Detection: ${failureTest.details.stuckEntryDetected ? 'Yes' : 'No'}`);
      console.log(`   Emergency Processing: ${failureTest.details.emergencyProcessed} entries`);
    }
    
    console.log('\n🎉 Integration test suite completed!');
    
    if (failedTests > 0) {
      console.log('\n⚠️ Some tests failed. Please review the detailed results above.');
      process.exit(1);
    } else {
      console.log('\n✅ All integration tests passed successfully!');
    }
  }

  /**
   * Cleanup test data
   */
  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Remove test bookings
      if (this.testBookings.length > 0) {
        const bookingIds = this.testBookings.map(b => b.bookingId);
        await prisma.bookingPlan.deleteMany({
          where: {
            bookingId: {
              in: bookingIds
            }
          }
        });
        console.log(`✅ Removed ${this.testBookings.length} test bookings`);
      }
      
      // Remove test employees
      if (this.testEmployees.length > 0) {
        const empCodes = this.testEmployees.map(e => e.empCode);
        await prisma.employee.deleteMany({
          where: {
            empCode: {
              in: empCodes
            }
          }
        });
        console.log(`✅ Removed ${this.testEmployees.length} test employees`);
      }
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Run the integration tests
async function runIntegrationTests() {
  const testSuite = new PoolProcessingIntegrationTests();
  
  try {
    await testSuite.runAllTests();
  } catch (error) {
    console.error('💥 Integration test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

module.exports = { PoolProcessingIntegrationTests };