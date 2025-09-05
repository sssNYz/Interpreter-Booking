// components/dashboard/types.ts

// ===== Enums (front-end mirrors of Prisma) =====
export type OwnerGroup = 'iot' | 'hardware' | 'software' | 'other';
export const OwnerGroupLabel: Record<OwnerGroup, string> = {
  iot: 'IoT',
  hardware: 'Hardware',
  software: 'Software',
  other: 'Other',
};

export type MeetingType = 'DR' | 'PDR' | 'VIP' | 'Weekly' | 'General' | 'Augent' | 'Other';
export type BookingStatus = 'approve' | 'cancel' | 'waiting' | 'complet';
export type DRType = 'PR_PR' | 'DR_k' | 'DR_II' | 'DR_I' | 'Other';
export type OtherTypeScope = 'meeting_type' | 'dr_type';
export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type EndType = 'never' | 'on_date' | 'after_occurrences';
export type WeekOrder = 'first' | 'second' | 'third' | 'fourth' | 'last';

// ===== Basic aliases =====
export type InterpreterName = string;
export type MonthName = string; // e.g., "Apr" | "May" | ...

// ===== Raw monthly row (what your mock/data adapter builds) =====
export interface MonthlyDataRow {
  year: number;
  month: MonthName;

  // totals per interpreter
  jobsByInterpreter: Record<InterpreterName, number>;
  hoursByInterpreter: Record<InterpreterName, number>;

  // department splits
  deptMeetings: Record<OwnerGroup, number>;
  deptByInterpreter: Record<InterpreterName, Record<OwnerGroup, number>>;

  // meeting type splits
  typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>>;
}

// ===== Chart/table row shapes (no any) =====

// Total Jobs per month (grouped by interpreter)
export type JobsRow = {
  month: MonthName;
  total: number;
} & Record<InterpreterName, number>;

// Total Time per month (in minutes, grouped by interpreter)
export type HoursRow = {
  month: MonthName;
  total: number; // minutes
} & Record<InterpreterName, number>;

// Dept grouped bars (one bar per group inside each month)
export type DeptBarsRow = {
  month: MonthName;
  group: string; // rendered label (e.g., "Hardware")
} & Record<InterpreterName, number>;

// Meeting Types grouped bars (one bar per type inside each month)
export type TypesBarsRow = {
  month: MonthName;
  type: string; // type key or "Other" when aggregated
} & Record<InterpreterName, number>;

// Meeting Types × Months table rows
// Use a generic for month columns to avoid `any` and avoid index conflicts.
export type TypesTableRow<M extends string = MonthName> = {
  type: string;    // row label (type or "Other")
  TOTAL: number;   // row total
} & Record<M, number>;

export interface TypesTableFooter {
  perMonth: number[]; // same order as ctx.months
  grand: number;
}

// Reusable footer for “per interpreter” summaries
export interface FooterByInterpreter {
  perInterpreter: number[]; // same order as ctx.interpreters
  grand: number;
  diff: number;             // max-min across interpreters
}

// ===== Dashboard context (consumed by the 4 tabs) =====
export interface DashboardCtx {
  activeYear: number;
  interpreters: InterpreterName[];
  months: MonthName[];
  departments: OwnerGroup[];

  // Jobs
  totalJobsStack: JobsRow[];
  jobsFooter: FooterByInterpreter;

  // Hours (Time)
  totalHoursLineMinutes: HoursRow[];
  hoursFooter: FooterByInterpreter;
  formatMinutes: (mins: number) => string;

  // Dept
  deptBarsFlat: DeptBarsRow[];
  deptChartWidthPx: number;
  deptMGIFooter: FooterByInterpreter;

  // Types
  typesBarsFlat: TypesBarsRow[];
  typesChartWidthPx: number;
  typesTableA_Rows: TypesTableRow[];
  typesTableA_Footer: TypesTableFooter;
  typesMGIFooter: FooterByInterpreter;

  // overflow types control
  displayTypes?: string[];
  hasOverflowTypes?: boolean;
  typesSorted?: string[];
  typeLimit?: number;

  // shared helpers
  interpreterColors: Record<InterpreterName, string>;
  diffClass: (v: number) => string;
  diffRange: (values: number[]) => number;

  // raw rows (used in some tables/charts)
  yearData: MonthlyDataRow[];
}
