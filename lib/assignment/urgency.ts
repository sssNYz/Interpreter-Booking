/**
 * Compute urgency score based on how close the booking is to start time
 * Higher score = more urgent (closer to start time)
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
