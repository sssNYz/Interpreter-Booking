// ✅ Refactored BookingCalendar with unified scroll grid (sticky headers + sidebar) and mock data

"use client";

import React, { useState } from "react";
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
import mockData from "./mockData.json";

const BookingCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  
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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: lastDay }, (_, i) => {
      const day = new Date(year, month, i + 1);
      return {
        date: i + 1,
        dayName: day.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: day,
        isPast: day < new Date().setHours(0, 0, 0, 0),
      };
    });
  };

  const daysInMonth = getDaysInMonth(currentDate);

  // Function to get booking data for a specific date and time
  const getBookingForSlot = (day, time) => {
    const dateString = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`;
    return mockData.bookings.find(
      (booking) => booking.date === dateString && booking.time === time
    );
  };

  // Function to get status color and icon
  const getStatusStyle = (status) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-green-100 border-green-300",
          text: "text-green-800",
          icon: <CheckCircle className="w-3 h-3" />,
        };
      case "wait":
        return {
          bg: "bg-yellow-100 border-yellow-300",
          text: "text-yellow-800",
          icon: <Hourglass className="w-3 h-3" />,
        };
      case "cancelled":
        return {
          bg: "bg-red-100 border-red-300",
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

  const navigateMonth = (direction) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    setSelectedSlots(new Set());
  };

  const createSlotKey = (day, time) =>
    `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}-${time}`;

  const toggleSlot = (day, time) => {
    const key = createSlotKey(day, time);
    const newSet = new Set(selectedSlots);

    newSet.has(key) ? newSet.delete(key) : newSet.add(key);

    setSelectedSlots(newSet);
  };

  const isSlotSelected = (day, time) =>
    selectedSlots.has(createSlotKey(day, time));

  return (
    <div>
      <div className="max-w-7xl mx-auto p-4">
        {/**TOP PAGE ZONE */}
        <div className="flex justify-between items-center mb-4">
          {/**TITLE ZONE*/}
          <div className="flex items-center space-x-2">
            <Calendar className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Book Appointment</h1>
          </div>

          {/*CHANGE MONTH ZONE */}
          <div className="flex items-center gap-2">
            {/**BUTTON GO BACK */}
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 border rounded"
            >
              <ChevronLeft />
            </button>

            {/** CURRENT MONTH LABEL ZONE*/}
            <span className="min-w-[150px] text-center font-medium">
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>

            {/**BUTTON GO NEXT */}
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 border rounded"
            >
              <ChevronRight />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1">
            <Hourglass className="w-4 h-4 text-yellow-600" />
            <span>Waiting</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>Cancelled</span>
          </div>
        </div>

        {/* Unified Scroll Grid */}
        <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow]">
          <div className=" border rounded-2xl shadow max-h-[500px]">
            <div
              className="grid "
              style={{
                gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
                gridAutoRows: "60px",
              }}
            >
              {/* Header row */}
              <div className="sticky top-0 left-0 z-40 bg-white border flex items-center justify-center">
                <Clock className="w-4 h-4 text-gray-600" />
              </div>

              {/**sticky use for lock bar */}
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="sticky top-0 z-30 bg-white border text-center text-sm font-medium flex items-center justify-center"
                >
                  {slot}
                </div>
              ))}

              {/* Rows  DAY NAME AND DAY NUMBER*/}
              {daysInMonth.map((day) => (
                <React.Fragment key={day.date}>
                  <div className="sticky left-0 z-20 bg-gray-50 border text-center text-xs flex flex-col justify-center">
                    <span className="font-semibold">{day.dayName}</span>
                    <span>{day.date}</span>
                  </div>
                  {timeSlots.map((slot) => {
                    const selected = isSlotSelected(day.date, slot);
                    const isPast = day.isPast;
                    const booking = getBookingForSlot(day.date, slot);
                    const statusStyle = booking ? getStatusStyle(booking.status) : null;
                    const isWeekend = ["Sat", "Sun"].includes(
                      day.fullDate.toLocaleDateString("en-US", { weekday: "short" })
                    );

                    return (
                      <div
                        key={`${day.date}-${slot}`}
                        className={`border flex flex-col items-center justify-center text-xs transition-all p-1
                          ${
                            isWeekend
                              ? "bg-amber-600 text-white cursor-not-allowed"
                              : isPast
                              ? "bg-gray-100 cursor-not-allowed opacity-50"
                              : booking
                              ? statusStyle.bg + " " + statusStyle.text + " cursor-default"
                              : "hover:bg-blue-50 cursor-pointer"
                          }
                          ${selected ? "ring-2 ring-blue-500" : ""}
                        `}
                        onClick={() => !isPast && !booking && !isWeekend && toggleSlot(day.date, slot)}
                        title={
                          isWeekend 
                            ? "Weekend - No booking available" 
                            : booking 
                            ? `${booking.name} - ${booking.room} (${booking.status})` 
                            : ""
                        }
                      >
                        {booking && !isWeekend && (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              {statusStyle.icon}
                              <User className="w-3 h-3" />
                            </div>
                            <div className="text-center">
                              <div className="font-medium truncate w-full">{booking.name}</div>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <MapPin className="w-2 h-2" />
                                <span className="text-xs truncate">{booking.room}</span>
                              </div>
                            </div>
                          </>
                        )}
                        {selected && !booking && !isWeekend && (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        )}
                        {isWeekend && (
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
      </div>
    </div>
  );
};

export default BookingCalendar;