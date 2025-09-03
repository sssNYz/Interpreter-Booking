// Centralized utility functions for Admin Dashboard API routes
// This file consolidates all repeated utility functions used across admin-dashboard APIs

import type {
  MonthName,
  InterpreterName,
  OwnerGroup,
  MeetingType,
  DRType,
} from "@/types/admin-dashboard";
import { MONTH_LABELS } from "@/types/admin-dashboard";

// ===== Date/Time Utilities =====
export function getUtcMonthIndex(date: Date): number {
  return date.getUTCMonth();
}

export function getMonthLabel(date: Date): MonthName {
  return MONTH_LABELS[getUtcMonthIndex(date)];
}

// ===== Data Initialization Utilities =====
export function createZeroMeetingTypes(): Record<MeetingType, number> {
  return {
    DR: 0,
    VIP: 0,
    Weekly: 0,
    General: 0,
    Augent: 0,
    Other: 0,
  };
}

export function createZeroDRTypes(): Record<DRType, number> {
  return {
    PR_PR: 0,
    DR_k: 0,
    DR_II: 0,
    DR_I: 0,
    Other: 0,
  };
}

export function createZeroOwnerGroups(): Record<OwnerGroup, number> {
  return {
    iot: 0,
    hardware: 0,
    software: 0,
    other: 0,
  };
}

export function createZeroInterpreterRecord<T>(interpreters: InterpreterName[], defaultValue: T): Record<InterpreterName, T> {
  const record: Record<InterpreterName, T> = {} as Record<InterpreterName, T>;
  interpreters.forEach(interpreter => {
    record[interpreter] = defaultValue;
  });
  return record;
}

// ===== Data Processing Utilities =====
export function calculateFooterStats(
  interpreters: InterpreterName[],
  yearData: Array<{ [key: string]: unknown }>,
  getValue: (row: { [key: string]: unknown }, interpreter: InterpreterName) => number
): { perInterpreter: number[]; grand: number; diff: number } {
  const perInterpreter = interpreters.map(interpreter =>
    yearData.reduce((sum, row) => sum + getValue(row, interpreter), 0)
  );
  
  const grand = perInterpreter.reduce((sum, val) => sum + val, 0);
  const diff = Math.max(...perInterpreter) - Math.min(...perInterpreter);
  
  return { perInterpreter, grand, diff };
}

// ===== Validation Utilities =====
export function isValidYear(year: string | null): boolean {
  if (!year) return false;
  const yearNum = parseInt(year);
  return !isNaN(yearNum) && yearNum >= 2020 && yearNum <= 2030;
}

export function parseYearParam(year: string | null): number | null {
  if (!isValidYear(year)) return null;
  return parseInt(year!);
}

// ===== Response Utilities =====
export function createApiResponse<T>(data: T, cacheControl = "public, s-maxage=60, stale-while-revalidate=300") {
  const response = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
    },
  });
  return response;
}

export function createErrorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// ===== Database Query Utilities =====
export function buildDateRangeFilter(from: string | null, to: string | null) {
  if (!from || !to) return {};
  
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return {};
  }
  
  return {
    gte: fromDate,
    lte: toDate,
  };
}

export function buildSearchFilter(search: string | null) {
  if (!search || search.trim().length < 2) return {};
  
  const searchTerm = search.trim();
  const bookingId = parseInt(searchTerm);
  
  if (!isNaN(bookingId)) {
    return { bookingId };
  } else {
    return { reason: { contains: searchTerm } };
  }
}

// ===== Pagination Utilities =====
export function calculatePagination(page: number, pageSize: number, total: number) {
  const maxPageSize = Math.min(pageSize, 100);
  const totalPages = Math.max(1, Math.ceil(total / maxPageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * maxPageSize;
  const endIndex = Math.min(startIndex + maxPageSize, total);
  
  return {
    page: currentPage,
    pageSize: maxPageSize,
    totalPages,
    startIndex,
    endIndex,
  };
}

// ===== Data Transformation Utilities =====
interface BookingPlanInput {
  meetingType: string;
  drType?: string | null;
  otherType?: string | null;
  ownerGroup?: string | null;
  timeStart: Date;
  timeEnd: Date;
  meetingRoom: string;
  ownerEmpCode?: string | null;
  employee?: {
    empCode: string;
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  } | null;
}

interface EmployeeInput {
  empCode: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
}

export function transformBookingPlanData(bookingPlan: BookingPlanInput) {
  return {
    meetingType: bookingPlan.meetingType,
    drType: bookingPlan.drType,
    otherType: bookingPlan.otherType,
    ownerGroup: bookingPlan.ownerGroup,
    timeStart: bookingPlan.timeStart.toISOString(),
    timeEnd: bookingPlan.timeEnd.toISOString(),
    meetingRoom: bookingPlan.meetingRoom,
    ownerEmpCode: bookingPlan.ownerEmpCode,
    employee: bookingPlan.employee ? {
      empCode: bookingPlan.employee.empCode,
      firstNameEn: bookingPlan.employee.firstNameEn,
      lastNameEn: bookingPlan.employee.lastNameEn,
      firstNameTh: bookingPlan.employee.firstNameTh,
      lastNameTh: bookingPlan.employee.lastNameTh,
    } : null,
  };
}

export function transformEmployeeData(employee: EmployeeInput | null) {
  if (!employee) return null;
  
  return {
    empCode: employee.empCode,
    firstNameEn: employee.firstNameEn,
    lastNameEn: employee.lastNameEn,
    firstNameTh: employee.firstNameTh,
    lastNameTh: employee.lastNameTh,
  };
}

// ===== Constants =====
export const NON_DR_TYPES: ReadonlyArray<MeetingType> = [
  "VIP", "Weekly", "General", "Augent", "Other",
];

export const DR_SUBTYPES: ReadonlyArray<DRType> = [
  "DR_I", "DR_II", "DR_k", "PR_PR", "Other"
];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
