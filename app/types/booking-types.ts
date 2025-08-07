export type Booking = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'Approved' | 'Waiting' | 'Cancelled';
  startTime: string;
  endTime: string;
  requestedTime: string;
  isDR: boolean;
};

export type WeeklyChartData = {
  day: string;
  value: number;
};



