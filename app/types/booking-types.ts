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
};

export type WeeklyChartData = {
  day: string;
  value: number;
};

export type OwnerGroup = 'iot' | 'hardware' | 'software' | 'other';

export type BookingManage = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;

  group: OwnerGroup;             // NEW: OWNER_GROUP
  meetingDetail: string;         // NEW: MEETING_DETAIL (เก็บชื่อเต็ม)

  // เพื่อไม่พังของเดิม ยังเก็บ topic ไว้และ map เป็นค่าเดียวกับ meetingDetail
  topic: string;

  bookedBy: string;
  status: 'Approve' | 'Wait' | 'Cancel';
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


