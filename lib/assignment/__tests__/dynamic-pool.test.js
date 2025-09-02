/**
 * Basic tests for dynamic pool management functions
 * Tests the core functionality of pool change detection and fairness adjustments
 */

const { 
  adjustFairnessForNewInterpreters,
  cleanupHistoryForRemovedInterpreters,
  detectPoolSizeChanges,
  manageDynamicPool
} = require('../dynamic-pool.ts');

// Mock Prisma
const mockPrisma = {
  bookingPlan: {
    findMany: jest.fn()
  }
};

// Mock the prisma import
jest.mock('@/prisma/prisma', () => mockPrisma);

describe('Dynamic Pool Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
    console.error = jest.fn(); // Mock console.error
  });

  describe('adjustFairnessForNewInterpreters', () => {
    test('should identify new interpreters correctly', async () => {
      // Mock existing interpreters with history
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001', timeStart: new Date('2024-01-15') },
        { interpreterEmpCode: 'INT002', timeStart: new Date('2024-01-16') }
      ]);

      const interpreterPool = ['INT001', 'INT002', 'INT003', 'INT004'];
      const fairnessWindowDays = 30;
      const referenceDate = new Date('2024-01-20');

      const result = await adjustFairnessForNewInterpreters(
        interpreterPool,
        fairnessWindowDays,
        referenceDate
      );

      expect(result).toHaveLength(4);
      
      // Check existing interpreters
      const existingInt001 = result.find(r => r.interpreterId === 'INT001');
      expect(existingInt001.isNewInterpreter).toBe(false);
      expect(existingInt001.adjustedPenalty).toBe(1.0);
      expect(existingInt001.adjustedBlocking).toBe(true);

      // Check new interpreters
      const newInt003 = result.find(r => r.interpreterId === 'INT003');
      expect(newInt003.isNewInterpreter).toBe(true);
      expect(newInt003.adjustedPenalty).toBe(0.5);
      expect(newInt003.adjustedBlocking).toBe(false);
    });

    test('should handle empty interpreter pool', async () => {
      mockPrisma.bookingPlan.findMany.mockResolvedValue([]);

      const result = await adjustFairnessForNewInterpreters([], 30);
      expect(result).toHaveLength(0);
    });

    test('should handle all new interpreters', async () => {
      mockPrisma.bookingPlan.findMany.mockResolvedValue([]);

      const interpreterPool = ['INT001', 'INT002'];
      const result = await adjustFairnessForNewInterpreters(interpreterPool, 30);

      expect(result).toHaveLength(2);
      result.forEach(adjustment => {
        expect(adjustment.isNewInterpreter).toBe(true);
        expect(adjustment.adjustedPenalty).toBe(0.5);
        expect(adjustment.adjustedBlocking).toBe(false);
      });
    });
  });

  describe('detectPoolSizeChanges', () => {
    test('should detect new interpreters', async () => {
      // Mock historical interpreters
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001' },
        { interpreterEmpCode: 'INT002' }
      ]);

      const currentPool = ['INT001', 'INT002', 'INT003', 'INT004'];
      const result = await detectPoolSizeChanges(currentPool, 30);

      expect(result.newInterpreters).toEqual(['INT003', 'INT004']);
      expect(result.removedInterpreters).toEqual([]);
      expect(result.poolSizeChange).toBe(2);
      expect(result.poolChangeDetected).toBe(true);
      expect(result.significantChange).toBe(true); // 100% increase
    });

    test('should detect removed interpreters', async () => {
      // Mock historical interpreters
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001' },
        { interpreterEmpCode: 'INT002' },
        { interpreterEmpCode: 'INT003' },
        { interpreterEmpCode: 'INT004' }
      ]);

      const currentPool = ['INT001', 'INT002'];
      const result = await detectPoolSizeChanges(currentPool, 30);

      expect(result.newInterpreters).toEqual([]);
      expect(result.removedInterpreters).toEqual(['INT003', 'INT004']);
      expect(result.poolSizeChange).toBe(-2);
      expect(result.poolChangeDetected).toBe(true);
      expect(result.significantChange).toBe(true); // 50% decrease
    });

    test('should detect no changes', async () => {
      // Mock historical interpreters matching current pool
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001' },
        { interpreterEmpCode: 'INT002' }
      ]);

      const currentPool = ['INT001', 'INT002'];
      const result = await detectPoolSizeChanges(currentPool, 30);

      expect(result.newInterpreters).toEqual([]);
      expect(result.removedInterpreters).toEqual([]);
      expect(result.poolSizeChange).toBe(0);
      expect(result.poolChangeDetected).toBe(false);
      expect(result.significantChange).toBe(false);
    });

    test('should calculate adjustment factor correctly', async () => {
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001' },
        { interpreterEmpCode: 'INT002' }
      ]);

      const currentPool = ['INT001', 'INT002', 'INT003', 'INT004'];
      const result = await detectPoolSizeChanges(currentPool, 30);

      // With 2 new interpreters out of 4 total, adjustment should be 0.75
      expect(result.adjustmentFactor).toBe(0.75);
    });
  });

  describe('cleanupHistoryForRemovedInterpreters', () => {
    test('should identify removed interpreters correctly', async () => {
      // Mock assignments from removed interpreters
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001', id: 1, timeStart: new Date('2024-01-15') },
        { interpreterEmpCode: 'INT002', id: 2, timeStart: new Date('2024-01-16') },
        { interpreterEmpCode: 'INT003', id: 3, timeStart: new Date('2024-01-17') }, // Removed
        { interpreterEmpCode: 'INT004', id: 4, timeStart: new Date('2024-01-18') }  // Removed
      ]);

      const currentPool = ['INT001', 'INT002'];
      const result = await cleanupHistoryForRemovedInterpreters(currentPool, 30);

      expect(result.cleanedCount).toBe(2); // INT003 and INT004 removed
      expect(result.preservedCount).toBe(2); // INT001 and INT002 preserved
    });

    test('should handle no removed interpreters', async () => {
      mockPrisma.bookingPlan.findMany.mockResolvedValue([
        { interpreterEmpCode: 'INT001', id: 1, timeStart: new Date('2024-01-15') },
        { interpreterEmpCode: 'INT002', id: 2, timeStart: new Date('2024-01-16') }
      ]);

      const currentPool = ['INT001', 'INT002'];
      const result = await cleanupHistoryForRemovedInterpreters(currentPool, 30);

      expect(result.cleanedCount).toBe(0);
      expect(result.preservedCount).toBe(2);
    });
  });

  describe('manageDynamicPool', () => {
    test('should coordinate all dynamic pool functions', async () => {
      // Mock for detectPoolSizeChanges
      mockPrisma.bookingPlan.findMany
        .mockResolvedValueOnce([
          { interpreterEmpCode: 'INT001' },
          { interpreterEmpCode: 'INT002' }
        ])
        // Mock for adjustFairnessForNewInterpreters
        .mockResolvedValueOnce([
          { interpreterEmpCode: 'INT001', timeStart: new Date('2024-01-15') },
          { interpreterEmpCode: 'INT002', timeStart: new Date('2024-01-16') }
        ])
        // Mock for cleanupHistoryForRemovedInterpreters
        .mockResolvedValueOnce([
          { interpreterEmpCode: 'INT001', id: 1, timeStart: new Date('2024-01-15') },
          { interpreterEmpCode: 'INT002', id: 2, timeStart: new Date('2024-01-16') }
        ]);

      const currentPool = ['INT001', 'INT002', 'INT003'];
      const result = await manageDynamicPool(currentPool, 30);

      expect(result.poolAdjustment).toBeDefined();
      expect(result.fairnessAdjustments).toBeDefined();
      expect(result.cleanupResult).toBeDefined();

      expect(result.poolAdjustment.newInterpreters).toEqual(['INT003']);
      expect(result.fairnessAdjustments).toHaveLength(3);
      expect(result.cleanupResult.preservedCount).toBe(2);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrisma.bookingPlan.findMany.mockRejectedValue(new Error('Database error'));

      await expect(adjustFairnessForNewInterpreters(['INT001'], 30))
        .rejects.toThrow('Database error');
      
      expect(console.error).toHaveBeenCalledWith(
        '❌ Error adjusting fairness for new interpreters:',
        expect.any(Error)
      );
    });
  });
});

console.log('✅ Dynamic pool management tests defined');