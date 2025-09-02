import type { CandidateResult, ScoreBreakdown } from "@/types/assignment";
import { computeFairnessScore, getMinHours } from "./fairness";
import { computeEnhancedUrgencyScore } from "./urgency";
import { computeLRSScore, getDaysSinceLastAssignment } from "./lrs";
import { checkDRAssignmentHistory, isDRMeeting, applyDRPenalty, getLastGlobalDRAssignment } from "./dr-history";
import { getScoringWeights, getDRPolicy } from "./policy";
import { filterAvailableInterpreters, getInterpreterAvailabilityDetails } from "./conflict-detection";

/**
 * Compute total score for a candidate using mode-specific weights
 */
export function computeTotalScore(
  fairnessScore: number,
  urgencyScore: number,
  lrsScore: number,
  mode: string,
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number }
): number {
  let weights: { w_fair: number; w_urgency: number; w_lrs: number };
  
  if (mode === 'CUSTOM' && customWeights) {
    // Use custom weights from config for CUSTOM mode
    weights = customWeights;
  } else {
    // Use predefined weights for other modes
    weights = getScoringWeights(mode);
  }
  
  return (
    weights.w_fair * fairnessScore +
    weights.w_urgency * urgencyScore +
    weights.w_lrs * lrsScore
  );
}

/**
 * Add deterministic tie-breaking based on interpreter characteristics
 * Uses multiple factors for consistent and fair tie-breaking
 */
function addDeterministicTieBreaker(
  interpreterId: string, 
  baseScore: number, 
  daysSinceLastAssignment: number,
  currentHours: number
): number {
  // Primary tie-breaker: days since last assignment (higher is better)
  const daysTieBreaker = daysSinceLastAssignment * 0.0001;
  
  // Secondary tie-breaker: current hours (lower is better for fairness)
  const hoursTieBreaker = -currentHours * 0.00001;
  
  // Tertiary tie-breaker: consistent hash of interpreter ID for final determinism
  let hash = 0;
  for (let i = 0; i < interpreterId.length; i++) {
    const char = interpreterId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashTieBreaker = (hash % 1000) / 10000000; // Very small consistent value
  
  return baseScore + daysTieBreaker + hoursTieBreaker + hashTieBreaker;
}

/**
 * Enhanced scoring function that integrates conflict detection and improved DR penalty logic
 * Filters out conflicted interpreters before scoring and applies enhanced tie-breaking
 */
export async function rankByScoreWithConflictDetection(
  candidates: Array<{
    empCode: string;
    currentHours: number;
    daysSinceLastAssignment: number;
  }>,
  hoursMap: Record<string, number>,
  urgencyScore: number,
  mode: string,
  fairnessWindowDays: number,
  maxGapHours: number,
  bookingTimeStart: Date,
  bookingTimeEnd: Date,
  isDRMeeting: boolean = false,
  drConsecutivePenalty: number = 0,
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number },
  drType?: string
): Promise<CandidateResult[]> {
  console.log(`🔍 Enhanced scoring with conflict detection for ${candidates.length} candidates`);
  
  // Step 1: Filter out interpreters with time conflicts
  const candidateIds = candidates.map(c => c.empCode);
  const availableInterpreterIds = await filterAvailableInterpreters(
    candidateIds,
    bookingTimeStart,
    bookingTimeEnd
  );
  
  // Get detailed availability information for logging
  const availabilityDetails = await getInterpreterAvailabilityDetails(
    candidateIds,
    bookingTimeStart,
    bookingTimeEnd
  );
  
  const conflictedInterpreters = availabilityDetails
    .filter(detail => !detail.isAvailable)
    .map(detail => detail.interpreterId);
  
  if (conflictedInterpreters.length > 0) {
    console.log(`⚠️ Excluded ${conflictedInterpreters.length} interpreters due to conflicts: ${conflictedInterpreters.join(', ')}`);
  }
  
  // Step 2: Filter candidates to only available ones
  const availableCandidates = candidates.filter(c => 
    availableInterpreterIds.includes(c.empCode)
  );
  
  console.log(`✅ ${availableCandidates.length} of ${candidates.length} candidates are available for scoring`);
  
  if (availableCandidates.length === 0) {
    console.log("❌ No available candidates after conflict detection");
    return [];
  }
  
  // Step 3: Proceed with enhanced scoring for available candidates
  return await rankByScore(
    availableCandidates,
    hoursMap,
    urgencyScore,
    mode,
    fairnessWindowDays,
    maxGapHours,
    isDRMeeting,
    drConsecutivePenalty,
    customWeights,
    bookingTimeStart,
    drType
  );
}

/**
 * Rank candidates by score with tie-breaking (original function enhanced)
 */
export async function rankByScore(
  candidates: Array<{
    empCode: string;
    currentHours: number;
    daysSinceLastAssignment: number;
  }>,
  hoursMap: Record<string, number>,
  urgencyScore: number,
  mode: string,
  fairnessWindowDays: number,
  maxGapHours: number,
  isDRMeeting: boolean = false,
  drConsecutivePenalty: number = 0,
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number },
  bookingTimeStart?: Date,
  drType?: string
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  // Get last global DR assignment once for DR meetings
  let lastGlobalDR = undefined;
  let drPolicy = undefined;
  
  if (isDRMeeting && bookingTimeStart) {
    drPolicy = getDRPolicy(mode);
    lastGlobalDR = await getLastGlobalDRAssignment(bookingTimeStart, {
      drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
      includePending: drPolicy.includePendingInGlobal
    });
    
    console.log(`🔍 DR meeting detected. Last global DR: ${lastGlobalDR?.interpreterEmpCode || 'None'}`);
  }

  for (const candidate of candidates) {
    // Check DR assignment history if this is a DR meeting
    let drHistory = undefined;
    let finalTotalScore = 0;
    
    if (isDRMeeting && bookingTimeStart && drPolicy) {
      drHistory = await checkDRAssignmentHistory(candidate.empCode, fairnessWindowDays, {
        bookingTimeStart,
        drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
        lastGlobalDR,
        includePendingInGlobal: drPolicy.includePendingInGlobal,
        drPolicy
      });
      
      // If interpreter is blocked due to consecutive DR assignments, skip them
      if (drHistory.isBlocked) {
        results.push({
          interpreterId: candidate.empCode,
          empCode: candidate.empCode,
          currentHours: candidate.currentHours,
          daysSinceLastAssignment: candidate.daysSinceLastAssignment,
          scores: {
            fairness: 0,
            urgency: 0,
            lrs: 0,
            total: 0
          },
          eligible: false,
          reason: `ConsecutiveDRBlocked: ${drHistory.isConsecutiveGlobal ? 'Last DR by same interpreter' : 'Policy violation'}`,
          drHistory
        });
        continue;
      }
    }

    // Compute individual scores
    const fairnessScore = computeFairnessScore(
      candidate.currentHours,
      minHours,
      maxGapHours
    );
    
    const lrsScore = await computeLRSScore(candidate.empCode, fairnessWindowDays);
    
    let totalScore = computeTotalScore(
      fairnessScore,
      urgencyScore,
      lrsScore,
      mode,
      customWeights
    );

    // Apply DR penalty if applicable
    if (isDRMeeting && drHistory?.penaltyApplied && drPolicy) {
      const penalty = drPolicy.consecutivePenalty;
      totalScore = applyDRPenalty(totalScore, penalty, true);
      console.log(`⚠️ DR penalty applied to ${candidate.empCode}: ${penalty} (consecutive DR: ${drHistory.isConsecutiveGlobal})`);
    }

    // Add deterministic tie-breaking
    finalTotalScore = addDeterministicTieBreaker(
      candidate.empCode, 
      totalScore, 
      candidate.daysSinceLastAssignment,
      candidate.currentHours
    );

    results.push({
      interpreterId: candidate.empCode,
      empCode: candidate.empCode,
      currentHours: candidate.currentHours,
      daysSinceLastAssignment: candidate.daysSinceLastAssignment,
      scores: {
        fairness: fairnessScore,
        urgency: urgencyScore,
        lrs: lrsScore,
        total: finalTotalScore
      },
      eligible: true,
      drHistory
    });
  }

  // Sort by total score (highest first), then by LRS for tie-breaking
  return results.sort((a, b) => {
    if (Math.abs(a.scores.total - b.scores.total) < 0.0001) {
      // Scores are effectively equal, use LRS as tie-breaker
      return b.scores.lrs - a.scores.lrs;
    }
    return b.scores.total - a.scores.total;
  });
}

/**
 * Enhanced candidate results creation with conflict detection integration
 * Includes both availability conflicts and fairness eligibility
 */
export async function createCandidateResultsWithConflictDetection(
  allInterpreters: Array<{ empCode: string; currentHours: number }>,
  eligibleIds: string[],
  hoursMap: Record<string, number>,
  urgencyScore: number,
  mode: string,
  fairnessWindowDays: number,
  maxGapHours: number,
  bookingTimeStart: Date,
  bookingTimeEnd: Date,
  isDRMeeting: boolean = false,
  drConsecutivePenalty: number = 0,
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number },
  drType?: string
): Promise<CandidateResult[]> {
  console.log(`🔍 Creating enhanced candidate results with conflict detection for ${allInterpreters.length} interpreters`);
  
  // Step 1: Check availability for all interpreters
  const interpreterIds = allInterpreters.map(i => i.empCode);
  const availabilityDetails = await getInterpreterAvailabilityDetails(
    interpreterIds,
    bookingTimeStart,
    bookingTimeEnd
  );
  
  // Create availability map for quick lookup
  const availabilityMap = new Map(
    availabilityDetails.map(detail => [detail.interpreterId, detail])
  );
  
  // Step 2: Process each interpreter with enhanced logic
  const results: CandidateResult[] = [];
  
  // Get DR policy and last global DR assignment for DR meetings
  let lastGlobalDR = undefined;
  let drPolicy = undefined;
  
  if (isDRMeeting) {
    drPolicy = getDRPolicy(mode);
    lastGlobalDR = await getLastGlobalDRAssignment(bookingTimeStart, {
      drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
      includePending: drPolicy.includePendingInGlobal
    });
    
    console.log(`🔍 DR meeting detected. Last global DR: ${lastGlobalDR?.interpreterEmpCode || 'None'}`);
  }
  
  for (const interpreter of allInterpreters) {
    const availability = availabilityMap.get(interpreter.empCode);
    const isAvailable = availability?.isAvailable ?? false;
    const isEligible = eligibleIds.includes(interpreter.empCode);
    const daysSinceLast = await getDaysSinceLastAssignment(interpreter.empCode);
    
    // Check for time conflicts first
    if (!isAvailable) {
      const conflictSummary = availability?.conflicts
        .map(c => `${c.conflictingMeetingType} (${c.conflictType})`)
        .join(', ') || 'Unknown conflicts';
      
      results.push({
        interpreterId: interpreter.empCode,
        empCode: interpreter.empCode,
        currentHours: interpreter.currentHours,
        daysSinceLastAssignment: daysSinceLast,
        scores: {
          fairness: 0,
          urgency: 0,
          lrs: 0,
          total: 0
        },
        eligible: false,
        reason: `Time conflict: ${conflictSummary}`
      });
      continue;
    }
    
    // Check DR assignment history if this is a DR meeting
    let drHistory = undefined;
    
    if (isDRMeeting && drPolicy) {
      drHistory = await checkDRAssignmentHistory(interpreter.empCode, fairnessWindowDays, {
        bookingTimeStart,
        drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
        lastGlobalDR,
        includePendingInGlobal: drPolicy.includePendingInGlobal,
        drPolicy
      });
      
      // If interpreter is blocked due to consecutive DR assignments, mark as ineligible
      if (drHistory.isBlocked) {
        results.push({
          interpreterId: interpreter.empCode,
          empCode: interpreter.empCode,
          currentHours: interpreter.currentHours,
          daysSinceLastAssignment: daysSinceLast,
          scores: {
            fairness: 0,
            urgency: 0,
            lrs: 0,
            total: 0
          },
          eligible: false,
          reason: `ConsecutiveDRBlocked: ${drHistory.isConsecutiveGlobal ? 'Last DR by same interpreter' : 'Policy violation'}`,
          drHistory
        });
        continue;
      }
    }
    
    if (isEligible) {
      // Available and eligible candidates get full scoring
      const fairnessScore = computeFairnessScore(
        interpreter.currentHours,
        getMinHours(hoursMap),
        maxGapHours
      );
      
      const lrsScore = await computeLRSScore(interpreter.empCode, fairnessWindowDays);
      let totalScore = computeTotalScore(
        fairnessScore,
        urgencyScore,
        lrsScore,
        mode,
        customWeights
      );

      // Apply DR penalty if applicable with enhanced logic
      if (isDRMeeting && drHistory?.penaltyApplied && drPolicy) {
        const penalty = drPolicy.consecutivePenalty;
        totalScore = applyDRPenalty(totalScore, penalty, true);
        console.log(`⚠️ Enhanced DR penalty applied to ${interpreter.empCode}: ${penalty} (consecutive DR: ${drHistory.isConsecutiveGlobal})`);
      }

      // Apply enhanced tie-breaking
      const finalScore = addDeterministicTieBreaker(
        interpreter.empCode,
        totalScore,
        daysSinceLast,
        interpreter.currentHours
      );

      console.log(`🔍 Enhanced scoring for ${interpreter.empCode} (Mode: ${mode}):`);
      console.log(`   Available: ${isAvailable}, Eligible: ${isEligible}`);
      console.log(`   Current hours: ${interpreter.currentHours}, Days since last: ${daysSinceLast}`);
      console.log(`   Fairness: ${fairnessScore.toFixed(3)}, Urgency: ${urgencyScore.toFixed(3)}, LRS: ${lrsScore.toFixed(3)}`);
      console.log(`   Total: ${totalScore.toFixed(3)}, Final: ${finalScore.toFixed(6)}`);
      if (isDRMeeting && drHistory) {
        console.log(`   DR consecutive: ${drHistory.isConsecutiveGlobal}, penalty: ${drHistory.penaltyApplied}`);
      }
      
      results.push({
        interpreterId: interpreter.empCode,
        empCode: interpreter.empCode,
        currentHours: interpreter.currentHours,
        daysSinceLastAssignment: daysSinceLast,
        scores: {
          fairness: fairnessScore,
          urgency: urgencyScore,
          lrs: lrsScore,
          total: finalScore
        },
        eligible: true,
        drHistory
      });
    } else {
      // Available but not eligible due to fairness constraints
      const simulatedHours = { ...hoursMap };
      simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1;
      const hours = Object.values(simulatedHours);
      const gap = Math.max(...hours) - Math.min(...hours);
      
      results.push({
        interpreterId: interpreter.empCode,
        empCode: interpreter.empCode,
        currentHours: interpreter.currentHours,
        daysSinceLastAssignment: daysSinceLast,
        scores: {
          fairness: 0,
          urgency: 0,
          lrs: 0,
          total: 0
        },
        eligible: false,
        reason: `Would exceed max gap: ${gap.toFixed(1)}h > ${maxGapHours}h`,
        drHistory
      });
    }
  }

  return results;
}

/**
 * Create candidate results for all interpreters (including ineligible ones) - Original function
 */
export async function createCandidateResults(
  allInterpreters: Array<{ empCode: string; currentHours: number }>,
  eligibleIds: string[],
  hoursMap: Record<string, number>,
  urgencyScore: number,
  mode: string,
  fairnessWindowDays: number,
  maxGapHours: number,
  isDRMeeting: boolean = false,
  drConsecutivePenalty: number = 0,
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number },
  bookingTimeStart?: Date,
  drType?: string
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  // Get last global DR assignment once for DR meetings
  let lastGlobalDR = undefined;
  let drPolicy = undefined;
  
  if (isDRMeeting && bookingTimeStart) {
    drPolicy = getDRPolicy(mode);
    lastGlobalDR = await getLastGlobalDRAssignment(bookingTimeStart, {
      drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
      includePending: drPolicy.includePendingInGlobal
    });
    
    console.log(`🔍 DR meeting detected. Last global DR: ${lastGlobalDR?.interpreterEmpCode || 'None'}`);
  }

  for (const interpreter of allInterpreters) {
    const isEligible = eligibleIds.includes(interpreter.empCode);
    const daysSinceLast = await getDaysSinceLastAssignment(interpreter.empCode);
    
    // Check DR assignment history if this is a DR meeting
    let drHistory = undefined;
    
    if (isDRMeeting && bookingTimeStart && drPolicy) {
      drHistory = await checkDRAssignmentHistory(interpreter.empCode, fairnessWindowDays, {
        bookingTimeStart,
        drType: drPolicy.scope === "BY_TYPE" ? drType : undefined,
        lastGlobalDR,
        includePendingInGlobal: drPolicy.includePendingInGlobal,
        drPolicy
      });
      
      // If interpreter is blocked due to consecutive DR assignments, mark as ineligible
      if (drHistory.isBlocked) {
        results.push({
          interpreterId: interpreter.empCode,
          empCode: interpreter.empCode,
          currentHours: interpreter.currentHours,
          daysSinceLastAssignment: daysSinceLast,
          scores: {
            fairness: 0,
            urgency: 0,
            lrs: 0,
            total: 0
          },
          eligible: false,
          reason: `ConsecutiveDRBlocked: ${drHistory.isConsecutiveGlobal ? 'Last DR by same interpreter' : 'Policy violation'}`,
          drHistory
        });
        continue;
      }
    }
    
    if (isEligible) {
      // Eligible candidates get full scoring
      const fairnessScore = computeFairnessScore(
        interpreter.currentHours,
        minHours,
        maxGapHours
      );
      
      const lrsScore = await computeLRSScore(interpreter.empCode, fairnessWindowDays);
      let totalScore = computeTotalScore(
        fairnessScore,
        urgencyScore,
        lrsScore,
        mode,
        customWeights
      );

      // Apply DR penalty if applicable
      if (isDRMeeting && drHistory?.penaltyApplied && drPolicy) {
        const penalty = drPolicy.consecutivePenalty;
        totalScore = applyDRPenalty(totalScore, penalty, true);
        console.log(`⚠️ DR penalty applied to ${interpreter.empCode}: ${penalty} (consecutive DR: ${drHistory.isConsecutiveGlobal})`);
      }

      // Debug logging
      console.log(`🔍 Scoring for ${interpreter.empCode} (Mode: ${mode}):`);
      console.log(`   Current hours: ${interpreter.currentHours}`);
      console.log(`   Fairness score: ${fairnessScore.toFixed(3)}`);
      console.log(`   Urgency score: ${urgencyScore.toFixed(3)}`);
      console.log(`   LRS score: ${lrsScore.toFixed(3)}`);
      console.log(`   Total score: ${totalScore.toFixed(3)}`);
      if (isDRMeeting && drHistory) {
        console.log(`   DR consecutive: ${drHistory.isConsecutiveGlobal}`);
        console.log(`   DR penalty applied: ${drHistory.penaltyApplied}`);
      }
      
      results.push({
        interpreterId: interpreter.empCode,
        empCode: interpreter.empCode,
        currentHours: interpreter.currentHours,
        daysSinceLastAssignment: daysSinceLast,
        scores: {
          fairness: fairnessScore,
          urgency: urgencyScore,
          lrs: lrsScore,
          total: totalScore
        },
        eligible: true,
        drHistory
      });
    } else {
      // Ineligible candidates get reason for logging
      const simulatedHours = { ...hoursMap };
      simulatedHours[interpreter.empCode] = (simulatedHours[interpreter.empCode] || 0) + 1; // assume 1 hour
      const hours = Object.values(simulatedHours);
      const gap = Math.max(...hours) - Math.min(...hours);
      
      results.push({
        interpreterId: interpreter.empCode,
        empCode: interpreter.empCode,
        currentHours: interpreter.currentHours,
        daysSinceLastAssignment: daysSinceLast,
        scores: {
          fairness: 0,
          urgency: 0,
          lrs: 0,
          total: 0
        },
        eligible: false,
        reason: `Would exceed max gap: ${gap.toFixed(1)}h > ${maxGapHours}h`,
        drHistory
      });
    }
  }

  return results;
}
/**
 * Validate and sort scoring results with enhanced tie-breaking
 * Ensures consistent ordering and validates score integrity
 */
export function validateAndSortScoringResults(results: CandidateResult[]): CandidateResult[] {
  // Validate score integrity
  for (const result of results) {
    if (result.eligible) {
      // Ensure scores are within expected ranges
      if (result.scores.fairness < 0 || result.scores.fairness > 1) {
        console.warn(`⚠️ Fairness score out of range for ${result.empCode}: ${result.scores.fairness}`);
      }
      if (result.scores.urgency < 0 || result.scores.urgency > 1) {
        console.warn(`⚠️ Urgency score out of range for ${result.empCode}: ${result.scores.urgency}`);
      }
      if (result.scores.lrs < 0 || result.scores.lrs > 1) {
        console.warn(`⚠️ LRS score out of range for ${result.empCode}: ${result.scores.lrs}`);
      }
    }
  }
  
  // Sort with enhanced tie-breaking logic
  return results.sort((a, b) => {
    // Primary sort: eligible candidates first
    if (a.eligible !== b.eligible) {
      return b.eligible ? 1 : -1;
    }
    
    // For eligible candidates, sort by total score (highest first)
    if (a.eligible && b.eligible) {
      const scoreDiff = b.scores.total - a.scores.total;
      
      // If scores are very close (within 0.000001), they're considered equal
      // The deterministic tie-breaker should have already handled this
      if (Math.abs(scoreDiff) < 0.000001) {
        console.log(`🔄 Very close scores detected: ${a.empCode}=${a.scores.total.toFixed(6)}, ${b.empCode}=${b.scores.total.toFixed(6)}`);
        
        // Fallback tie-breaker: days since last assignment (higher is better)
        const daysDiff = b.daysSinceLastAssignment - a.daysSinceLastAssignment;
        if (daysDiff !== 0) return daysDiff;
        
        // Final fallback: current hours (lower is better for fairness)
        const hoursDiff = a.currentHours - b.currentHours;
        if (hoursDiff !== 0) return hoursDiff;
        
        // Ultimate fallback: interpreter ID for absolute consistency
        return a.empCode.localeCompare(b.empCode);
      }
      
      return scoreDiff;
    }
    
    // For ineligible candidates, sort by reason for consistent ordering
    return (a.reason || '').localeCompare(b.reason || '');
  });
}

/**
 * Get scoring statistics for monitoring and debugging
 */
export function getScoringStatistics(results: CandidateResult[]): {
  totalCandidates: number;
  eligibleCandidates: number;
  conflictedCandidates: number;
  drBlockedCandidates: number;
  fairnessBlockedCandidates: number;
  scoreDistribution: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
} {
  const eligible = results.filter(r => r.eligible);
  const conflicted = results.filter(r => r.reason?.includes('Time conflict'));
  const drBlocked = results.filter(r => r.reason?.includes('ConsecutiveDRBlocked'));
  const fairnessBlocked = results.filter(r => r.reason?.includes('exceed max gap'));
  
  const eligibleScores = eligible.map(r => r.scores.total).sort((a, b) => a - b);
  
  return {
    totalCandidates: results.length,
    eligibleCandidates: eligible.length,
    conflictedCandidates: conflicted.length,
    drBlockedCandidates: drBlocked.length,
    fairnessBlockedCandidates: fairnessBlocked.length,
    scoreDistribution: {
      min: eligibleScores.length > 0 ? eligibleScores[0] : 0,
      max: eligibleScores.length > 0 ? eligibleScores[eligibleScores.length - 1] : 0,
      avg: eligibleScores.length > 0 ? eligibleScores.reduce((a, b) => a + b, 0) / eligibleScores.length : 0,
      median: eligibleScores.length > 0 ? eligibleScores[Math.floor(eligibleScores.length / 2)] : 0
    }
  };
}