import { getMeetingTypePriority } from "../config/policy";
import { getEnvMeetingTypePriority } from "../config/env-policy";

/**
 * Calculate how urgent a booking is
 * Uses meeting type priority and time left
 */
export async function computeEnhancedUrgencyScore(
  startTime: Date,
  meetingType: string,
  environmentId?: number | null
): Promise<number> {
  const daysUntil = getDaysUntil(startTime);
  const priority = environmentId != null
    ? (await getEnvMeetingTypePriority(environmentId, meetingType)) ?? (await getMeetingTypePriority(meetingType))
    : await getMeetingTypePriority(meetingType);
  const priorityValue = priority?.priorityValue || 1;
  const urgentThreshold = priority?.urgentThresholdDays || 1;
  
  // If booking already started, it is very urgent
  if (daysUntil < 0) {
    return 1.0;
  }
  
  // If booking is close to start time, calculate urgency
  if (daysUntil <= urgentThreshold) {
    // Closer to start time = higher score
    const timeScore = Math.pow(2, (urgentThreshold - daysUntil) / 2);
    const cappedTimeScore = Math.min(timeScore, 100); // Limit to 100 max
    
    // Multiply priority and time score
    const urgencyScore = priorityValue * cappedTimeScore;
    
    // Make final score between 0 and 1
    return Math.min(1.0, urgencyScore / 100);
  }
  
  // If booking is far in future, not urgent
  return 0.0;
}

/**
 * Compute urgency score based on how close the booking is to start time
 * Higher score = more urgent (closer to start time)
 * @deprecated Use computeEnhancedUrgencyScore instead
 */
export async function computeUrgencyScore(
  startTime: Date,
  meetingType: string,
  environmentId?: number | null
): Promise<number> {
  const daysUntil = getDaysUntil(startTime);
  const priority = environmentId != null
    ? (await getEnvMeetingTypePriority(environmentId, meetingType)) ?? (await getMeetingTypePriority(meetingType))
    : await getMeetingTypePriority(meetingType);
  const urgentThreshold = priority?.urgentThresholdDays || 1;
  
  // If already past start time, maximum urgency
  if (daysUntil < 0) {
    return 1.0;
  }
  
  // If within urgent threshold days, calculate urgency
  if (daysUntil <= urgentThreshold) {
    const urgency = (urgentThreshold - daysUntil) / urgentThreshold;
    return Math.max(0, Math.min(1, urgency)); // clamp to 0..1
  }
  
  // If well in advance, no urgency
  return 0.0;
}

/**
 * Get days until booking starts
 */
export function getDaysUntil(startTime: Date): number {
  const now = new Date();
  const timeDiff = startTime.getTime() - now.getTime();
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
}

/**
 * Check if booking is urgent (within urgent threshold days)
 */
export async function isUrgent(startTime: Date, meetingType: string, environmentId?: number | null): Promise<boolean> {
  const priority = environmentId != null
    ? (await getEnvMeetingTypePriority(environmentId, meetingType)) ?? (await getMeetingTypePriority(meetingType))
    : await getMeetingTypePriority(meetingType);
  const urgentThreshold = priority?.urgentThresholdDays || 1;
  return getDaysUntil(startTime) <= urgentThreshold;
}

/**
 * Check if booking should be assigned immediately based on meeting type and lead time
 */
export async function shouldAssignImmediately(
  startTime: Date,
  meetingType: string,
  environmentId?: number | null
): Promise<boolean> {
  const priority = environmentId != null
    ? (await getEnvMeetingTypePriority(environmentId, meetingType)) ?? (await getMeetingTypePriority(meetingType))
    : await getMeetingTypePriority(meetingType);
  if (!priority) return false;
  
  const daysUntil = getDaysUntil(startTime);
  return daysUntil <= priority.urgentThresholdDays;
}

/**
 * Check if booking has reached its decision window
 */
export async function hasReachedDecisionWindow(
  startTime: Date,
  meetingType: string,
  poolEntryTime: Date
): Promise<boolean> {
  const priority = await getMeetingTypePriority(meetingType);
  if (!priority) return false;
  
  const daysUntil = getDaysUntil(startTime);
  const poolAge = Math.floor((Date.now() - poolEntryTime.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check if booking is urgent or has been in pool long enough
  return daysUntil <= priority.urgentThresholdDays || poolAge >= priority.generalThresholdDays;
}
