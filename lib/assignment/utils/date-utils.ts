/**
 * Date utility functions to handle timezone issues consistently
 * These functions ensure consistent date formatting across the application
 */

/**
 * Convert Date to ISO string
 */
export const toIso = (d: Date): string => d.toISOString();

/**
 * Extract YYYY-MM-DD from ISO string
 */
export const extractYMD = (iso: string): string => iso.split("T")[0];

/**
 * Extract HH:mm:ss from ISO string
 */
export const extractHMS = (iso: string): string => iso.split("T")[1].slice(0, 8);

/**
 * Format Date as "YYYY-MM-DD HH:mm:ss" string
 * This ensures consistent formatting without timezone conversion issues
 */
export const formatDateTime = (d: Date): string => `${extractYMD(toIso(d))} ${extractHMS(toIso(d))}`;

/**
 * Parse a formatted date string back to Date object
 * Handles "YYYY-MM-DD HH:mm:ss" format
 */
export const parseDateTime = (dateTimeString: string): Date => {
  // If it's already in ISO format, parse directly
  if (dateTimeString.includes('T')) {
    return new Date(dateTimeString);
  }
  
  // If it's in "YYYY-MM-DD HH:mm:ss" format, convert to ISO
  const [datePart, timePart] = dateTimeString.split(' ');
  if (datePart && timePart) {
    return new Date(`${datePart}T${timePart}.000Z`);
  }
  
  // Fallback to direct parsing
  return new Date(dateTimeString);
};

/**
 * Get current time as formatted string
 */
export const getCurrentDateTime = (): string => formatDateTime(new Date());

/**
 * Compare two dates using formatted strings to avoid timezone issues
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export const compareDates = (date1: Date, date2: Date): number => {
  const formatted1 = formatDateTime(date1);
  const formatted2 = formatDateTime(date2);
  
  if (formatted1 < formatted2) return -1;
  if (formatted1 > formatted2) return 1;
  return 0;
};

/**
 * Check if a deadline has passed using string comparison
 */
export const isDeadlinePassed = (deadline: Date, currentTime?: Date): boolean => {
  const current = currentTime || new Date();
  return compareDates(current, deadline) >= 0;
};

/**
 * Calculate deadline time using UTC timestamps (no timezone conversion)
 */
export const calculateDeadline = (startTime: Date, daysBeforeStart: number): Date => {
  const startTimeUTC = startTime.getTime();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const deadlineUTC = startTimeUTC - (daysBeforeStart * millisecondsPerDay);
  return new Date(deadlineUTC);
};

/**
 * Get time difference in hours between two dates
 */
export const getHoursDifference = (date1: Date, date2: Date): number => {
  const diff = date1.getTime() - date2.getTime();
  return diff / (1000 * 60 * 60);
};

/**
 * Format date for database storage (ensures consistent format)
 */
export const formatForDatabase = (date: Date): string => {
  return formatDateTime(date);
};

/**
 * Create a Date object from database string (handles timezone consistently)
 */
export const parseFromDatabase = (dateString: string): Date => {
  return parseDateTime(dateString);
};