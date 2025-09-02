/**
 * Basic tests for enhanced scoring algorithm with conflict detection
 * Tests the integration of conflict detection, improved DR penalties, and deterministic tie-breaking
 */

const { 
  rankByScoreWithConflictDetection,
  createCandidateResultsWithConflictDetection,
  validateAndSortScoringResults,
  getScoringStatistics
} = require('../scoring');

// Mock the dependencies
jest.mock('../conflict-detection', () => ({
  filterAvailableInterpreters: jest.fn(),
  getInterpreterAvailabilityDetails: jest.fn()
}));

jest.mock('../fairness', () => ({
  computeFairnessScore: jest.fn(),
  getMinHours: jest.fn()
}));

jest.mock('../urgency', () => ({
  computeEnhancedUrgencyScore: jest.fn()
}));

jest.mock('../lrs', () => ({
  computeLRSScore: jest.fn(),
  getDaysSinceLastAssignment: jest.fn()
}));

jest.mock('../dr-history', () => ({
  checkDRAssignmentHistory: jest.fn(),
  getLastGlobalDRAssignment: jest.fn(),
  applyDRPenalty: jest.fn()
}));

jest.mock('../policy', () => ({
  getScoringWeights: jest.fn(),
  getDRPolicy: jest.fn()
}));

const mockConflictDetection = require('../conflict-detection');
const mockFairness = require('../fairness');
const mockUrgency = require('../urgency');
const mockLrs = require('../lrs');
const mockDrHistory = require('../dr-history');
const mockPolicy = require('../policy');

describe('Enhanced Scoring Algorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockConflictDetection.filterAvailableInterpreters.mockResolvedValue(['INT001', 'INT002']);
    mockConflictDetection.getInterpreterAvailabilityDetails.mockResolvedValue([
      {
        interpreterId: 'INT001',
        isAvailable: true,
        conflicts: []
      },
      {
        interpreterId: 'INT002',
        isAvailable: true,
        conflicts: []
      },
      {
        interpreterId: 'INT003',
        isAvailable: false,
        conflicts: [
          {
            interpreterId: 'INT003',
            conflictingBookingId: 123,
            conflictStart: new Date('2025-01-01T10:00:00Z'),
            conflictEnd: new Date('2025-01-01T11:00:00Z'),
            conflictType: 'OVERLAP',
            conflictingMeetingType: 'Regular Meeting'
          }
        ]
      }
    ]);
    
    mockFairness.computeFairnessScore.mockReturnValue(0.8);
    mockFairness.getMinHours.mockReturnValue(10);
    mockUrgency.computeEnhancedUrgencyScore.mockResolvedValue(0.7);
    mockLrs.computeLRSScore.mockResolvedValue(0.6);
    mockLrs.getDaysSinceLastAssignment.mockResolvedValue(5);
    mockDrHistory.getLastGlobalDRAssignment.mockResolvedValue({ interpreterEmpCode: null });
    mockDrHistory.checkDRAssignmentHistory.mockResolvedValue({
      interpreterId: 'INT001',
      consecutiveDRCount: 0,
      lastDRAssignments: [],
      isBlocked: false,
      penaltyApplied: false,
      isConsecutiveGlobal: false
    });
    mockDrHistory.applyDRPenalty.mockImplementation((score, penalty, applied) => 
      applied ? score + penalty : score
    );
    mockPolicy.getScoringWeights.mockReturnValue({ w_fair: 0.4, w_urgency: 0.3, w_lrs: 0.3 });
    mockPolicy.getDRPolicy.mockReturnValue({
      scope: "GLOBAL",
      forbidConsecutive: false,
      consecutivePenalty: -0.7,
      includePendingInGlobal: false
    });
  });

  describe('rankByScoreWithConflictDetection', () => {
    test('should filter out conflicted interpreters before scoring', async () => {
      const candidates = [
        { empCode: 'INT001', currentHours: 10, daysSinceLastAssignment: 5 },
        { empCode: 'INT002', currentHours: 12, daysSinceLastAssignment: 3 },
        { empCode: 'INT003', currentHours: 8, daysSinceLastAssignment: 7 }
      ];

      const hoursMap = { INT001: 10, INT002: 12, INT003: 8 };
      const startTime = new Date('2025-01-01T10:00:00Z');
      const endTime = new Date('2025-01-01T11:00:00Z');

      const results = await rankByScoreWithConflictDetection(
        candidates,
        hoursMap,
        0.7, // urgencyScore
        'NORMAL',
        30, // fairnessWindowDays
        5, // maxGapHours
        startTime,
        endTime,
        false // isDRMeeting
      );

      // Should call conflict detection
      expect(mockConflictDetection.filterAvailableInterpreters).toHaveBeenCalledWith(
        ['INT001', 'INT002', 'INT003'],
        startTime,
        endTime
      );

      // Should only score available interpreters (INT001, INT002)
      expect(results).toHaveLength(2);
      expect(results.map(r => r.empCode)).toEqual(['INT001', 'INT002']);
    });

    test('should return empty array when no interpreters are available', async () => {
      mockConflictDetection.filterAvailableInterpreters.mockResolvedValue([]);

      const candidates = [
        { empCode: 'INT001', currentHours: 10, daysSinceLastAssignment: 5 }
      ];

      const results = await rankByScoreWithConflictDetection(
        candidates,
        { INT001: 10 },
        0.7,
        'NORMAL',
        30,
        5,
        new Date(),
        new Date(),
        false
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('createCandidateResultsWithConflictDetection', () => {
    test('should mark conflicted interpreters as ineligible with conflict reason', async () => {
      const interpreters = [
        { empCode: 'INT001', currentHours: 10 },
        { empCode: 'INT002', currentHours: 12 },
        { empCode: 'INT003', currentHours: 8 }
      ];

      const results = await createCandidateResultsWithConflictDetection(
        interpreters,
        ['INT001', 'INT002', 'INT003'], // all eligible for fairness
        { INT001: 10, INT002: 12, INT003: 8 },
        0.7,
        'NORMAL',
        30,
        5,
        new Date('2025-01-01T10:00:00Z'),
        new Date('2025-01-01T11:00:00Z'),
        false
      );

      expect(results).toHaveLength(3);
      
      // INT001 and INT002 should be available and eligible
      const int001 = results.find(r => r.empCode === 'INT001');
      const int002 = results.find(r => r.empCode === 'INT002');
      expect(int001.eligible).toBe(true);
      expect(int002.eligible).toBe(true);

      // INT003 should be marked as conflicted
      const int003 = results.find(r => r.empCode === 'INT003');
      expect(int003.eligible).toBe(false);
      expect(int003.reason).toContain('Time conflict');
      expect(int003.reason).toContain('Regular Meeting (OVERLAP)');
    });

    test('should apply enhanced DR penalties for DR meetings', async () => {
      // Setup DR meeting scenario
      mockDrHistory.checkDRAssignmentHistory.mockResolvedValue({
        interpreterId: 'INT001',
        consecutiveDRCount: 1,
        lastDRAssignments: [],
        isBlocked: false,
        penaltyApplied: true,
        isConsecutiveGlobal: true
      });

      const interpreters = [{ empCode: 'INT001', currentHours: 10 }];

      const results = await createCandidateResultsWithConflictDetection(
        interpreters,
        ['INT001'],
        { INT001: 10 },
        0.7,
        'NORMAL',
        30,
        5,
        new Date('2025-01-01T10:00:00Z'),
        new Date('2025-01-01T11:00:00Z'),
        true, // isDRMeeting
        -0.7,
        undefined,
        'DR-Type1'
      );

      expect(mockDrHistory.applyDRPenalty).toHaveBeenCalled();
      expect(results[0].drHistory.penaltyApplied).toBe(true);
    });

    test('should block interpreters with consecutive DR violations', async () => {
      mockDrHistory.checkDRAssignmentHistory.mockResolvedValue({
        interpreterId: 'INT001',
        consecutiveDRCount: 2,
        lastDRAssignments: [],
        isBlocked: true,
        penaltyApplied: false,
        isConsecutiveGlobal: true
      });

      const interpreters = [{ empCode: 'INT001', currentHours: 10 }];

      const results = await createCandidateResultsWithConflictDetection(
        interpreters,
        ['INT001'],
        { INT001: 10 },
        0.7,
        'BALANCE',
        30,
        5,
        new Date('2025-01-01T10:00:00Z'),
        new Date('2025-01-01T11:00:00Z'),
        true // isDRMeeting
      );

      expect(results[0].eligible).toBe(false);
      expect(results[0].reason).toContain('ConsecutiveDRBlocked');
    });
  });

  describe('validateAndSortScoringResults', () => {
    test('should sort eligible candidates by total score descending', () => {
      const results = [
        {
          empCode: 'INT001',
          eligible: true,
          scores: { total: 0.8, fairness: 0.8, urgency: 0.7, lrs: 0.6 },
          currentHours: 10,
          daysSinceLastAssignment: 5
        },
        {
          empCode: 'INT002',
          eligible: true,
          scores: { total: 0.9, fairness: 0.9, urgency: 0.8, lrs: 0.7 },
          currentHours: 8,
          daysSinceLastAssignment: 3
        },
        {
          empCode: 'INT003',
          eligible: false,
          scores: { total: 0, fairness: 0, urgency: 0, lrs: 0 },
          reason: 'Time conflict'
        }
      ];

      const sorted = validateAndSortScoringResults(results);

      // Eligible candidates should come first, sorted by score
      expect(sorted[0].empCode).toBe('INT002'); // highest score
      expect(sorted[1].empCode).toBe('INT001'); // second highest
      expect(sorted[2].empCode).toBe('INT003'); // ineligible last
    });

    test('should use deterministic tie-breaking for equal scores', () => {
      const results = [
        {
          empCode: 'INT001',
          eligible: true,
          scores: { total: 0.800001, fairness: 0.8, urgency: 0.7, lrs: 0.6 },
          currentHours: 12,
          daysSinceLastAssignment: 3
        },
        {
          empCode: 'INT002',
          eligible: true,
          scores: { total: 0.800002, fairness: 0.8, urgency: 0.7, lrs: 0.6 },
          currentHours: 10,
          daysSinceLastAssignment: 5
        }
      ];

      const sorted = validateAndSortScoringResults(results);

      // INT002 should win due to higher daysSinceLastAssignment in tie-breaking
      expect(sorted[0].empCode).toBe('INT002');
      expect(sorted[1].empCode).toBe('INT001');
    });
  });

  describe('getScoringStatistics', () => {
    test('should calculate correct statistics', () => {
      const results = [
        {
          empCode: 'INT001',
          eligible: true,
          scores: { total: 0.8 },
          reason: undefined
        },
        {
          empCode: 'INT002',
          eligible: true,
          scores: { total: 0.9 },
          reason: undefined
        },
        {
          empCode: 'INT003',
          eligible: false,
          scores: { total: 0 },
          reason: 'Time conflict: Meeting (OVERLAP)'
        },
        {
          empCode: 'INT004',
          eligible: false,
          scores: { total: 0 },
          reason: 'ConsecutiveDRBlocked: Last DR by same interpreter'
        },
        {
          empCode: 'INT005',
          eligible: false,
          scores: { total: 0 },
          reason: 'Would exceed max gap: 6.0h > 5h'
        }
      ];

      const stats = getScoringStatistics(results);

      expect(stats.totalCandidates).toBe(5);
      expect(stats.eligibleCandidates).toBe(2);
      expect(stats.conflictedCandidates).toBe(1);
      expect(stats.drBlockedCandidates).toBe(1);
      expect(stats.fairnessBlockedCandidates).toBe(1);
      expect(stats.scoreDistribution.min).toBe(0.8);
      expect(stats.scoreDistribution.max).toBe(0.9);
      expect(stats.scoreDistribution.avg).toBe(0.85);
    });
  });
});