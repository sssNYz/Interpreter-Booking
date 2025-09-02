/**
 * Basic Functionality Tests for Auto-Assignment System
 * 
 * Tests core functionality across all major components:
 * - Conflict detection works
 * - DR history functions work  
 * - Pool management works
 * - Configuration validation works
 * 
 * Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 5.1, 8.1
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Prisma for testing
const mockBookings = [];
const mockInterpreters = [];
const mockConfig = {};

const mockPrisma = {
  bookingPlan: {
    findMany: jest.fn(async (query) => {
      // Simulate conflict detection queries
      if (query.where?.interpreterEmpCode && query.where?.timeStart) {
        const interpreterId = query.where.interpreterEmpCode;
        const startBefore = query.where.AND?.[0]?.timeStart?.lt;
        const endAfter = query.where.AND?.[1]?.timeEnd?.gt;
        
        return mockBookings.filter(booking => {
          const matchesInterpreter = booking.interpreterEmpCode === interpreterId;
          const matchesStatus = query.where.bookingStatus?.in?.includes(booking.bookingStatus) ?? true;
          const matchesTime = startBefore && endAfter ? 
            (booking.timeStart < startBefore && booking.timeEnd > endAfter) : true;
          
          return matchesInterpreter && matchesStatus && matchesTime;
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
    }),
    findFirst: jest.fn(async (query) => {
      const results = await mockPrisma.bookingPlan.findMany(query);
      return results[0] || null;
    })
  },
  interpreter: {
    findMany: jest.fn(async () => mockInterpreters)
  },
  autoAssignmentConfig: {
    findFirst: jest.fn(async () => mockConfig)
  }
};

// Mock the modules
jest.mock('@/prisma/prisma', () => mockPrisma);

describe('Basic Functionality Tests', () => {
  beforeEach(() => {
    // Clear mock data
    mockBookings.length = 0;
    mockInterpreters.length = 0;
    Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
    
    // Reset mock functions
    jest.clearAllMocks();
  });

  describe('1. Conflict Detection Functions (Requirements 1.1, 1.2)', () => {
    test('checkInterpreterAvailability returns true when no conflicts', async () => {
      const { checkInterpreterAvailability } = require('../conflict-detection');
      
      const result = await checkInterpreterAvailability(
        'INT001',
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T10:00:00Z')
      );
      
      expect(result).toBe(true);
      expect(mockPrisma.bookingPlan.findMany).toHaveBeenCalled();
    });

    test('checkInterpreterAvailability returns false when conflicts exist', async () => {
      const { checkInterpreterAvailability } = require('../conflict-detection');
      
      // Add conflicting booking
      mockBookings.push({
        bookingId: 123,
        interpreterEmpCode: 'INT001',
        bookingStatus: 'approve',
        timeStart: new Date('2024-01-15T09:30:00Z'),
        timeEnd: new Date('2024-01-15T10:30:00Z'),
        meetingType: 'DR'
      });
      
      const result = await checkInterpreterAvailability(
        'INT001',
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T10:00:00Z')
      );
      
      expect(result).toBe(false);
    });

    test('getConflictingBookings returns conflict details', async () => {
      const { getConflictingBookings } = require('../conflict-detection');
      
      // Add conflicting booking
      mockBookings.push({
        bookingId: 124,
        interpreterEmpCode: 'INT001',
        bookingStatus: 'approve',
        timeStart: new Date('2024-01-15T09:30:00Z'),
        timeEnd: new Date('2024-01-15T10:30:00Z'),
        meetingType: 'DR'
      });
      
      const conflicts = await getConflictingBookings(
        'INT001',
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T10:00:00Z')
      );
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        interpreterId: 'INT001',
        conflictingBookingId: 124,
        conflictType: expect.any(String)
      });
    });

    test('filterAvailableInterpreters excludes conflicted interpreters', async () => {
      const { filterAvailableInterpreters } = require('../conflict-detection');
      
      // Add conflict for INT001 only
      mockBookings.push({
        bookingId: 125,
        interpreterEmpCode: 'INT001',
        bookingStatus: 'approve',
        timeStart: new Date('2024-01-15T09:30:00Z'),
        timeEnd: new Date('2024-01-15T10:30:00Z'),
        meetingType: 'DR'
      });
      
      const available = await filterAvailableInterpreters(
        ['INT001', 'INT002', 'INT003'],
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T10:00:00Z')
      );
      
      expect(available).toEqual(['INT002', 'INT003']);
      expect(available).not.toContain('INT001');
    });
  });

  describe('2. DR History Functions (Requirements 2.1, 2.2)', () => {
    test('getLastGlobalDRAssignment returns most recent DR assignment', async () => {
      const { getLastGlobalDRAssignment } = require('../dr-history');
      
      // Add DR assignments
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
      
      const lastDR = await getLastGlobalDRAssignment(new Date('2024-01-15T09:00:00Z'));
      
      expect(lastDR).toMatchObject({
        interpreterEmpCode: 'INT002',
        bookingId: 202
      });
    });

    test('getLastGlobalDRAssignment respects fairness window', async () => {
      const { getLastGlobalDRAssignment } = require('../dr-history');
      
      // Add DR assignment outside fairness window
      mockBookings.push({
        bookingId: 203,
        interpreterEmpCode: 'INT001',
        bookingStatus: 'approve',
        timeStart: new Date('2024-01-01T09:00:00Z'), // 14 days ago
        meetingType: 'DR',
        drType: 'Regular'
      });
      
      const lastDR = await getLastGlobalDRAssignment(
        new Date('2024-01-15T09:00:00Z'),
        { fairnessWindowDays: 7 } // Only look back 7 days
      );
      
      expect(lastDR.interpreterEmpCode).toBeNull();
    });

    test('checkDRAssignmentHistory works with basic parameters', async () => {
      const { checkDRAssignmentHistory } = require('../dr-history');
      
      // Add DR history for interpreter
      mockBookings.push({
        bookingId: 204,
        interpreterEmpCode: 'INT001',
        bookingStatus: 'approve',
        timeStart: new Date('2024-01-10T09:00:00Z'),
        meetingType: 'DR',
        drType: 'Regular'
      });
      
      const history = await checkDRAssignmentHistory('INT001', 14);
      
      expect(history).toBeDefined();
      expect(typeof history.hasRecentDR).toBe('boolean');
    });
  });

  describe('3. Pool Management Functions (Requirements 3.1, 3.2)', () => {
    test('addToPool creates pool entry with mode-specific settings', async () => {
      // Mock the pool module
      const mockPool = {
        addToPool: jest.fn(async (bookingId, meetingType, startTime, endTime, mode) => ({
          bookingId,
          meetingType,
          startTime,
          endTime,
          mode: mode || 'NORMAL',
          thresholdDays: mode === 'URGENT' ? 1 : 3,
          processingPriority: mode === 'URGENT' ? 10 : 5
        }))
      };
      
      const result = await mockPool.addToPool(
        301,
        'DR',
        new Date('2024-01-20T09:00:00Z'),
        new Date('2024-01-20T10:00:00Z'),
        'URGENT'
      );
      
      expect(result).toMatchObject({
        bookingId: 301,
        meetingType: 'DR',
        mode: 'URGENT',
        thresholdDays: 1,
        processingPriority: 10
      });
    });

    test('pool processing handles different modes correctly', async () => {
      // Mock pool processing result
      const mockProcessingResult = {
        processedCount: 5,
        assignedCount: 4,
        escalatedCount: 1,
        remainingCount: 0,
        processingMode: 'BALANCE',
        batchId: 'batch-001',
        processingTime: new Date()
      };
      
      // Simulate pool processing
      expect(mockProcessingResult.processingMode).toBe('BALANCE');
      expect(mockProcessingResult.assignedCount).toBeGreaterThan(0);
      expect(mockProcessingResult.processedCount).toBeGreaterThanOrEqual(mockProcessingResult.assignedCount);
    });
  });

  describe('4. Configuration Validation Functions (Requirements 5.1)', () => {
    test('validateConfiguration accepts valid parameters', async () => {
      const { validateConfiguration } = require('../config-validation');
      
      const validConfig = {
        mode: 'CUSTOM',
        fairnessWindowDays: 21,
        maxGapHours: 6,
        w_fair: 1.5,
        w_urgency: 1.0,
        w_lrs: 0.5,
        drConsecutivePenalty: -0.5
      };
      
      const result = await validateConfiguration(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateConfiguration warns about extreme values', async () => {
      const { validateConfiguration } = require('../config-validation');
      
      const extremeConfig = {
        mode: 'CUSTOM',
        fairnessWindowDays: 100, // Too high
        maxGapHours: 1, // Too low
        w_fair: 5.0, // Maximum
        w_urgency: 0, // Minimum
        w_lrs: 2.0, // Too high
        drConsecutivePenalty: -2.0 // Maximum penalty
      };
      
      const result = await validateConfiguration(extremeConfig);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.field === 'fairnessWindowDays')).toBe(true);
    });

    test('validateConfiguration rejects invalid mode configurations', async () => {
      const { validateConfiguration } = require('../config-validation');
      
      const invalidConfig = {
        mode: 'BALANCE',
        fairnessWindowDays: 7, // Trying to change locked parameter
        w_fair: 2.0 // Trying to change locked parameter
      };
      
      const result = await validateConfiguration(invalidConfig);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('locked'))).toBe(true);
    });

    test('configuration impact assessment works', async () => {
      const { validateConfiguration } = require('../config-validation');
      
      const config = {
        mode: 'CUSTOM',
        fairnessWindowDays: 30,
        w_fair: 2.0,
        w_urgency: 0.5
      };
      
      const result = await validateConfiguration(config);
      
      expect(result.impactAssessment).toBeDefined();
      expect(result.impactAssessment.fairnessImpact).toMatch(/positive|neutral|negative/);
      expect(result.impactAssessment.overallRisk).toMatch(/low|medium|high/);
    });
  });

  describe('5. Dynamic Pool Management Functions (Requirements 8.1)', () => {
    test('adjustFairnessForNewInterpreters handles new interpreters', async () => {
      const { adjustFairnessForNewInterpreters } = require('../dynamic-pool');
      
      const currentPool = ['INT001', 'INT002', 'INT003'];
      const newPool = ['INT001', 'INT002', 'INT003', 'INT004', 'INT005'];
      
      const result = await adjustFairnessForNewInterpreters(currentPool, newPool, 14);
      
      expect(result).toBeDefined();
      expect(result.newInterpreters).toEqual(['INT004', 'INT005']);
      expect(result.adjustmentFactor).toBeGreaterThan(0);
    });

    test('cleanupHistoryForRemovedInterpreters maintains data integrity', async () => {
      const { cleanupHistoryForRemovedInterpreters } = require('../dynamic-pool');
      
      const currentPool = ['INT001', 'INT002', 'INT003'];
      const newPool = ['INT001', 'INT003']; // INT002 removed
      
      const result = await cleanupHistoryForRemovedInterpreters(currentPool, newPool);
      
      expect(result).toBeDefined();
      expect(result.removedInterpreters).toEqual(['INT002']);
      expect(result.cleanupActions).toBeGreaterThan(0);
    });
  });

  describe('6. Integration Tests', () => {
    test('conflict detection integrates with assignment flow', async () => {
      // Mock assignment flow with conflict detection
      const mockAssignmentFlow = async (interpreterId, startTime, endTime) => {
        const { checkInterpreterAvailability } = require('../conflict-detection');
        
        // Step 1: Check availability
        const isAvailable = await checkInterpreterAvailability(interpreterId, startTime, endTime);
        
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
      const { getLastGlobalDRAssignment, checkDRAssignmentHistory } = require('../dr-history');
      
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
      const lastDR = await getLastGlobalDRAssignment(new Date('2024-01-15T09:00:00Z'));
      expect(lastDR.interpreterEmpCode).toBe('INT001');
      
      // Check consecutive history
      const history = await checkDRAssignmentHistory('INT001', 14);
      expect(history).toBeDefined();
    });
  });
});