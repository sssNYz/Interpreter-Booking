"use client";
import React, { useState, useMemo, useEffect } from "react";
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


const BookingCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; slot: string } | undefined>(undefined);
  const [bookings, setBookings] = useState<BookingData[]>([]);


  // เพิ่ม useEffect เพื่อเรียก API เมื่อ currentDate เปลี่ยน
  useEffect(() => {
    const fetchBookings = async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      try {
        const response = await fetch(`/api/booking-data/get-booking-byDate/${year}/${month}`);
        console.log(year, month);
        const data = await response.json();
        console.log("Debug : fetch output is : ",data);
        setBookings(data);
      } catch (err) {
        console.error("Failed to fetch", err);
      }
    };

    fetchBookings();
  }, [currentDate]);

    // ✅ 1. Preprocess bookings into a Map for O(1) lookup performance
  const bookingMap: Map<string, Booking> = useMemo(() => {
    const map = new Map<string, Booking>();

bookings.forEach((b) => {
  console.log("Debug before use new Date: Start : ", b.timeStart, "End:", b.timeEnd);

  const name = `${b.ownerName} ${b.ownerSurname}`;
  const room = b.meetingRoom;
  const status = b.bookingStatus;

  // ใช้ Date เฉพาะเพื่อคำนวณ loop — แต่สำหรับ key ให้ดึงจาก raw string
  const startISO = b.timeStart; // "2026-01-01T09:00:00.000Z"
  const endISO = b.timeEnd;

  const current = new Date(startISO);
  const end = new Date(endISO);

  while (current < end) {
    const dateKey = startISO.split("T")[0]; // YYYY-MM-DD
    const hours = current.getUTCHours().toString().padStart(2, "0");
    const minutes = current.getUTCMinutes().toString().padStart(2, "0");
    const timeKey = `${hours}:${minutes}`;

    const key = `${dateKey}-${timeKey}`;
    console.log("key is", key);

    map.set(key, {
      id: b.bookingId,
      name,
      room,
      status,
      timeStart: b.timeStart,
      timeEnd: b.timeEnd,
    });

    current.setUTCMinutes(current.getUTCMinutes() + 30); // move to next slot in UTC
  }
});


  
    

    return map;
  }, [bookings]);

  //Function for change month next and previous, use parameter direction (1,-1)
  const shiftMonth = (direction: number) => {
    //setCurrentDate for update current month
    setCurrentDate((current) => {
      const newDate = new Date(current); //Step1 : copy data from current data and set to newDate
      newDate.setMonth(current.getMonth() + direction); //Step2 : shift month by direction in newDate
      return newDate; //Step3 : give newDate value for update currentDate by setCurrentDate fuction
    });
  };

  //Create all time in table and keep in slots array
  const generateTimeSlots = () => {
    const slots = [];
    //loop start 8:00 AM to 18:00 PM
    for (let hour = 8; hour < 18; hour++) {
      //Spetial Time Condition
      if (hour === 12) {
        slots.push(`${hour}:00`, `${hour}:20`);
        continue;
      }
      //Spetial Time Condition
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

  const timeSlots = generateTimeSlots(); //timeSlote keep time array

  //getDaysInMonth is array of date for careate data {date,dayName,fillday,isPast}
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(); //number of year : 202 5
    const month = date.getMonth(); //number of current month : 6
    const lastDay = new Date(year, month + 1, 0).getDate(); //calcurate how namy day in month
    {
      /*loop in lastDay lange for like a
      { date: 3,
        dayName: "Wed",
        fullDate: Wed Jul 03 2025 00:00:00,
        isPast: false}*/
    }
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

  const daysInMonth = getDaysInMonth(currentDate); //daysInMonth keep array of date data

  // ✅ 2. Optimized getBookingData using Map lookup (O(1) instead of O(n))
  const getBookingData = (day: number, time: string): Booking | undefined => {
    const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
    const paddedDay = String(day).padStart(2, "0");
    const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
    const key = `${dateString}-${time}`;

    return bookingMap.get(key);
  };

  //style of booking like a red for cancel or green for approve
  const getStatusStyle = (status: string) => {
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

  // ✅ 3. Refactored shouldHideSlot to accept booking as parameter (avoids redundant lookup)
  const shouldHideSlot = (
    day: number,
    timeIndex: number,
    currentBooking: Booking | undefined
  ): boolean => {
    if (!currentBooking) return false;

    // Check if previous slot has same booking
    if (timeIndex > 0) {
      const prevSlot = timeSlots[timeIndex - 1];
      const prevBooking = getBookingData(day, prevSlot);

      if (
        prevBooking &&
        prevBooking.name === currentBooking.name &&
        prevBooking.room === currentBooking.room &&
        prevBooking.status === currentBooking.status
      ) {
        return true;
      }
    }

    return false;
  };

  // ✅ 4. Refactored getBookingSpan to accept booking as parameter (avoids redundant lookup)
  const getBookingSpan = (
    day: number,
    timeIndex: number,
    currentBooking: Booking | undefined
  ): number => {
    if (!currentBooking) return 1;

    let span = 1;
    // Count consecutive slots with same booking
    for (let i = timeIndex + 1; i < timeSlots.length; i++) {
      const nextSlot = timeSlots[i];
      const nextBooking = getBookingData(day, nextSlot);

      if (
        nextBooking &&
        nextBooking.name === currentBooking.name &&
        nextBooking.room === currentBooking.room &&
        nextBooking.status === currentBooking.status
      ) {
        span++;
      } else {
        break;
      }
    }

    return span;
  };

  //set parameter for use in booking-form
  const handleSlotClick = (day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  };

  // Function to check if a specific time slot is in the past
  const isTimeSlotPast = (day: number, timeSlot: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Parse the time slot (e.g., "10:00" or "14:30")
    const [slotHour, slotMinute] = timeSlot.split(":").map(Number);

    // Check if it's today
    const isToday =
      day === now.getDate() &&
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear();

    if (!isToday) return false;

    // Calculate the END time of the slot (slot + 30 minutes)
    let slotEndHour = slotHour;
    let slotEndMinute = slotMinute + 30;

    // Handle minute overflow (e.g., 9:30 + 30min = 10:00)
    if (slotEndMinute >= 60) {
      slotEndHour += 1;
      slotEndMinute -= 60;
    }

    // Compare current time with slot END time
    if (currentHour > slotEndHour) return true;
    if (currentHour === slotEndHour && currentMinute >= slotEndMinute)
      return true;

    return false;
  };

  return (
    <div className="max-w-[1500px]">
      <div>
        {/*Head zone*/}
        <div
          className="flex items-center justify-between  py-3"
          style={{ maxWidth: "1500px" }}
        >
          {/*Title of commonent */}
          <div className=" flex items-center justify-center   min-w-[370px] rounded-t-4xl bg-slate-300">
            <Calendar className="w-8 h-8 " />
            <h1 className="text-[30px] font-medium">Book Appointment</h1>
          </div>
          {/*Next and Previous month zone*/}
          <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto  max-w-[280px]">
            <div className="flex items-center gap-2">
              {/**Button previous month*/}
              <button
                onClick={() => shiftMonth(-1)} // Move to previous month
                className="p-2 border  rounded-[10px]"
              >
                <ChevronLeft />
              </button>
              {/**Current month label*/}
              <span className="min-w-[150px] text-center font-medium ">
                {currentDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {/**Button next month*/}
              <button
                onClick={() => shiftMonth(1)} // Move to next month
                className="p-2 border rounded-[10px]"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>

        {/*Content Zone*/}
        <ScrollArea className="focus-visible:ring-ring/50 size-full rounded-3xl  transition-[color,box-shadow] overflow-hidden ">
          {/*Table content zone */}
          <div className=" max-h-[500px] ">
            {/*Create Grid */}
            <div
              className="grid"
              style={{
                // First column = 120px (for showing day names)
                // Next columns = created from timeSlots (each 120px wide)
                gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
                gridAutoRows: "60px",
              }}
            >
              {/* Header row */}
              <div className="sticky top-0 left-0 z-40 bg-slate-50 border flex items-center justify-center">
                <Clock className=" bg-slate-50 w-4 h-4 text-gray-600" />
              </div>

              {/**Time slot headers, loop in timeSlots*/}
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="sticky top-0 z-30  bg-slate-50 border text-center text-sm font-medium flex items-center justify-center"
                >
                  {slot}
                </div>
              ))}

              {/* loop in date array for print in calendar */}
              {daysInMonth.map((day) => (
                <React.Fragment key={day.date}>
                  <div className=" sticky left-0 z-20  bg-slate-50 border text-center text-xs flex flex-col justify-center">
                    <span className="font-semibold">{day.dayName}</span>
                    <span>{day.date}</span>
                  </div>

                  {timeSlots.map((slot, timeIndex) => {
                    const isPast = day.isPast;
                    const isPastTime = isTimeSlotPast(day.date, slot);

                    // ✅ 5. Call getBookingData ONCE and reuse the result
                    const booking = getBookingData(day.date, slot);

                    const statusStyle = booking
                      ? getStatusStyle(booking.status)
                      : null;

                    //check weekend
                    const isWeekend = ["Sat", "Sun"].includes(
                      day.fullDate.toLocaleDateString("en-US", {
                        weekday: "short",
                      })
                    );

                    // ✅ 6. Pass the already-fetched booking to helper functions
                    if (shouldHideSlot(day.date, timeIndex, booking)) {
                      return null;
                    }

                    const colspan = getBookingSpan(
                      day.date,
                      timeIndex,
                      booking
                    );

                    return (
                      <div
                        key={`${day.date}-${slot}`}
                        className={`rounded-[4px] border flex flex-col items-center justify-center text-xs transition-all p-1
                        ${
                          isWeekend
                            ? "bg-slate-500 text-white cursor-not-allowed"
                            : isPast || isPastTime
                            ? "bg-slate-300 cursor-not-allowed "
                            : booking
                            ? (statusStyle ? statusStyle.bg : "") +
                              " " +
                              (statusStyle ? statusStyle.text : "") +
                              " cursor-default"
                            : "bg-slate-50 cursor-pointer"
                        }

                        `}
                        style={{
                          gridColumn:
                            colspan > 1 ? `span ${colspan}` : undefined,
                        }}
                        onClick={() => {
                          if (
                            !isPast &&
                            !booking &&
                            !isWeekend &&
                            !isPastTime
                          ) {
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
                              {statusStyle ? statusStyle.icon : ""}
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
