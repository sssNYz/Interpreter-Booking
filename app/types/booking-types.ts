export type Booking = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'Approve' | 'Wait' | 'Cancel';
  startTime: string;
  endTime: string;
  requestedTime: string;
  isDR: boolean;
  isOverlapping: boolean,
};

export type WeeklyChartData = {
  day: string;
  value: number;
};

export type BookingMange = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'Approve' | 'Wait' | 'Cancel';
  startTime: string;
  endTime: string;
  requestedTime: string;
  isDR: boolean;
  isOverlapping: boolean,
};

export interface BookingConflicts {
  hasInterpreterConflict: boolean;
  hasRoomConflict: boolean;
  conflictingBookings: number[];
}

export interface BookingWithConflicts extends BookingMange {
  conflicts: BookingConflicts;
}

export interface Stats {
  wait: number;
  approve: number;
  cancel: number;
  total: number;
}


