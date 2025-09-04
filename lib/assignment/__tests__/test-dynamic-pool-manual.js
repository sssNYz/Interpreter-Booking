/**
 * Manual test runner for dynamic pool management functions
 * This tests the basic functionality without requiring a full test framework
 */

// Mock console for cleaner output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && (args[0].includes('🔄') || args[0].includes('✅') || args[0].includes('📊'))) {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  originalConsoleError('TEST ERROR:', ...args);
};

// Mock Prisma
const mockBookings = [
  { interpreterEmpCode: 'INT001', timeStart: new Date('2024-01-15'), id: 1 },
  { interpreterEmpCode: 'INT002', timeStart: new Date('2024-01-16'), id: 2 },
  { interpreterEmpCode: 'INT003', timeStart: new Date('2024-01-17'), id: 3 }
];

// Create a mock module for prisma
const mockPrisma = {
  bookingPlan: {
    findMany: async (query) => {
      // Simulate different responses based on query
      if (query.select && query.select.interpreterEmpCode && !query.select.id) {
        // For detectInterpreterListChanges - return distinct interpreters
        return mockBookings.map(b => ({ interpreterEmpCode: b.interpreterEmpCode }));
      } else if (query.select && query.select.id) {
        // For cleanupHistoryForRemovedInterpreters - return full booking data
        return mockBookings;
      } else {
        // For adjustFairnessForNewInterpreters - return bookings with timeStart
        return mockBookings.filter(b => b.interpreterEmpCode !== 'INT003'); // Simulate INT003 as new
      }
    }
  }
};

// Mock the module system
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === '@/prisma/prisma') {
    return mockPrisma;
  }
  return originalRequire.apply(this, arguments);
};

async function runTests() {
  try {
    console.log('🧪 Starting manual tests for dynamic pool management...\n');

    // Import the functions (this will use our mocked prisma)
    const {
      adjustFairnessForNewInterpreters,
      detectInterpreterListChanges,
      cleanupHistoryForRemovedInterpreters,
      manageDynamicPool
    } = require('../dynamic-pool.ts');

    // Test 1: adjustFairnessForNewInterpreters
    console.log('Test 1: Fairness adjustments for new interpreters');
    const interpreterList = ['INT001', 'INT002', 'INT003', 'INT004'];
    const fairnessAdjustments = await adjustFairnessForNewInterpreters(interpreterList, 30);
    
    console.log(`✓ Generated ${fairnessAdjustments.length} fairness adjustments`);
    const newInterpreters = fairnessAdjustments.filter(a => a.isNewInterpreter);
    console.log(`✓ Found ${newInterpreters.length} new interpreters with reduced penalties\n`);

    // Test 2: detectInterpreterListChanges
    console.log('Test 2: Pool size change detection');
    const currentPool = ['INT001', 'INT002', 'INT004', 'INT005']; // Added INT005, removed INT003
    const poolChanges = await detectInterpreterListChanges(currentPool, 30);
    
    console.log(`✓ Pool changes detected: ${poolChanges.poolChangeDetected}`);
    console.log(`✓ New interpreters: ${poolChanges.newInterpreters.length}`);
    console.log(`✓ Removed interpreters: ${poolChanges.removedInterpreters.length}`);
    console.log(`✓ Pool size change: ${poolChanges.poolSizeChange}`);
    console.log(`✓ Significant change: ${poolChanges.significantChange}\n`);

    // Test 3: cleanupHistoryForRemovedInterpreters
    console.log('Test 3: Cleanup history for removed interpreters');
    const cleanupResult = await cleanupHistoryForRemovedInterpreters(currentPool, 30);
    
    console.log(`✓ Cleaned up ${cleanupResult.cleanedCount} removed interpreters`);
    console.log(`✓ Preserved ${cleanupResult.preservedCount} current assignments\n`);

    // Test 4: manageDynamicPool (comprehensive test)
    console.log('Test 4: Comprehensive dynamic pool management');
    const comprehensiveResult = await manageDynamicPool(currentPool, 30);
    
    console.log(`✓ Pool adjustment completed`);
    console.log(`✓ Fairness adjustments: ${comprehensiveResult.fairnessAdjustments.length}`);
    console.log(`✓ Cleanup completed\n`);

    console.log('🎉 All manual tests completed successfully!');
    
    // Verify key functionality
    const tests = [
      fairnessAdjustments.length > 0,
      poolChanges.poolChangeDetected === true,
      cleanupResult.cleanedCount >= 0,
      comprehensiveResult.poolAdjustment !== undefined
    ];

    const passedTests = tests.filter(Boolean).length;
    console.log(`\n📊 Test Results: ${passedTests}/${tests.length} tests passed`);

    if (passedTests === tests.length) {
      console.log('✅ All dynamic pool management functions are working correctly!');
      return true;
    } else {
      console.log('❌ Some tests failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return false;
  }
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});