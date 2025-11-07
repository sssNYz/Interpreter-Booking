import type { OwnerGroup, BookingStatus, MeetingType, DRType, OtherTypeScope } from "@/prisma/prisma";

// Dedicated request type for creating room bookings
export interface CreateRoomBookingRequest {
  ownerEmpCode: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss"
  timeEnd: string;   // "YYYY-MM-DD HH:mm:ss"

  // Optional metadata
  meetingType?: MeetingType;
  meetingDetail?: string | null;
  applicableModel?: string | null;
  meetingLink?: string | null;
  chairmanEmail?: string | null;
  inviteEmails?: string[];
  bookingStatus?: BookingStatus;

  // Optional: DR/Other categorization
  // Accepts DRType or string for flexibility with mapped DB values
  drType?: DRType | string | null;
  otherType?: string | null;
  otherTypeScope?: OtherTypeScope | null;
}
