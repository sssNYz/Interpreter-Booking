"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Hourglass,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Edit,
  Save,
  X as XIcon,
  ArrowLeft,
  RefreshCw,
  ArrowDown,
} from "lucide-react";
import type { BookingData } from "@/types/booking";
import { DateTimePicker } from "@/components/DateTimePicker/date-time-picker";
import { format, parse } from "date-fns";

/* ================= helpers: format ================= */
const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

// Format date/time range: if same date, show date once with time range
const fmtDateTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const startDate = start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const endDate = end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const startTime = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endTime = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (startDate === endDate) {
    // Same date: "07 Nov 2025, 11:00 – 12:30"
    return `${startDate}, ${startTime} – ${endTime}`;
  } else {
    // Different dates: "07 Nov 2025, 11:00 – 08 Nov 2025, 12:30"
    return `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
  }
};

/* ================= helpers: toast formatting ================= */
const ToastDescription: React.FC<{ lines: string[] }> = ({ lines }) => (
  <div className="space-y-1.5 mt-1">
    {lines.map((line, idx) => (
      <div key={idx} className="text-sm leading-relaxed text-black dark:text-white font-medium">
        {line}
      </div>
    ))}
  </div>
);

/* ================= helpers: UI status pill ================= */
const Status: React.FC<{ value: string }> = ({ value }) => {
  const normalized = value.toLowerCase();
  const iconClass = normalized === "approve"
    ? "text-emerald-600"
    : normalized === "waiting"
      ? "text-amber-600"
      : "text-red-600";
  const Icon = normalized === "approve" ? CheckCircle : normalized === "waiting" ? Hourglass : XCircle;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80">
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
      {label}
    </span>
  );
};

/* ================= types ================= */
interface Room {
  id: number;
  name: string;
  location: string | null;
  capacity: number;
  isActive: boolean;
}

interface UserBookingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
  onEditComplete: () => void;
}

/* ================= main component ================= */
export const UserBookingEditDialog: React.FC<UserBookingEditDialogProps> = ({
  open,
  onOpenChange,
  booking,
  onEditComplete,
}) => {
  // Responsive design
  const { isMobile, screenSize } = useMobile();
  const isTablet = screenSize === 'md' || screenSize === 'lg';

  // State management
  const [submitting, setSubmitting] = useState<null | "save" | "apply">(null);

  // Date/Time editing state - LOCAL DRAFT
  const [isEditingDateTime, setIsEditingDateTime] = useState(false);
  const [editedDate, setEditedDate] = useState<Date | undefined>(undefined);
  const [editedStartTime, setEditedStartTime] = useState<string>("");
  const [editedEndTime, setEditedEndTime] = useState<string>("");

  // Room editing state - LOCAL DRAFT
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [editedRoom, setEditedRoom] = useState<string>("");
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomAvailability, setRoomAvailability] = useState<Record<string, { available: boolean; conflicts?: any[] }>>({});

  // Participant editing state - LOCAL DRAFT
  const [isEditingParticipants, setIsEditingParticipants] = useState(false);
  const [editedParticipants, setEditedParticipants] = useState<string[]>([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState<string>("");

  // Validated changes (ready to apply) - LOCAL DRAFT
  const [validatedDateTimeChanges, setValidatedDateTimeChanges] = useState<{
    date: Date;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [validatedRoomChange, setValidatedRoomChange] = useState<string | null>(null);
  const [validatedParticipantChanges, setValidatedParticipantChanges] = useState<string[] | null>(null);

  // Check if booking status is "waiting"
  const canEdit = useMemo(() => {
    return booking?.bookingStatus?.toLowerCase() === "waiting";
  }, [booking?.bookingStatus]);

  // Initialize edit values when entering edit mode
  useEffect(() => {
    if (isEditingDateTime && booking) {
      try {
        // Parse the ISO datetime string
        const startDate = new Date(booking.timeStart);
        const endDate = new Date(booking.timeEnd);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error("Invalid date format:", { timeStart: booking.timeStart, timeEnd: booking.timeEnd });
          toast.error("Invalid Date Format", {
            description: <ToastDescription lines={["❌ Could not parse booking dates"]} />,
            duration: 3000,
          });
          setIsEditingDateTime(false);
          return;
        }

        // Use the startDate directly - just reset time to midnight for date picker
        const date = new Date(startDate);
        date.setHours(0, 0, 0, 0);

        // Extract times in HH:mm format using getHours/getMinutes
        const startTime = String(startDate.getHours()).padStart(2, '0') + ':' + String(startDate.getMinutes()).padStart(2, '0');
        const endTime = String(endDate.getHours()).padStart(2, '0') + ':' + String(endDate.getMinutes()).padStart(2, '0');

        console.log("Initializing date/time edit:", {
          date: date.toISOString(),
          startTime,
          endTime,
          isValidDate: !isNaN(date.getTime())
        });

        setEditedDate(date);
        setEditedStartTime(startTime);
        setEditedEndTime(endTime);
      } catch (e) {
        console.error("Error parsing date:", e);
        toast.error("Error", {
          description: <ToastDescription lines={["❌ Failed to initialize date/time editor"]} />,
          duration: 3000,
        });
        setIsEditingDateTime(false);
      }
    }
  }, [isEditingDateTime, booking]);

  // Initialize room when entering edit mode
  useEffect(() => {
    if (isEditingRoom && booking) {
      setEditedRoom(booking.meetingRoom);
    }
  }, [isEditingRoom, booking]);

  // Initialize participants when entering edit mode
  useEffect(() => {
    if (isEditingParticipants && booking) {
      // Create a copy to avoid mutating the original array
      setEditedParticipants([...(booking.inviteEmails || [])]);
    }
  }, [isEditingParticipants, booking]);

  // Reset ALL draft state when dialog closes or booking changes
  useEffect(() => {
    if (!open) {
      setIsEditingDateTime(false);
      setEditedDate(undefined);
      setEditedStartTime("");
      setEditedEndTime("");
      setValidatedDateTimeChanges(null);

      setIsEditingRoom(false);
      setEditedRoom("");
      setValidatedRoomChange(null);

      setIsEditingParticipants(false);
      setEditedParticipants([]);
      setNewParticipantEmail("");
      setValidatedParticipantChanges(null);
    }
  }, [open]);

  // Clear draft state when booking changes
  useEffect(() => {
    setIsEditingDateTime(false);
    setEditedDate(undefined);
    setEditedStartTime("");
    setEditedEndTime("");
    setValidatedDateTimeChanges(null);

    setIsEditingRoom(false);
    setEditedRoom("");
    setValidatedRoomChange(null);

    setIsEditingParticipants(false);
    setEditedParticipants([]);
    setNewParticipantEmail("");
    setValidatedParticipantChanges(null);
  }, [booking?.bookingId]);

  // Fetch available rooms when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchRooms = async () => {
      setRoomsLoading(true);
      try {
        const res = await fetch('/api/admin/add-room?isActive=true');
        const data = await res.json();
        if (data.success && data.data?.rooms) {
          setAvailableRooms(data.data.rooms);
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
        toast.error("Failed to Load Rooms", {
          description: <ToastDescription lines={["❌ Could not load available rooms"]} />,
          duration: 3000,
        });
      } finally {
        setRoomsLoading(false);
      }
    };

    fetchRooms();
  }, [open]);

  // Check if booking status is not "waiting"
  useEffect(() => {
    if (open && !canEdit) {
      toast.error("Cannot Edit Booking", {
        description: <ToastDescription lines={["❌ Only bookings with 'Waiting' status can be edited"]} />,
        duration: 5000,
      });
      onOpenChange(false);
    }
  }, [open, canEdit, onOpenChange]);

  // Validation function for date/time
  const validateDateTime = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!editedDate) {
      errors.push("Please select a date");
      return { valid: false, errors };
    }

    if (!editedStartTime) {
      errors.push("Please select a start time");
      return { valid: false, errors };
    }

    if (!editedEndTime) {
      errors.push("Please select an end time");
      return { valid: false, errors };
    }

    // Validate end time > start time
    const [startHour, startMin] = editedStartTime.split(':').map(Number);
    const [endHour, endMin] = editedEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      errors.push("End time must be after start time");
      return { valid: false, errors };
    }

    // Validate not in the past
    const now = new Date();
    const selectedDateTime = new Date(editedDate);
    selectedDateTime.setHours(startHour, startMin, 0, 0);

    if (selectedDateTime < now) {
      errors.push("Cannot select a time in the past");
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  };

  // Save date/time handler with validation
  const handleSaveDateTime = async () => {
    if (!booking) return;

    // Client-side validation
    const validation = validateDateTime();

    if (!validation.valid) {
      toast.error("Validation Failed", {
        description: <ToastDescription lines={validation.errors.map(e => `❌ ${e}`)} />,
        duration: 5000,
      });
      return;
    }

    setSubmitting("save");

    try {
      // Check room availability
      const dateStr = format(editedDate!, "yyyy-MM-dd");
      const params = new URLSearchParams({
        date: dateStr,
        room: booking.meetingRoom,
        startTime: editedStartTime,
        endTime: editedEndTime,
        excludeBookingId: booking.bookingId.toString(),
      });

      const res = await fetch(`/api/booking-data/check-room-availability?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to check availability");
      }

      if (!data.available || (data.conflicts && data.conflicts.length > 0)) {
        const conflictDetails = data.conflicts
          ?.map((c: any) => `  • Booking #${c.bookingId}: ${c.timeStart} - ${c.timeEnd}`)
          .join('\n') || '';

        toast.error("Room Not Available", {
          description: <ToastDescription lines={[
            "❌ Room is already booked during this time",
            conflictDetails,
            "Please select a different time"
          ]} />,
          duration: 5000,
        });
        return;
      }

      // TWO-WAY VALIDATION: If room was already changed, validate the new time against the new room
      if (validatedRoomChange) {
        const roomCheckParams = new URLSearchParams({
          date: dateStr,
          room: validatedRoomChange,
          startTime: editedStartTime,
          endTime: editedEndTime,
          excludeBookingId: booking.bookingId.toString(),
        });

        const roomCheckRes = await fetch(`/api/booking-data/check-room-availability?${roomCheckParams.toString()}`, {
          cache: 'no-store',
        });

        const roomCheckData = await roomCheckRes.json();

        if (!roomCheckData.available || (roomCheckData.conflicts && roomCheckData.conflicts.length > 0)) {
          const conflictDetails = roomCheckData.conflicts
            ?.map((c: any) => `  • Booking #${c.bookingId}`)
            .join('\n') || '';

          toast.error("Time Conflicts with Selected Room", {
            description: <ToastDescription lines={[
              "❌ The selected time conflicts with an existing booking in this room",
              conflictDetails,
              "Please select a different time or change the room"
            ]} />,
            duration: 5000,
          });
          return;
        }
      }

      // Validation successful - store validated changes
      setValidatedDateTimeChanges({
        date: editedDate!,
        startTime: editedStartTime,
        endTime: editedEndTime,
      });

      // Exit edit mode
      setIsEditingDateTime(false);

      toast.success("Validation Successful", {
        description: <ToastDescription lines={[
          "✅ Date and time are available",
          validatedRoomChange ? "✅ Compatible with selected room" : "",
          "Click 'Apply Changes' to save"
        ].filter(Boolean)} />,
        duration: 3000,
      });

    } catch (error) {
      console.error("Error validating date/time:", error);
      toast.error("Validation Failed", {
        description: <ToastDescription lines={[
          "❌ " + (error as Error).message
        ]} />,
        duration: 5000,
      });
    } finally {
      setSubmitting(null);
    }
  };

  // Fetch available rooms when room editing starts
  useEffect(() => {
    const fetchRooms = async () => {
      if (!isEditingRoom || !open) return;

      try {
        setRoomsLoading(true);
        const res = await fetch('/api/admin/add-room?isActive=true&pageSize=100', {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch rooms (${res.status})`);
        }

        const data = await res.json();
        if (data.success && data.data?.rooms) {
          setAvailableRooms(data.data.rooms);
        } else {
          throw new Error('Failed to load rooms');
        }
      } catch (e) {
        toast.error("Failed to Load Rooms", {
          description: <ToastDescription lines={["❌ " + (e as Error).message]} />,
          duration: 5000,
        });
        setIsEditingRoom(false);
      } finally {
        setRoomsLoading(false);
      }
    };

    void fetchRooms();
  }, [isEditingRoom, open]);

  // Check room availability when rooms are loaded
  useEffect(() => {
    const checkRoomAvailability = async () => {
      if (!isEditingRoom || !booking || availableRooms.length === 0) return;

      // Use validated date/time if available, otherwise use current booking date/time
      const dateStr = validatedDateTimeChanges
        ? format(validatedDateTimeChanges.date, "yyyy-MM-dd")
        : booking.timeStart.split('T')[0];
      const startTime = validatedDateTimeChanges
        ? validatedDateTimeChanges.startTime
        : booking.timeStart.split('T')[1]?.substring(0, 5) || "";
      const endTime = validatedDateTimeChanges
        ? validatedDateTimeChanges.endTime
        : booking.timeEnd.split('T')[1]?.substring(0, 5) || "";

      const availability: Record<string, { available: boolean; conflicts?: any[] }> = {};

      for (const room of availableRooms) {
        try {
          const params = new URLSearchParams({
            date: dateStr,
            room: room.name,
            startTime,
            endTime,
            excludeBookingId: booking.bookingId.toString(),
          });

          const res = await fetch(`/api/booking-data/check-room-availability?${params}`, {
            cache: 'no-store',
          });

          if (res.ok) {
            const data = await res.json();
            availability[room.name] = {
              available: data.available && (!data.conflicts || data.conflicts.length === 0),
              conflicts: data.conflicts || [],
            };
          } else {
            availability[room.name] = { available: false };
          }
        } catch (e) {
          availability[room.name] = { available: false };
        }
      }

      setRoomAvailability(availability);
    };

    void checkRoomAvailability();
  }, [isEditingRoom, booking, availableRooms, validatedDateTimeChanges]);

  const handleSaveRoom = async () => {
    if (!booking || !editedRoom) {
      toast.error("Validation Failed", {
        description: <ToastDescription lines={["Please select a room"]} />,
        duration: 4000,
      });
      return;
    }

    try {
      setSubmitting("save");

      // Check if room is unchanged
      if (editedRoom === booking.meetingRoom) {
        setIsEditingRoom(false);
        setSubmitting(null);
        return;
      }

      // TWO-WAY VALIDATION: Perform explicit availability check
      // Use validated date/time if available, otherwise use current booking date/time
      const dateStr = validatedDateTimeChanges
        ? format(validatedDateTimeChanges.date, "yyyy-MM-dd")
        : booking.timeStart.split('T')[0];
      const startTime = validatedDateTimeChanges
        ? validatedDateTimeChanges.startTime
        : booking.timeStart.split('T')[1]?.substring(0, 5) || "";
      const endTime = validatedDateTimeChanges
        ? validatedDateTimeChanges.endTime
        : booking.timeEnd.split('T')[1]?.substring(0, 5) || "";

      const params = new URLSearchParams({
        date: dateStr,
        room: editedRoom,
        startTime,
        endTime,
        excludeBookingId: booking.bookingId.toString(),
      });

      const res = await fetch(`/api/booking-data/check-room-availability?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!data.available || (data.conflicts && data.conflicts.length > 0)) {
        const conflicts = data.conflicts?.map((c: any) => `• Booking #${c.bookingId}`) || [];
        const lines = conflicts.length > 0
          ? ["❌ This room is not available for the selected time", ...conflicts, "Please select a different room"]
          : ["❌ This room is not available for the selected time", "Please select a different room"];

        toast.error("Room Not Available", {
          description: <ToastDescription lines={lines} />,
          duration: 5000,
        });
        setSubmitting(null);
        return;
      }

      // Validation successful - store validated room change
      setValidatedRoomChange(editedRoom);
      setIsEditingRoom(false);

      toast.success("Room Change Validated", {
        description: <ToastDescription lines={[
          "✓ Room is available",
          validatedDateTimeChanges ? "✓ Compatible with selected time" : "",
          "Click 'Apply Changes' to save"
        ].filter(Boolean)} />,
        duration: 4000,
      });

    } catch (e) {
      toast.error("Validation Failed", {
        description: <ToastDescription lines={["❌ " + (e as Error).message]} />,
        duration: 5000,
      });
    } finally {
      setSubmitting(null);
    }
  };

  // Email validation function (reuse existing pattern)
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddParticipant = () => {
    const email = newParticipantEmail.trim();

    if (!email) {
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      toast.error("Invalid Email", {
        description: <ToastDescription lines={["❌ Please enter a valid email address"]} />,
        duration: 3000,
      });
      return;
    }

    // Check for duplicates
    if (editedParticipants.includes(email)) {
      toast.error("Duplicate Email", {
        description: <ToastDescription lines={["❌ This participant is already added"]} />,
        duration: 3000,
      });
      return;
    }

    // Add to list
    setEditedParticipants(prev => [...prev, email]);
    setNewParticipantEmail("");

    toast.success("Participant Added", {
      description: <ToastDescription lines={["✓ " + email]} />,
      duration: 2000,
    });
  };

  const handleSaveParticipants = async () => {
    if (!booking) return;

    try {
      setSubmitting("save");

      // Check if participants are unchanged (create copies before sorting to avoid mutation)
      const originalEmails = [...(booking.inviteEmails || [])].sort().join(',');
      const editedEmails = [...editedParticipants].sort().join(',');

      if (originalEmails === editedEmails) {
        setIsEditingParticipants(false);
        setSubmitting(null);
        return;
      }

      // Validation successful - store validated participant changes (create a copy)
      setValidatedParticipantChanges([...editedParticipants]);
      setIsEditingParticipants(false);

      toast.success("Participant Changes Validated", {
        description: <ToastDescription lines={[
          "✓ Participants updated",
          "Click 'Apply Changes' to save"
        ]} />,
        duration: 4000,
      });

    } catch (e) {
      toast.error("Validation Failed", {
        description: <ToastDescription lines={["❌ " + (e as Error).message]} />,
        duration: 5000,
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleApply = async () => {
    if (!booking) return;

    try {
      setSubmitting("apply");

      // Apply date/time changes if validated
      if (validatedDateTimeChanges) {
        const dateStr = format(validatedDateTimeChanges.date, "yyyy-MM-dd");
        const timeStartStr = `${dateStr}T${validatedDateTimeChanges.startTime}:00`;
        const timeEndStr = `${dateStr}T${validatedDateTimeChanges.endTime}:00`;

        const res = await fetch(`/api/booking-data/patch-booking-datetime/${booking.bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeStart: timeStartStr,
            timeEnd: timeEndStr,
          }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => null);
          if (res.status === 409) {
            throw new Error("Time slot was taken by another booking. Please select a different time.");
          }
          throw new Error(j?.message || `Update failed (${res.status})`);
        }
      }

      // Apply room and/or participant changes if validated
      if (validatedRoomChange || validatedParticipantChanges) {
        const body: any = {};
        if (validatedRoomChange) {
          body.room = validatedRoomChange;
        }
        if (validatedParticipantChanges) {
          body.inviteEmails = validatedParticipantChanges;
        }

        const res = await fetch(`/api/booking-data/patch-booking-by-id/${booking.bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.message || j?.title || `Update failed (${res.status})`);
        }
      }

      // Success!
      toast.success("Booking Updated Successfully", {
        description: <ToastDescription lines={[
          "✅ Your changes have been saved",
          "Booking status: Waiting"
        ]} />,
        duration: 3000,
      });

      // Close dialog and refresh
      onOpenChange(false);
      setTimeout(() => onEditComplete(), 150);

    } catch (error) {
      console.error("Error applying changes:", error);
      toast.error("Failed to Apply Changes", {
        description: <ToastDescription lines={[
          "❌ " + (error as Error).message
        ]} />,
        duration: 5000,
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit Booking #{booking.bookingId}</span>
            <Status value={booking.bookingStatus} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date & Time Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Date & Time</span>
              </div>
              {!isEditingDateTime && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingDateTime(true)}
                  className="gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {!isEditingDateTime ? (
              <>
                <div className="text-sm">
                  <div>{fmtDateTimeRange(booking.timeStart, booking.timeEnd)}</div>
                </div>

                {/* Show preview of validated date/time changes */}
                {validatedDateTimeChanges && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">New date/time (pending):</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setValidatedDateTimeChanges(null);
                          setEditedDate(undefined);
                          setEditedStartTime("");
                          setEditedEndTime("");
                        }}
                        title="Cancel date/time change"
                      >
                        <XIcon className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    <div className="text-sm font-bold text-primary">
                      {format(validatedDateTimeChanges.date, "dd MMM yyyy")}, {validatedDateTimeChanges.startTime} – {validatedDateTimeChanges.endTime}
                    </div>
                    <div className="text-xs text-primary/80 mt-1">
                      Click "Apply Changes" button to save
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                {editedDate && editedStartTime && editedEndTime ? (
                  <DateTimePicker
                    selectedDate={editedDate}
                    selectedStartTime={editedStartTime}
                    selectedEndTime={editedEndTime}
                    selectedRoom={booking.meetingRoom}
                    bookingId={booking.bookingId}
                    onDateChange={setEditedDate}
                    onStartTimeChange={setEditedStartTime}
                    onEndTimeChange={setEditedEndTime}
                    disabled={submitting === "save"}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading date/time...
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveDateTime}
                    disabled={submitting === "save"}
                  >
                    <Save className="h-3.5 w-3.5 mr-2" />
                    {submitting === "save" ? "Validating..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingDateTime(false);
                      // Reset to original values
                      if (booking) {
                        const dateStr = booking.timeStart.split('T')[0];
                        const date = parse(dateStr, "yyyy-MM-dd", new Date());
                        const startTime = booking.timeStart.split('T')[1]?.substring(0, 5) || "";
                        const endTime = booking.timeEnd.split('T')[1]?.substring(0, 5) || "";
                        setEditedDate(date);
                        setEditedStartTime(startTime);
                        setEditedEndTime(endTime);
                      }
                    }}
                  >
                    <XIcon className="h-3.5 w-3.5 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Room Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Meeting Room</span>
              </div>
              {!isEditingRoom && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingRoom(true)}
                  className="gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>

            {!isEditingRoom ? (
              <>
                <div className="text-sm">
                  {booking.meetingRoom || "No room assigned"}
                </div>

                {/* Show preview of validated room change */}
                {validatedRoomChange && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">New room (pending):</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setValidatedRoomChange(null);
                          setEditedRoom("");
                        }}
                        title="Cancel room change"
                      >
                        <XIcon className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    <div className="text-sm font-bold text-primary">
                      {validatedRoomChange}
                    </div>
                    <div className="text-xs text-primary/80 mt-1">
                      Click "Apply Changes" button to save
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Room
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setIsEditingRoom(false);
                        setEditedRoom(booking.meetingRoom);
                      }}
                      disabled={submitting === "save"}
                    >
                      <XIcon className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleSaveRoom}
                      disabled={submitting === "save" || !editedRoom || roomsLoading}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {submitting === "save" ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                {roomsLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading rooms...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Current Room Display */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Current:</span>
                        <span className="text-sm font-medium text-foreground">{booking.meetingRoom}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select New Room</label>
                      <Select
                        value={editedRoom}
                        onValueChange={setEditedRoom}
                        disabled={submitting === "save"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a room" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {availableRooms.map((room) => {
                            const availability = roomAvailability[room.name];
                            const isAvailable = availability?.available !== false;
                            const conflicts = availability?.conflicts || [];

                            return (
                              <SelectItem
                                key={room.id}
                                value={room.name}
                                disabled={!isAvailable}
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3" />
                                    <span>{room.name}</span>
                                    {room.location && (
                                      <span className="text-xs text-muted-foreground">({room.location})</span>
                                    )}
                                  </div>
                                  {!isAvailable && (
                                    <span className="text-xs text-destructive">
                                      (Booked{conflicts.length > 0 ? ` #${conflicts[0].bookingId}` : ''})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground">
                        ℹ️ Only available rooms for the selected time are shown
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Participants Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Participants</span>
              </div>
              {!isEditingParticipants && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingParticipants(true)}
                  className="gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>

            {!isEditingParticipants ? (
              <>
                <div className="text-sm">
                  {booking.inviteEmails && booking.inviteEmails.length > 0 ? (
                    <ul className="space-y-1">
                      {booking.inviteEmails.map((email, idx) => (
                        <li key={idx}>• {email}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No participants</span>
                  )}
                </div>

                {/* Show preview of validated participant changes */}
                {validatedParticipantChanges && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">New participants (pending):</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setValidatedParticipantChanges(null);
                          // Create a copy to avoid mutating the original array
                          setEditedParticipants([...(booking.inviteEmails || [])]);
                        }}
                        title="Cancel participant changes"
                      >
                        <XIcon className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    {validatedParticipantChanges.length > 0 ? (
                      <ul className="space-y-1 text-sm font-medium text-primary">
                        {validatedParticipantChanges.map((email, idx) => (
                          <li key={idx}>• {email}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm font-medium text-primary">No participants</div>
                    )}
                    <div className="text-xs text-primary/80 mt-1">
                      Click "Apply Changes" button to save
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Participants
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setIsEditingParticipants(false);
                        // Create a copy to avoid mutating the original array
                        setEditedParticipants([...(booking.inviteEmails || [])]);
                        setNewParticipantEmail("");
                      }}
                      disabled={submitting === "save"}
                    >
                      <XIcon className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleSaveParticipants}
                      disabled={submitting === "save"}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {submitting === "save" ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Current Participants List */}
                  {editedParticipants.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Participants</label>
                      <div className="space-y-1">
                        {editedParticipants.map((email, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <span className="text-sm">{email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditedParticipants(prev => prev.filter((_, i) => i !== idx));
                              }}
                              title="Remove participant"
                            >
                              <XIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Participant */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Add Participant</label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={newParticipantEmail}
                        onChange={(e) => setNewParticipantEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddParticipant();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddParticipant}
                        disabled={!newParticipantEmail.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Press Enter or click Add to include this participant
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Change Preview Section - shown when validated changes exist */}
          {(validatedDateTimeChanges || validatedRoomChange || validatedParticipantChanges) && (
            <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Changes Ready to Apply</span>
              </div>
              <div className="text-sm space-y-2">
                {/* Change preview will be implemented in Task 6 */}
                <div className="text-muted-foreground">
                  Preview of changes will be displayed here...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {(validatedDateTimeChanges || validatedRoomChange || validatedParticipantChanges) ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setValidatedDateTimeChanges(null);
                  setValidatedRoomChange(null);
                  setValidatedParticipantChanges(null);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Back to Edit
              </Button>
              <Button
                variant="default"
                onClick={handleApply}
                disabled={submitting === "apply"}
              >
                {submitting === "apply" ? "Applying..." : "Apply Changes"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleCancel}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserBookingEditDialog;
