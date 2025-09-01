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

// New DR policy configuration for consecutive-aware logic
export interface DRPolicy {
  scope: "GLOBAL" | "BY_TYPE";     // GLOBAL = one pool; BY_TYPE = rotate per drType
  forbidConsecutive: boolean;      // true = hard block; false = soft penalty
  consecutivePenalty: number;      // negative number applied to total score if not blocked
  includePendingInGlobal: boolean; // whether pending bookings count as "last"
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

// New interface for last global DR assignment
export interface LastGlobalDRAssignment {
  interpreterEmpCode: string | null;
  bookingId?: number;
  timeStart?: Date;
  drType?: string;
}

// Extended DRAssignmentHistory for consecutive-aware logic
export interface ConsecutiveDRAssignmentHistory {
  interpreterId: string;
  consecutiveDRCount: number;    // 1 if the last global DR is the same interpreter, else 0
  lastDRAssignments: Array<{ bookingId: number, timeStart: Date, drType: string }>;
  isBlocked: boolean;            // true if policy forbids consecutive; else false
  penaltyApplied: boolean;       // true if policy penalizes "last DR person"; else false
  isConsecutiveGlobal: boolean;  // true if this interpreter did the last global DR
  lastGlobalDR?: LastGlobalDRAssignment; // reference to the last global DR assignment
}
