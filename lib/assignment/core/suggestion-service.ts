import prisma from "@/prisma/prisma";
import type { CandidateResult, AssignmentPolicy } from "@/types/assignment";
import { loadPolicy } from "../config/policy";
import { getEffectivePolicyForEnvironment } from "../config/env-policy";
import { getActiveInterpreters, getInterpreterHours } from "../scoring/fairness";
import { computeEnhancedUrgencyScore } from "../scoring/urgency";
import { rankByScore } from "../scoring/scoring";
import { isDRMeeting } from "../utils/dr-history";
import { centerPart } from "@/utils/users";
import { filterAvailableInterpreters } from "../utils/conflict-detection";

export interface SuggestionCandidate {
  empCode: string;
  score: number;
  reasons: string[];
  time: {
    daysToMeeting: number;
    hoursToStart: number;
    lastJobDaysAgo: number;
  };
}

export interface SuggestionResult {
  ok: boolean;
  mode: string;
  thresholds: {
    urgentThresholdDays: number;
    generalThresholdDays: number;
  };
  candidates: SuggestionCandidate[];
  totalChecked: number;
  conflictsDetected: number;
  error?: string;
}

export async function buildSuggestions(
  bookingId: number,
  environmentId?: number,
  mode?: string,
  customWeights?: { w_fair?: number; w_urgency?: number; w_lrs?: number },
  maxCandidates: number = 10
): Promise<SuggestionResult> {
  try {
    // Get booking details
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        timeStart: true,
        timeEnd: true,
        meetingType: true,
        interpreterEmpCode: true,
        meetingDetail: true,
        employee: { select: { deptPath: true } }
      }
    });

    if (!booking) {
      return {
        ok: false,
        mode: 'UNKNOWN',
        thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
        candidates: [],
        totalChecked: 0,
        conflictsDetected: 0,
        error: 'Booking not found'
      };
    }

    // Check if already assigned
    if (booking.interpreterEmpCode) {
      return {
        ok: false,
        mode: 'UNKNOWN',
        thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
        candidates: [],
        totalChecked: 0,
        conflictsDetected: 0,
        error: 'Booking already assigned'
      };
    }

    // Determine environment
    let effectiveEnvId = environmentId;
    if (!effectiveEnvId) {
      const forward = await prisma.bookingForwardTarget.findFirst({
        where: { bookingId },
        select: { environmentId: true },
        orderBy: { createdAt: 'desc' }
      });
      effectiveEnvId = forward?.environmentId ?? undefined;
      
      if (effectiveEnvId == null) {
        const center = centerPart(booking.employee?.deptPath ?? null);
        if (center) {
          const envCenter = await prisma.environmentCenter.findUnique({ 
            where: { center }, 
            select: { environmentId: true } 
          });
          effectiveEnvId = envCenter?.environmentId ?? undefined;
        }
      }
    }

    // Load effective policy
    const effectivePolicy: AssignmentPolicy = effectiveEnvId != null
      ? await getEffectivePolicyForEnvironment(effectiveEnvId)
      : await loadPolicy();

    const effectiveMode = mode || effectivePolicy.mode;

    // Get active interpreters
    let interpreters = await getActiveInterpreters();

    // Filter by environment
    if (effectiveEnvId != null) {
      const envLinks = await prisma.environmentInterpreter.findMany({
        where: { environmentId: effectiveEnvId },
        select: { interpreterEmpCode: true }
      });
      const allowedSet = new Set(envLinks.map((l) => l.interpreterEmpCode));
      interpreters = interpreters.filter((i) => allowedSet.has(i.empCode));
    }

    if (interpreters.length === 0) {
      return {
        ok: false,
        mode: effectiveMode,
        thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
        candidates: [],
        totalChecked: 0,
        conflictsDetected: 0,
        error: 'No interpreters available'
      };
    }

    // Check conflicts
    const interpreterIds = interpreters.map(i => i.empCode);
    const availableInterpreterIds = await filterAvailableInterpreters(
      interpreterIds,
      booking.timeStart,
      booking.timeEnd
    );

    const conflictsDetected = interpreters.length - availableInterpreterIds.length;

    if (availableInterpreterIds.length === 0) {
      return {
        ok: false,
        mode: effectiveMode,
        thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
        candidates: [],
        totalChecked: interpreters.length,
        conflictsDetected,
        error: 'All interpreters have time conflicts'
      };
    }

    // Filter available interpreters
    const availableInterpreters = interpreters.filter(i =>
      availableInterpreterIds.includes(i.empCode)
    );

    // Get interpreter hours
    const preHoursSnapshot = await getInterpreterHours(interpreters, effectivePolicy.fairnessWindowDays);

    // Compute urgency score
    const urgencyScore = await computeEnhancedUrgencyScore(
      booking.timeStart,
      booking.meetingType
    );

    // Check fairness eligibility
    const eligibleIds: string[] = [];
    const bookingDuration = (booking.timeEnd.getTime() - booking.timeStart.getTime()) / (1000 * 60 * 60);

    for (const interpreter of availableInterpreters) {
      const simulatedHours = { ...preHoursSnapshot };
      const currentHours = simulatedHours[interpreter.empCode] || 0;
      simulatedHours[interpreter.empCode] = currentHours + bookingDuration;

      const hours = Object.values(simulatedHours);
      const gap = Math.max(...hours) - Math.min(...hours);

      if (gap <= effectivePolicy.maxGapHours) {
        eligibleIds.push(interpreter.empCode);
      }
    }

    if (eligibleIds.length === 0) {
      return {
        ok: false,
        mode: effectiveMode,
        thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
        candidates: [],
        totalChecked: interpreters.length,
        conflictsDetected,
        error: 'No interpreters meet fairness criteria'
      };
    }

    // Score candidates
    const candidates = availableInterpreters.map(interpreter => ({
      empCode: interpreter.empCode,
      currentHours: preHoursSnapshot[interpreter.empCode] || 0,
      daysSinceLastAssignment: 0
    }));

    const rankedResults = await rankByScore(
      candidates,
      preHoursSnapshot,
      urgencyScore,
      effectiveMode,
      effectivePolicy.fairnessWindowDays,
      effectivePolicy.maxGapHours,
      isDRMeeting(booking.meetingType),
      effectivePolicy.drConsecutivePenalty,
      customWeights ? {
        w_fair: customWeights.w_fair || 1.0,
        w_urgency: customWeights.w_urgency || 1.0,
        w_lrs: customWeights.w_lrs || 1.0
      } : undefined,
      booking.timeStart,
      booking.meetingDetail || undefined
    );

    // Convert to suggestion format
    const suggestionCandidates: SuggestionCandidate[] = rankedResults
      .slice(0, maxCandidates)
      .map((result) => ({
        empCode: result.empCode,
        score: Math.round(result.scores.total * 100) / 100,
        reasons: buildReasons(result),
        time: calculateTiming(result, booking)
      }));

    return {
      ok: true,
      mode: effectiveMode,
      thresholds: {
        urgentThresholdDays: 10, // TODO: Get from env-aware thresholds
        generalThresholdDays: 30
      },
      candidates: suggestionCandidates,
      totalChecked: interpreters.length,
      conflictsDetected
    };

  } catch (error) {
    console.error('Error building suggestions:', error);
    return {
      ok: false,
      mode: 'ERROR',
      thresholds: { urgentThresholdDays: 0, generalThresholdDays: 0 },
      candidates: [],
      totalChecked: 0,
      conflictsDetected: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function buildReasons(result: CandidateResult): string[] {
  const reasons: string[] = [];
  
  if (result.scores.fairness > 0.8) reasons.push('High fairness score');
  if (result.scores.urgency > 0.8) reasons.push('High urgency score');
  if (result.scores.lrs > 0.8) reasons.push('Long time since last job');
  
  if (reasons.length === 0) reasons.push('Available for time slot');
  
  return reasons;
}

function calculateTiming(result: CandidateResult, booking: {
  timeStart: Date;
  timeEnd: Date;
}) {
  const now = new Date();
  const meetingStart = booking.timeStart;
  const daysToMeeting = Math.ceil((meetingStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const hoursToStart = Math.ceil((meetingStart.getTime() - now.getTime()) / (1000 * 60 * 60));

  return {
    daysToMeeting: Math.max(0, daysToMeeting),
    hoursToStart: Math.max(0, hoursToStart),
    lastJobDaysAgo: result.daysSinceLastAssignment
  };
}
