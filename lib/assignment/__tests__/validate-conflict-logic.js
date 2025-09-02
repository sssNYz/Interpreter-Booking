/**
 * Simple validation of conflict detection logic
 */

// Import the conflict type determination function
function determineConflictType(requestStart, requestEnd, existingStart, existingEnd) {
  // Check if one booking is completely contained within the other
  if ((requestStart >= existingStart && requestEnd <= existingEnd) ||
      (existingStart >= requestStart && existingEnd <= requestEnd)) {
    return 'CONTAINED';
  }

  // Check if bookings are adjacent (end time of one equals start time of another)
  if (requestStart.getTime() === existingEnd.getTime() || 
      requestEnd.getTime() === existingStart.getTime()) {
    return 'ADJACENT';
  }

  // Otherwise, it's a partial overlap
  return 'OVERLAP';
}

function runLogicTests() {
  console.log('🧪 Testing Conflict Detection Logic...\n');
  
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
  
  // Test 1: OVERLAP conflict
  console.log('Test 1: OVERLAP conflict detection');
  const overlapType = determineConflictType(
    new Date('2024-01-15T09:00:00Z'), // Request: 9-10
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-15T09:30:00Z'), // Existing: 9:30-10:30
    new Date('2024-01-15T10:30:00Z')
  );
  assert(overlapType === 'OVERLAP', 'Should detect OVERLAP for partial overlap');
  
  // Test 2: CONTAINED conflict (request inside existing)
  console.log('\nTest 2: CONTAINED conflict detection (request inside existing)');
  const containedType1 = determineConflictType(
    new Date('2024-01-15T09:00:00Z'), // Request: 9-10
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-15T08:00:00Z'), // Existing: 8-11 (contains request)
    new Date('2024-01-15T11:00:00Z')
  );
  assert(containedType1 === 'CONTAINED', 'Should detect CONTAINED when request is inside existing');
  
  // Test 3: CONTAINED conflict (existing inside request)
  console.log('\nTest 3: CONTAINED conflict detection (existing inside request)');
  const containedType2 = determineConflictType(
    new Date('2024-01-15T08:00:00Z'), // Request: 8-11
    new Date('2024-01-15T11:00:00Z'),
    new Date('2024-01-15T09:00:00Z'), // Existing: 9-10 (inside request)
    new Date('2024-01-15T10:00:00Z')
  );
  assert(containedType2 === 'CONTAINED', 'Should detect CONTAINED when existing is inside request');
  
  // Test 4: ADJACENT conflict (request ends when existing starts)
  console.log('\nTest 4: ADJACENT conflict detection (request ends when existing starts)');
  const adjacentType1 = determineConflictType(
    new Date('2024-01-15T09:00:00Z'), // Request: 9-10
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-15T10:00:00Z'), // Existing: 10-11 (adjacent)
    new Date('2024-01-15T11:00:00Z')
  );
  assert(adjacentType1 === 'ADJACENT', 'Should detect ADJACENT when request ends as existing starts');
  
  // Test 5: ADJACENT conflict (existing ends when request starts)
  console.log('\nTest 5: ADJACENT conflict detection (existing ends when request starts)');
  const adjacentType2 = determineConflictType(
    new Date('2024-01-15T10:00:00Z'), // Request: 10-11
    new Date('2024-01-15T11:00:00Z'),
    new Date('2024-01-15T09:00:00Z'), // Existing: 9-10 (adjacent)
    new Date('2024-01-15T10:00:00Z')
  );
  assert(adjacentType2 === 'ADJACENT', 'Should detect ADJACENT when existing ends as request starts');
  
  // Test 6: No conflict (completely separate times)
  console.log('\nTest 6: No conflict scenario');
  // This test would be handled by the database query logic, not the conflict type function
  // The conflict type function only runs when there IS a conflict detected by the query
  
  // Test 7: Edge case - same start and end times
  console.log('\nTest 7: Exact same time periods');
  const exactSameType = determineConflictType(
    new Date('2024-01-15T09:00:00Z'), // Request: 9-10
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-15T09:00:00Z'), // Existing: 9-10 (exact same)
    new Date('2024-01-15T10:00:00Z')
  );
  assert(exactSameType === 'CONTAINED', 'Should detect CONTAINED for exact same time periods');
  
  // Test 8: Database query logic simulation
  console.log('\nTest 8: Database query overlap logic');
  
  function wouldOverlap(reqStart, reqEnd, existingStart, existingEnd) {
    // This simulates the database query logic:
    // booking overlaps if it starts before our end time and ends after our start time
    return existingStart < reqEnd && existingEnd > reqStart;
  }
  
  // Test various scenarios
  const scenarios = [
    {
      name: 'Partial overlap',
      reqStart: new Date('2024-01-15T09:00:00Z'),
      reqEnd: new Date('2024-01-15T10:00:00Z'),
      existingStart: new Date('2024-01-15T09:30:00Z'),
      existingEnd: new Date('2024-01-15T10:30:00Z'),
      shouldOverlap: true
    },
    {
      name: 'No overlap (before)',
      reqStart: new Date('2024-01-15T09:00:00Z'),
      reqEnd: new Date('2024-01-15T10:00:00Z'),
      existingStart: new Date('2024-01-15T11:00:00Z'),
      existingEnd: new Date('2024-01-15T12:00:00Z'),
      shouldOverlap: false
    },
    {
      name: 'No overlap (after)',
      reqStart: new Date('2024-01-15T11:00:00Z'),
      reqEnd: new Date('2024-01-15T12:00:00Z'),
      existingStart: new Date('2024-01-15T09:00:00Z'),
      existingEnd: new Date('2024-01-15T10:00:00Z'),
      shouldOverlap: false
    },
    {
      name: 'Adjacent (touching)',
      reqStart: new Date('2024-01-15T09:00:00Z'),
      reqEnd: new Date('2024-01-15T10:00:00Z'),
      existingStart: new Date('2024-01-15T10:00:00Z'),
      existingEnd: new Date('2024-01-15T11:00:00Z'),
      shouldOverlap: false // Adjacent bookings don't overlap in time
    }
  ];
  
  scenarios.forEach(scenario => {
    const overlaps = wouldOverlap(scenario.reqStart, scenario.reqEnd, scenario.existingStart, scenario.existingEnd);
    assert(overlaps === scenario.shouldOverlap, `${scenario.name}: ${scenario.shouldOverlap ? 'should' : 'should not'} overlap`);
  });
  
  console.log(`\n📊 Logic Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All logic tests passed!');
    return true;
  } else {
    console.log('💥 Some logic tests failed!');
    return false;
  }
}

// Run tests
runLogicTests();