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
  id: number;
  name: string;
  room: string;
  status: string;
  timeStart: string;
  timeEnd: string;
};

export type SlotData = {
  bookings: Booking[]; // Changed: Now supports multiple bookings
  bgClass: string;
  textClass: string;
  icon: React.ReactNode | null;
  isPast: boolean;
  isPastTime: boolean;
  isWeekend: boolean;
  isClickable: boolean;
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
          bg: "bg-slate-50 border-green-700 border-[2px]",
          text: "text-green-800",
          icon: React.createElement(CheckCircle, { className: "w-3 h-3" }),
        };
      case "wait":
        return {
          bg: "bg-slate-50 border-yellow-700 border-[2px]",
          text: "text-yellow-700",
          icon: React.createElement(Hourglass, { className: "w-3 h-3" }),
        };
      case "cancelled":
        return {
          bg: "bg-slate-50 border-red-800 border-[2px]",
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

  // Helper function to check if time slot is in the past
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

  // Pre-process ALL slot data in useMemo - UPDATED FOR MULTIPLE BOOKINGS
  const slotDataMap: Map<string, SlotData> = useMemo(() => {
    const map = new Map<string, SlotData>();

    // Step 1: Create booking map for fast lookup - NOW SUPPORTS MULTIPLE BOOKINGS PER SLOT
    const bookingMap = new Map<string, Booking[]>();

    bookings.forEach((b) => {
      const name = `${b.ownerName} ${b.ownerSurname}`;
      const room = b.meetingRoom;
      const status = b.bookingStatus;
      const bookingId = b.bookingId;

      const startISO = b.timeStart;
      const endISO = b.timeEnd;

      const current = new Date(startISO);
      const end = new Date(endISO);

      while (current < end) {
        const dateKey = startISO.split("T")[0]; // YYYY-MM-DD
        const hours = current.getUTCHours().toString().padStart(2, "0");
        const minutes = current.getUTCMinutes().toString().padStart(2, "0");
        const timeKey = `${hours}:${minutes}`;

        const key = `${dateKey}-${timeKey}`;

        const booking: Booking = {
          id: bookingId,
          name,
          room,
          status,
          timeStart: b.timeStart,
          timeEnd: b.timeEnd,
        };

        // Add to existing array or create new array
        if (bookingMap.has(key)) {
          bookingMap.get(key)!.push(booking);
        } else {
          bookingMap.set(key, [booking]);
        }

        current.setUTCMinutes(current.getUTCMinutes() + 30);
      }
    });

    // Step 2: Pre-process each day and time slot
    daysInMonth.forEach((day) => {
      const isWeekend = ["Sat", "Sun"].includes(day.dayName);
      const isPast = day.isPast;

      timeSlots.forEach((timeSlot) => {
        const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
        const paddedDay = String(day.date).padStart(2, "0");
        const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
        const key = `${dateString}-${timeSlot}`;

        const slotBookings = bookingMap.get(key) || [];
        const isPastTime = isTimeSlotPast(day.date, timeSlot);

        // Determine styling based on bookings
        let bgClass: string;
        let textClass = "";
        let icon: React.ReactNode | null = null;

        if (isWeekend) {
          bgClass = "bg-slate-500 text-white";
        } else if (isPast || isPastTime) {
          bgClass = "bg-slate-300";
        } else if (slotBookings.length > 0) {
          // For multiple bookings, we might want to show the highest priority status
          // or create a mixed style. For now, we'll use the first booking's style
          const firstBooking = slotBookings[0];
          const statusStyle = getStatusStyle(firstBooking.status);
          bgClass = statusStyle.bg;
          textClass = statusStyle.text;
          icon = statusStyle.icon;
        } else {
          bgClass = "bg-slate-50";
        }

        const slotData: SlotData = {
          bookings: slotBookings,
          bgClass,
          textClass,
          icon,
          isPast,
          isPastTime,
          isWeekend,
          isClickable:
            !isPast && slotBookings.length === 0 && !isWeekend && !isPastTime,
        };

        map.set(key, slotData);
      });
    });

    return map;
  }, [bookings, currentDate, daysInMonth, isTimeSlotPast, timeSlots]);

  // Function for changing month
  const shiftMonth = (direction: number) => {
    setCurrentDate((current) => {
      const newDate = new Date(current);
      newDate.setMonth(current.getMonth() + direction);
      return newDate;
    });
  };

  // Handle slot click
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
  };
};
