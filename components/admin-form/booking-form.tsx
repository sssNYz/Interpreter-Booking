import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, AlertTriangle, Star, CheckCircle, XCircle, Hourglass, ArrowLeft, Calendar, Clock, User, MapPin } from 'lucide-react';

// Types
import type { BookingWithConflicts, BookingMange } from '@/app/types/booking-types';

// Dialog Step Types
type DialogStep = 'details' | 'flow1_conflict' | 'flow2_waiting';

interface BookingDetailDialogProps {
  booking: BookingWithConflicts;
  allBookings?: BookingMange[];
  onActionComplete?: () => void;
}

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
const BookingDetailDialog: React.FC<BookingDetailDialogProps> = ({ 
  booking, 
  allBookings = [], 
  onActionComplete 
}) => {
  const [isClient, setIsClient] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<DialogStep>('details');
  const [conflictingApprovedBooking, setConflictingApprovedBooking] = useState<BookingMange | null>(null);
  const [waitingConflictBookings, setWaitingConflictBookings] = useState<BookingMange[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset dialog state when it opens
  const handleDialogOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setCurrentStep('details');
      setConflictingApprovedBooking(null);
      setWaitingConflictBookings([]);
      setIsProcessing(false);
    }
  };

  // FLOW 1: Check for approved booking conflicts
  const checkApprovedConflicts = (): BookingMange | null => {
    if (!allBookings.length) return null;

    const conflictingBooking = allBookings.find(other => 
      other.id !== booking.id &&
      other.status === 'Approve' &&
      other.dateTime === booking.dateTime &&
      hasTimeOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime) &&
      (booking.interpreter === other.interpreter || booking.room === other.room)
    );

    return conflictingBooking || null;
  };

  // FLOW 2: Find waiting bookings that conflict with this booking
  const findWaitingConflicts = (): BookingMange[] => {
    if (!allBookings.length) return [];

    return allBookings.filter(other =>
      other.id !== booking.id &&
      other.status === 'Wait' &&
      other.dateTime === booking.dateTime &&
      hasTimeOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime) &&
      (booking.interpreter === other.interpreter || booking.room === other.room)
    );
  };

  // Handle approve action
  const handleApprove = async () => {
    if (booking.status === 'Approve') return;

    setIsProcessing(true);

    // FLOW 1: Check for conflicts with approved bookings
    const approvedConflict = checkApprovedConflicts();
    
    if (approvedConflict) {
      setConflictingApprovedBooking(approvedConflict);
      setCurrentStep('flow1_conflict');
      setIsProcessing(false);
      return;
    }

    // No conflicts, proceed with approval
    await performApproval();
  };

  // Perform the actual approval
  const performApproval = async () => {
    setIsProcessing(true);

    try {
      // TODO: Replace with actual API call
      console.log('Approving booking:', booking.id);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // FLOW 2: Check for waiting conflicts after approval
      const waitingConflicts = findWaitingConflicts();
      
      if (waitingConflicts.length > 0) {
        setWaitingConflictBookings(waitingConflicts);
        setCurrentStep('flow2_waiting');
        setIsProcessing(false);
        return;
      }

      // No waiting conflicts, complete the process
      completeAction();
    } catch (error) {
      console.error('Error approving booking:', error);
      setIsProcessing(false);
    }
  };

  // Handle cancel action
  const handleCancel = async () => {
    if (booking.status === 'Cancel') return;

    setIsProcessing(true);

    try {
      // TODO: Replace with actual API call
      console.log('Cancelling booking:', booking.id);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      completeAction();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setIsProcessing(false);
    }
  };

  // FLOW 1: Handle approved conflict resolution
  const handleApprovedConflictConfirm = async () => {
    if (!conflictingApprovedBooking) return;

    setIsProcessing(true);

    try {
      // TODO: Replace with actual API calls
      console.log('Cancelling conflicting booking:', conflictingApprovedBooking.id);
      console.log('Approving current booking:', booking.id);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // FLOW 2: Check for waiting conflicts after approval
      const waitingConflicts = findWaitingConflicts();
      
      if (waitingConflicts.length > 0) {
        setWaitingConflictBookings(waitingConflicts);
        setCurrentStep('flow2_waiting');
        setIsProcessing(false);
        return;
      }

      // No waiting conflicts, complete the process
      completeAction();
    } catch (error) {
      console.error('Error resolving conflict:', error);
      setIsProcessing(false);
    }
  };

  // FLOW 2: Handle waiting conflicts resolution
  const handleWaitingConflictsConfirm = async () => {
    setIsProcessing(true);

    try {
      // TODO: Replace with actual API call
      console.log('Cancelling waiting conflicts:', waitingConflictBookings.map(b => b.id));
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      completeAction();
    } catch (error) {
      console.error('Error cancelling waiting bookings:', error);
      setIsProcessing(false);
    }
  };

  // Complete the action and close dialog
  const completeAction = () => {
    setIsProcessing(false);
    setIsOpen(false);
    onActionComplete?.();
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentStep === 'flow1_conflict') {
      setCurrentStep('details');
      setConflictingApprovedBooking(null);
    } else if (currentStep === 'flow2_waiting') {
      setCurrentStep('details');
      setWaitingConflictBookings([]);
    }
  };

  // Render conflict type badge
  const renderConflictType = (currentBooking: BookingWithConflicts, conflictingBooking: BookingMange) => {
    const hasInterpreterConflict = currentBooking.interpreter === conflictingBooking.interpreter;
    const hasRoomConflict = currentBooking.room === conflictingBooking.room;

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
        <AlertTriangle className="h-3 w-3" />
        {hasInterpreterConflict && 'Interpreter'}
        {hasInterpreterConflict && hasRoomConflict && ' & '}
        {hasRoomConflict && 'Room'} Conflict
      </span>
    );
  };

  // Render booking card
  const renderBookingCard = (bookingData: BookingMange | BookingWithConflicts, title: string, variant: 'current' | 'conflicting' | 'waiting' = 'current') => {
    const borderColor = variant === 'current' ? 'border-blue-200 bg-blue-50' : 
                       variant === 'conflicting' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
    
    return (
      <div className={`border rounded-lg p-4 ${borderColor}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(bookingData.status)}`}>
            {getStatusIcon(bookingData.status)}
            {bookingData.status}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span>{formatDate(bookingData.dateTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="font-mono">{bookingData.startTime} - {bookingData.endTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span>{bookingData.bookedBy}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>{bookingData.room}</span>
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-600">Interpreter: <strong>{bookingData.interpreter}</strong></span>
          {bookingData.isDR && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
              <Star className="h-3 w-3 fill-current" />
              DR
            </span>
          )}
        </div>
        
        {variant !== 'current' && (
          <div className="mt-2">
            {renderConflictType(booking, bookingData)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-blue-100"
        >
          <Edit className="h-8 w-8 text-gray-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {currentStep !== 'details' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-8 w-8 p-0"
                disabled={isProcessing}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {currentStep === 'details' && 'Booking Details'}
            {currentStep === 'flow1_conflict' && 'Resolve Booking Conflict'}
            {currentStep === 'flow2_waiting' && 'Handle Waiting Bookings'}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Booking Details */}
        {currentStep === 'details' && (
          <div className="space-y-6">
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              {booking.status !== 'Approve' && (
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isProcessing ? 'Processing...' : 'Approve Booking'}
                </Button>
              )}
              {booking.status !== 'Cancel' && (
                <Button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  variant="destructive"
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Cancel Booking'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: FLOW 1 - Approved Booking Conflict */}
        {currentStep === 'flow1_conflict' && conflictingApprovedBooking && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Booking Conflict Detected</h3>
              </div>
              <p className="text-red-700 text-sm">
                This booking conflicts with an already approved booking. To approve this booking, 
                the conflicting approved booking must be cancelled.
              </p>
            </div>

            <div className="space-y-4">
              {renderBookingCard(booking, "Current Booking (to be approved)", 'current')}
              {renderBookingCard(conflictingApprovedBooking, "Conflicting Approved Booking", 'conflicting')}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-semibold">
                Do you want to cancel the currently approved booking in order to approve this one?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleApprovedConflictConfirm}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isProcessing ? 'Processing...' : 'Yes, Cancel & Approve'}
              </Button>
              <Button
                onClick={handleBack}
                disabled={isProcessing}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: FLOW 2 - Waiting Bookings Conflict */}
        {currentStep === 'flow2_waiting' && waitingConflictBookings.length > 0 && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-800">Booking Approved Successfully</h3>
              </div>
              <p className="text-emerald-700 text-sm">
                Your booking has been approved. However, there are waiting bookings that conflict with this approved booking.
              </p>
            </div>

            <div className="space-y-4">
              {renderBookingCard(booking, "Newly Approved Booking", 'current')}
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Conflicting Waiting Bookings ({waitingConflictBookings.length})
                </h4>
                <div className="space-y-3">
                  {waitingConflictBookings.map((waitingBooking) => (
                    <div key={waitingBooking.id}>
                      {renderBookingCard(waitingBooking, `Waiting Booking #${waitingBooking.id}`, 'waiting')}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-semibold">
                Do you want to automatically cancel these waiting bookings?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleWaitingConflictsConfirm}
                disabled={isProcessing}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? 'Processing...' : 'Yes, Cancel Waiting Bookings'}
              </Button>
              <Button
                onClick={completeAction}
                disabled={isProcessing}
                variant="outline"
                className="flex-1"
              >
                Skip (Keep Waiting Bookings)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;