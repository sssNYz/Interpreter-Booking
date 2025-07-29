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
import mockData from "@/data/mockData.json";
import { BookingForm } from "../booking-form/booking-form";

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
  {
    /**📌 สรุปสั้น:
ฟังก์ชันนี้ใช้เพื่อ "หาว่ามีคนจอง slot นี้ไหม"
โดยเช็คจาก:
วันที่ → ถูกต้อง (ปี-เดือน-วัน)
เวลา → อยู่ใน array timeSlots
*/
  }
  const getBookingForSlot = (day, time) => {
    const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0"); // add +1 to fix 0-based month
    const paddedDay = String(day).padStart(2, "0");
    const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;

    return mockData.bookings.find(
      (booking) =>
        booking.date === dateString && booking.timeSlots.includes(time)
    );
  };

  // Function to check if current slot should be merged (hidden)
  const shouldHideSlot = (day, timeIndex) => {
    const currentSlot = timeSlots[timeIndex];
    const booking = getBookingForSlot(day, currentSlot);

    if (!booking) return false;

    // Check if previous slot has same booking
    if (timeIndex > 0) {
      const prevSlot = timeSlots[timeIndex - 1];
      const prevBooking = getBookingForSlot(day, prevSlot);

      if (
        prevBooking &&
        prevBooking.name === booking.name &&
        prevBooking.room === booking.room &&
        prevBooking.status === booking.status
      ) {
        return true;
      }
    }

    return false;
  };

  // Function to get colspan for merged booking
  const getBookingSpan = (day, timeIndex) => {
    const currentSlot = timeSlots[timeIndex];
    const booking = getBookingForSlot(day, currentSlot);

    if (!booking) return 1;

    let span = 1;
    // Count consecutive slots with same booking
    for (let i = timeIndex + 1; i < timeSlots.length; i++) {
      const nextSlot = timeSlots[i];
      const nextBooking = getBookingForSlot(day, nextSlot);

      if (
        nextBooking &&
        nextBooking.name === booking.name &&
        nextBooking.room === booking.room &&
        nextBooking.status === booking.status
      ) {
        span++;
      } else {
        break;
      }
    }

    return span;
  };

  // Function to get status color and icon
  const getStatusStyle = (status) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-slate-50  border-green-700 border-[2px]",
          text: "text-green-800",
          icon: <CheckCircle className="w-3 h-3" />,
        };
      case "wait":
        return {
          bg: "bg-slate-50  border-yellow-700 border-[2px]",
          text: "text-yellow-700",
          icon: <Hourglass className="w-3 h-3" />,
        };
      case "cancelled":
        return {
          bg: "bg-slate-50  border-red-800 border-[2px]",
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const handleSlotClick = (day, slot) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col max-w-[1500px] mt-10 px- mx-auto">
      {/**============================================================================ */}

      {/**<div className="flex items-center justify-between px-4 py-3 bg-blue-800" style={{ maxWidth: "1500px" }}> */}
      <div>
        <div className=" mx-auto px-4  pb-4" style={{ maxWidth: "1500px" }}>
          {/**TOP ZONE =======================================*/}
          <div
            className="flex items-center justify-between  py-3"
            style={{ maxWidth: "1500px" }}
          >
            {/**title Zone */}
            <div className=" flex items-center justify-center   min-w-[370px] rounded-t-4xl bg-slate-300">
              <Calendar className="w-8 h-8 " />
              <h1 className="text-[30px] font-medium">Book Appointment</h1>
            </div>

            {/*CHANGE MONTH ZONE */}
            <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto  max-w-[280px]">
              <div className="flex items-center gap-2">
                {/**BUTTON GO BACK */}
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 border  rounded-[10px]"
                >
                  <ChevronLeft />
                </button>

                {/** CURRENT MONTH LABEL ZONE*/}
                <span className="min-w-[150px] text-center font-medium ">
                  {currentDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>

                {/**BUTTON GO NEXT */}
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 border rounded-[10px]"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          </div>
          {/**TITLE ZONE*/}
          {/* TABLE ZONE  Scroll Grid */}
          <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-3xl  transition-[color,box-shadow] overflow-hidden ">
            {/** TABLE CONTENT */}
            <div className=" max-h-[500px] ">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
                  gridAutoRows: "60px",
                }}
              >
                {/* Header row */}
                <div className="sticky top-0 left-0 z-40 bg-slate-50 border flex items-center justify-center">
                  <Clock className=" bg-slate-50 w-4 h-4 text-gray-600" />
                </div>

                {/**Time slot headers */}
                {timeSlots.map((slot) => (
                  <div
                    key={slot}
                    className="sticky top-0 z-30  bg-slate-50 border text-center text-sm font-medium flex items-center justify-center"
                  >
                    {slot}
                  </div>
                ))}

                {/* Rows - DAY NAME AND DAY NUMBER with TIME SLOTS */}
                {daysInMonth.map((day) => (
                  <React.Fragment key={day.date}>
                    <div className=" sticky left-0 z-20  bg-slate-50 border text-center text-xs flex flex-col justify-center">
                      <span className="font-semibold">{day.dayName}</span>
                      <span>{day.date}</span>
                    </div>

                    {timeSlots.map((slot, timeIndex) => {
                      const selected = isSlotSelected(day.date, slot);
                      const isPast = day.isPast;
                      const booking = getBookingForSlot(day.date, slot);
                      const statusStyle = booking
                        ? getStatusStyle(booking.status)
                        : null;
                      const isWeekend = ["Sat", "Sun"].includes(
                        day.fullDate.toLocaleDateString("en-US", {
                          weekday: "short",
                        })
                      );

                      // Skip rendering if this slot should be merged with previous
                      if (shouldHideSlot(day.date, timeIndex)) {
                        return null;
                      }

                      const colspan = getBookingSpan(day.date, timeIndex);

                      return (
                        <div
                          key={`${day.date}-${slot}`}
                          className={`rounded-[4px] border flex flex-col items-center justify-center text-xs transition-all p-1
                        ${
                          isWeekend
                            ? "bg-slate-500 text-white cursor-not-allowed"
                            : isPast
                            ? "bg-slate-300 cursor-not-allowed "
                            : booking
                            ? statusStyle.bg +
                              " " +
                              statusStyle.text +
                              " cursor-default"
                            : "bg-slate-50 cursor-pointer"
                        }
                              ${selected ? "ring-2 ring-blue-500" : ""}
                        `}
                          style={{
                            gridColumn:
                              colspan > 1 ? `span ${colspan}` : undefined,
                          }}
                          onClick={() => {
                            if (!isPast && !booking && !isWeekend) {
                              handleSlotClick(day.date, slot);
                            }
                          }}
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
                                <div className="font-medium truncate w-full">
                                  {booking.name}
                                </div>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <MapPin className="w-2 h-2" />
                                  <span className="text-xs truncate">
                                    {booking.room}
                                  </span>
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
      </div>
      <BookingForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedSlot={selectedSlot}
      />
    </div>
  );
};

export default BookingCalendar;