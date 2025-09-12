import type React from "react";

export type Booking = {
  id: number;
  name: string;
  room: string;
  status: string;
  timeStart: string;
  timeEnd: string;
};

export type BookingData = {
  bookingId: number;
  ownerEmpCode: string;
  ownerPrefix?: string;
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingDetail: string;
  timeStart: string;
  timeEnd: string;
  interpreterId: string | null;
  interpreterName?: string;
  inviteEmails?: string[];
  bookingStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerGroup = "software" | "iot" | "hardware" | "other";

export type DayInfo = {
  date: number;
  dayName: string; // Mon, Tue, ...
  fullDate: Date;
  isPast: boolean;
};

export type SlotData = {
  bookingId: number | null;
  name: string | null;
  room: string | null;
  status: string | null;
  bgClass: string;
  textClass: string;
  icon: React.ReactNode | null;
  span: number;
  shouldDisplay: boolean;
  isPast: boolean;
  isPastTime: boolean;
  isWeekend: boolean;
  isClickable: boolean;
};

// Thin stacked bars data for overlay rendering
export type BarItem = {
  bookingId: number;
  name: string; // owner name for tooltip
  room: string; // meeting room for tooltip
  status: string; // affects color
  startIndex: number; // inclusive
  endIndex: number; // exclusive
  lane: number; // stacked level
  interpreterName?: string; // interpreter name if assigned
  interpreterId?: string | null; // interpreter id if assigned
  meetingDetail?: string; // meeting details
  ownerEmail?: string; // owner email
  ownerTel?: string; // owner phone
  ownerGroup?: OwnerGroup; // owner group/department
};

export type DayBars = {
  bars: BarItem[];
  occupancy: number[]; // length === timeSlots.length, values 0..MAX_LANES
};