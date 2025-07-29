export type Booking = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
};

export type WeeklyChartData = {
  day: string;
  value: number;
};
