// Types for the interpreter auto-assignment system

export interface AssignmentPolicy {
  autoAssignEnabled: boolean;
  fairnessWindowDays: number;
  maxGapHours: number;
  minAdvanceDays: number;
  w_fair: number;
  w_urgency: number;
  w_lrs: number;
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
}

export interface RunResult {
  status: "assigned" | "escalated";
  interpreterId?: string;
  reason?: string;
  breakdown?: CandidateResult[];
  note?: string;
}

export interface HoursSnapshot {
  [interpreterId: string]: number;
}

export interface AssignmentLogData {
  bookingId: number;
  interpreterEmpCode?: string;
  status: "assigned" | "escalated";
  reason?: string;
  preHoursSnapshot: HoursSnapshot;
  postHoursSnapshot?: HoursSnapshot;
  scoreBreakdown?: ScoreBreakdown;
  maxGapHours: number;
  fairnessWindowDays: number;
}

export interface InterpreterAvailability {
  empCode: string;
  isActive: boolean;
  canWorkAt: (startTime: Date, endTime: Date) => Promise<boolean>;
}
