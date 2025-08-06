"use client";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Hourglass,
  User,
  MapPin,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { BookingForm } from "../booking-form/booking-form";

type Booking = {
  id: number;
  name: string;
  room: string;
  status: string;
  timeStart: string;
  timeEnd: string;
};

type BookingData = {
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

// ✅ New optimized slot data structure
type SlotData = {
  bookingId: number | null;
  name: string | null;
  room: string | null;
  status: string | null;
  bgClass: string;
  textClass: string;
  icon: React.ReactNode | null;
  span: number;
  shouldDisplay: boolean;
  isPast: boolean;
  isPastTime: boolean;
  isWeekend: boolean;
  isClickable: boolean;
};

const BookingCalendar = () => {
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
  const getDaysInMonth = (date: Date) => {
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
      case "approve-block":
        return {
          bg: "bg-slate-50 border-green-700 border-[0.1px]",
          text: "text-green-800",
          icon: <CheckCircle className="w-3 h-3" />,
        };
      case "waitinge-block":
        return {
          bg: "bg-slate-50 border-yellow-700 border-[0.1px]",
          text: "text-yellow-700",
          icon: <Hourglass className="w-3 h-3" />,
        };
      case "cancele-block":
        return {
          bg: "bg-slate-50 border-red-800 border-[0.1px]",
          text: "text-red-800",
          icon: <XCircle className="w-3 h-3" />,
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
const isTimeSlotPast = useCallback((day: number, timeSlot: string) => {
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
    if (currentHour === slotEndHour && currentMinute >= slotEndMinute) return true;

    return false;
}, [currentDate]);

  // ✅ MAIN OPTIMIZATION: Pre-process ALL slot data in useMemo
  const slotDataMap: Map<string, SlotData> = useMemo(() => {
    const map = new Map<string, SlotData>();
    
    // Step 1: Create booking map for fast lookup
    const bookingMap = new Map<string, Booking>();
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

        bookingMap.set(key, {
          id: bookingId,
          name,
          room,
          status,
          timeStart: b.timeStart,
          timeEnd: b.timeEnd,
        });

        current.setUTCMinutes(current.getUTCMinutes() + 30);
      }
    });

    // Step 2: Pre-process each day and time slot
    daysInMonth.forEach((day) => {
      const isWeekend = ["Sat", "Sun"].includes(day.dayName);
      const isPast = day.isPast;

      timeSlots.forEach((timeSlot, timeIndex) => {
        const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
        const paddedDay = String(day.date).padStart(2, "0");
        const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
        const key = `${dateString}-${timeSlot}`;

        const booking = bookingMap.get(key);
        const isPastTime = isTimeSlotPast(day.date, timeSlot);

        // Default slot data for empty slots
        let slotData: SlotData = {
          bookingId: null,
          name: null,
          room: null,
          status: null,
          bgClass: isWeekend
            ? "bg-slate-500 text-white"
            : isPast || isPastTime
            ? "bg-slate-300"
            : "bg-slate-50",
          textClass: "",
          icon: null,
          span: 1,
          shouldDisplay: true,
          isPast,
          isPastTime,
          isWeekend,
          isClickable: !isPast && !booking && !isWeekend && !isPastTime,
        };

        if (booking) {
          const statusStyle = getStatusStyle(booking.status);
          
          // Check if this is the first slot of this booking for this day
          const isFirstSlot = timeIndex === 0 || (() => {
            const prevSlot = timeSlots[timeIndex - 1];
            const prevKey = `${dateString}-${prevSlot}`;
            const prevBooking = bookingMap.get(prevKey);
            return !prevBooking || prevBooking.id !== booking.id;
          })();

          // Calculate span: count consecutive slots with same booking ID
          let span = 1;
          if (isFirstSlot) {
            for (let i = timeIndex + 1; i < timeSlots.length; i++) {
              const nextSlot = timeSlots[i];
              const nextKey = `${dateString}-${nextSlot}`;
              const nextBooking = bookingMap.get(nextKey);
              
              if (nextBooking && nextBooking.id === booking.id) {
                span++;
              } else {
                break;
              }
            }
          }

          slotData = {
            bookingId: booking.id,
            name: booking.name,
            room: booking.room,
            status: booking.status,
            bgClass: isWeekend
              ? "bg-slate-500 text-white"
              : statusStyle.bg,
            textClass: isWeekend ? "" : statusStyle.text,
            icon: isWeekend ? null : statusStyle.icon,
            span: span,
            shouldDisplay: isFirstSlot, // Only show first slot of multi-slot booking
            isPast,
            isPastTime,
            isWeekend,
            isClickable: false,
          };
        }

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

  return (
    <div className="max-w-[1500px]">
      <div>
        {/* Head zone */}
        <div
          className="flex items-center justify-between py-3"
          style={{ maxWidth: "1500px" }}
        >
          {/* Title of component */}
          <div className="flex items-center justify-center min-w-[370px] rounded-t-4xl bg-slate-300">
            <Calendar className="w-8 h-8" />
            <h1 className="text-[30px] font-medium">Book Appointment</h1>
          </div>
          {/* Next and Previous month zone */}
          <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto max-w-[280px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 border rounded-[10px]"
              >
                <ChevronLeft />
              </button>
              <span className="min-w-[150px] text-center font-medium">
                {currentDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                className="p-2 border rounded-[10px]"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>

        {/* Content Zone */}
        <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-3xl transition-[color,box-shadow] overflow-hidden">
          <div className="max-h-[500px]">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
                gridAutoRows: "60px",
              }}
            >
              {/* Header row */}
              <div className="sticky top-0 left-0 z-40 bg-slate-50 border flex items-center justify-center">
                <Clock className="bg-slate-50 w-4 h-4 text-gray-600" />
              </div>

              {/* Time slot headers */}
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="sticky top-0 z-30 bg-slate-50 border text-center text-sm font-medium flex items-center justify-center"
                >
                  {slot}
                </div>
              ))}

              {/* ✅ OPTIMIZED RENDER: Read from pre-calculated map only */}
              {daysInMonth.map((day) => (
                <React.Fragment key={day.date}>
                  <div className="sticky left-0 z-20 bg-slate-50 border text-center text-xs flex flex-col justify-center">
                    <span className="font-semibold">{day.dayName}</span>
                    <span>{day.date}</span>
                  </div>

                  {timeSlots.map((slot) => {
                    const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
                    const paddedDay = String(day.date).padStart(2, "0");
                    const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
                    const key = `${dateString}-${slot}`;

                    // ✅ Single lookup - all data is pre-calculated
                    const slotData = slotDataMap.get(key);
                    if (!slotData) {
                      return null;
                    }

                    // ✅ Skip rendering hidden slots entirely (they're covered by the spanning cell)
                    if (!slotData.shouldDisplay) {
                      return null;
                    }

                    return (
                      <div
                        key={key}
                        className={`rounded-[4px] border flex flex-col items-center justify-center text-xs transition-all p-1 ${
                          slotData.isWeekend
                            ? "cursor-not-allowed"
                            : slotData.isPast || slotData.isPastTime
                            ? "cursor-not-allowed"
                            : slotData.bookingId
                            ? "cursor-default"
                            : "cursor-pointer"
                        } ${slotData.bgClass} ${slotData.textClass}`}
                        style={{
                          gridColumn: slotData.span > 1 ? `span ${slotData.span}` : undefined,
                        }}
                        onClick={() => {
                          if (slotData.isClickable) {
                            handleSlotClick(day.date, slot);
                          }
                        }}
                        title={
                          slotData.isWeekend
                            ? "Weekend - No booking available"
                            : slotData.bookingId
                            ? `${slotData.name} - ${slotData.room} (${slotData.status})`
                            : ""
                        }
                      >
                        {slotData.bookingId && !slotData.isWeekend && (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              {slotData.icon}
                              <User className="w-3 h-3" />
                            </div>
                            <div className="text-center">
                              <div className="font-medium truncate w-full">
                                {slotData.name}
                              </div>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <MapPin className="w-2 h-2" />
                                <span className="text-xs truncate">
                                  {slotData.room}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                        {slotData.isWeekend && (
                          <span className="text-xs font-medium">Weekend</span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="bg-slate-300 flex items-center justify-center gap-7 ml-auto text-sm mt-3 max-w-[350px] min-h-[35px] rounded-br-4xl rounded-bl-4xl">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-medium">Approved</span>
          </div>
          <div className="flex items-center gap-1">
            <Hourglass className="w-4 h-4 text-yellow-600" />
            <span className="font-medium">Waiting</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="font-medium">Cancelled</span>
          </div>
        </div>
      </div>
      
      <BookingForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedSlot={selectedSlot}
        daysInMonth={daysInMonth}
      />
    </div>
  );
};

export default BookingCalendar;