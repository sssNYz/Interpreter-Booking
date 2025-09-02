/**
 * Pool Processing Performance Integration Tests
 * 
 * Focused performance testing for pool processing under various load conditions
 */

const { PrismaClient, PoolStatus } = require('@prisma/client');

const prisma = new PrismaClient();

class PoolProcessingPerformanceTests {
  constructor() {
    this.performanceMetrics = [];
    this.testBookings = [];
    this.testEmployees = [];
  }

  /**
   * Run all performance tests
   */
  async runPerformanceTests() {
    console.log('⚡ Starting Pool Processing Performance Tests...\n');
    
    try {
      await this.setupPerformanceTestData();
      
      // Performance Test 1: Database Query Performance
      await this.testDatabaseQueryPerformance();
      
      // Performance Test 2: Bulk Pool Operations
      await this.testBulkPoolOperations();
      
      // Performance Test 3: Concurrent Processing Performance
      await this.testConcurrentProcessingPerformance();
      
      // Performance Test 4: Memory Usage Under Load
      await this.testMemoryUsageUnderLoad();
      
      // Performance Test 5: Scalability Testing
      await this.testScalabilityLimits();
      
      await this.generatePerformanceReport();
      
    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      throw error;
    } finally {
      await this.cleanupPerformanceTestData();
      await prisma.$disconnect();
    }
  }

  /**
   * Setup performance test data
   */
  async setupPerformanceTestData() {
    console.log('📋 Setting up performance test data...');
    
    // Create test employees for performance testing
    const employees = Array.from({ length: 10 }, (_, i) => ({
      empCode: `PERF_INT_${String(i + 1).padStart(3, '0')}`,
      firstNameEn: 'Performance',
      lastNameEn: `Interpreter${i + 1}`,
      email: `perf_int${i + 1}@test.com`,
      isActive: true
    }));
    
    const bookers = Array.from({ length: 5 }, (_, i) => ({
      empCode: `PERF_BOOK_${String(i + 1).padStart(3, '0')}`,
      firstNameEn: 'Performance',
      lastNameEn: `Booker${i + 1}`,
      email: `perf_book${i + 1}@test.com`,
      isActive: true
    }));
    
    for (const emp of [...employees, ...bookers]) {
      const employee = await prisma.employee.create({ data: emp });
      this.testEmployees.push(employee);
    }
    
    console.log(`✅ Created ${this.testEmployees.length} performance test employees`);
  }

  /**
   * Test database query performance with various pool sizes
   */
  async testDatabaseQueryPerformance() {
    console.log('\n1️⃣ Testing Database Query Performance...');
    
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    
    const poolSizes = [10, 50, 100, 500, 1000];
    
    for (const size of poolSizes) {
      console.log(`📊 Testing with pool size: ${size}`);
      
      // Create bookings for this test
      const bookings = [];
      const batchSize = 50;
      
      for (let i = 0; i < size; i += batchSize) {
        const batch = [];
        const currentBatchSize = Math.min(batchSize, size - i);
        
        for (let j = 0; j < currentBatchSize; j++) {
          const bookingIndex = i + j;
          const booking = await prisma.bookingPlan.create({
            data: {
              ownerEmpCode: 'PERF_BOOK_001',
              ownerGroup: 'software',
              meetingRoom: `PERF_QUERY_${bookingIndex + 1}`,
              meetingType: 'General',
              timeStart: new Date(Date.now() + (2 + Math.random() * 5) * 24 * 60 * 60 * 1000),
              timeEnd: new Date(Date.now() + (2 + Math.random() * 5) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
              bookingStatus: 'waiting'
            }
          });
          
          batch.push(booking);
          bookings.push(booking);
          this.testBookings.push(booking);
        }
        
        // Add batch to pool
        for (const booking of batch) {
          const deadlineTime = new Date(booking.timeStart.getTime() - (1 + Math.random()) * 24 * 60 * 60 * 1000);
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
        }
      }
      
      // Test various query operations
      const queryTests = [
        {
          name: 'getPoolStats',
          operation: () => bookingPool.getPoolStats()
        },
        {
          name: 'getReadyForAssignment',
          operation: () => bookingPool.getReadyForAssignment()
        },
        {
          name: 'getDeadlineEntries',
          operation: () => bookingPool.getDeadlineEntries()
        },
        {
          name: 'getAllPoolEntries',
          operation: () => bookingPool.getAllPoolEntries()
        },
        {
          name: 'getFailedEntries',
          operation: () => bookingPool.getFailedEntries()
        }
      ];
      
      const queryMetrics = {};
      
      for (const test of queryTests) {
        const iterations = 5;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await test.operation();
          const duration = Date.now() - start;
          times.push(duration);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        queryMetrics[test.name] = {
          avgTime,
          minTime,
          maxTime,
          iterations
        };
        
        console.log(`  ${test.name}: avg=${avgTime.toFixed(2)}ms, min=${minTime}ms, max=${maxTime}ms`);
      }
      
      this.performanceMetrics.push({
        testName: 'Database Query Performance',
        poolSize: size,
        metrics: queryMetrics,
        timestamp: new Date()
      });
      
      // Clean up this batch
      await prisma.bookingPlan.updateMany({
        where: {
          bookingId: {
            in: bookings.map(b => b.bookingId)
          }
        },
        data: {
          poolStatus: null,
          poolEntryTime: null,
          poolDeadlineTime: null,
          poolProcessingAttempts: 0
        }
      });
      
      await prisma.bookingPlan.deleteMany({
        where: {
          bookingId: {
            in: bookings.map(b => b.bookingId)
          }
        }
      });
      
      // Remove from tracking
      this.testBookings = this.testBookings.filter(b => 
        !bookings.some(db => db.bookingId === b.bookingId)
      );
    }
  }

  /**
   * Test bulk pool operations performance
   */
  async testBulkPoolOperations() {
    console.log('\n2️⃣ Testing Bulk Pool Operations Performance...');
    
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    
    const operationSizes = [10, 50, 100, 200];
    
    for (const size of operationSizes) {
      console.log(`📦 Testing bulk operations with ${size} entries...`);
      
      // Create bookings for bulk operations
      const bookings = [];
      for (let i = 0; i < size; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'PERF_BOOK_002',
            ownerGroup: 'software',
            meetingRoom: `BULK_OP_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        bookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Test bulk add to pool
      const addStart = Date.now();
      for (const booking of bookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      const addDuration = Date.now() - addStart;
      const addThroughput = size / (addDuration / 1000);
      
      console.log(`  Bulk Add: ${addDuration}ms (${addThroughput.toFixed(2)} ops/sec)`);
      
      // Test bulk status updates
      const updateStart = Date.now();
      for (const booking of bookings) {
        await bookingPool.markAsProcessing(booking.bookingId);
      }
      const updateDuration = Date.now() - updateStart;
      const updateThroughput = size / (updateDuration / 1000);
      
      console.log(`  Bulk Update: ${updateDuration}ms (${updateThroughput.toFixed(2)} ops/sec)`);
      
      // Test bulk remove from pool
      const removeStart = Date.now();
      for (const booking of bookings) {
        await bookingPool.removeFromPool(booking.bookingId);
      }
      const removeDuration = Date.now() - removeStart;
      const removeThroughput = size / (removeDuration / 1000);
      
      console.log(`  Bulk Remove: ${removeDuration}ms (${removeThroughput.toFixed(2)} ops/sec)`);
      
      this.performanceMetrics.push({
        testName: 'Bulk Pool Operations',
        operationSize: size,
        metrics: {
          addDuration,
          addThroughput,
          updateDuration,
          updateThroughput,
          removeDuration,
          removeThroughput
        },
        timestamp: new Date()
      });
      
      // Cleanup
      await prisma.bookingPlan.deleteMany({
        where: {
          bookingId: {
            in: bookings.map(b => b.bookingId)
          }
        }
      });
      
      this.testBookings = this.testBookings.filter(b => 
        !bookings.some(db => db.bookingId === b.bookingId)
      );
    }
  }

  /**
   * Test concurrent processing performance
   */
  async testConcurrentProcessingPerformance() {
    console.log('\n3️⃣ Testing Concurrent Processing Performance...');
    
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
    
    const concurrencyLevels = [1, 2, 5, 10];
    
    for (const concurrency of concurrencyLevels) {
      console.log(`🔄 Testing with concurrency level: ${concurrency}`);
      
      // Create bookings for concurrent processing
      const bookings = [];
      const bookingsPerThread = 20;
      const totalBookings = concurrency * bookingsPerThread;
      
      for (let i = 0; i < totalBookings; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'PERF_BOOK_003',
            ownerGroup: 'software',
            meetingRoom: `CONCURRENT_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (1 + Math.random() * 2) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (1 + Math.random() * 2) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        bookings.push(booking);
        this.testBookings.push(booking);
      }
      
      // Add all to pool
      for (const booking of bookings) {
        const deadlineTime = new Date(booking.timeStart.getTime() - Math.random() * 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      // Test concurrent processing
      const engine = getPoolProcessingEngine();
      
      const concurrentStart = Date.now();
      
      const concurrentPromises = Array(concurrency).fill().map(async (_, threadIndex) => {
        const threadStart = Date.now();
        
        // Each thread processes some entries
        const readyResults = await engine.processReadyEntries();
        const deadlineResults = await engine.processDeadlineEntries();
        
        const threadDuration = Date.now() - threadStart;
        
        return {
          threadIndex,
          readyResults: readyResults.length,
          deadlineResults: deadlineResults.length,
          threadDuration
        };
      });
      
      const concurrentResults = await Promise.all(concurrentPromises);
      const concurrentDuration = Date.now() - concurrentStart;
      
      const totalProcessed = concurrentResults.reduce((sum, result) => 
        sum + result.readyResults + result.deadlineResults, 0
      );
      
      const avgThreadDuration = concurrentResults.reduce((sum, result) => 
        sum + result.threadDuration, 0
      ) / concurrentResults.length;
      
      const throughput = totalProcessed / (concurrentDuration / 1000);
      
      console.log(`  Concurrent Duration: ${concurrentDuration}ms`);
      console.log(`  Avg Thread Duration: ${avgThreadDuration.toFixed(2)}ms`);
      console.log(`  Total Processed: ${totalProcessed}`);
      console.log(`  Throughput: ${throughput.toFixed(2)} entries/sec`);
      
      this.performanceMetrics.push({
        testName: 'Concurrent Processing Performance',
        concurrencyLevel: concurrency,
        metrics: {
          concurrentDuration,
          avgThreadDuration,
          totalProcessed,
          throughput,
          threadResults: concurrentResults
        },
        timestamp: new Date()
      });
      
      // Cleanup
      await prisma.bookingPlan.deleteMany({
        where: {
          bookingId: {
            in: bookings.map(b => b.bookingId)
          }
        }
      });
      
      this.testBookings = this.testBookings.filter(b => 
        !bookings.some(db => db.bookingId === b.bookingId)
      );
    }
  }

  /**
   * Test memory usage under load
   */
  async testMemoryUsageUnderLoad() {
    console.log('\n4️⃣ Testing Memory Usage Under Load...');
    
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    
    const getMemoryUsage = () => {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
      };
    };
    
    const initialMemory = getMemoryUsage();
    console.log(`📊 Initial memory usage:`, initialMemory);
    
    const loadSizes = [100, 500, 1000];
    
    for (const loadSize of loadSizes) {
      console.log(`🔄 Testing memory usage with ${loadSize} pool entries...`);
      
      const beforeLoad = getMemoryUsage();
      
      // Create load
      const bookings = [];
      for (let i = 0; i < loadSize; i++) {
        const booking = await prisma.bookingPlan.create({
          data: {
            ownerEmpCode: 'PERF_BOOK_004',
            ownerGroup: 'software',
            meetingRoom: `MEMORY_${i + 1}`,
            meetingType: 'General',
            timeStart: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000),
            timeEnd: new Date(Date.now() + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            bookingStatus: 'waiting'
          }
        });
        
        bookings.push(booking);
        this.testBookings.push(booking);
        
        // Add to pool
        const deadlineTime = new Date(booking.timeStart.getTime() - 24 * 60 * 60 * 1000);
        await bookingPool.addToPool(booking.bookingId, deadlineTime);
      }
      
      const afterLoad = getMemoryUsage();
      
      // Perform operations to test memory usage
      const operations = [
        () => bookingPool.getPoolStats(),
        () => bookingPool.getAllPoolEntries(),
        () => bookingPool.getReadyForAssignment(),
        () => bookingPool.getDeadlineEntries()
      ];
      
      for (const operation of operations) {
        await operation();
      }
      
      const afterOperations = getMemoryUsage();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterGC = getMemoryUsage();
      
      console.log(`  Before load: ${beforeLoad.heapUsed}MB heap`);
      console.log(`  After load: ${afterLoad.heapUsed}MB heap (+${afterLoad.heapUsed - beforeLoad.heapUsed}MB)`);
      console.log(`  After operations: ${afterOperations.heapUsed}MB heap`);
      console.log(`  After GC: ${afterGC.heapUsed}MB heap`);
      
      this.performanceMetrics.push({
        testName: 'Memory Usage Under Load',
        loadSize,
        metrics: {
          beforeLoad,
          afterLoad,
          afterOperations,
          afterGC,
          memoryIncrease: afterLoad.heapUsed - beforeLoad.heapUsed,
          memoryPerEntry: (afterLoad.heapUsed - beforeLoad.heapUsed) / loadSize
        },
        timestamp: new Date()
      });
      
      // Cleanup
      await prisma.bookingPlan.deleteMany({
        where: {
          bookingId: {
            in: bookings.map(b => b.bookingId)
          }
        }
      });
      
      this.testBookings = this.testBookings.filter(b => 
        !bookings.some(db => db.bookingId === b.bookingId)
      );
    }
  }

  /**
   * Test scalability limits
   */
  async testScalabilityLimits() {
    console.log('\n5️⃣ Testing Scalability Limits...');
    
    const { bookingPool } = await import('../lib/assignment/pool.ts');
    const { getPoolProcessingEngine } = await import('../lib/assignment/pool-engine.ts');
    
    // Test with increasingly large pool sizes to find performance degradation points
    const scaleSizes = [1000, 2000, 5000];
    
    for (const scaleSize of scaleSizes) {
      console.log(`📈 Testing scalability with ${scaleSize} entries...`);
      
      const scaleStart = Date.now();
      
      // Create large number of bookings
      const bookings = [];
      const batchSize = 100;
      
      for (let i = 0; i < scaleSize; i += batchSize) {
        const batch = [];
        const currentBatchSize = Math.min(batchSize, scaleSize - i);
        
        for (let j = 0; j < currentBatchSize; j++) {
          const bookingIndex = i + j;
          const booking = await prisma.bookingPlan.create({
            data: {
              ownerEmpCode: 'PERF_BOOK_005',
              ownerGroup: 'software',
              meetingRoom: `SCALE_${bookingIndex + 1}`,
              meetingType: 'General',
              timeStart: new Date(Date.now() + (1 + Math.random() * 4) * 24 * 60 * 60 * 1000),
              timeEnd: new Date(Date.now() + (1 + Math.random() * 4) * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
              bookingStatus: 'waiting'
            }
          });
          
          batch.push(booking);
          bookings.push(booking);
          this.testBookings.push(booking);
        }
        
        // Add batch to pool
        for (const booking of batch) {
          const deadlineTime = new Date(booking.timeStart.getTime() - Math.random() * 2 * 24 * 60 * 60 * 1000);
          await bookingPool.addToPool(booking.bookingId, deadlineTime);
        }
        
        if ((i + batchSize) % 500 === 0) {
          console.log(`  Created ${i + batchSize}/${scaleSize} entries...`);
        }
      }
      
      const creationTime = Date.now() - scaleStart;
      console.log(`  Creation completed in ${creationTime}ms`);
      
      // Test various operations at scale
      const scaleTests = [
        {
          name: 'getPoolStats',
          operation: () => bookingPool.getPoolStats()
        },
        {
          name: 'getReadyForAssignment',
          operation: () => bookingPool.getReadyForAssignment()
        },
        {
          name: 'processReadyEntries',
          operation: async () => {
            const engine = getPoolProcessingEngine();
            return await engine.processReadyEntries();
          }
        }
      ];
      
      const scaleMetrics = {};
      
      for (const test of scaleTests) {
        const testStart = Date.now();
        const result = await test.operation();
        const testDuration = Date.now() - testStart;
        
        scaleMetrics[test.name] = {
          duration: testDuration,
          throughput: scaleSize / (testDuration / 1000),
          resultSize: Array.isArray(result) ? result.length : (result ? 1 : 0)
        };
        
        console.log(`  ${test.name}: ${testDuration}ms (${scaleMetrics[test.name].throughput.toFixed(2)} entries/sec)`);
      }
      
      const totalTime = Date.now() - scaleStart;
      
      this.performanceMetrics.push({
        testName: 'Scalability Limits',
        scaleSize,
        metrics: {
          creationTime,
          totalTime,
          scaleTests: scaleMetrics
        },
        timestamp: new Date()
      });
      
      // Cleanup in batches to avoid timeout
      console.log(`  Cleaning up ${bookings.length} entries...`);
      for (let i = 0; i < bookings.length; i += batchSize) {
        const batch = bookings.slice(i, i + batchSize);
        await prisma.bookingPlan.deleteMany({
          where: {
            bookingId: {
              in: batch.map(b => b.bookingId)
            }
          }
        });
      }
      
      this.testBookings = this.testBookings.filter(b => 
        !bookings.some(db => db.bookingId === b.bookingId)
      );
      
      console.log(`  Cleanup completed`);
    }
  }

  /**
   * Generate performance test report
   */
  async generatePerformanceReport() {
    console.log('\n📊 Generating Performance Test Report...\n');
    
    console.log('⚡ PERFORMANCE TEST SUMMARY');
    console.log('=' .repeat(60));
    
    // Database Query Performance Summary
    const queryTests = this.performanceMetrics.filter(m => m.testName === 'Database Query Performance');
    if (queryTests.length > 0) {
      console.log('\n📊 DATABASE QUERY PERFORMANCE:');
      queryTests.forEach(test => {
        console.log(`  Pool Size: ${test.poolSize}`);
        Object.entries(test.metrics).forEach(([operation, metrics]) => {
          console.log(`    ${operation}: ${metrics.avgTime.toFixed(2)}ms avg (${metrics.minTime}-${metrics.maxTime}ms)`);
        });
      });
    }
    
    // Bulk Operations Performance Summary
    const bulkTests = this.performanceMetrics.filter(m => m.testName === 'Bulk Pool Operations');
    if (bulkTests.length > 0) {
      console.log('\n📦 BULK OPERATIONS PERFORMANCE:');
      bulkTests.forEach(test => {
        console.log(`  Operation Size: ${test.operationSize}`);
        console.log(`    Add Throughput: ${test.metrics.addThroughput.toFixed(2)} ops/sec`);
        console.log(`    Update Throughput: ${test.metrics.updateThroughput.toFixed(2)} ops/sec`);
        console.log(`    Remove Throughput: ${test.metrics.removeThroughput.toFixed(2)} ops/sec`);
      });
    }
    
    // Concurrent Processing Performance Summary
    const concurrentTests = this.performanceMetrics.filter(m => m.testName === 'Concurrent Processing Performance');
    if (concurrentTests.length > 0) {
      console.log('\n🔄 CONCURRENT PROCESSING PERFORMANCE:');
      concurrentTests.forEach(test => {
        console.log(`  Concurrency Level: ${test.concurrencyLevel}`);
        console.log(`    Throughput: ${test.metrics.throughput.toFixed(2)} entries/sec`);
        console.log(`    Avg Thread Duration: ${test.metrics.avgThreadDuration.toFixed(2)}ms`);
      });
    }
    
    // Memory Usage Summary
    const memoryTests = this.performanceMetrics.filter(m => m.testName === 'Memory Usage Under Load');
    if (memoryTests.length > 0) {
      console.log('\n💾 MEMORY USAGE SUMMARY:');
      memoryTests.forEach(test => {
        console.log(`  Load Size: ${test.loadSize}`);
        console.log(`    Memory Increase: ${test.metrics.memoryIncrease}MB`);
        console.log(`    Memory Per Entry: ${test.metrics.memoryPerEntry.toFixed(3)}MB`);
      });
    }
    
    // Scalability Summary
    const scaleTests = this.performanceMetrics.filter(m => m.testName === 'Scalability Limits');
    if (scaleTests.length > 0) {
      console.log('\n📈 SCALABILITY SUMMARY:');
      scaleTests.forEach(test => {
        console.log(`  Scale Size: ${test.scaleSize}`);
        console.log(`    Creation Time: ${test.metrics.creationTime}ms`);
        Object.entries(test.metrics.scaleTests).forEach(([operation, metrics]) => {
          console.log(`    ${operation}: ${metrics.throughput.toFixed(2)} entries/sec`);
        });
      });
    }
    
    console.log('\n✅ Performance testing completed!');
  }

  /**
   * Cleanup performance test data
   */
  async cleanupPerformanceTestData() {
    console.log('\n🧹 Cleaning up performance test data...');
    
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
      console.error('❌ Performance test cleanup failed:', error);
    }
  }
}

// Run performance tests
async function runPerformanceTests() {
  const testSuite = new PoolProcessingPerformanceTests();
  
  try {
    await testSuite.runPerformanceTests();
  } catch (error) {
    console.error('💥 Performance test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { PoolProcessingPerformanceTests };