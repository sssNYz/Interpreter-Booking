// Mock data
export type Booking = {
  id: number;
  dateTime: string;
  interpreter: string;
  room: string;
  topic: string;
  bookedBy: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
};

const weeklyData = [
  { day: "Mon", value: 2 },
  { day: "Tue", value: 4 },
  { day: "Wed", value: 3 },
  { day: "Thu", value: 6 },
  { day: "Fri", value: 8 },
  { day: "Sat", value: 1 },
  { day: "Sun", value: 2 }
];

const recentBookings: Booking[] = [
  {
    id: 1,
    dateTime: "2025-01-24 09:00",
    interpreter: "Sarah Johnson",
    room: "Conference A",
    topic: "Medical Consultation",
    bookedBy: "Dr. Smith",
    status: "confirmed"
  },
  {
    id: 2,
    dateTime: "2025-01-24 14:30",
    interpreter: "Miguel Rodriguez",
    room: "Meeting Room B",
    topic: "Legal Deposition",
    bookedBy: "Law Firm ABC",
    status: "pending"
  },
  {
    id: 3,
    dateTime: "2025-01-24 11:15",
    interpreter: "Li Wei",
    room: "Virtual Room 1",
    topic: "Business Meeting",
    bookedBy: "Tech Corp",
    status: "completed"
  },
  {
    id: 4,
    dateTime: "2025-01-20 16:00",
    interpreter: "Anna Kowalski",
    room: "Conference C",
    topic: "Court Hearing",
    bookedBy: "City Court",
    status: "cancelled"
  },
  {
    id: 5,
    dateTime: "2025-01-15 10:30",
    interpreter: "Ahmed Hassan",
    room: "Meeting Room A",
    topic: "Immigration Interview",
    bookedBy: "Immigration Office",
    status: "completed"
  },
  {
    id: 6,
    dateTime: "2024-12-28 13:45",
    interpreter: "Maria Garcia",
    room: "Conference B",
    topic: "Financial Meeting",
    bookedBy: "Bank Corp",
    status: "completed"
  },
  {
    id: 7,
    dateTime: "2024-11-15 15:30",
    interpreter: "John Smith",
    room: "Virtual Room 2",
    topic: "Medical Consultation",
    bookedBy: "Hospital XYZ",
    status: "completed"
  },
  {
    id: 8,
    dateTime: "2025-01-22 08:00",
    interpreter: "Elena Petrov",
    room: "Meeting Room C",
    topic: "Legal Advisory",
    bookedBy: "Legal Firm DEF",
    status: "confirmed"
  },
  {
    id: 9,
    dateTime: "2024-08-10 14:20",
    interpreter: "Carlos Mendez",
    room: "Conference D",
    topic: "Corporate Meeting",
    bookedBy: "Tech Startup",
    status: "completed"
  },
  {
    id: 10,
    dateTime: "2023-12-05 10:15",
    interpreter: "Sophie Laurent",
    room: "Virtual Room 3",
    topic: "Educational Seminar",
    bookedBy: "University ABC",
    status: "completed"
  },
  {
    id: 11,
    dateTime: "2023-09-18 16:45",
    interpreter: "David Kim",
    room: "Meeting Room D",
    topic: "Healthcare Conference",
    bookedBy: "Medical Center",
    status: "completed"
  },
  {
    id: 12,
    dateTime: "2022-11-22 11:30",
    interpreter: "Isabella Romano",
    room: "Conference E",
    topic: "International Trade Meeting",
    bookedBy: "Export Company",
    status: "completed"
  },
  {
    id: 13,
    dateTime: "2022-07-14 09:00",
    interpreter: "Raj Patel",
    room: "Virtual Room 4",
    topic: "Legal Consultation",
    bookedBy: "Immigration Law Firm",
    status: "completed"
  },
  {
    id: 14,
    dateTime: "2024-03-12 13:30",
    interpreter: "Nina Volkov",
    room: "Conference F",
    topic: "Government Meeting",
    bookedBy: "City Hall",
    status: "completed"
  }
];

export { weeklyData, recentBookings };
