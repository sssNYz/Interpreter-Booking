import type { OwnerGroup } from "./booking";
import type {
  BookingStatus,
  MeetingType,
  RecurrenceType,
  EndType,
  WeekOrder,
} from "@prisma/client";

export interface CreateBookingRequest {
  ownerEmpCode: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingType?: MeetingType | null;
  meetingDetail?: string;
  highPriority?: boolean;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss"
  timeEnd: string; // "YYYY-MM-DD HH:mm:ss"
  interpreterEmpCode?: string | null;
  bookingStatus?: BookingStatus;
  timezone?: string;
  inviteEmails?: string[];
  force?: boolean;

  // Recurrence fields
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType | null;
  recurrenceInterval?: number | null;
  recurrenceEndType?: EndType | null;
  recurrenceEndDate?: string | null; // "YYYY-MM-DD HH:mm:ss" (date at 00:00:00)
  recurrenceEndOccurrences?: number | null;
  recurrenceWeekdays?: string | null; // csv of lowercase: sun,mon,tue...
  recurrenceMonthday?: number | null; // 1..31
  recurrenceWeekOrder?: WeekOrder | null;
}
