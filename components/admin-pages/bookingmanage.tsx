"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Edit, AlertTriangle, Star, Clock, Info, CheckCircle, XCircle, Hourglass, Calendar } from 'lucide-react';

// Types
import type  {
  BookingMange, BookingWithConflicts, BookingConflicts, Stats,
} from '@/app/types/booking-types';

// Constants
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Wait', label: 'Wait' },
  { value: 'Approve', label: 'Approve' },
  { value: 'Cancel', label: 'Cancel' }
];

// Mock data - Examples of conflicts
const MOCK_BOOKINGS: BookingMange[]  = [
  {
    id: 1,
    dateTime: '2024-08-15',
    startTime: '09:00',
    endTime: '09:30',
    requestedTime: '2024-08-14T14:30:00',
    bookedBy: 'John Smith',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Approve',
    isDR: true,
    isOverlapping: false,
    topic: 'Hello World Meeting'
  },
  {
    id: 2,
    dateTime: '2024-08-15',
    startTime: '10:00',
    endTime: '10:30',
    requestedTime: '2024-08-14T15:45:00',
    bookedBy: 'Sarah Johnson',
    interpreter: 'Carlos Rodriguez',
    room: 'Room B',
    status: 'Wait',
    isDR: false,
    isOverlapping: false,
    topic: 'Team Sync'
  },
  {
    id: 3,
    dateTime: '2024-08-16',
    startTime: '14:30',
    endTime: '15:00',
    requestedTime: '2024-08-15T09:15:00',
    bookedBy: 'Mike Wilson',
    interpreter: 'Ana Lopez',
    room: 'Room C',
    status: 'Cancel',
    isDR: true,
    isOverlapping: false,
    topic: 'Retrospective'
  },
  {
    id: 4,
    dateTime: '2024-08-15',
    startTime: '09:15',
    endTime: '09:45',
    requestedTime: '2024-08-15T11:20:00',
    bookedBy: 'Emma Davis',
    interpreter: 'Maria Garcia',
    room: 'Room D',
    status: 'Wait',
    isDR: true,
    isOverlapping: false,
    topic: 'Design Review'
  },
  {
    id: 5,
    dateTime: '2024-08-15',
    startTime: '09:20',
    endTime: '09:50',
    requestedTime: '2024-08-16T16:45:00',
    bookedBy: 'David Brown',
    interpreter: 'Pedro Martinez',
    room: 'Room A',
    status: 'Approve',
    isDR: false,
    isOverlapping: false,
    topic: 'Marketing Planning'
  },
  {
    id: 6,
    dateTime: '2024-08-15',
    startTime: '09:00',
    endTime: '09:30',
    requestedTime: '2024-07-19T10:00:00',
    bookedBy: 'Lisa White',
    interpreter: 'Carlos Rodriguez',
    room: 'Room C',
    status: 'Approve',
    isDR: false,
    isOverlapping: false,
    topic: 'Dev Sync'
  },
  {
    id: 7,
    dateTime: '2024-08-15',
    startTime: '11:00',
    endTime: '11:30',
    requestedTime: '2024-08-14T16:00:00',
    bookedBy: 'Tom Wilson',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Wait',
    isDR: false,
    isOverlapping: false,
    topic: 'Client Meeting'
  }
];

// Utility functions
const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const hasTimeOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  const startMinutes1 = parseTime(start1);
  const endMinutes1 = parseTime(end1);
  const startMinutes2 = parseTime(start2);
  const endMinutes2 = parseTime(end2);
  
  return startMinutes1 < endMinutes2 && startMinutes2 < endMinutes1;
};

// Lightweight date formatting with month names
const formatDate = (dateString: string, isClient: boolean): string => {
  if (!isClient) return dateString;
  
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  // Check for today/tomorrow
  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return 'Today';
  if (isTomorrow) return 'Tomorrow';

  // Return DD MMM YYYY format
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
};

const formatRequestedTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

const getFullDate = (dateString: string, isClient: boolean): string => {
  if (!isClient) return dateString;
  
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${dayName}, ${day} ${month} ${year}`;
};

const sortBookings = (bookings: BookingWithConflicts[]): BookingWithConflicts[] => {
  return [...bookings].sort((a, b) => {
    // First sort by date
    const dateCompare = a.dateTime.localeCompare(b.dateTime);
    if (dateCompare !== 0) return dateCompare;
    
    // Then sort by start time
    const timeA = parseTime(a.startTime);
    const timeB = parseTime(b.startTime);
    return timeA - timeB;
  });
};

const detectConflicts = (bookings: BookingMange[]): BookingWithConflicts[] => {
  return bookings.map(booking => {
    const conflicts: BookingConflicts = {
      hasInterpreterConflict: false,
      hasRoomConflict: false,
      conflictingBookings: []
    };

    // Only check conflicts for non-cancelled bookings
    if (booking.status === 'Cancel') {
      return { ...booking, conflicts };
    }

    const otherBookings = bookings.filter(other => 
      other.id !== booking.id && 
      other.dateTime === booking.dateTime && 
      other.status !== 'Cancel'
    );

    otherBookings.forEach(other => {
      const hasOverlap = hasTimeOverlap(
        booking.startTime, 
        booking.endTime, 
        other.startTime, 
        other.endTime
      );

      if (hasOverlap) {
        // Check interpreter conflict
        if (booking.interpreter === other.interpreter) {
          conflicts.hasInterpreterConflict = true;
          conflicts.conflictingBookings.push(other.id);
        }
        
        // Check room conflict
        if (booking.room === other.room) {
          conflicts.hasRoomConflict = true;
          conflicts.conflictingBookings.push(other.id);
        }
      }
    });

    return { ...booking, conflicts };
  });
};

const getCurrentMonthBookings = (bookings: BookingWithConflicts[]): BookingWithConflicts[] => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  return bookings.filter(booking => {
    const bookingDate = new Date(booking.dateTime);
    return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
  });
};

// Component helpers
const getStatusColor = (status: string): string => {
  const statusColors = {
    'Approve': 'text-emerald-700 bg-emerald-100',
    'Wait': 'text-amber-700 bg-amber-100',
    'Cancel': 'text-red-700 bg-red-100'
  };
  return statusColors[status as keyof typeof statusColors] || 'text-gray-700 bg-gray-100';
};

const getStatusIcon = (status: string): React.ReactElement | null => {
  const statusIcons = {
    'Approve': <CheckCircle className="h-4 w-4" />,
    'Wait': <Hourglass className="h-4 w-4" />,
    'Cancel': <XCircle className="h-4 w-4" />
  };
  return statusIcons[status as keyof typeof statusIcons] || null;
};

// Main component
export default function BookingManagement(): React.JSX.Element {
  // State
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    date: '',
    dateRequest: '',
    time: 'all'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    rowsPerPage: 10
  });
  const [selectedBooking, setSelectedBooking] = useState<BookingWithConflicts | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('');
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  // Effects
  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setCurrentMonth(months[now.getMonth()]);
    setCurrentYear(now.getFullYear());
  }, []);

  // Computed values
  const bookingsWithConflicts = useMemo(() => detectConflicts(MOCK_BOOKINGS), []);

  const filteredBookings = useMemo(() => {
    const filtered = bookingsWithConflicts.filter(booking => {
      const matchesSearch = filters.search === '' ||
        booking.bookedBy.toLowerCase().includes(filters.search.toLowerCase()) ||
        booking.interpreter.toLowerCase().includes(filters.search.toLowerCase());

      const matchesStatus = filters.status === 'all' || booking.status === filters.status;
      const matchesDate = filters.date === '' || booking.dateTime === filters.date;
      
      // Handle date request filtering (extract date part from datetime)
      const matchesDateRequest = filters.dateRequest === '' || 
        booking.requestedTime.startsWith(filters.dateRequest);
      
      const matchesTime = filters.time === 'all' || booking.startTime === filters.time;

      return matchesSearch && matchesStatus && matchesDate && matchesDateRequest && matchesTime;
    });

    // Sort the filtered results
    return sortBookings(filtered);
  }, [bookingsWithConflicts, filters]);

  const stats = useMemo((): Stats => {
    const hasActiveFilters = Object.values(filters).some(filter => filter !== '' && filter !== 'all');
    const bookingsToAnalyze = hasActiveFilters ? filteredBookings : getCurrentMonthBookings(bookingsWithConflicts);

    return {
      wait: bookingsToAnalyze.filter(b => b.status === 'Wait').length,
      approve: bookingsToAnalyze.filter(b => b.status === 'Approve').length,
      cancel: bookingsToAnalyze.filter(b => b.status === 'Cancel').length,
      total: bookingsToAnalyze.length
    };
  }, [filteredBookings, bookingsWithConflicts, filters]);

  const paginatedBookings = useMemo(() => {
    const totalPages = Math.ceil(filteredBookings.length / pagination.rowsPerPage);
    const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
    return {
      bookings: filteredBookings.slice(startIndex, startIndex + pagination.rowsPerPage),
      totalPages,
      startIndex
    };
  }, [filteredBookings, pagination]);

  // Handlers
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(newPage, paginatedBookings.totalPages))
    }));
  };

  const handleRowsPerPageChange = (value: string) => {
    setPagination({
      currentPage: 1,
      rowsPerPage: parseInt(value)
    });
  };

  const hasActiveFilters = Object.values(filters).some(filter => filter !== '' && filter !== 'all');

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
      </div>

      {/* Legend */}
      <div className="mb-6 flex items-center gap-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-800">Legend:</span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
          <span className="text-blue-700">= DR (High Priority Meeting)</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-blue-700">= Conflict (Interpreter/Room Overlap)</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        {[
          { key: 'wait', label: 'Wait', color: 'amber', icon: Hourglass, description: hasActiveFilters ? 'Awaiting management approval' : 'Bookings awaiting approval' },
          { key: 'approve', label: 'Approve', color: 'emerald', icon: CheckCircle, description: hasActiveFilters ? 'Confirmed & ready to proceed' : 'Confirmed bookings' },
          { key: 'cancel', label: 'Cancel', color: 'red', icon: XCircle, description: hasActiveFilters ? 'Rejected or withdrawn bookings' : 'Cancel bookings' },
          { key: 'total', label: 'Total', color: 'blue', icon: Calendar, description: hasActiveFilters ? 'All matching results' : 'Total bookings this month' }
        ].map(({ key, label, color, icon: Icon, description }) => (
          <Card key={key} className={`bg-gradient-to-br from-${color}-50 to-${color}-100 border-${color}-200 hover:shadow-lg transition-shadow`}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-base font-semibold text-${color}-800 flex items-center gap-2`}>
                <Icon className="h-4 w-4" />
                {label} {!hasActiveFilters && isClient && `- ${currentMonth} ${currentYear}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold text-${color}-700`}>
                {stats[key as keyof Stats]}
              </div>
              <p className={`text-sm text-${color}-600 mt-1`}>
                {description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Search User / Interpreter
              </label>
              <Input
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Status
              </label>
              <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Date Meeting
              </label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => updateFilter('date', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Date Requested
              </label>
              <Input
                type="date"
                value={filters.dateRequest}
                onChange={(e) => updateFilter('dateRequest', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[130px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Start Time
              </label>
              <Select value={filters.time} onValueChange={(value) => updateFilter('time', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Times" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Times</SelectItem>
                  {TIME_SLOTS.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-200">
                    {['Date Meeting', 'Time', 'User', 'Interpreter', 'Room', 'Status', 'Request', 'Action'].map(header => (
                      <th key={header} className={`px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm ${header === 'Action' ? 'text-center' : ''}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedBookings.bookings.map((booking, index) => {
                    const hasConflict = booking.conflicts.hasInterpreterConflict || booking.conflicts.hasRoomConflict;
                    
                    return (
                      <tr
                        key={booking.id}
                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="group relative">
                              <span className="font-semibold text-gray-900 text-sm cursor-help">
                                {formatDate(booking.dateTime, isClient)}
                              </span>
                              {isClient && (
                                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  {getFullDate(booking.dateTime, isClient)}
                                </div>
                              )}
                            </div>
                            {booking.isDR && (
                              <div className="group relative">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500 cursor-help" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  High Priority Meeting (DR)
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                              <Clock className="h-4 w-4 text-gray-500" />
                              {booking.startTime} - {booking.endTime}
                            </div>
                            {hasConflict && (
                              <div className="group relative">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-semibold cursor-help">
                                  <AlertTriangle className="h-3 w-3" />
                                  Conflict
                                </span>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  {booking.conflicts.hasInterpreterConflict && 'Interpreter conflict'}
                                  {booking.conflicts.hasInterpreterConflict && booking.conflicts.hasRoomConflict && ' & '}
                                  {booking.conflicts.hasRoomConflict && 'Room conflict'}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 text-sm">{booking.bookedBy}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-800 text-sm">{booking.interpreter}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold">
                            {booking.room}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                            {getStatusIcon(booking.status)}
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600 font-mono">
                            {formatRequestedTime(booking.requestedTime)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-blue-100"
                                onClick={() => setSelectedBooking(booking)}
                              >
                                <Edit className="h-8 w-8 text-gray-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Booking Details</DialogTitle>
                              </DialogHeader>
                              {selectedBooking && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">Date Meeting</label>
                                      <p className="mt-1 font-semibold text-base">{formatDate(selectedBooking.dateTime, isClient)}</p>
                                      {isClient && (
                                        <p className="text-sm text-gray-500">{getFullDate(selectedBooking.dateTime, isClient)}</p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">Time</label>
                                      <p className="mt-1 font-mono text-base">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                                    </div>
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">User</label>
                                      <p className="mt-1 font-semibold text-base">{selectedBooking.bookedBy}</p>
                                    </div>
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">Interpreter</label>
                                      <p className="mt-1 text-base">{selectedBooking.interpreter}</p>
                                    </div>
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">Room</label>
                                      <p className="mt-1 text-base">{selectedBooking.room}</p>
                                    </div>
                                    <div>
                                      <label className="block text-base font-semibold text-gray-800">Status</label>
                                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mt-1 ${getStatusColor(selectedBooking.status)}`}>
                                        {getStatusIcon(selectedBooking.status)}
                                        {selectedBooking.status}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-base font-semibold text-gray-800">Requested Time</label>
                                    <p className="mt-1 text-base text-gray-700">{formatRequestedTime(selectedBooking.requestedTime)}</p>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {selectedBooking.isDR && (
                                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                        DR Booking
                                      </span>
                                    )}
                                    {(selectedBooking.conflicts.hasInterpreterConflict || selectedBooking.conflicts.hasRoomConflict) && (
                                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {selectedBooking.conflicts.hasInterpreterConflict && 'Interpreter'}
                                        {selectedBooking.conflicts.hasInterpreterConflict && selectedBooking.conflicts.hasRoomConflict && ' & '}
                                        {selectedBooking.conflicts.hasRoomConflict && 'Room'} Conflict
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-800">Rows per page:</span>
            <Select value={pagination.rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(value => (
                  <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-800">
              {paginatedBookings.startIndex + 1}-{Math.min(paginatedBookings.startIndex + pagination.rowsPerPage, filteredBookings.length)} of {filteredBookings.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === paginatedBookings.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}