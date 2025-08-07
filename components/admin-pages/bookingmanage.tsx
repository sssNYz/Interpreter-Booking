"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Edit, AlertTriangle, Star, Clock, Info, CheckCircle, XCircle, Hourglass, Calendar } from 'lucide-react';

// Types
interface Booking {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  requestedTime: string;
  user: string;
  interpreter: string;
  room: string;
  status: 'Approve' | 'Wait' | 'Cancel';
  isDR: boolean;
  isOverlapping: boolean;
}

interface Stats {
  wait: number;
  approve: number;
  cancel: number;
  total: number;
}

// Mock data for demonstration
const mockBookings: Booking[] = [
  {
    id: 1,
    date: '2024-08-15',
    startTime: '09:00',
    endTime: '09:30',
    requestedTime: '2024-08-14 14:30',
    user: 'John Smith',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Approve',
    isDR: true,
    isOverlapping: false
  },
  {
    id: 2,
    date: '2024-08-15',
    startTime: '10:00',
    endTime: '10:30',
    requestedTime: '2024-08-14 15:45',
    user: 'Sarah Johnson',
    interpreter: 'Carlos Rodriguez',
    room: 'Room B',
    status: 'Wait',
    isDR: false,
    isOverlapping: false
  },
  {
    id: 3,
    date: '2024-08-16',
    startTime: '14:30',
    endTime: '15:00',
    requestedTime: '2024-08-15 09:15',
    user: 'Mike Wilson',
    interpreter: 'Ana Lopez',
    room: 'Room C',
    status: 'Cancel',
    isDR: true,
    isOverlapping: false
  },
  {
    id: 4,
    date: '2024-08-15',
    startTime: '09:15',
    endTime: '09:45',
    requestedTime: '2024-08-15 11:20',
    user: 'Emma Davis',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Wait',
    isDR: true,
    isOverlapping: true
  },
  {
    id: 5,
    date: '2024-08-15',
    startTime: '09:20',
    endTime: '09:50',
    requestedTime: '2024-08-16 16:45',
    user: 'David Brown',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Approve',
    isDR: false,
    isOverlapping: true
  },
  {
    id: 6,
    date: '2024-07-20',
    startTime: '11:00',
    endTime: '11:30',
    requestedTime: '2024-07-19 10:00',
    user: 'Lisa White',
    interpreter: 'Pedro Martinez',
    room: 'Room D',
    status: 'Approve',
    isDR: false,
    isOverlapping: false
  }
];

// Client-side safe date formatting functions
const formatRequestedTime = (dateString: string, isClient: boolean): string => {
  if (!isClient) return dateString; // Return raw string on server
  
  const date = new Date(dateString);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate time slots from 08:00 to 17:00 in 30-minute intervals
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 17; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 17) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

// Get current month's bookings
const getCurrentMonthBookings = (bookings: Booking[]): Booking[] => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  return bookings.filter(booking => {
    const bookingDate = new Date(booking.date);
    return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
  });
};

export default function BookingManagement(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [dateRequestFilter, setDateRequestFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  // Client-side state for hydration-safe rendering
  const [isClient, setIsClient] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  const timeSlots = generateTimeSlots();

  // Ensure client-side rendering for dates
  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setCurrentMonth(now.toLocaleDateString('en-US', { month: 'short' }));
    setCurrentYear(now.getFullYear()); // ใช้ ปี คศ
  }, []);

  // Client-safe date formatting functions
  const formatDate = (dateString: string): string => {
    if (!isClient) return dateString; // Return raw string on server
    
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok'
    }).format(date);
  };

  const getFullDate = (dateString: string): string => {
    if (!isClient) return dateString; // Return raw string on server
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok'
    }).format(date);
  };

  // Filter bookings based on current filters
  const filteredBookings = useMemo<Booking[]>(() => {
    return mockBookings.filter(booking => {
      const matchesSearch = searchTerm === '' ||
        booking.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.interpreter.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      const matchesDate = dateFilter === '' || booking.date === dateFilter;
      const matchesDateRequest = dateRequestFilter === '' || booking.requestedTime.startsWith(dateRequestFilter);
      const matchesTime = timeFilter === 'all' || booking.startTime === timeFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesDateRequest && matchesTime;
    });
  }, [searchTerm, statusFilter, dateFilter, dateRequestFilter, timeFilter]);

  // Calculate summary statistics
  const stats = useMemo<Stats>(() => {
    const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || dateFilter !== '' || dateRequestFilter !== '' || timeFilter !== 'all';
    const bookingsToAnalyze = hasActiveFilters ? filteredBookings : getCurrentMonthBookings(mockBookings);

    const wait = bookingsToAnalyze.filter(b => b.status === 'Wait').length;
    const approve = bookingsToAnalyze.filter(b => b.status === 'Approve').length;
    const cancel = bookingsToAnalyze.filter(b => b.status === 'Cancel').length;
    const total = bookingsToAnalyze.length;

    return { wait, approve, cancel, total };
  }, [filteredBookings, searchTerm, statusFilter, dateFilter, dateRequestFilter, timeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedBookings = filteredBookings.slice(startIndex, startIndex + rowsPerPage);

  const handlePageChange = (newPage: number): void => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const handleRowsPerPageChange = (value: string): void => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Approve': return 'text-emerald-700 bg-emerald-100';
      case 'Wait': return 'text-amber-700 bg-amber-100';
      case 'Cancel': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string): React.ReactElement | null => {
    switch (status) {
      case 'Approve': return <CheckCircle className="h-4 w-4" />;
      case 'Wait': return <Hourglass className="h-4 w-4" />;
      case 'Cancel': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || dateFilter !== '' || dateRequestFilter !== '' || timeFilter !== 'all';

  return (
    <div className="min-h-scree p-4 md:p-6">
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
          <span className="text-blue-700">= Conflict (Time Overlap)</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
              <Hourglass className="h-4 w-4" />
              Wait {!hasActiveFilters && isClient && `- ${currentMonth} ${currentYear}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{stats.wait}</div>
            <p className="text-sm text-amber-600 mt-1">
              {hasActiveFilters ? 'Awaiting management approval' : 'Bookings awaiting approval'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approve {!hasActiveFilters && isClient && `- ${currentMonth} ${currentYear}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{stats.approve}</div>
            <p className="text-sm text-emerald-600 mt-1">
              {hasActiveFilters ? 'Confirmed & ready to proceed' : 'Confirmed bookings'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Cancel {!hasActiveFilters && isClient && `- ${currentMonth} ${currentYear}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{stats.cancel}</div>
            <p className="text-sm text-red-600 mt-1">
              {hasActiveFilters ? 'Rejected or withdrawn bookings' : 'Cancel bookings'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-blue-800 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total {!hasActiveFilters && isClient && `- ${currentMonth} ${currentYear}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
            <p className="text-sm text-blue-600 mt-1">
              {hasActiveFilters ? 'All matching results' : 'Total bookings this month'}
            </p>
          </CardContent>
        </Card>
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Wait">Wait</SelectItem>
                  <SelectItem value="Approve">Approve</SelectItem>
                  <SelectItem value="Cancel">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Date Meeting
              </label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Date Requested
              </label>
              <Input
                type="date"
                value={dateRequestFilter}
                onChange={(e) => setDateRequestFilter(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex-1 min-w-[130px]">
              <label className="block text-base font-semibold text-gray-800 mb-2">
                Start Time
              </label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Times</SelectItem>
                  {timeSlots.map(time => (
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
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Meeting</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Interpreter</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Room</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Request</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBookings.map((booking, index) => (
                    <tr
                      key={booking.id}
                      className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="group relative">
                            <span className="font-semibold text-gray-900 text-sm cursor-help">
                              {formatDate(booking.date)}
                            </span>
                            {isClient && (
                              <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                {getFullDate(booking.date)}
                              </div>
                            )}
                          </div>
                          {booking.isDR && (
                            <div className="flex items-center gap-1">
                              <div className="group relative">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500 cursor-help" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  High Priority Meeting (DR)
                                </div>
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
                          {booking.isOverlapping && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-semibold">
                              <AlertTriangle className="h-3 w-3" />
                              Conflict
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900 text-sm">{booking.user}</span>
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
                          {formatRequestedTime(booking.requestedTime, isClient)}
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
                              <Edit className="h-4 w-4 text-gray-500" />
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
                                    <p className="mt-1 font-semibold text-base">{formatDate(selectedBooking.date)}</p>
                                    {isClient && (
                                      <p className="text-sm text-gray-500">{getFullDate(selectedBooking.date)}</p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-base font-semibold text-gray-800">Time</label>
                                    <p className="mt-1 font-mono text-base">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                                  </div>
                                  <div>
                                    <label className="block text-base font-semibold text-gray-800">User</label>
                                    <p className="mt-1 font-semibold text-base">{selectedBooking.user}</p>
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
                                  <label className="block text-base font-semibold text-gray-800">คศ Requested Time</label>
                                  <p className="mt-1 text-base text-gray-700">{selectedBooking.requestedTime}</p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {selectedBooking.isDR && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                                      <Star className="h-3.5 w-3.5 fill-current" />
                                      DR Booking
                                    </span>
                                  )}
                                  {selectedBooking.isOverlapping && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Conflicting
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
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
            <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-800">
              {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredBookings.length)} of {filteredBookings.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}