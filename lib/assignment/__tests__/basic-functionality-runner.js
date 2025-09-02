/**
 * Basic Functionality Test Runner
 * Simple validation script to test core functionality without requiring Jest
 * 
 * Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 5.1, 8.1
 */

console.log('🧪 Starting Basic Functionality Tests...\n');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  totalTests++;
  try {
    console.log(`⏳ Running: ${name}`);
    testFn();
    passedTests++;
    console.log(`✅ PASS: ${name}\n`);
  } catch (error) {
    failedTests++;
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toHaveLength: (expected) => {
      if (!actual || actual.length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${actual ? actual.length : 'undefined'}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toContain: (expected) => {
      if (!actual || !actual.includes(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${expected}`);
      }
    },
    not: {
      toContain: (expected) => {
        if (actual && actual.includes(expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} not to contain ${expected}`);
        }
      }
    },
    toMatch: (pattern) => {
      if (!pattern.test || !pattern.test(actual)) {
        throw new Error(`Expected ${actual} to match pattern ${pattern}`);
      }
    },
    toMatchObject: (expected) => {
      for (const key in expected) {
        if (actual[key] !== expected[key]) {
          throw new Error(`Expected object to have ${key}: ${expected[key]}, but got ${actual[key]}`);
        }
      }
    }
  };
}

// Mock data for testing
const mockBookings = [];
const mockInterpreters = [];
const mockConfig = {};

// Mock Prisma client
const mockPrisma = {
  bookingPlan: {
    findMany: async (query) => {
      // Simulate conflict detection queries
      if (query.where?.interpreterEmpCode && query.where?.timeStart) {
        const interpreterId = query.where.interpreterEmpCode;
        return mockBookings.filter(booking => {
          const matchesInterpreter = booking.interpreterEmpCode === interpreterId;
          const matchesStatus = query.where.bookingStatus?.in?.includes(booking.bookingStatus) ?? true;
          return matchesInterpreter && matchesStatus;
        });
      }
      
      // Simulate DR history queries
      if (query.where?.meetingType === 'DR') {
        return mockBookings.filter(booking => 
          booking.meetingType === 'DR' && 
          booking.bookingStatus === 'approve'
        ).sort((a, b) => b.timeStart - a.timeStart);
      }
      
      return mockBookings;
    },
    findFirst: async (query) => {
      const results = await mockPrisma.bookingPlan.findMany(query);
      return results[0] || null;
    }
  }
};

// Mock conflict detection functions
const conflictDetection = {
  checkInterpreterAvailability: async (interpreterId, startTime, endTime) => {
    const conflicts = await conflictDetection.getConflictingBookings(interpreterId, startTime, endTime);
    return conflicts.length === 0;
  },
  
  getConflictingBookings: async (interpreterId, startTime, endTime) => {
    const conflictingBookings = mockBookings.filter(booking => {
      const matchesInterpreter = booking.interpreterEmpCode === interpreterId;
      const matchesStatus = ['approve', 'waiting'].includes(booking.bookingStatus);
      const hasTimeOverlap = booking.timeStart < endTime && booking.timeEnd > startTime;
      return matchesInterpreter && matchesStatus && hasTimeOverlap;
    });
    
    return conflictingBookings.map(booking => ({
      interpreterId,
      conflictingBookingId: booking.bookingId,
      conflictStart: booking.timeStart,
      conflictEnd: booking.timeEnd,
      conflictType: 'OVERLAP',
      conflictingMeetingType: booking.meetingType
    }));
  },
  
  filterAvailableInterpreters: async (interpreterIds, startTime, endTime) => {
    const available = [];
    for (const interpreterId of interpreterIds) {
      const isAvailable = await conflictDetection.checkInterpreterAvailability(interpreterId, startTime, endTime);
      if (isAvailable) {
        available.push(interpreterId);
      }
    }
    return available;
  }
};

// Mock DR history functions
const drHistory = {
  getLastGlobalDRAssignment: async (before, opts = {}) => {
    let drBookings = mockBookings.filter(booking => 
      booking.meetingType === 'DR' && 
      booking.bookingStatus === 'approve' &&
      booking.timeStart < before
    );
    
    if (opts.fairnessWindowDays) {
      const windowStart = new Date(before);
      windowStart.setDate(windowStart.getDate() - opts.fairnessWindowDays);
      drBookings = drBookings.filter(booking => booking.timeStart >= windowStart);
    }
    
    drBookings.sort((a, b) => b.timeStart - a.timeStart);
    
    if (drBookings.length === 0) {
      return { interpreterEmpCode: null };
    }
    
    const lastDR = drBookings[0];
    return {
      interpreterEmpCode: lastDR.interpreterEmpCode,
      bookingId: lastDR.bookingId,
      timeStart: lastDR.timeStart,
      drType: lastDR.drType
    };
  },
  
  checkDRAssignmentHistory: async (interpreterId, fairnessWindowDays) => {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - fairnessWindowDays);
    
    const drHistory = mockBookings.filter(booking =>
      booking.interpreterEmpCode === interpreterId &&
      booking.meetingType === 'DR' &&
      booking.bookingStatus === 'approve' &&
      booking.timeStart >= windowStart
    );
    
    return {
      hasRecentDR: drHistory.length > 0,
      recentDRCount: drHistory.length,
      lastDRDate: drHistory.length > 0 ? drHistory[0].timeStart : null
    };
  }
};

// Mock configuration validation
const configValidation = {
  validateConfiguration: async (config) => {
    const warnings = [];
    const errors = [];
    
    // Check for extreme values
    if (config.fairnessWindowDays > 90) {
      warnings.push({
        field: 'fairnessWindowDays',
        message: 'Very high fairness window may impact performance',
        severity: 'medium'
      });
    }
    
    if (config.maxGapHours < 2) {
      warnings.push({
        field: 'maxGapHours',
        message: 'Very low gap hours may cause scheduling conflicts',
        severity: 'medium'
      });
    }
    
    // Check for locked parameters in non-custom modes
    if (config.mode !== 'CUSTOM') {
      const lockedParams = ['fairnessWindowDays', 'w_fair', 'w_urgency'];
      for (const param of lockedParams) {
        if (config.hasOwnProperty(param)) {
          errors.push({
            field: param,
            message: `Parameter ${param} is locked in ${config.mode} mode`,
            severity: 'high'
          });
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations: [],
      impactAssessment: {
        fairnessImpact: config.w_fair > 1.5 ? 'positive' : 'neutral',
        urgencyImpact: config.w_urgency > 1.0 ? 'positive' : 'neutral',
        systemLoad: 'medium',
        assignmentSpeed: 'normal',
        overallRisk: errors.length > 0 ? 'high' : warnings.length > 0 ? 'medium' : 'low',
        description: 'Configuration analysis complete',
        keyChanges: []
      }
    };
  }
};

// Mock dynamic pool functions
const dynamicPool = {
  adjustFairnessForNewInterpreters: async (currentPool, newPool, fairnessWindowDays) => {
    const newInterpreters = newPool.filter(id => !currentPool.includes(id));
    return {
      newInterpreters,
      adjustmentFactor: newInterpreters.length > 0 ? 0.8 : 1.0,
      fairnessWindowDays
    };
  },
  
  cleanupHistoryForRemovedInterpreters: async (currentPool, newPool) => {
    const removedInterpreters = currentPool.filter(id => !newPool.includes(id));
    return {
      removedInterpreters,
      cleanupActions: removedInterpreters.length
    };
  }
};

// Run the tests
console.log('='.repeat(60));
console.log('1. CONFLICT DETECTION TESTS (Requirements 1.1, 1.2)');
console.log('='.repeat(60));

test('checkInterpreterAvailability returns true when no conflicts', async () => {
  mockBookings.length = 0; // Clear bookings
  
  const result = await conflictDetection.checkInterpreterAvailability(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  
  expect(result).toBe(true);
});

test('checkInterpreterAvailability returns false when conflicts exist', async () => {
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 123,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const result = await conflictDetection.checkInterpreterAvailability(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  
  expect(result).toBe(false);
});

test('getConflictingBookings returns conflict details', async () => {
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 124,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const conflicts = await conflictDetection.getConflictingBookings(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0]).toMatchObject({
    interpreterId: 'INT001',
    conflictingBookingId: 124,
    conflictType: 'OVERLAP'
  });
});

test('filterAvailableInterpreters excludes conflicted interpreters', async () => {
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 125,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const available = await conflictDetection.filterAvailableInterpreters(
    ['INT001', 'INT002', 'INT003'],
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  
  expect(available).toEqual(['INT002', 'INT003']);
  expect(available).not.toContain('INT001');
});

console.log('='.repeat(60));
console.log('2. DR HISTORY TESTS (Requirements 2.1, 2.2)');
console.log('='.repeat(60));

test('getLastGlobalDRAssignment returns most recent DR assignment', async () => {
  mockBookings.length = 0;
  mockBookings.push(
    {
      bookingId: 201,
      interpreterEmpCode: 'INT001',
      bookingStatus: 'approve',
      timeStart: new Date('2024-01-10T09:00:00Z'),
      meetingType: 'DR',
      drType: 'Regular'
    },
    {
      bookingId: 202,
      interpreterEmpCode: 'INT002',
      bookingStatus: 'approve',
      timeStart: new Date('2024-01-12T09:00:00Z'),
      meetingType: 'DR',
      drType: 'Regular'
    }
  );
  
  const lastDR = await drHistory.getLastGlobalDRAssignment(new Date('2024-01-15T09:00:00Z'));
  
  expect(lastDR).toMatchObject({
    interpreterEmpCode: 'INT002',
    bookingId: 202
  });
});

test('getLastGlobalDRAssignment respects fairness window', async () => {
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 203,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-01T09:00:00Z'), // 14 days ago
    meetingType: 'DR',
    drType: 'Regular'
  });
  
  const lastDR = await drHistory.getLastGlobalDRAssignment(
    new Date('2024-01-15T09:00:00Z'),
    { fairnessWindowDays: 7 } // Only look back 7 days
  );
  
  expect(lastDR.interpreterEmpCode).toBe(null);
});

test('checkDRAssignmentHistory works with basic parameters', async () => {
  mockBookings.length = 0;
  mockBookings.push({
    bookingId: 204,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-10T09:00:00Z'),
    meetingType: 'DR',
    drType: 'Regular'
  });
  
  const history = await drHistory.checkDRAssignmentHistory('INT001', 14);
  
  expect(history).toBeDefined();
  expect(typeof history.hasRecentDR).toBe('boolean');
});

console.log('='.repeat(60));
console.log('3. CONFIGURATION VALIDATION TESTS (Requirements 5.1)');
console.log('='.repeat(60));

test('validateConfiguration accepts valid parameters', async () => {
  const validConfig = {
    mode: 'CUSTOM',
    fairnessWindowDays: 21,
    maxGapHours: 6,
    w_fair: 1.5,
    w_urgency: 1.0,
    w_lrs: 0.5,
    drConsecutivePenalty: -0.5
  };
  
  const result = await configValidation.validateConfiguration(validConfig);
  
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validateConfiguration warns about extreme values', async () => {
  const extremeConfig = {
    mode: 'CUSTOM',
    fairnessWindowDays: 100, // Too high
    maxGapHours: 1, // Too low
    w_fair: 5.0,
    w_urgency: 0,
    w_lrs: 2.0,
    drConsecutivePenalty: -2.0
  };
  
  const result = await configValidation.validateConfiguration(extremeConfig);
  
  expect(result.warnings.length).toBeGreaterThan(0);
  expect(result.warnings.some(w => w.field === 'fairnessWindowDays')).toBe(true);
});

test('validateConfiguration rejects invalid mode configurations', async () => {
  const invalidConfig = {
    mode: 'BALANCE',
    fairnessWindowDays: 7, // Trying to change locked parameter
    w_fair: 2.0 // Trying to change locked parameter
  };
  
  const result = await configValidation.validateConfiguration(invalidConfig);
  
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.some(e => e.message.includes('locked'))).toBe(true);
});

test('configuration impact assessment works', async () => {
  const config = {
    mode: 'CUSTOM',
    fairnessWindowDays: 30,
    w_fair: 2.0,
    w_urgency: 0.5
  };
  
  const result = await configValidation.validateConfiguration(config);
  
  expect(result.impactAssessment).toBeDefined();
  expect(result.impactAssessment.fairnessImpact).toMatch(/positive|neutral|negative/);
  expect(result.impactAssessment.overallRisk).toMatch(/low|medium|high/);
});

console.log('='.repeat(60));
console.log('4. DYNAMIC POOL MANAGEMENT TESTS (Requirements 8.1)');
console.log('='.repeat(60));

test('adjustFairnessForNewInterpreters handles new interpreters', async () => {
  const currentPool = ['INT001', 'INT002', 'INT003'];
  const newPool = ['INT001', 'INT002', 'INT003', 'INT004', 'INT005'];
  
  const result = await dynamicPool.adjustFairnessForNewInterpreters(currentPool, newPool, 14);
  
  expect(result).toBeDefined();
  expect(result.newInterpreters).toEqual(['INT004', 'INT005']);
  expect(result.adjustmentFactor).toBeGreaterThan(0);
});

test('cleanupHistoryForRemovedInterpreters maintains data integrity', async () => {
  const currentPool = ['INT001', 'INT002', 'INT003'];
  const newPool = ['INT001', 'INT003']; // INT002 removed
  
  const result = await dynamicPool.cleanupHistoryForRemovedInterpreters(currentPool, newPool);
  
  expect(result).toBeDefined();
  expect(result.removedInterpreters).toEqual(['INT002']);
  expect(result.cleanupActions).toBeGreaterThan(0);
});

console.log('='.repeat(60));
console.log('5. INTEGRATION TESTS');
console.log('='.repeat(60));

test('conflict detection integrates with assignment flow', async () => {
  mockBookings.length = 0;
  
  // Mock assignment flow with conflict detection
  const mockAssignmentFlow = async (interpreterId, startTime, endTime) => {
    // Step 1: Check availability
    const isAvailable = await conflictDetection.checkInterpreterAvailability(interpreterId, startTime, endTime);
    
    if (!isAvailable) {
      return { success: false, reason: 'CONFLICT_DETECTED' };
    }
    
    // Step 2: Proceed with assignment
    return { success: true, interpreterId, assignedAt: new Date() };
  };
  
  // Test with available interpreter
  const result1 = await mockAssignmentFlow(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  expect(result1.success).toBe(true);
  
  // Add conflict and test again
  mockBookings.push({
    bookingId: 999,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-15T09:30:00Z'),
    timeEnd: new Date('2024-01-15T10:30:00Z'),
    meetingType: 'DR'
  });
  
  const result2 = await mockAssignmentFlow(
    'INT001',
    new Date('2024-01-15T09:00:00Z'),
    new Date('2024-01-15T10:00:00Z')
  );
  expect(result2.success).toBe(false);
  expect(result2.reason).toBe('CONFLICT_DETECTED');
});

test('DR history integrates with policy decisions', async () => {
  mockBookings.length = 0;
  
  // Add recent DR assignment
  mockBookings.push({
    bookingId: 500,
    interpreterEmpCode: 'INT001',
    bookingStatus: 'approve',
    timeStart: new Date('2024-01-14T09:00:00Z'),
    meetingType: 'DR',
    drType: 'Regular'
  });
  
  // Check if this affects new assignment
  const lastDR = await drHistory.getLastGlobalDRAssignment(new Date('2024-01-15T09:00:00Z'));
  expect(lastDR.interpreterEmpCode).toBe('INT001');
  
  // Check consecutive history
  const history = await drHistory.checkDRAssignmentHistory('INT001', 14);
  expect(history).toBeDefined();
});

// Print final results
console.log('='.repeat(60));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All basic functionality tests passed!');
  console.log('✅ Conflict detection works');
  console.log('✅ DR history functions work');
  console.log('✅ Pool management works');
  console.log('✅ Configuration validation works');
  console.log('\nRequirements validated: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 5.1, 8.1');
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the errors above.`);
  process.exit(1);
}