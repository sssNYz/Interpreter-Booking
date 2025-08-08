import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, AlertTriangle, Star, CheckCircle, XCircle, Hourglass } from 'lucide-react';

// Types
import type { BookingWithConflicts } from '@/app/types/booking-types';

// Utility functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
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

// BookingDetailDialog Component
interface BookingDetailDialogProps {
  booking: BookingWithConflicts;
}

const BookingDetailDialog: React.FC<BookingDetailDialogProps> = ({ booking }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-blue-100"
        >
          <Edit className="h-8 w-8 text-gray-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Booking Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-800">Date Meeting</label>
              <p className="mt-1 font-semibold text-base">{formatDate(booking.dateTime)}</p>
              {isClient && (
                <p className="text-sm text-gray-500">{getFullDate(booking.dateTime, isClient)}</p>
              )}
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800">Time</label>
              <p className="mt-1 font-mono text-base">{booking.startTime} - {booking.endTime}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800">User</label>
              <p className="mt-1 font-semibold text-base">{booking.bookedBy}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800">Interpreter</label>
              <p className="mt-1 text-base">{booking.interpreter}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800">Room</label>
              <p className="mt-1 text-base">{booking.room}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800">Status</label>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mt-1 ${getStatusColor(booking.status)}`}>
                {getStatusIcon(booking.status)}
                {booking.status}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800">Requested Time</label>
            <p className="mt-1 text-base text-gray-700">{formatRequestedTime(booking.requestedTime)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {booking.isDR && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                <Star className="h-3.5 w-3.5 fill-current" />
                DR Booking
              </span>
            )}
            {(booking.conflicts.hasInterpreterConflict || booking.conflicts.hasRoomConflict) && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {booking.conflicts.hasInterpreterConflict && 'Interpreter'}
                {booking.conflicts.hasInterpreterConflict && booking.conflicts.hasRoomConflict && ' & '}
                {booking.conflicts.hasRoomConflict && 'Room'} Conflict
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;