/**
 * Manual test runner for conflict detection functions
 * This validates the core logic without requiring a full test framework setup
 */

// Mock Prisma for testing
const mockBookings = [];

const mockPrisma = {
  bookingPlan: {
    findMany: async (query) => {
      // Simulate database query logic
      const { where } = query;
      const interpreterId = where.interpreterEmpCode;
      const statuses = where.bookingStatus.in;
      const startBefore = where.AND[0].timeStart.lt;
      const endAfter = where.AND[1].timeEnd.gt;
      
      console.log('Mock query:', { interpreterId, statuses, startBefore, endAfter });
      console.log('Mock bookings:', mockBookings);
      
      const filtered = mockBookings.filter(booking => {
        const matchesInterpreter = booking.interpreterEmpCode === interpreterId;
        const matchesStatus = statuses.includes(booking.bookingStatus);
        const matchesTime = booking.timeStart < startBefore && booking.timeEnd > endAfter;
        
        console.log('Booking check:', {
          booking: booking.bookingId,
          matchesInterpreter,
          matchesStatus,
          matchesTime,
          bookingStart: booking.timeStart,
          bookingEnd: booking.timeEnd
        });
        
        return matchesInterpreter && matchesStatus && matchesTime;
      });
      
      console.log('Filtered results:', filtered);
      return filtered;
    }
  }
};

// Set up global mock for the test version
global.mockPrisma = mockPrisma;

// Import the functions (we'll need to modify the import for testing)
const {
  checkInterpreterAvailability,
  getConflictingBookings,
  filterAvailableInterpreters,
  validateAssignmentSafety
} = require('../conflict-detection-test-version');

async function runTests() {
  console.log('🧪 Running Conflict Detection Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.log(`❌ ${message}`);
      failed++;
    }
  }
  
  // Test 1: No conflicts
  console.log('Test 1: No conflicts scenario');
  mockBookings.length = 0; // Clear mock data
  
  const available1 = await checkInterpreterAvailability(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  assert(available1 === true, 'Should return true when no conflicts exist');
  
  // Test 2: With conflicts
  console.log('\nTest 2: With conflicts scenario');
  mockBookings.push({
    bookingId: 123,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const available2 = await checkInterpreterAvailability(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  assert(available2 === false, 'Should return false when conflicts exist');
  
  // Test 3: Get conflict details
  console.log('\nTest 3: Get conflict details');
  const conflicts = await getConflictingBookings(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  console.log('Conflicts found:', conflicts);
  assert(conflicts.length === 1, 'Should return one conflict');
  if (conflicts.length > 0) {
    assert(conflicts[0].conflictingBookingId === 123, 'Should return correct booking ID');
    assert(conflicts[0].conflictType === 'OVERLAP', 'Should detect OVERLAP conflict type');
  }
  
  // Test 4: Filter available interpreters
  console.log('\nTest 4: Filter available interpreters');
  mockBookings.length = 0; // Clear conflicts for INT002
  
  const availableInterpreters = await filterAvailableInterpreters(
    ['INT001', 'INT002'],
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  assert(availableInterpreters.length === 1, 'Should return one available interpreter');
  assert(availableInterpreters[0] === 'INT002', 'Should return INT002 as available');
  
  // Test 5: Edge case - adjacent bookings
  console.log('\nTest 5: Adjacent bookings (should be considered conflicts)');
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 124,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T10:00:00Z'), // Starts exactly when our booking ends
    timeEnd: new Date('2024-01-15T11:00:00Z'),
    meetingType: 'Weekly'
  });
  
  const adjacentConflicts = await getConflictingBookings(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  assert(adjacentConflicts.length === 1, 'Should detect adjacent booking as conflict');
  assert(adjacentConflicts[0].conflictType === 'ADJACENT', 'Should classify as ADJACENT conflict');
  
  // Test 6: Cancelled bookings should not conflict
  console.log('\nTest 6: Cancelled bookings should not conflict');
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 125,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'cancel', // Cancelled booking
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const availableWithCancelled = await checkInterpreterAvailability(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  assert(availableWithCancelled === true, 'Should ignore cancelled bookings');
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('💥 Some tests failed!');
    return false;
  }
}

// Export for use
module.exports = { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}