"use client";
import React from "react";
import { CheckCircle, XCircle, Hourglass } from "lucide-react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { useCalendarLogic } from "@/components/hooks/useCalendarLogic";
import { BookingForm } from "../booking-form/booking-form";

const BookingCalendar = () => {
  const {
    currentDate,
    isFormOpen,
    selectedSlot,
    timeSlots,
    daysInMonth,
    slotDataMap,
    shiftMonth,
    handleSlotClick,
    setIsFormOpen,
  } = useCalendarLogic();

  return (
    <div className="max-w-[1500px]">
      <div>
        {/* Header */}
        <CalendarHeader currentDate={currentDate} shiftMonth={shiftMonth} />

        {/* Calendar Grid */}
        <CalendarGrid
          timeSlots={timeSlots}
          daysInMonth={daysInMonth}
          slotDataMap={slotDataMap}
          currentDate={currentDate}
          handleSlotClick={handleSlotClick}
        />

        {/* Legend */}
        <div className="bg-slate-300 flex items-center justify-center gap-7 ml-auto text-sm mt-3 max-w-[400px] min-h-[40px] rounded-br-4xl rounded-bl-4xl px-4 py-2">
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
