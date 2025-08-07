"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Hourglass } from "lucide-react";
import React from "react";

export type BookingData = {
  bookingId: number;
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: string;
  meetingRoom: string;
  meetingDetail: string;
  highPriority: boolean;
  timeStart: string;
  timeEnd: string;
  interpreterId: number | null;
  bookingStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  layerIndex: number;
  id: number;
  name: string;
  room: string;
  status: string;
  timeStart: string;
  timeEnd: string;
  // NEW: Properties for timeline rendering
  startSlotIndex: number; // Which time slot this booking starts in
  endSlotIndex: number; // Which time slot this booking ends in
  totalDuration: number; // Total slots this booking spans
};

export type BookingWithLayer = Booking & {
  layerIndex: number;
};

// UPDATED: SlotData now handles multiple overlapping bookings with timeline functionality
export type SlotData = {
  bookings: Booking[]; // Array of ALL bookings that occupy this 30-min slot
  bgClass: string;
  textClass: string;
  icon: React.ReactNode | null;
  isPast: boolean;
  isPastTime: boolean;
  isWeekend: boolean;
  isClickable: boolean; // UPDATED: Now remains true even with bookings (except weekends/past)
};

export type DayInfo = {
  date: number;
  dayName: string;
  fullDate: Date;
  isPast: boolean;
};

export const useCalendarLogic = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<
    { day: number; slot: string } | undefined
  >(undefined);
  const [bookings, setBookings] = useState<BookingData[]>([]);

  // Fetch bookings when currentDate changes
  useEffect(() => {
    const fetchBookings = async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      try {
        const response = await fetch(
          `/api/booking-data/get-booking-byDate/${year}/${month}`
        );
        const data = await response.json();
        setBookings(data);
      } catch (err) {
        console.error("Failed to fetch", err);
      }
    };

    fetchBookings();
  }, [currentDate]);

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      if (hour === 12) {
        slots.push(`${hour}:00`, `${hour}:20`);
        continue;
      }
      if (hour === 13) {
        slots.push(`${hour}:10`, `${hour}:30`);
        continue;
      }
      if (hour === 17) {
        slots.push(`${hour}:00`);
        continue;
      }
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get days in current month
  const getDaysInMonth = (date: Date): DayInfo[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: lastDay }, (_, i) => {
      const day = new Date(year, month, i + 1);
      return {
        date: i + 1,
        dayName: day.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: day,
        isPast: day.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0),
      };
    });
  };

  const daysInMonth = getDaysInMonth(currentDate);

  // Helper function to get status styles
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-green-100 border-green-500",
          text: "text-green-800",
          icon: React.createElement(CheckCircle, { className: "w-3 h-3" }),
        };
      case "wait":
        return {
          bg: "bg-yellow-100 border-yellow-500",
          text: "text-yellow-700",
          icon: React.createElement(Hourglass, { className: "w-3 h-3" }),
        };
      case "cancelled":
        return {
          bg: "bg-red-100 border-red-500",
          text: "text-red-800",
          icon: React.createElement(XCircle, { className: "w-3 h-3" }),
        };
      default:
        return {
          bg: "bg-gray-100 border-gray-300",
          text: "text-gray-800",
          icon: null,
        };
    }
  };

  // Helper function to find slot index for a given time
  const findSlotIndex = useCallback(
    (time: string): number => {
      const timeKey = time.substring(11, 16); // Extract HH:MM from ISO string
      return timeSlots.findIndex((slot) => slot === timeKey);
    },
    [timeSlots]
  );

  // Helper function to check if two bookings overlap in time
  const isTimeOverlapping = (booking1: Booking, booking2: Booking): boolean => {
    const start1 = new Date(booking1.timeStart).getTime();
    const end1 = new Date(booking1.timeEnd).getTime();
    const start2 = new Date(booking2.timeStart).getTime();
    const end2 = new Date(booking2.timeEnd).getTime();

    return start1 < end2 && start2 < end1;
  };

  // Assign vertical layers to overlapping bookings using greedy algorithm
  const assignLayersToBookings = (bookings: Booking[]): BookingWithLayer[] => {
  if (bookings.length === 0) return [];

  const layers: BookingWithLayer[][] = [];
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(a.timeStart).getTime() - new Date(b.timeStart).getTime()
  );

  for (const booking of sortedBookings) {
    let placed = false;

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const hasOverlap = layer.some((existingBooking) => {
        const aStart = new Date(existingBooking.timeStart).getTime();
        const aEnd = new Date(existingBooking.timeEnd).getTime();
        const bStart = new Date(booking.timeStart).getTime();
        const bEnd = new Date(booking.timeEnd).getTime();

        return aStart < bEnd && bStart < aEnd;
      });

      if (!hasOverlap) {
        const bookingWithLayer: BookingWithLayer = { ...booking, layerIndex };
        layer.push(bookingWithLayer);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const bookingWithLayer: BookingWithLayer = {
        ...booking,
        layerIndex: layers.length,
      };
      layers.push([bookingWithLayer]);
    }
  }

  return layers.flat();
};


  // Group bookings by room and assign layers within each room
  const assignLayersByRoom = (
    bookings: Booking[]
  ): { bookingsWithLayers: BookingWithLayer[]; maxLayers: number } => {
    const roomGroups = new Map<string, Booking[]>();

    // Group bookings by room
    bookings.forEach((booking) => {
      const room = booking.room;
      if (!roomGroups.has(room)) {
        roomGroups.set(room, []);
      }
      roomGroups.get(room)!.push(booking);
    });

    let maxLayers = 0;
    const allBookingsWithLayers: BookingWithLayer[] = [];

    // Process each room group separately
    roomGroups.forEach((roomBookings) => {
      const roomBookingsWithLayers = assignLayersToBookings(roomBookings);
      const roomMaxLayer =
        Math.max(...roomBookingsWithLayers.map((b) => b.layerIndex), -1) + 1;
      maxLayers = Math.max(maxLayers, roomMaxLayer);
      allBookingsWithLayers.push(...roomBookingsWithLayers);
    });

    return { bookingsWithLayers: allBookingsWithLayers, maxLayers };
  };
  const isTimeSlotPast = useCallback(
    (day: number, timeSlot: string) => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const [slotHour, slotMinute] = timeSlot.split(":").map(Number);

      const isToday =
        day === now.getDate() &&
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getFullYear() === now.getFullYear();

      if (!isToday) return false;

      let slotEndHour = slotHour;
      let slotEndMinute = slotMinute + 30;

      if (slotEndMinute >= 60) {
        slotEndHour += 1;
        slotEndMinute -= 60;
      }

      if (currentHour > slotEndHour) return true;
      if (currentHour === slotEndHour && currentMinute >= slotEndMinute)
        return true;

      return false;
    },
    [currentDate]
  );
  const normalizeTimeToSlot = (time: string): string => {
  const date = new Date(time);
  let h = date.getHours();
  let m = date.getMinutes();

  if (m >= 45) {
    h++;
    m = 0;
  } else if (m >= 15) {
    m = 30;
  } else {
    m = 0;
  }

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};


  // UPDATED: Process bookings for timeline view with improved clickability
  const slotDataMap: Map<string, SlotData> = useMemo(() => {
    const map = new Map<string, SlotData>();

    // Step 1: Process each booking to create enhanced booking objects
    const processedBookings: Booking[] = bookings.map((b) => {
      const name = `${b.ownerName} ${b.ownerSurname}`;
      const startSlotIndex = findSlotIndex(b.timeStart);
      const endSlotIndex = findSlotIndex(b.timeEnd);
      const totalDuration = endSlotIndex - startSlotIndex + 1;

      return {
        id: b.bookingId,
        name,
        room: b.meetingRoom,
        status: b.bookingStatus,
        timeStart: b.timeStart,
        timeEnd: b.timeEnd,
        startSlotIndex,
        endSlotIndex,
        totalDuration: Math.max(1, totalDuration),
        layerIndex: 0, // ✅ Temporary value; will be overwritten later
      };
    });

    // Step 2: Initialize all slots for all days
    daysInMonth.forEach((day) => {
      const isWeekend = ["Sat", "Sun"].includes(day.dayName);
      const isPast = day.isPast;

      timeSlots.forEach((timeSlot) => {
        const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
        const paddedDay = String(day.date).padStart(2, "0");
        const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
        const key = `${dateString}-${timeSlot}`;

        const isPastTime = isTimeSlotPast(day.date, timeSlot);

        // Initialize empty slot - UPDATED: Keep clickable even with bookings
        const slotData: SlotData = {
          bookings: [],
          bgClass: isWeekend
            ? "bg-slate-500 text-white"
            : isPast || isPastTime
            ? "bg-slate-300"
            : "bg-slate-50",
          textClass: "",
          icon: null,
          isPast,
          isPastTime,
          isWeekend,
          isClickable: !isPast && !isWeekend && !isPastTime, // UPDATED: Don't disable for bookings
        };

        map.set(key, slotData);
      });
    });

    // Step 3: Add bookings to their respective slots
    processedBookings.forEach((booking) => {
      const bookingDate = booking.timeStart.split("T")[0]; // YYYY-MM-DD
      const startTime = booking.timeStart.substring(11, 16); // HH:MM
      const endTime = booking.timeEnd.substring(11, 16); // HH:MM

      // Find all time slots this booking occupies
      const startIndex = timeSlots.findIndex((slot) => slot === startTime);
      const endIndex = timeSlots.findIndex((slot) => slot === endTime);

      if (startIndex === -1 || endIndex === -1) return;

      // Add this booking to all slots it occupies
      for (let i = startIndex; i < endIndex; i++) {
        const slot = timeSlots[i];
        const key = `${bookingDate}-${slot}`;
        const slotData = map.get(key);

        if (slotData) {
          // Add booking to this slot
          slotData.bookings.push(booking);

          // UPDATED: Keep clickable state - only disabled for past/weekend
          // slotData.isClickable remains as initialized (based on time/weekend only)

          // Set visual properties based on FIRST booking for consistency
          if (slotData.bookings.length >= 1 && !slotData.isWeekend) {
            const firstBooking = slotData.bookings[0];
            const statusStyle = getStatusStyle(firstBooking.status);
            slotData.bgClass = statusStyle.bg;
            slotData.textClass = statusStyle.text;
            slotData.icon = statusStyle.icon;
          }
        }
      }
    });

    return map;
  }, [
    bookings,
    currentDate,
    daysInMonth,
    timeSlots,
    isTimeSlotPast,
    findSlotIndex,
  ]);

  // Function for changing month
  const shiftMonth = (direction: number) => {
    setCurrentDate((current) => {
      const newDate = new Date(current);
      newDate.setMonth(current.getMonth() + direction);
      return newDate;
    });
  };

  // Handle slot click - UPDATED: Allow clicking even with bookings
  const handleSlotClick = (day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  };

  return {
    // State
    currentDate,
    isFormOpen,
    selectedSlot,
    bookings,

    // Computed values
    timeSlots,
    daysInMonth,
    slotDataMap,

    // Functions
    shiftMonth,
    handleSlotClick,
    setIsFormOpen,

    // Helper functions (exposed for potential reuse)
    isTimeSlotPast,
    getStatusStyle,
    findSlotIndex,
    assignLayersByRoom,
  };
};
