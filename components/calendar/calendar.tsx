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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    day: number;
    slot: string;
  } | null>(null);

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

  // Function to get booking data for a specific date and time
  {
    /**
ฟังก์ชันนี้ใช้เพื่อ "หาว่ามีคนจอง slot นี้ไหม"
โดยเช็คจาก:
วันที่ → ถูกต้อง (ปี-เดือน-วัน)
เวลา → อยู่ใน array timeSlots
*/
  }
  const getBookingData = (day: number, time: string) => {
    const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0"); // add +1 to fix 0-based month and add 0 like a "02, 09, 10"
    const paddedDay = String(day).padStart(2, "0");
    const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`; //create format for find data

    return mockData.bookings.find(
      (booking) =>
        booking.date === dateString && booking.timeSlots.includes(time)
    );
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

  //funcion for check that cell should merge or not ?
  const shouldHideSlot = (day: number, timeIndex: number) => {
    const currentSlot = timeSlots[timeIndex];
    const booking = getBookingData(day, currentSlot);

    if (!booking) return false;

    // Check if previous slot has same booking
    if (timeIndex > 0) {
      const prevSlot = timeSlots[timeIndex - 1];
      const prevBooking = getBookingData(day, prevSlot);

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

  //function for fine how many cell that should merge 
  const getBookingSpan = (day: number, timeIndex: number) => {
    const currentSlot = timeSlots[timeIndex];
    const booking = getBookingData(day, currentSlot);

    if (!booking) return 1;

    let span = 1;
    // Count consecutive slots with same booking
    for (let i = timeIndex + 1; i < timeSlots.length; i++) {
      const nextSlot = timeSlots[i];
      const nextBooking = getBookingData(day, nextSlot);

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


  //set parameter for use in booking-form
  const handleSlotClick = (day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col max-w-[1500px] mt-10 px- mx-auto ">
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

              {/* loop in date array for print in calendar like this
                {
                date: 3,
                dayName: "Wed",
                fullDate: Wed Jul 03 2025 00:00:00,
                isPast: false
                }*/}
              {daysInMonth.map((day) => (
                <React.Fragment key={day.date}>
                  <div className=" sticky left-0 z-20  bg-slate-50 border text-center text-xs flex flex-col justify-center">
                    <span className="font-semibold">{day.dayName}</span>
                    <span>{day.date}</span>
                  </div>
                  {/* slot is value from timeSlots {array of time}
                      day is value from dayInMonth {array of date data}*/}
                  {timeSlots.map((slot, timeIndex) => {
                    const isPast = day.isPast;
                    const booking = getBookingData(day.date, slot); //keep array of booking data
                    const statusStyle = booking //get style of boking status
                      ? getStatusStyle(booking.status)
                      : null;
                    //check weekend
                    const isWeekend = ["Sat", "Sun"].includes(
                      day.fullDate.toLocaleDateString("en-US", {
                        weekday: "short",
                      })
                    );

                    // check that cell should merge or not, if YES, skip this cell
                    if (shouldHideSlot(day.date, timeIndex)) {
                      return null; // if not should return null. NOT CONTINUE
                    }
                    //if should merge, fiind find how many cell should be merge
                    //how many cell that should br merge (like a 2,3,4)
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
      />
    </div>
  );
};

export default BookingCalendar;
