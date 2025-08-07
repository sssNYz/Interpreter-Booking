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
