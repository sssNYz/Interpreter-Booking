// Centralized utility functions for Admin Dashboard API routes
// This file consolidates all repeated utility functions used across admin-dashboard APIs

import { NextResponse } from "next/server";
import React from "react";
import type { Prisma } from "@prisma/client";
import type {
  MonthName,
  InterpreterName,
  OwnerGroup,
  MeetingType,
  DRType,
  BaseApiResponse,
  UseDashboardDataResult,
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

export function createErrorResponseLegacy(message: string, status = 500) {
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

// ===== Overviews =====

// minutes -> "H.MM hr" or "N min"
export function formatMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return "0 min";
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}.${String(m).padStart(2, "0")} hr` : `${sign}${abs} min`;
}

export const getCurrentFiscalMonthLabel = (now = new Date()): MonthName => {
  const mths: MonthName[] = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const map: Record<number, number> = { 0: 9, 1: 10, 2: 11, 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8 };
  return mths[map[now.getMonth()]];
};

export const years: number[] = Array.from(
  { length: new Date().getFullYear() - 2025 + 1 }, 
  (_, i) => new Date().getFullYear() - i
);

// ===== Current Month Detection =====
export function getCurrentCalendarMonth(months: MonthName[]): MonthName {
  const cur = new Date().toLocaleString("en-US", { month: "short" }) as MonthName; 
  return months.includes(cur) ? cur : (months[0] as MonthName);
}

export function getCurrentCalendarMonthStrict(months: MonthName[]): MonthName | "" {
  if (!months?.length) return "";
  const idx = new Date().getMonth(); 
  return months[idx] ?? "";
}

export function diffRange(values: number[]): number {
  if (!values.length) return 0;
  let min = values[0], max = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

export function diffClass(v: number): string {
  return v === 0 ? "text-emerald-700" : "text-red-600";
}

// ===== Chart & UI Utilities =====
const INTERPRETER_COLOR_PALETTE = [
  "#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED",
  "#0EA5E9", "#059669", "#CA8A04", "#EA580C", "#9333EA",
] as const;

export function createInterpreterColorPalette(interpreters: InterpreterName[]): Record<InterpreterName, string> {
  const colorMap = {} as Record<InterpreterName, string>;
  interpreters.forEach((name, index) => {
    colorMap[name] = INTERPRETER_COLOR_PALETTE[index % INTERPRETER_COLOR_PALETTE.length];
  });
  return colorMap;
}

export function getInterpreterColorPaletteAsMap(interpreters: InterpreterName[]): Map<InterpreterName, string> {
  const colorMap = new Map<InterpreterName, string>();
  interpreters.forEach((name, index) => {
    colorMap.set(name, INTERPRETER_COLOR_PALETTE[index % INTERPRETER_COLOR_PALETTE.length] ?? "#94a3b8");
  });
  return colorMap;
}

// Hours formatting utilities
export function formatHoursDecimal(minutes: number): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}.${String(mm).padStart(2, "0")} h`;
}

// Consolidated time formatting - use this instead of formatMinutes for consistency
export function formatTimeDisplay(minutes: number, format: 'decimal' | 'mixed' = 'decimal'): string {
  if (format === 'decimal') {
    return formatHoursDecimal(minutes);
  }
  return formatMinutes(minutes);
}

export function buildTwoHourTicks(maxMinutes: number): number[] {
  const topHours = Math.ceil((Math.max(0, maxMinutes) / 60) / 2) * 2;
  const ticks: number[] = [];
  for (let h = 0; h <= topHours; h += 2) {
    ticks.push(h * 60);
  }
  return ticks.length ? ticks : [0, 120];
}

// ===== API Route Utilities =====
export function createDateRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))
  };
}

export async function fetchActiveInterpreters(
  prisma: {
    employee: {
      findMany: (args: {
        where: Prisma.EmployeeWhereInput;
        select: Prisma.EmployeeSelect;
        orderBy: Prisma.EmployeeOrderByWithRelationInput;
      }) => Promise<{ empCode: string; firstNameEn: string | null; lastNameEn: string | null }[]>;
    };
  },
  dateRange: { start: Date; end: Date }
): Promise<{ empCode: string; firstNameEn: string | null; lastNameEn: string | null }[]> {
  return await prisma.employee.findMany({
    where: {
      isActive: true,
      bookingsAsInterpreter: {
        some: {
          timeStart: { gte: dateRange.start, lt: dateRange.end },
          interpreterEmpCode: { not: null }
        }
      }
    },
    select: {
      empCode: true,
      firstNameEn: true,
      lastNameEn: true,
    },
    orderBy: {
      firstNameEn: 'asc'
    }
  });
}

export function createInterpreterMapping(
  activeInterpreters: { empCode: string; firstNameEn: string | null; lastNameEn: string | null }[]
): { empCodeToName: Map<string, InterpreterName>; interpreters: InterpreterName[] } {
  const empCodeToName = new Map<string, InterpreterName>();
  
  for (const interpreter of activeInterpreters) {
    const empCode = interpreter.empCode;
    const first = interpreter.firstNameEn?.trim() ?? "";
    const last = interpreter.lastNameEn?.trim() ?? "";
    const name = (`${first} ${last}`.trim() || empCode) as InterpreterName;
    empCodeToName.set(empCode, name);
  }

  const interpreters: InterpreterName[] = Array.from(new Set(empCodeToName.values()))
    .sort((a, b) => a.localeCompare(b));

  return { empCodeToName, interpreters };
}

export function createApiResponseHeaders(totalCount?: number, pageCount?: number): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
  };
  
  if (totalCount !== undefined) {
    headers['X-Total-Count'] = String(totalCount);
  }
  
  if (pageCount !== undefined) {
    headers['X-Page-Count'] = String(pageCount);
  }
  
  return headers;
}

export function createErrorResponse(message: string, status = 500) {
  return NextResponse.json(
    { message: message ?? "Server error" },
    { status }
  );
}

// ===== Shared React Hooks =====
export function useDashboardData<T extends BaseApiResponse>(
  apiEndpoint: string,
  year: number
): UseDashboardDataResult<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      
      if (!response.ok) {
        throw new Error(`Failed (${response.status})`);
      }
      
      const result = (await response.json()) as T;
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch data";
      setError(errorMessage);
      console.error(`Error fetching data from ${apiEndpoint}:`, err);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData, year]);

  return { data, loading, error, refetch: fetchData };
}

export function useDashboardDataExtraction<T extends BaseApiResponse>(data: T | null, fallbackYear: number) {
  return React.useMemo(() => ({
    interpreters: data?.interpreters ?? [],
    months: data?.months ?? [],
    year: data?.year ?? fallbackYear,
  }), [data, fallbackYear]);
}

export function useInterpreterColors(interpreters: InterpreterName[]): Record<InterpreterName, string> {
  return React.useMemo(() => createInterpreterColorPalette(interpreters), [interpreters]);
}

export function useCurrentMonth(months: MonthName[]): MonthName | "" {
  return React.useMemo(() => getCurrentCalendarMonthStrict(months), [months]);
}