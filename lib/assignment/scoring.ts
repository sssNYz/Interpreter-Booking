import type { CandidateResult, ScoreBreakdown } from "@/types/assignment";
import { computeFairnessScore, getMinHours } from "./fairness";
import { computeEnhancedUrgencyScore } from "./urgency";
import { computeLRSScore, getDaysSinceLastAssignment } from "./lrs";
import { checkDRAssignmentHistory, isDRMeeting, applyDRPenalty } from "./dr-history";
import { getScoringWeights } from "./policy";

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
 * Add small seeded random jitter to break ties
 * Uses interpreter ID as seed for consistent results
 */
function addJitter(interpreterId: string, baseScore: number): number {
  // Simple hash function for consistent jitter
  let hash = 0;
  for (let i = 0; i < interpreterId.length; i++) {
    const char = interpreterId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Generate small jitter (-0.001 to +0.001)
  const jitter = (hash % 2000 - 1000) / 1000000;
  return baseScore + jitter;
}

/**
 * Rank candidates by score with tie-breaking
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
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number }
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  for (const candidate of candidates) {
    // Check DR assignment history if this is a DR meeting
    let drHistory = undefined;
    let finalTotalScore = 0;
    
    if (isDRMeeting) {
      drHistory = await checkDRAssignmentHistory(candidate.empCode, fairnessWindowDays);
      
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
          reason: `ConsecutiveDRBlocked: ${drHistory.consecutiveDRCount} consecutive DR assignments`,
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
    if (isDRMeeting && drHistory?.penaltyApplied) {
      totalScore = applyDRPenalty(totalScore, drConsecutivePenalty, true);
      console.log(`⚠️ DR penalty applied to ${candidate.empCode}: ${drConsecutivePenalty} (consecutive DR count: ${drHistory.consecutiveDRCount})`);
    }

    // Add jitter for tie-breaking
    finalTotalScore = addJitter(candidate.empCode, totalScore);

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
 * Create candidate results for all interpreters (including ineligible ones)
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
  customWeights?: { w_fair: number; w_urgency: number; w_lrs: number }
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  for (const interpreter of allInterpreters) {
    const isEligible = eligibleIds.includes(interpreter.empCode);
    const daysSinceLast = await getDaysSinceLastAssignment(interpreter.empCode);
    
    // Check DR assignment history if this is a DR meeting
    let drHistory = undefined;
    
    if (isDRMeeting) {
      drHistory = await checkDRAssignmentHistory(interpreter.empCode, fairnessWindowDays);
      
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
          reason: `ConsecutiveDRBlocked: ${drHistory.consecutiveDRCount} consecutive DR assignments`,
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
      if (isDRMeeting && drHistory?.penaltyApplied) {
        totalScore = applyDRPenalty(totalScore, drConsecutivePenalty, true);
        console.log(`⚠️ DR penalty applied to ${interpreter.empCode}: ${drConsecutivePenalty} (consecutive DR count: ${drHistory.consecutiveDRCount})`);
      }

      // Debug logging
      console.log(`🔍 Scoring for ${interpreter.empCode} (Mode: ${mode}):`);
      console.log(`   Current hours: ${interpreter.currentHours}`);
      console.log(`   Fairness score: ${fairnessScore.toFixed(3)}`);
      console.log(`   Urgency score: ${urgencyScore.toFixed(3)}`);
      console.log(`   LRS score: ${lrsScore.toFixed(3)}`);
      console.log(`   Total score: ${totalScore.toFixed(3)}`);
      if (isDRMeeting && drHistory) {
        console.log(`   DR consecutive count: ${drHistory.consecutiveDRCount}`);
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
