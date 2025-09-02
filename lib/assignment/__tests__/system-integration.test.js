/**
 * System Integration Tests for Enhanced Auto-Assignment System
 * Tests the complete integration of all enhanced components
 */

const { runAssignment, processPool } = require('../run');
const { loadPolicy, updatePolicy } = require('../policy');
const { filterAvailableInterpreters } = require('../conflict-detection');
const { manageDynamicPool } = require('../dynamic-pool');
const { validateAssignmentPolicy } = require('../config-validation');

// Mock Prisma
const mockPrisma = {
  bookingPlan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  },
  assignmentPolicy: {
    findFirst: jest.fn(),
    upsert: jest.fn()
  },
  meetingTypePriority: {
    findMany: jest.fn(),
    upsert: jest.fn()
  },
  assignmentLog: {
    create: jest.fn()
  },
  $transaction: jest.fn()
};

jest.mock('@/prisma/prisma', () => mockPrisma);

describe('System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default policy
    mockPrisma.assignmentPolicy.findFirst.mockResolvedValue({
      mode: 'NORMAL',
      fairnessWindowDays: 30,
      maxGapHours: 4,
      minAdvanceDays: 2,
      w_fair: 1.2,
      w_urgency: 1.0,
      w_lrs: 0.3,
      drConsecutivePenalty: -0.5,
      autoAssignEnabled: true
    });
    
    // Setup default priorities
    mockPrisma.meetingTypePriority.findMany.mockResolvedValue([
      { meetingType: 'DR', priorityValue: 8, urgentThresholdDays: 1, generalThresholdDays: 7 },
      { meetingType: 'VIP', priorityValue: 7, urgentThresholdDays: 2, generalThresholdDays: 14 }
    ]);
  });

  describe('Complete Assignment Flow Integration', () => {
    test('should handle normal booking with conflict detection', async () => {
      // Setup booking
      const booking = {
        bookingId: 1001,
        timeStart: new Date('2025-02-10T10:00:00Z'),
        timeEnd: new Date('2025-02-10T11:00:00Z'),
        meetingType: 'General',
        interpreterEmpCode: null,
        meetingDetail: null
      };
      
      mockPrisma.bookingPlan.findUnique.mockResolvedValue(booking);
      
      // Mock successful assignment
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      
      mockPrisma.bookingPlan.update.mockResolvedValue({
        ...booking,
        interpreterEmpCode: 'INT001'
      });
      
      const result = await runAssignment(1001);
      
      expect(result.status).toBe('assigned');
      expect(result.interpreterId).toBe('INT001');
      expect(mockPrisma.bookingPlan.update).toHaveBeenCalledWith({
        where: { bookingId: 1001 },
        data: { 
          interpreterEmpCode: 'INT001',
          bookingStatus: 'approve'
        }
      });
    });
  });
});    tes
t('should handle DR meeting with enhanced policy', async () => {
      // Setup DR booking
      const booking = {
        bookingId: 1002,
        timeStart: new Date('2025-02-10T14:00:00Z'),
        timeEnd: new Date('2025-02-10T15:00:00Z'),
        meetingType: 'DR',
        interpreterEmpCode: null,
        meetingDetail: 'Weekly DR Meeting'
      };
      
      mockPrisma.bookingPlan.findUnique.mockResolvedValue(booking);
      
      // Mock successful assignment with DR policy
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      
      mockPrisma.bookingPlan.update.mockResolvedValue({
        ...booking,
        interpreterEmpCode: 'INT002'
      });
      
      const result = await runAssignment(1002);
      
      expect(result.status).toBe('assigned');
      expect(result.interpreterId).toBe('INT002');
    });

    test('should escalate when all interpreters have conflicts', async () => {
      // Setup booking with conflicts
      const booking = {
        bookingId: 1003,
        timeStart: new Date('2025-02-10T16:00:00Z'),
        timeEnd: new Date('2025-02-10T17:00:00Z'),
        meetingType: 'General',
        interpreterEmpCode: null,
        meetingDetail: null
      };
      
      mockPrisma.bookingPlan.findUnique.mockResolvedValue(booking);
      
      // Mock all interpreters having conflicts
      jest.doMock('../conflict-detection', () => ({
        filterAvailableInterpreters: jest.fn().mockResolvedValue([]),
        getInterpreterAvailabilityDetails: jest.fn().mockResolvedValue([
          {
            interpreterId: 'INT001',
            isAvailable: false,
            conflicts: [{ conflictType: 'OVERLAP', conflictingBookingId: 999 }]
          }
        ])
      }));
      
      const result = await runAssignment(1003);
      
      expect(result.status).toBe('escalated');
      expect(result.reason).toContain('time conflicts');
    });
  });

  describe('Pool Processing Integration', () => {
    test('should process pool entries with batch optimization', async () => {
      // Mock pool entries
      jest.doMock('../pool', () => ({
        processPoolEntriesWithBatchResults: jest.fn().mockResolvedValue({
          entries: [
            {
              bookingId: 2001,
              mode: 'BALANCE',
              processingPriority: 1,
              thresholdDays: 3,
              deadlineTime: new Date('2025-02-15T00:00:00Z')
            }
          ],
          batchResults: [
            {
              batchId: 'batch_001',
              fairnessImprovement: 0.15
            }
          ],
          summary: {
            totalProcessed: 1,
            totalAssigned: 1,
            totalEscalated: 0,
            fairnessImprovement: 0.15
          }
        })
      }));
      
      // Mock booking for pool entry
      mockPrisma.bookingPlan.findUnique.mockResolvedValue({
        bookingId: 2001,
        timeStart: new Date('2025-02-12T10:00:00Z'),
        timeEnd: new Date('2025-02-12T11:00:00Z'),
        meetingType: 'General',
        interpreterEmpCode: null,
        meetingDetail: null
      });
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      
      mockPrisma.bookingPlan.update.mockResolvedValue({
        bookingId: 2001,
        interpreterEmpCode: 'INT003'
      });
      
      const results = await processPool();
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('assigned');
    });
  });

  describe('Configuration Validation Integration', () => {
    test('should validate policy changes with enhanced validation', async () => {
      const testPolicy = {
        mode: 'CUSTOM',
        fairnessWindowDays: 45,
        maxGapHours: 6,
        minAdvanceDays: 3,
        w_fair: 1.5,
        w_urgency: 1.2,
        w_lrs: 0.4,
        drConsecutivePenalty: -0.8,
        autoAssignEnabled: true
      };
      
      const currentPolicy = await loadPolicy();
      const validation = validateAssignmentPolicy(testPolicy, currentPolicy);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.recommendations).toBeDefined();
      expect(validation.impactAssessment).toBeDefined();
    });

    test('should apply safe fallbacks for invalid configurations', async () => {
      const invalidPolicy = {
        mode: 'CUSTOM',
        fairnessWindowDays: -5, // Invalid
        maxGapHours: 200, // Invalid
        w_fair: -1, // Invalid
        autoAssignEnabled: true
      };
      
      mockPrisma.assignmentPolicy.upsert.mockResolvedValue(invalidPolicy);
      
      const validation = validateAssignmentPolicy(invalidPolicy, await loadPolicy());
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.field === 'fairnessWindowDays')).toBe(true);
    });
  });

  describe('Dynamic Pool Management Integration', () => {
    test('should handle new interpreter additions', async () => {
      const currentPool = ['INT001', 'INT002'];
      const fairnessWindow = 30;
      
      // Mock dynamic pool management
      jest.doMock('../dynamic-pool', () => ({
        manageDynamicPool: jest.fn().mockResolvedValue({
          poolAdjustment: {
            newInterpreters: ['INT003'],
            removedInterpreters: [],
            adjustmentFactor: 1.1,
            poolChangeDetected: true,
            significantChange: false
          },
          fairnessAdjustments: [
            {
              interpreterId: 'INT003',
              adjustmentType: 'NEW_INTERPRETER',
              adjustmentValue: 0.2
            }
          ]
        })
      }));
      
      const result = await manageDynamicPool(currentPool, fairnessWindow);
      
      expect(result.poolAdjustment.newInterpreters).toContain('INT003');
      expect(result.fairnessAdjustments).toHaveLength(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle database errors gracefully', async () => {
      mockPrisma.bookingPlan.findUnique.mockRejectedValue(new Error('Database connection failed'));
      
      const result = await runAssignment(9999);
      
      expect(result.status).toBe('escalated');
      expect(result.reason).toContain('Error');
    });

    test('should handle policy loading failures', async () => {
      mockPrisma.assignmentPolicy.findFirst.mockRejectedValue(new Error('Policy not found'));
      
      try {
        await loadPolicy();
      } catch (error) {
        expect(error.message).toContain('Policy not found');
      }
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain compatibility with existing booking data', async () => {
      // Test with legacy booking format
      const legacyBooking = {
        bookingId: 5001,
        timeStart: new Date('2025-02-10T10:00:00Z'),
        timeEnd: new Date('2025-02-10T11:00:00Z'),
        meetingType: 'General',
        interpreterEmpCode: null
        // Missing meetingDetail field (legacy format)
      };
      
      mockPrisma.bookingPlan.findUnique.mockResolvedValue(legacyBooking);
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      
      mockPrisma.bookingPlan.update.mockResolvedValue({
        ...legacyBooking,
        interpreterEmpCode: 'INT001'
      });
      
      const result = await runAssignment(5001);
      
      expect(result.status).toBe('assigned');
      expect(result.interpreterId).toBe('INT001');
    });

    test('should handle legacy configuration format', async () => {
      // Test with minimal legacy policy
      const legacyPolicy = {
        mode: 'NORMAL',
        fairnessWindowDays: 30,
        maxGapHours: 4,
        autoAssignEnabled: true
        // Missing newer fields
      };
      
      mockPrisma.assignmentPolicy.findFirst.mockResolvedValue(legacyPolicy);
      
      const policy = await loadPolicy();
      
      expect(policy.mode).toBe('NORMAL');
      expect(policy.fairnessWindowDays).toBe(30);
      expect(policy.autoAssignEnabled).toBe(true);
      // Should have defaults for missing fields
      expect(policy.w_fair).toBeDefined();
      expect(policy.w_urgency).toBeDefined();
    });
  });
});