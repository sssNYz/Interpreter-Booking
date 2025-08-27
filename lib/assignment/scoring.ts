import type { CandidateResult, ScoreBreakdown } from "@/types/assignment";
import { computeFairnessScore, getMinHours } from "./fairness";
import { computeUrgencyScore } from "./urgency";
import { computeLRSScore, getDaysSinceLastAssignment } from "./lrs";

/**
 * Compute total score for a candidate
 */
export function computeTotalScore(
  fairnessScore: number,
  urgencyScore: number,
  lrsScore: number,
  weights: { w_fair: number; w_urgency: number; w_lrs: number }
): number {
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
  weights: { w_fair: number; w_urgency: number; w_lrs: number },
  fairnessWindowDays: number,
  maxGapHours: number
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  for (const candidate of candidates) {
    // Compute individual scores
    const fairnessScore = computeFairnessScore(
      candidate.currentHours,
      minHours,
      maxGapHours // Use actual maxGapHours, not weights.w_fair
    );
    
    const lrsScore = await computeLRSScore(candidate.empCode, fairnessWindowDays);
    
    const totalScore = computeTotalScore(
      fairnessScore,
      urgencyScore,
      lrsScore,
      weights
    );

    // Add jitter for tie-breaking
    const finalScore = addJitter(candidate.empCode, totalScore);

    results.push({
      interpreterId: candidate.empCode, // Using empCode as ID for consistency
      empCode: candidate.empCode,
      currentHours: candidate.currentHours,
      daysSinceLastAssignment: candidate.daysSinceLastAssignment,
      scores: {
        fairness: fairnessScore,
        urgency: urgencyScore,
        lrs: lrsScore,
        total: finalScore
      },
      eligible: true
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
  weights: { w_fair: number; w_urgency: number; w_lrs: number },
  fairnessWindowDays: number,
  maxGapHours: number
): Promise<CandidateResult[]> {
  const minHours = getMinHours(hoursMap);
  const results: CandidateResult[] = [];

  for (const interpreter of allInterpreters) {
    const isEligible = eligibleIds.includes(interpreter.empCode);
    const daysSinceLast = await getDaysSinceLastAssignment(interpreter.empCode);
    
    if (isEligible) {
      // Eligible candidates get full scoring
      const fairnessScore = computeFairnessScore(
        interpreter.currentHours,
        minHours,
        maxGapHours
      );
      
      const lrsScore = await computeLRSScore(interpreter.empCode, fairnessWindowDays);
      const totalScore = computeTotalScore(
        fairnessScore,
        urgencyScore,
        lrsScore,
        weights
      );

      // Debug logging
      console.log(`🔍 Scoring for ${interpreter.empCode}:`);
      console.log(`   Current hours: ${interpreter.currentHours}`);
      console.log(`   Fairness score: ${fairnessScore.toFixed(3)}`);
      console.log(`   Urgency score: ${urgencyScore.toFixed(3)}`);
      console.log(`   LRS score: ${lrsScore.toFixed(3)}`);
      console.log(`   Total score: ${totalScore.toFixed(3)}`);
      
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
        eligible: true
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
        reason: `Would exceed max gap: ${gap.toFixed(1)}h > ${maxGapHours}h`
      });
    }
  }

  return results;
}
