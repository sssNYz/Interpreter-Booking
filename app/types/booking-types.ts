export type Booking = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'Approved' | 'Waiting' | 'Cancelled';
};

export type WeeklyChartData = {
  day: string;
  value: number;
};
export interface BookingMange {
  id: number;
  user: string; // OWNER_NAME + OWNER_SURNAME
  room: string; // MEETING_ROOM
  interpreter: string; // แสดงชื่อ ต้องมาจาก INTERPRETER_ID → ชื่อ
  status: 'Approved' | 'Waiting' | 'Cancelled'; // จาก BOOKING_STATUS
  isDR: boolean; // จาก HIGH_PRIORITY == 1
  isOverlapping: boolean; // คำนวณเพิ่มเองภายหลัง
  startTime: string; // จาก TIME_START → format 'HH:mm'
  endTime: string; // จาก TIME_END → format 'HH:mm'
  requestedTime: string; // created_at → format 'YYYY-MM-DD HH:mm'
}
