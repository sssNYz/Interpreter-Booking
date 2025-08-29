import { getMeetingTypePriority } from "./policy";

/**
 * Compute enhanced urgency score based on meeting type priority and lead time
 * Uses diminishing returns model and priority multiplication
 */
export async function computeEnhancedUrgencyScore(
  startTime: Date,
  meetingType: string,
  minAdvanceDays: number
): Promise<number> {
  const daysUntil = getDaysUntil(startTime);
  const priority = await getMeetingTypePriority(meetingType);
  const priorityValue = priority?.priorityValue || 1;
  
  // If already past start time, maximum urgency
  if (daysUntil < 0) {
    return 1.0;
  }
  
  // If within minimum advance days, calculate urgency with diminishing returns
  if (daysUntil <= minAdvanceDays) {
    // Exponential decay: closer = exponentially higher score
    const timeScore = Math.pow(2, (minAdvanceDays - daysUntil) / 2);
    const cappedTimeScore = Math.min(timeScore, 100); // Cap at 100x
    
    // Combine priority and time using multiplication
    const urgencyScore = priorityValue * cappedTimeScore;
    
    // Normalize to 0-1 range with priority influence
    return Math.min(1.0, urgencyScore / 100);
  }
  
  // If well in advance, no urgency
  return 0.0;
}

/**
 * Compute urgency score based on how close the booking is to start time
 * Higher score = more urgent (closer to start time)
 * @deprecated Use computeEnhancedUrgencyScore instead
 */
export function computeUrgencyScore(
  startTime: Date,
  minAdvanceDays: number
): number {
  const now = new Date();
  const timeDiff = startTime.getTime() - now.getTime();
  const daysUntil = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // If already past start time, maximum urgency
  if (daysUntil < 0) {
    return 1.0;
  }
  
  // If within minimum advance days, calculate urgency
  if (daysUntil <= minAdvanceDays) {
    const urgency = (minAdvanceDays - daysUntil) / minAdvanceDays;
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
 * Check if booking is urgent (within minimum advance days)
 */
export function isUrgent(startTime: Date, minAdvanceDays: number): boolean {
  return getDaysUntil(startTime) <= minAdvanceDays;
}

/**
 * Check if booking should be assigned immediately based on meeting type and lead time
 */
export async function shouldAssignImmediately(
  startTime: Date,
  meetingType: string
): Promise<boolean> {
  const priority = await getMeetingTypePriority(meetingType);
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
