import type { OwnerGroup } from "./booking";
import type { BookingStatus } from "@prisma/client";

export interface CreateBookingRequest {
  ownerEmpCode: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingDetail?: string;
  highPriority?: boolean;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss"
  timeEnd: string; // "YYYY-MM-DD HH:mm:ss"
  interpreterEmpCode?: string | null;
  bookingStatus?: BookingStatus;
  timezone?: string;
  inviteEmails?: string[];
  force?: boolean;
}


