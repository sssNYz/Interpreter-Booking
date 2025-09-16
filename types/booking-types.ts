import type { OwnerGroup } from "./booking";

export type StatusOption = "all" | "Wait" | "Approve" | "Cancel";

export type AdminBookingRow = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  group?: OwnerGroup;
  meetingDetail?: string;
  topic?: string;
  bookedBy: string;
  status: "Approve" | "Wait" | "Cancel";
  startTime: string;
  endTime: string;
  requestedTime: string;
  isDR: boolean;
};

// Types used in admin manage and detail views
export type BookingManage = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  group: OwnerGroup;
  meetingDetail: string;
  // legacy compatibility
  topic: string;
  bookedBy: string;
  status: "Approve" | "Wait" | "Cancel";
  startTime: string;
  endTime: string;
  requestedTime: string;
  isDR: boolean;
};

export interface Stats {
  wait: number;
  approve: number;
  cancel: number;
  total: number;
}

export type WeeklyChartData = {
  day: string;
  value: number;
};

// For overview table recent bookings
export type AdminRecentBooking = AdminBookingRow;


