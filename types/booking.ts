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
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: string;
  meetingRoom: string;
  meetingDetail: string;
  highPriority: boolean;
  timeStart: string;
  timeEnd: string;
  interpreterId: number | null;
  bookingStatus: string;
  createdAt: string;
  updatedAt: string;
};

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
  name: string; // optional for tooltip
  room: string; // optional for tooltip
  status: string; // affects color
  startIndex: number; // inclusive
  endIndex: number; // exclusive
  lane: 0 | 1; // stacked level
};

export type DayBars = {
  bars: BarItem[];
  occupancy: number[]; // length === timeSlots.length, values 0..MAX_LANES
};