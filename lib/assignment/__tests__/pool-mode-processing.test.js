/**
 * Tests for mode-specific pool processing logic
 * Task 3.1: Create mode-specific pool processing logic
 */

const { bookingPool, shouldAssignImmediately, calculateThresholdDays, shouldApplyDeadlineOverride } = require('../pool');

// Mock dependencies
jest.mock('@/prisma/prisma', () => ({
  meetingTypePriority: {
    findUnique: jest.fn()
  },
  autoAssignmentConfig: {
    findFirst: jest.fn()
  }
}));

jest.mock('../policy', () => ({
  getMeetingTypePriority: jest.fn(),
  loadPolicy: jest.fn()
}));

const { getMeetingTypePriority, loadPolicy } = require('../policy');

describe('Mode-Specific Pool Processing', () => {
  beforeEach(() => {
    // Clear pool before each test
    bookingPool.clearPool();
    
    // Setup default mocks
    getMeetingTypePriority.mockResolvedValue({
      meetingType: 'DR',
      priorityValue: 100,
      urgentThresholdDays: 1,
      generalThresholdDays: 7
    });
    
    loadPolicy.mockResolvedValue({
      mode: 'NORMAL',
      fairnessWindowDays: 30,
      maxGapHours: 5
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldAssignImmediately', () => {
    test('URGENT mode assigns immediately for bookings within urgent threshold', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const result = await shouldAssignImmediately(tomorrow, 'DR', 'URGENT');
      expect(result).toBe(true);
    });

    test('BALANCE mode only assigns immediately at deadline', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const result = await shouldAssignImmediately(tomorrow, 'DR', 'BALANCE');
      expect(result).toBe(true); // Within urgent threshold (1 day)
    });

    test('NORMAL mode uses standard urgent threshold', async () => {
      const twoDaysAway = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      
      const result = await shouldAssignImmediately(twoDaysAway, 'DR', 'NORMAL');
      expect(result).toBe(false); // Beyond urgent threshold (1 day)
    });
  });

  describe('calculateThresholdDays', () => {
    test('BALANCE mode uses longer threshold for batch optimization', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      
      const result = await calculateThresholdDays(futureDate, 'DR', 'BALANCE');
      
      expect(result.thresholdDays).toBeGreaterThanOrEqual(3);
      expect(result.shouldProcessImmediately).toBe(false);
    });

    test('URGENT mode processes immediately', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      const result = await calculateThresholdDays(futureDate, 'DR', 'URGENT');
      
      expect(result.thresholdDays).toBe(0);
      expect(result.shouldProcessImmediately).toBe(true);
    });

    test('NORMAL mode uses standard thresholds', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      const result = await calculateThresholdDays(futureDate, 'DR', 'NORMAL');
      
      expect(result.thresholdDays).toBe(7); // generalThresholdDays
      expect(result.shouldProcessImmediately).toBe(false);
    });
  });

  describe('shouldApplyDeadlineOverride', () => {
    test('applies critical override when deadline has passed', () => {
      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const entry = {
        bookingId: 1,
        mode: 'BALANCE',
        deadlineTime: pastDeadline
      };
      
      const result = shouldApplyDeadlineOverride(entry);
      
      expect(result.shouldOverride).toBe(true);
      expect(result.urgencyLevel).toBe('CRITICAL');
      expect(result.reason).toContain('Deadline has passed');
    });

    test('applies high priority override within 6 hours', () => {
      const nearDeadline = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours away
      const entry = {
        bookingId: 1,
        mode: 'NORMAL',
        deadlineTime: nearDeadline
      };
      
      const result = shouldApplyDeadlineOverride(entry);
      
      expect(result.shouldOverride).toBe(true);
      expect(result.urgencyLevel).toBe('HIGH');
    });

    test('considers Balance mode override within 24 hours', () => {
      const dayAway = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours away
      const balanceEntry = {
        bookingId: 1,
        mode: 'BALANCE',
        deadlineTime: dayAway
      };
      
      const normalEntry = {
        bookingId: 2,
        mode: 'NORMAL',
        deadlineTime: dayAway
      };
      
      const balanceResult = shouldApplyDeadlineOverride(balanceEntry);
      const normalResult = shouldApplyDeadlineOverride(normalEntry);
      
      expect(balanceResult.shouldOverride).toBe(true);
      expect(normalResult.shouldOverride).toBe(false);
    });

    test('no override needed for distant deadlines', () => {
      const distantDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days away
      const entry = {
        bookingId: 1,
        mode: 'NORMAL',
        deadlineTime: distantDeadline
      };
      
      const result = shouldApplyDeadlineOverride(entry);
      
      expect(result.shouldOverride).toBe(false);
      expect(result.urgencyLevel).toBe('LOW');
    });
  });

  describe('Pool Entry Management', () => {
    test('adds booking with mode-specific timing', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      const entry = await bookingPool.addToPool(1, 'DR', futureDate, futureDate, 'BALANCE');
      
      expect(entry.mode).toBe('BALANCE');
      expect(entry.thresholdDays).toBeGreaterThanOrEqual(3);
      expect(entry.processingPriority).toBeDefined();
    });

    test('gets entries by mode correctly', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      await bookingPool.addToPool(1, 'DR', futureDate, futureDate, 'BALANCE');
      await bookingPool.addToPool(2, 'DR', futureDate, futureDate, 'URGENT');
      
      const balanceEntries = bookingPool.getEntriesByMode('BALANCE');
      const urgentEntries = bookingPool.getEntriesByMode('URGENT');
      
      expect(balanceEntries).toHaveLength(1);
      expect(urgentEntries).toHaveLength(1);
      expect(balanceEntries[0].bookingId).toBe(1);
      expect(urgentEntries[0].bookingId).toBe(2);
    });

    test('calculates enhanced pool statistics', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      
      await bookingPool.addToPool(1, 'DR', futureDate, futureDate, 'BALANCE');
      await bookingPool.addToPool(2, 'DR', futureDate, futureDate, 'URGENT');
      
      const stats = bookingPool.getPoolStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byMode).toBeDefined();
      expect(stats.byMode.BALANCE.total).toBe(1);
      expect(stats.byMode.URGENT.total).toBe(1);
    });
  });
});