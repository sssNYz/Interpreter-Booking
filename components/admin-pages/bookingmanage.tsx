"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {  ChevronLeft, ChevronRight, Edit, AlertTriangle, Star } from 'lucide-react';

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
  status: 'Approved' | 'Waiting' | 'Cancelled';
  isDR: boolean;
  isOverlapping: boolean;
}

interface Stats {
  waiting: number;
  approved: number;
  cancelled: number;
  total: number;
}

// Mock data for demonstration
const mockBookings: Booking[] = [
  {
    id: 1,
    date: '2024-01-15',
    startTime: '09:00',
    endTime: '09:30',
    requestedTime: '2024-01-14 14:30',
    user: 'John Smith',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Approved',
    isDR: true,
    isOverlapping: false
  },
  {
    id: 2,
    date: '2024-01-15',
    startTime: '10:00',
    endTime: '10:30',
    requestedTime: '2024-01-14 15:45',
    user: 'Sarah Johnson',
    interpreter: 'Carlos Rodriguez',
    room: 'Room B',
    status: 'Waiting',
    isDR: false,
    isOverlapping: true
  },
  {
    id: 3,
    date: '2024-01-16',
    startTime: '14:30',
    endTime: '15:00',
    requestedTime: '2024-01-15 09:15',
    user: 'Mike Wilson',
    interpreter: 'Ana Lopez',
    room: 'Room C',
    status: 'Cancelled',
    isDR: true,
    isOverlapping: false
  },
  {
    id: 4,
    date: '2024-01-16',
    startTime: '10:00',
    endTime: '10:30',
    requestedTime: '2024-01-15 11:20',
    user: 'Emma Davis',
    interpreter: 'Carlos Rodriguez',
    room: 'Room B',
    status: 'Waiting',
    isDR: false,
    isOverlapping: true
  },
  {
    id: 5,
    date: '2024-01-17',
    startTime: '11:30',
    endTime: '12:00',
    requestedTime: '2024-01-16 16:45',
    user: 'David Brown',
    interpreter: 'Maria Garcia',
    room: 'Room A',
    status: 'Approved',
    isDR: false,
    isOverlapping: false
  }
];

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

export default function BookingManagement(): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const timeSlots = generateTimeSlots();

  // Filter bookings based on current filters
  const filteredBookings = useMemo<Booking[]>(() => {
    return mockBookings.filter(booking => {
      const matchesSearch = searchTerm === '' || 
        booking.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.interpreter.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      const matchesDate = dateFilter === '' || booking.date === dateFilter;
      
      const matchesTime = timeFilter === 'all' || booking.startTime === timeFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesTime;
    });
  }, [searchTerm, statusFilter, dateFilter, timeFilter]);

  // Calculate summary statistics
  const stats = useMemo<Stats>(() => {
    const waiting = mockBookings.filter(b => b.status === 'Waiting').length;
    const approved = mockBookings.filter(b => b.status === 'Approved').length;
    const cancelled = mockBookings.filter(b => b.status === 'Cancelled').length;
    const total = mockBookings.length;
    
    return { waiting, approved, cancelled, total };
  }, []);

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
      case 'Approved': return 'text-green-600 bg-green-50';
      case 'Waiting': return 'text-yellow-600 bg-yellow-50';
      case 'Cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.waiting}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search User / Interpreter
              </label>
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Waiting">Waiting</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Start Time
              </label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
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
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-white z-10 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Meeting Time</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Requested Time</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">User</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Interpreter</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Room</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 border-r">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedBookings.map((booking) => (
                    <tr 
                      key={booking.id}
                      className={`
                        ${booking.isOverlapping ? 'bg-red-50' : ''}
                        hover:bg-gray-50
                      `}
                    >
                      <td className="px-4 py-3 font-medium border-r">
                        <div className="flex items-center gap-1">
                          {booking.isDR && <Star className="h-4 w-4 text-yellow-500" />}
                          {booking.date}
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r">
                        <div className="flex items-center gap-1">
                          {booking.isOverlapping && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          {booking.startTime} - {booking.endTime}
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r">{booking.requestedTime}</td>
                      <td className="px-4 py-3 border-r">{booking.user}</td>
                      <td className="px-4 py-3 border-r">{booking.interpreter}</td>
                      <td className="px-4 py-3 border-r">{booking.room}</td>
                      <td className="px-4 py-3 border-r">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Booking Details</DialogTitle>
                            </DialogHeader>
                            {selectedBooking && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Date</label>
                                    <p className="mt-1">{selectedBooking.date}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Time</label>
                                    <p className="mt-1">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">User</label>
                                    <p className="mt-1">{selectedBooking.user}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Interpreter</label>
                                    <p className="mt-1">{selectedBooking.interpreter}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Room</label>
                                    <p className="mt-1">{selectedBooking.room}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Status</label>
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(selectedBooking.status)}`}>
                                      {selectedBooking.status}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Requested Time</label>
                                  <p className="mt-1">{selectedBooking.requestedTime}</p>
                                </div>
                                <div className="flex gap-2">
                                  {selectedBooking.isDR && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                      <Star className="h-3 w-3" />
                                      DR Booking
                                    </span>
                                  )}
                                  {selectedBooking.isOverlapping && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                      <AlertTriangle className="h-3 w-3" />
                                      Overlapping
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
            <span className="text-sm text-gray-700">Rows per page:</span>
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
            <span className="text-sm text-gray-700">
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