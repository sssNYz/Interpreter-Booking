// Types for the interpreter auto-assignment system

export interface AssignmentPolicy {
  autoAssignEnabled: boolean;
  mode: 'BALANCE' | 'URGENT' | 'NORMAL' | 'CUSTOM';
  fairnessWindowDays: number;
  maxGapHours: number;
  minAdvanceDays: number;
  w_fair: number;
  w_urgency: number;
  w_lrs: number;
  drConsecutivePenalty: number; // New parameter for DR consecutive assignment penalty
}

export interface MeetingTypePriority {
  id: number;
  meetingType: string;
  priorityValue: number;
  urgentThresholdDays: number;
  generalThresholdDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingPoolEntry {
  bookingId: number;
  meetingType: string;
  startTime: Date;
  endTime: Date;
  priorityValue: number;
  urgentThresholdDays: number;
  generalThresholdDays: number;
  poolEntryTime: Date;
  decisionWindowTime: Date;
}

export interface ScoreBreakdown {
  fairness: number;
  urgency: number;
  lrs: number;
  total: number;
}

export interface CandidateResult {
  interpreterId: string;
  empCode: string;
  currentHours: number;
  daysSinceLastAssignment: number;
  scores: ScoreBreakdown;
  eligible: boolean;
  reason?: string;
  drHistory?: DRAssignmentHistory; // DR assignment history for DR meetings
}

export interface RunResult {
  status: "assigned" | "escalated" | "pooled";
  interpreterId?: string;
  reason?: string;
  breakdown?: CandidateResult[];
  note?: string;
  poolEntry?: BookingPoolEntry;
}

export interface HoursSnapshot {
  [interpreterId: string]: number;
}

export interface AssignmentLogData {
  bookingId: number;
  interpreterEmpCode?: string;
  status: "assigned" | "escalated" | "pooled";
  reason?: string;
  preHoursSnapshot: HoursSnapshot;
  postHoursSnapshot?: HoursSnapshot;
  scoreBreakdown?: ScoreBreakdown;
  maxGapHours: number;
  fairnessWindowDays: number;
  mode?: string;
}

export interface InterpreterAvailability {
  empCode: string;
  isActive: boolean;
  canWorkAt: (startTime: Date, endTime: Date) => Promise<boolean>;
}

export interface DRAssignmentHistory {
  interpreterId: string;
  consecutiveDRCount: number;
  lastDRAssignments: Array<{
    bookingId: number;
    timeStart: Date;
    drType: string;
  }>;
  isBlocked: boolean;
  penaltyApplied: boolean;
}
