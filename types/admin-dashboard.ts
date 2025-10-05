// Centralized types for Admin Dashboard components and API routes
// This file consolidates all repeated and inconsistent type definitions

// ===== Re-export from existing overview types =====
export type {
  MonthName,
  InterpreterName,
  OwnerGroup,
  MeetingType,
  DRType,
  MonthlyDataRow,
  JobsRow,
  HoursRow,
  FooterByInterpreter,
} from "@/types/overview";

export { OwnerGroupLabel } from "@/types/overview";

// ===== Import for internal use =====
import type {
  MonthName,
  InterpreterName,
  OwnerGroup,
  MeetingType,
  DRType,
  MonthlyDataRow,
  JobsRow,
  HoursRow,
  FooterByInterpreter,
} from "@/types/overview";

// ===== Employee Information Types =====
export interface EmployeeInfo {
  empCode: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
}

// ===== Booking Plan Information Types =====
export interface BookingPlanInfo {
  meetingType: string;
  drType?: string | null;
  otherType?: string | null;
  ownerGroup?: string | null;
  timeStart: string;
  timeEnd: string;
  meetingRoom: string;
  ownerEmpCode?: string | null;
  employee?: EmployeeInfo | null;
}

// ===== Assignment Logs Types =====
export interface AssignmentLogItem {
  id: number;
  bookingId: number;
  interpreterEmpCode?: string | null;
  status: string;
  reason?: string | null;
  createdAt: string;
  preHoursSnapshot?: unknown;
  postHoursSnapshot?: unknown;
  scoreBreakdown?: unknown;
  bookingPlan: BookingPlanInfo;
  interpreterEmployee?: EmployeeInfo | null;
}

export interface AssignmentLogsApiResponse {
  items: AssignmentLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    byInterpreter: Record<string, {
      assigned: number;
      approved: number;
      rejected: number;
    }>;
  };
}

// ===== Jobs Total API Response =====
export interface JobsApiResponse {
  months: MonthName[];
  interpreters: InterpreterName[];
  totalJobsStack: JobsRow[];
  jobsFooter: FooterByInterpreter;
  year: number;
}

// ===== Hours/Time Jobs Total API Response =====
export interface HoursApiResponse {
  months: MonthName[];
  interpreters: InterpreterName[];
  totalHoursLineMinutes: HoursRow[];
  hoursFooter: FooterByInterpreter;
  year: number;
}

// ===== Department Jobs Total API Response =====
export interface DepartmentsApiResponse {
  months: MonthName[];
  interpreters: InterpreterName[];
  departments: OwnerGroup[];
  year: number;
  yearData: MonthlyDataRow[];
  deptMGIFooter: FooterByInterpreter;
}

// ===== Meeting Types Jobs Total API Response =====
export interface MonthlyDataRowWithDR extends MonthlyDataRow {
  drTypeByInterpreter: Record<InterpreterName, Record<DRType, number>>;
}

export interface TypesApiResponse {
  months: MonthName[];
  interpreters: InterpreterName[];
  year: number;
  yearData: MonthlyDataRowWithDR[];
  typesMGIFooter: FooterByInterpreter;
}

// ===== Constants =====
export const MONTH_LABELS: MonthName[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MEETING_TYPES: MeetingType[] = ["DR", "VIP", "Weekly", "General", "Urgent", "President", "Other"];

export const DR_TYPES: DRType[] = ["DR_PR", "DR_k", "DR_II", "DR_I", "Other"];

export const OWNER_GROUPS: OwnerGroup[] = ["iot", "hardware", "software", "other"];

// ===== Unified Chart Data Types =====
export interface BaseChartDataRow {
  [key: string]: string | number;
}

export interface InterpreterChartRow extends BaseChartDataRow {
  month: MonthName;
  total: number;
}

export interface CategoryChartRow extends BaseChartDataRow {
  group: string;
}

export interface TypeChartRow extends BaseChartDataRow {
  type: string;
}

// ===== Unified Table Types =====
export interface BaseTableRow {
  TOTAL: number;
  [key: string]: string | number;
}

export type MonthlyTableRow = BaseTableRow & {
  [K in MonthName]: number;
}

export interface DetailedTableRow {
  values: number[];
  total: number;
  diff: number;
}

// ===== Shared API Types =====
export interface ApiRouteParams {
  year?: string;
}

// ===== Shared Component Types =====
export interface BaseApiResponse {
  months: MonthName[];
  interpreters: InterpreterName[];
  year: number;
}

export interface ChartDataRow extends BaseChartDataRow {
  month: MonthName;
  total: number;
}

export type DepartmentChartRow = CategoryChartRow & {
  [K in InterpreterName]: number;
}

export type TypeChartDataRow = TypeChartRow & {
  [K in InterpreterName]: number;
}

// ===== Shared React Hook Types =====
export interface UseDashboardDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface InterpreterEmployee {
  empCode: string;
  firstNameEn: string | null;
  lastNameEn: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
}

export interface InterpreterMapping {
  empCodeToName: Map<string, InterpreterName>;
  interpreters: InterpreterName[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ApiResponseHeaders {
  'Cache-Control': string;
  'X-Total-Count'?: string;
  'X-Page-Count'?: string;
}

// ===== Legacy Type Aliases (for backward compatibility) =====
export type ApiResponse = JobsApiResponse; // Default to JobsApiResponse for backward compatibility
export type DeptApiResponse = DepartmentsApiResponse;


