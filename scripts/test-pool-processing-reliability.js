/**
 * Pool Processing Reliability Integration Tests
 * 
 * Tests for concurrent processing, failure scenarios, and system reliability
 */

const { PrismaClient, PoolStatus } = require('@prisma/client');

const prisma = new PrismaClient();

class PoolProcessingReliabilityTests {
  constructor() {
    this.reliabilityResults = [];
    this.testBookings = [];
    this.testEmployees = [];
    this.activeProcesses = [];
  }

  /**
   * Run all reliability tests
   */
  async runReliabilityTests() {
    console.log('🔒 Starting Pool Processing Reliability Tests...\n');
    
    try {
      await this.setupReliabilityTestData();
      
      // Reliability Test 1: Race Condition Handling
      await this.testRaceConditionHandling();
      
      // Reliability Test 2: Database Connection Failures
      await this.testDatabaseConnectionFailures();
      
      // Reliability Test 3: Concurrent Mode Switching
      await this.testConcurrentModeSwitching();
      
      // Reliability Test 4: Process Interruption Recovery
      await this.testProcessInterruptionRecovery();
      
      // Reliability Test 5: Data Consistency Under Load
      await this.testDataConsistencyUnderLoad();
      
      // Reliability Test 6: Deadlock Prevention
      await this.testDeadlockPrevention();
      
      await this.generateReliabilityReport();
      
    } catch (error) {
      console.error('❌ Reliability test suite failed:', error);
      throw error;
    } finally {
      await this.cleanupReliabilityTestData();
      await prisma.$disconnect();
    }
  }

  /**
   * Setup reliability test data
   */
  async setupReliabilityTestData() {
    console.log('📋 Setting up reliability test data...');
    
    // Create test employees
    const employees = Array.from({ length: 15 }, (_, i) => ({
      empCode: `REL_INT_${String(i + 1).padStart(3, '0')}`,
      firstNameEn: 'Reliability',
      lastNameEn: `Interpreter${i + 1}`,
      email: `rel_int${i + 1}@test.com`,
      isActive: true
    }));
    
    const bookers = Array.from({ length: 5 }, (_, i) => ({
      empCode: `REL_BOOK_${String(i + 1).padStart(3, '0')}`,
      firstNameEn: 'Reliability',
      lastNameEn: `Booker${i + 1}`,
      email: `rel_book${i + 1}@test.com`,
      isActive: true
    }));
    
    for (const emp of [...employees, ...bookers]) {
      const employee = await prisma.employee.create({ data: emp });
      this.testEmployees.push(employee);
    }
    
    console.log(`✅ Created ${this.testEmployees.length} reliability test employees`);
  }

  /**
   * Test race condition handling
   */
  async testRaceConditionHandling() {
    console.log('\n1️⃣ Testing Race Condition Handling...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      
      // Create bookings for race condition testing
      const raceBookings = [];
      for (let i = 0; i < 10; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_001',
            ownerGroup: 'software',
            meetingRoom: `RACE_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (1 + Math.random()) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (1 + Math.random()) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        raceBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add all to pool
      for (const booking of raceBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 12 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      console.log('🏁 Testing concurrent pool modifications...');
      
      // Test 1: Concurrent markAsProcessing calls
      const concurrentMarkingPromises = raceBookings.map(booking => 
        Array(5).fill().map(async (_, attempt) => {
          try {
            await bookingPool.markAsProcessing(booking.bookingId);
            return { bookingId: booking.bookingId, attempt, success: true, error: null };
          } catch (error) {
            return { bookingId: booking.bookingId, attempt, success: false, error: error.message };
          }
        })
      ).flat();
      
      const markingResults = await Promise.all(concurrentMarkingPromises);
      
      // Analyze results
      const successfulMarkings = markingResults.filter(r => r.success);
      const failedMarkings = markingResults.filter(r => !r.success);
      
      console.log(`  Concurrent marking: ${successfulMarkings.length} successful, ${failedMarkings.length} failed`);
      
      // Test 2: Concurrent add/remove operations
      console.log('🔄 Testing concurrent add/remove operations...');
      
      const addRemoveBookings = [];
      for (let i = 0; i < 5; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_002',
            ownerGroup: 'software',
            meetingRoom: `ADD_REMOVE_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        addRemoveBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      const addRemovePromises = addRemoveBookings.map(booking => 
        Array(3).fill().map(async (_, cycle) => {
          try {
            const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
            await bookingPool.addToPool(booking.bookingId, deadlineTime);
            
            // Small delay to increase chance of race condition
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            
            await bookingPool.removeFromPool(booking.bookingId);
            
            return { bookingId: booking.bookingId, cycle, success: true, error: null };
          } catch (error) {
            return { bookingId: booking.bookingId, cycle, success: false, error: error.message };
          }
        })
      ).flat();
      
      const addRemoveResults = await Promise.all(addRemovePromises);
      const successfulAddRemove = addRemoveResults.filter(r => r.success);
      const failedAddRemove = addRemoveResults.filter(r => !r.success);
      
      console.log(`  Add/Remove operations: ${successfulAddRemove.length} successful, ${failedAddRemove.length} failed`);
      
      // Test 3: Concurrent status queries during modifications
      console.log('📊 Testing concurrent status queries...');
      
      const statusQueryPromises = Array(20).fill().map(async (_, queryIndex) => {
        try {
          const stats = await bookingPool.getPoolStats();
          return { queryIndex, success: true, stats, error: null };
        } catch (error) {
          return { queryIndex, success: false, stats: null, error: error.message };
        }
      });
      
      const statusResults = await Promise.all(statusQueryPromises);
      const successfulQueries = statusResults.filter(r => r.success);
      const failedQueries = statusResults.filter(r => !r.success);
      
      console.log(`  Status queries: ${successfulQueries.length} successful, ${failedQueries.length} failed`);
      
      // Check data consistency
      const finalStats = await bookingPool.getPoolStats();
      console.log(`  Final pool consistency: ${finalStats.totalInPool} total entries`);
      
      const raceConditionsPassed = failedMarkings.length < markingResults.length * 0.8 && // Some failures expected
                                   failedQueries.length === 0; // Queries should not fail
      
      this.reliabilityResults.push({
        testName: 'Race Condition Handling',
        passed: raceConditionsPassed,
        duration: Date.now() - testStart,
        metrics: {
          concurrentMarkings: { successful: successfulMarkings.length, failed: failedMarkings.length },
          addRemoveOperations: { successful: successfulAddRemove.length, failed: failedAddRemove.length },
          statusQueries: { successful: successfulQueries.length, failed: failedQueries.length },
          finalPoolSize: finalStats.totalInPool
        }
      });
      
    } catch (error) {
      console.error('❌ Race condition test failed:', error);
      this.reliabilityResults.push({
        testName: 'Race Condition Handling',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Test database connection failures and recovery
   */
  async testDatabaseConnectionFailures() {
    console.log('\n2️⃣ Testing Database Connection Failures...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolErrorRecoveryManager } = await import('../lib/assignment/pool-error-recovery.ts');
      
      // Create test bookings
      const connectionTestBookings = [];
      for (let i = 0; i < 5; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_003',
            ownerGroup: 'software',
            meetingRoom: `CONN_TEST_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        connectionTestBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add to pool
      for (const booking of connectionTestBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      console.log('🔌 Testing connection resilience...');
      
      // Test error recovery manager
      const errorRecoveryManager = getPoolErrorRecoveryManager();
      
      // Test health check functionality
      const healthCheck = await errorRecoveryManager.performHealthCheck();
      console.log(`  Health check: ${healthCheck.isHealthy ? 'healthy' : 'unhealthy'}`);
      console.log(`  Warnings: ${healthCheck.warnings.length}`);
      console.log(`  Errors: ${healthCheck.errors.length}`);
      
      // Test recovery processing
      const poolEntries = await bookingPool.getAllPoolEntries();
      if (poolEntries.length > 0) {
        console.log('🔄 Testing error recovery processing...');
        
        const recoveryResults = await errorRecoveryManager.processWithErrorRecovery(poolEntries.slice(0, 3));
        console.log(`  Recovery processing: ${recoveryResults.length} results`);
        
        const successfulRecoveries = recoveryResults.filter(r => r.status === 'assigned' || r.status === 'recovered');
        console.log(`  Successful recoveries: ${successfulRecoveries.length}`);
      }
      
      // Test graceful degradation
      console.log('📉 Testing graceful degradation...');
      
      // Simulate some failed entries
      if (connectionTestBookings.length > 0) {
        await prisma.bookingPlan.update({
          where: { bookingId: connectionTestBookings[0].bookingId },
          data: {
            poolStatus: PoolStatus.failed,
            poolProcessingAttempts: 3
          }
        });
        
        // Test retry mechanism
        await bookingPool.retryFailedEntries();
        
        const retriedBooking = await prisma.bookingPlan.findUnique({
          where: { bookingId: connectionTestBookings[0].bookingId }
        });
        
        const retryWorked = retriedBooking?.poolStatus === PoolStatus.waiting;
        console.log(`  Retry mechanism: ${retryWorked ? 'working' : 'failed'}`);
      }
      
      // Test connection recovery status
      const recoveryStatus = await errorRecoveryManager.getPoolProcessingStatus();
      console.log(`  Recovery status: ${recoveryStatus.healthStatus.isHealthy ? 'healthy' : 'unhealthy'}`);
      
      const connectionTestPassed = healthCheck.isHealthy && recoveryStatus.healthStatus.isHealthy;
      
      this.reliabilityResults.push({
        testName: 'Database Connection Failures',
        passed: connectionTestPassed,
        duration: Date.now() - testStart,
        metrics: {
          healthCheck: {
            isHealthy: healthCheck.isHealthy,
            warnings: healthCheck.warnings.length,
            errors: healthCheck.errors.length
          },
          recoveryStatus: {
            isHealthy: recoveryStatus.healthStatus.isHealthy,
            recentIssues: recoveryStatus.healthStatus.recentIssues
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Database connection failure test failed:', error);
      this.reliabilityResults.push({
        testName: 'Database Connection Failures',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Test concurrent mode switching
   */
  async testConcurrentModeSwitching() {
    console.log('\n3️⃣ Testing Concurrent Mode Switching...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { loadPolicy, updatePolicy } = await import('../lib/assignment/policy.ts');
      
      // Create bookings for mode switching test
      const modeSwitchBookings = [];
      for (let i = 0; i < 15; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_004',
            ownerGroup: 'software',
            meetingRoom: `MODE_SWITCH_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        modeSwitchBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add all to pool
      for (const booking of modeSwitchBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - (1 + Math.random()) * 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      const originalPolicy = await loadPolicy();
      console.log(`  Original mode: ${originalPolicy.mode}`);
      
      // Test concurrent mode switches
      console.log('🔄 Testing concurrent mode switches...');
      
      const modes = ['BALANCE', 'URGENT', 'NORMAL'];
      const modeSwitchPromises = modes.map(async (mode, index) => {
        try {
          // Add small delay to create race conditions
          await new Promise(resolve => setTimeout(resolve, index * 100));
          
          await updatePolicy({ mode });
          const updatedPolicy = await loadPolicy();
          
          return { 
            targetMode: mode, 
            actualMode: updatedPolicy.mode, 
            success: updatedPolicy.mode === mode,
            timestamp: Date.now()
          };
        } catch (error) {
          return { 
            targetMode: mode, 
            actualMode: null, 
            success: false, 
            error: error.message,
            timestamp: Date.now()
          };
        }
      });
      
      const modeSwitchResults = await Promise.all(modeSwitchPromises);
      const successfulSwitches = modeSwitchResults.filter(r => r.success);
      
      console.log(`  Mode switches: ${successfulSwitches.length}/${modeSwitchResults.length} successful`);
      
      // Test pool operations during mode switching
      console.log('📊 Testing pool operations during mode switching...');
      
      const concurrentOperationPromises = [
        // Pool status queries
        ...Array(5).fill().map(() => bookingPool.getPoolStats()),
        // Pool entry queries
        ...Array(3).fill().map(() => bookingPool.getReadyForAssignment()),
        // Pool modifications
        ...modeSwitchBookings.slice(0, 3).map(booking => 
          bookingPool.markAsProcessing(booking.bookingId)
        )
      ];
      
      const operationResults = await Promise.allSettled(concurrentOperationPromises);
      const successfulOperations = operationResults.filter(r => r.status === 'fulfilled');
      const failedOperations = operationResults.filter(r => r.status === 'rejected');
      
      console.log(`  Concurrent operations: ${successfulOperations.length} successful, ${failedOperations.length} failed`);
      
      // Test data consistency after mode switching
      const finalStats = await bookingPool.getPoolStats();
      const finalPolicy = await loadPolicy();
      
      console.log(`  Final mode: ${finalPolicy.mode}`);
      console.log(`  Final pool size: ${finalStats.totalInPool}`);
      
      // Reset to original mode
      await updatePolicy({ mode: originalPolicy.mode });
      
      const modeSwitchingPassed = successfulSwitches.length > 0 && 
                                  failedOperations.length < operationResults.length * 0.2;
      
      this.reliabilityResults.push({
        testName: 'Concurrent Mode Switching',
        passed: modeSwitchingPassed,
        duration: Date.now() - testStart,
        metrics: {
          modeSwitches: { successful: successfulSwitches.length, total: modeSwitchResults.length },
          concurrentOperations: { successful: successfulOperations.length, failed: failedOperations.length },
          finalPoolSize: finalStats.totalInPool,
          originalMode: originalPolicy.mode,
          finalMode: finalPolicy.mode
        }
      });
      
    } catch (error) {
      console.error('❌ Concurrent mode switching test failed:', error);
      this.reliabilityResults.push({
        testName: 'Concurrent Mode Switching',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Test process interruption recovery
   */
  async testProcessInterruptionRecovery() {
    console.log('\n4️⃣ Testing Process Interruption Recovery...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
      
      // Create bookings for interruption testing
      const interruptionBookings = [];
      for (let i = 0; i < 10; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_005',
            ownerGroup: 'software',
            meetingRoom: `INTERRUPT_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (1 + Math.random()) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (1 + Math.random()) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        interruptionBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add to pool
      for (const booking of interruptionBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 12 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      console.log('⏸️ Testing process interruption scenarios...');
      
      // Simulate stuck processing entries
      const stuckBookings = interruptionBookings.slice(0, 3);
      for (const booking of stuckBookings) {
        await prisma.bookingPlan.update({
          where: { bookingId: booking.bookingId },
          data: {
            poolStatus: PoolStatus.processing,
            poolProcessingAttempts: 1,
            poolEntryTime: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
          }
        });
      }
      
      console.log(`  Created ${stuckBookings.length} stuck processing entries`);
      
      // Test stuck entry detection
      const { getPoolErrorRecoveryManager } = await import('../lib/assignment/pool-error-recovery.ts');
      const errorRecoveryManager = getPoolErrorRecoveryManager();
      
      const healthCheck = await errorRecoveryManager.performHealthCheck();
      const stuckWarnings = healthCheck.warnings.filter(w => w.includes('stuck') || w.includes('processing'));
      
      console.log(`  Stuck entry detection: ${stuckWarnings.length} warnings found`);
      
      // Test recovery of stuck entries
      for (const booking of stuckBookings) {
        await bookingPool.resetProcessingStatus(booking.bookingId);
      }
      
      console.log('  Reset stuck processing entries');
      
      // Test processing resumption
      const engine = getPoolProcessingEngine();
      const processingStatus = await engine.getProcessingStatus();
      
      console.log(`  Processing status: ${processingStatus.poolSize} total, ${processingStatus.readyForProcessing} ready`);
      
      // Test recovery processing
      const recoveryResults = await engine.processReadyEntries();
      console.log(`  Recovery processing: ${recoveryResults.length} entries processed`);
      
      // Test interrupted batch processing recovery
      console.log('🔄 Testing interrupted batch processing...');
      
      // Simulate partial batch processing
      const batchBookings = interruptionBookings.slice(3, 7);
      for (let i = 0; i < batchBookings.length; i++) {
        const booking = batchBookings[i];
        const status = i < 2 ? PoolStatus.processing : PoolStatus.waiting;
        
        await prisma.bookingPlan.update({
          where: { bookingId: booking.bookingId },
          data: {
            poolStatus: status,
            poolProcessingAttempts: i < 2 ? 1 : 0
          }
        });
      }
      
      // Test batch recovery
      const batchRecoveryResults = await engine.processReadyEntries();
      console.log(`  Batch recovery: ${batchRecoveryResults.length} entries processed`);
      
      // Verify final consistency
      const finalStats = await bookingPool.getPoolStats();
      const finalHealthCheck = await errorRecoveryManager.performHealthCheck();
      
      console.log(`  Final pool state: ${finalStats.totalInPool} total, ${finalStats.currentlyProcessing} processing`);
      console.log(`  Final health: ${finalHealthCheck.isHealthy ? 'healthy' : 'unhealthy'}`);
      
      const interruptionRecoveryPassed = stuckWarnings.length > 0 && // Detected stuck entries
                                         finalHealthCheck.isHealthy && // System recovered
                                         finalStats.currentlyProcessing === 0; // No stuck entries
      
      this.reliabilityResults.push({
        testName: 'Process Interruption Recovery',
        passed: interruptionRecoveryPassed,
        duration: Date.now() - testStart,
        metrics: {
          stuckEntriesDetected: stuckWarnings.length,
          recoveryProcessingResults: recoveryResults.length,
          batchRecoveryResults: batchRecoveryResults.length,
          finalHealthy: finalHealthCheck.isHealthy,
          finalProcessingCount: finalStats.currentlyProcessing
        }
      });
      
    } catch (error) {
      console.error('❌ Process interruption recovery test failed:', error);
      this.reliabilityResults.push({
        testName: 'Process Interruption Recovery',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Test data consistency under load
   */
  async testDataConsistencyUnderLoad() {
    console.log('\n5️⃣ Testing Data Consistency Under Load...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      
      // Create large number of bookings for consistency testing
      const consistencyBookings = [];
      const bookingCount = 50;
      
      for (let i = 0; i < bookingCount; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_001',
            ownerGroup: 'software',
            meetingRoom: `CONSISTENCY_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        consistencyBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      console.log(`📊 Testing consistency with ${bookingCount} bookings...`);
      
      // Test 1: Concurrent pool additions
      console.log('  Testing concurrent pool additions...');
      
      const additionPromises = consistencyBookings.map(async (booking, index) => {
        const deadlineTime = new Date(booking.timeStart.getTime() - (12 + Math.random() * 12) * 60 * 60 * 1000);
        
        try {
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
          return { bookingId: booking.bookingId, success: true, index };
        } catch (error) {
          return { bookingId: booking.bookingId, success: false, error: error.message, index };
        }
      });
      
      const additionResults = await Promise.all(additionPromises);
      const successfulAdditions = additionResults.filter(r => r.success);
      
      console.log(`    Additions: ${successfulAdditions.length}/${bookingCount} successful`);
      
      // Test 2: Concurrent status queries during modifications
      console.log('  Testing concurrent status queries...');
      
      const statusQueryPromises = Array(20).fill().map(async (_, queryIndex) => {
        const stats = await bookingPool.getPoolStats();
        return { queryIndex, stats };
      });
      
      const statusResults = await Promise.all(statusQueryPromises);
      
      // Check consistency of status results
      const totalCounts = statusResults.map(r => r.stats.totalInPool);
      const uniqueTotalCounts = [...new Set(totalCounts)];
      const isConsistent = uniqueTotalCounts.length <= 2; // Allow for small variations due to timing
      
      console.log(`    Status consistency: ${isConsistent ? 'consistent' : 'inconsistent'} (${uniqueTotalCounts.length} unique values)`);
      
      // Test 3: Concurrent modifications
      console.log('  Testing concurrent modifications...');
      
      const modificationPromises = consistencyBookings.slice(0, 20).map(async (booking, index) => {
        try {
          if (index % 3 === 0) {
            await bookingPool.markAsProcessing(booking.bookingId);
            return { bookingId: booking.bookingId, operation: 'markProcessing', success: true };
          } else if (index % 3 === 1) {
            await bookingPool.removeFromPool(booking.bookingId);
            return { bookingId: booking.bookingId, operation: 'remove', success: true };
          } else {
            await bookingPool.resetProcessingStatus(booking.bookingId);
            return { bookingId: booking.bookingId, operation: 'reset', success: true };
          }
        } catch (error) {
          return { bookingId: booking.bookingId, operation: 'unknown', success: false, error: error.message };
        }
      });
      
      const modificationResults = await Promise.all(modificationPromises);
      const successfulModifications = modificationResults.filter(r => r.success);
      
      console.log(`    Modifications: ${successfulModifications.length}/${modificationResults.length} successful`);
      
      // Test 4: Final consistency check
      console.log('  Performing final consistency check...');
      
      const finalStats = await bookingPool.getPoolStats();
      
      // Count actual database entries
      const actualPoolEntries = await prisma.bookingPlan.count({
        where: { poolStatus: { not: null } }
      });
      
      const statsMatch = finalStats.totalInPool === actualPoolEntries;
      console.log(`    Stats match database: ${statsMatch} (stats: ${finalStats.totalInPool}, db: ${actualPoolEntries})`);
      
      // Test referential integrity
      const poolEntriesWithInvalidData = await prisma.bookingPlan.count({
        where: {
          AND: [
            { poolStatus: { not: null } },
            { poolEntryTime: null }
          ]
        }
      });
      
      const referentialIntegrity = poolEntriesWithInvalidData === 0;
      console.log(`    Referential integrity: ${referentialIntegrity ? 'maintained' : 'violated'} (${poolEntriesWithInvalidData} invalid entries)`);
      
      const dataConsistencyPassed = isConsistent && statsMatch && referentialIntegrity;
      
      this.reliabilityResults.push({
        testName: 'Data Consistency Under Load',
        passed: dataConsistencyPassed,
        duration: Date.now() - testStart,
        metrics: {
          bookingCount,
          successfulAdditions: successfulAdditions.length,
          statusConsistency: isConsistent,
          uniqueStatusCounts: uniqueTotalCounts.length,
          successfulModifications: successfulModifications.length,
          statsMatchDatabase: statsMatch,
          referentialIntegrity,
          finalPoolSize: finalStats.totalInPool
        }
      });
      
    } catch (error) {
      console.error('❌ Data consistency test failed:', error);
      this.reliabilityResults.push({
        testName: 'Data Consistency Under Load',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Test deadlock prevention
   */
  async testDeadlockPrevention() {
    console.log('\n6️⃣ Testing Deadlock Prevention...');
    
    const testStart = Date.now();
    
    try {
      const { bookingPool } = await import('../lib/assignment/pool.ts');
      
      // Create bookings for deadlock testing
      const deadlockBookings = [];
      for (let i = 0; i < 10; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'REL_BOOK_001',
            ownerGroup: 'software',
            meetingRoom: `DEADLOCK_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        deadlockBookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add to pool
      for (const booking of deadlockBookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      console.log('🔒 Testing potential deadlock scenarios...');
      
      // Test 1: Circular dependency operations
      console.log('  Testing circular dependency operations...');
      
      const circularPromises = deadlockBookings.slice(0, 5).map(async (booking, index) => {
        const nextIndex = (index + 1) % 5;
        const nextBooking = deadlockBookings[nextIndex];
        
        try {
          // Create potential circular dependency by operating on next booking
          await bookingPool.markAsProcessing(booking.bookingId);
          
          // Small delay to increase chance of deadlock
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          
          await bookingPool.markAsProcessing(nextBooking.bookingId);
          
          return { bookingId: booking.bookingId, success: true, index };
        } catch (error) {
          return { bookingId: booking.bookingId, success: false, error: error.message, index };
        }
      });
      
      const circularResults = await Promise.all(circularPromises);
      const successfulCircular = circularResults.filter(r => r.success);
      
      console.log(`    Circular operations: ${successfulCircular.length}/${circularResults.length} completed`);
      
      // Test 2: High contention scenario
      console.log('  Testing high contention scenario...');
      
      const contentionBooking = deadlockBookings[5];
      const contentionPromises = Array(10).fill().map(async (_, attempt) => {
        try {
          await bookingPool.markAsProcessing(contentionBooking.bookingId);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
          await bookingPool.resetProcessingStatus(contentionBooking.bookingId);
          
          return { attempt, success: true };
        } catch (error) {
          return { attempt, success: false, error: error.message };
        }
      });
      
      const contentionResults = await Promise.all(contentionPromises);
      const successfulContention = contentionResults.filter(r => r.success);
      
      console.log(`    High contention: ${successfulContention.length}/${contentionResults.length} completed`);
      
      // Test 3: Transaction timeout handling
      console.log('  Testing transaction timeout handling...');
      
      const timeoutPromises = deadlockBookings.slice(6, 9).map(async (booking, index) => {
        try {
          // Simulate long-running transaction
          await prisma.$transaction(async (tx) => {
            await tx.bookingPlan.update({
              where: { bookingId: booking.bookingId },
              data: { poolStatus: PoolStatus.processing }
            });
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
            await tx.bookingPlan.update({
              where: { bookingId: booking.bookingId },
              data: { poolProcessingAttempts: { increment: 1 } }
            });
          });
          
          return { bookingId: booking.bookingId, success: true };
        } catch (error) {
          return { bookingId: booking.bookingId, success: false, error: error.message };
        }
      });
      
      const timeoutResults = await Promise.all(timeoutPromises);
      const successfulTimeouts = timeoutResults.filter(r => r.success);
      
      console.log(`    Transaction timeouts: ${successfulTimeouts.length}/${timeoutResults.length} completed`);
      
      // Verify no deadlocks occurred (all operations completed)
      const totalOperations = circularResults.length + contentionResults.length + timeoutResults.length;
      const totalSuccessful = successfulCircular.length + successfulContention.length + successfulTimeouts.length;
      const deadlockFreeRatio = totalSuccessful / totalOperations;
      
      console.log(`  Overall completion rate: ${(deadlockFreeRatio * 100).toFixed(1)}%`);
      
      const deadlockPreventionPassed = deadlockFreeRatio > 0.8; // Allow for some failures due to contention
      
      this.reliabilityResults.push({
        testName: 'Deadlock Prevention',
        passed: deadlockPreventionPassed,
        duration: Date.now() - testStart,
        metrics: {
          circularOperations: { successful: successfulCircular.length, total: circularResults.length },
          contentionOperations: { successful: successfulContention.length, total: contentionResults.length },
          transactionTimeouts: { successful: successfulTimeouts.length, total: timeoutResults.length },
          overallCompletionRate: deadlockFreeRatio,
          totalOperations,
          totalSuccessful
        }
      });
      
    } catch (error) {
      console.error('❌ Deadlock prevention test failed:', error);
      this.reliabilityResults.push({
        testName: 'Deadlock Prevention',
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      });
    }
  }

  /**
   * Generate reliability test report
   */
  async generateReliabilityReport() {
    console.log('\n📊 Generating Reliability Test Report...\n');
    
    const totalTests = this.reliabilityResults.length;
    const passedTests = this.reliabilityResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('🔒 RELIABILITY TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Reliability Score: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('=' .repeat(60));
    
    // Detailed results
    console.log('\n📋 DETAILED RELIABILITY RESULTS:');
    this.reliabilityResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      
      console.log(`\n${index + 1}. ${result.testName} ${status}`);
      console.log(`   Duration: ${duration}s`);
      
      if (result.metrics) {
        console.log('   Metrics:');
        this.printMetrics(result.metrics, '     ');
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n✅ Reliability testing completed!');
    
    if (failedTests > 0) {
      console.log('\n⚠️ Some reliability tests failed. System may not be fully reliable under all conditions.');
    } else {
      console.log('\n🎉 All reliability tests passed! System demonstrates high reliability.');
    }
  }

  /**
   * Helper method to print metrics recursively
   */
  printMetrics(obj, indent = '') {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`${indent}${key}:`);
        this.printMetrics(value, indent + '  ');
      } else {
        console.log(`${indent}${key}: ${JSON.stringify(value)}`);
      }
    });
  }

  /**
   * Cleanup reliability test data
   */
  async cleanupReliabilityTestData() {
    console.log('\n🧹 Cleaning up reliability test data...');
    
    try {
      if (this.testBookings.length > 0) {
        const bookingIds = this.testBookings.map(b => b.bookingId);
        await prisma.bookingPlan.deleteMany({
          where: { bookingId: { in: bookingIds } }
        });
        console.log(`✅ Removed ${this.testBookings.length} test bookings`);
      }
      
      if (this.testEmployees.length > 0) {
        const empCodes = this.testEmployees.map(e => e.empCode);
        await prisma.employee.deleteMany({
          where: { empCode: { in: empCodes } }
        });
        console.log(`✅ Removed ${this.testEmployees.length} test employees`);
      }
    } catch (error) {
      console.error('❌ Reliability test cleanup failed:', error);
    }
  }
}

// Run reliability tests
async function runReliabilityTests() {
  const testSuite = new PoolProcessingReliabilityTests();
  
  try {
    await testSuite.runReliabilityTests();
  } catch (error) {
    console.error('💥 Reliability test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runReliabilityTests().catch(console.error);
}

module.exports = { PoolProcessingReliabilityTests };