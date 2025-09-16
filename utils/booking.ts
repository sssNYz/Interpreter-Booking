import React from "react";
import { CheckCircle, Hourglass, XCircle } from "lucide-react";
import type { BookingManage } from "@/types/admin";

/* ========= Date Utilities ========= */

/**
 * Convert date string to YYYY-MM-DD format
 */
export const toLocalYMD = (s: string): string => {
  const d = new Date(s);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Check if a meeting is past (ended with grace period and past end of day)
 */
export const isPastMeeting = (dateStr: string, endHHmm: string, graceMin = 10): boolean => {
  const ymd = toLocalYMD(dateStr);
  const end = new Date(`${ymd}T${endHHmm}:00`);
  const endWithGrace = new Date(end.getTime() + graceMin * 60 * 1000);
  const endOfDay = new Date(`${ymd}T23:59:59`);
  
  return Date.now() > endWithGrace.getTime() && Date.now() > endOfDay.getTime();
};

/* ========= Time Utilities ========= */

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export const parseTime = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* ========= Formatting Utilities ========= */

/**
 * Format date string to "DD MMM YYYY" format
 */
export const formatDate = (s: string): string => {
  const d = new Date(s);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Format requested time to "DD MMM YYYY · HH:MM" format
 */
export const formatRequestedTime = (s: string): string => {
  const d = new Date(s);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
};

/**
 * Get full date string with day name (client-side only)
 */
export const getFullDate = (s: string, isClient: boolean): string => {
  if (!isClient) return s;
  const d = new Date(s);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/* ========= Data Processing Utilities ========= */

/**
 * Sort bookings by date and time
 */
export const sortBookings = (arr: BookingManage[], asc: boolean): BookingManage[] =>
  [...arr].sort((a, b) => {
    const dc = asc ? a.dateTime.localeCompare(b.dateTime) : b.dateTime.localeCompare(a.dateTime);
    if (dc !== 0) return dc;
    return parseTime(a.startTime) - parseTime(b.startTime);
  });

/**
 * Filter bookings for current month
 */
export const getCurrentMonthBookings = (arr: BookingManage[]): BookingManage[] => {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return arr.filter((b) => {
    const d = new Date(b.dateTime);
    return d.getMonth() === m && d.getFullYear() === y;
  });
};

/* ========= UI Utilities ========= */

/**
 * Get status color classes for booking status
 */
export const getStatusColor = (status: string): string =>
  ({
    Approve: "text-emerald-700 bg-emerald-100",
    Wait: "text-amber-700 bg-amber-100",
    Cancel: "text-red-700 bg-red-100",
  } as const)[status as "Approve" | "Wait" | "Cancel"] || "text-gray-700 bg-gray-100";

/**
 * Get status icon for booking status
 */
export const getStatusIcon = (status: string) => {
  const iconMap = {
    Approve: React.createElement(CheckCircle, { className: "h-4 w-4" }),
    Wait: React.createElement(Hourglass, { className: "h-4 w-4" }),
    Cancel: React.createElement(XCircle, { className: "h-4 w-4" }),
  } as const;
  
  return iconMap[status as "Approve" | "Wait" | "Cancel"] || null;
};
