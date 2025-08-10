"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookingForm } from "@/components/booking-form/BookingForm";
import DayRow from "./DayRow";

import { generateTimeSlots, getDaysInMonth } from "@/utils/calendar";
import { useBookings } from "@/hooks/useBookings";
import { useSlotDataForBars } from "@/hooks/useSlotDataForBars";
import { ROW_HEIGHT, DAY_LABEL_WIDTH, CELL_WIDTH } from "@/utils/constants";
import type { DayInfo } from "@/types/booking";

const BookingCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<
    { day: number; slot: string } | undefined
  >(undefined);

  // IMPORTANT: keep ScrollArea viewport ref together with virtualizer
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const daysInMonth: DayInfo[] = useMemo(
    () => getDaysInMonth(currentDate),
    [currentDate]
  );

  const { bookings } = useBookings(currentDate);

  const isTimeSlotPast = useCallback(
    (day: number, timeSlot: string) => {
      const now = new Date();
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

      if (now.getHours() > slotEndHour) return true;
      if (now.getHours() === slotEndHour && now.getMinutes() >= slotEndMinute)
        return true;
      return false;
    },
    [currentDate]
  );

  const { barsByDay, occupancyByDay } = useSlotDataForBars({
    bookings,
    daysInMonth,
    timeSlots,
  });

  const rowVirtualizer = useVirtualizer({
    count: daysInMonth.length,
    getScrollElement: () => scrollAreaViewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
  });

  const shiftMonth = useCallback((direction: number) => {
    setCurrentDate((current) => {
      const d = new Date(current);
      d.setMonth(current.getMonth() + direction);
      return d;
    });
  }, []);

  const handleSlotClick = useCallback((day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  }, []);

  return (
    <div className="max-w-[1500px]">
      <div
        className="flex items-center justify-between py-3"
        style={{ maxWidth: "1500px" }}
      >
        <div className="flex items-center gap-2 justify-center min-w-[370px] rounded-t-4xl bg-slate-300 px-4 py-2">
          <Calendar className="w-8 h-8" />
          <h1 className="text-[30px] font-medium">Book Appointment</h1>
        </div>
        <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto max-w-[280px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-2 border rounded-[10px] hover:bg-slate-50"
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
              className="p-2 border rounded-[10px] hover:bg-slate-50"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white">
        {/* KEEPING ScrollArea + virtualizer viewport TOGETHER */}
        <ScrollArea className="h-[500px]">
          <div
            className="sticky top-0 z-30 bg-slate-50 border-b border-slclassNameate-200"
            style={{
              display: "grid",
              gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${timeSlots.length}, ${CELL_WIDTH}px)`,
              height: `${ROW_HEIGHT}px`,
            }}
          >
            <div className="sticky left-0 z-30 flex items-center justify-center border-r border-slate-200 bg-slate-100">
              <Clock className="w-4 h-4 text-gray-600" />
            </div>
            {timeSlots.map((slot) => (
              <div
                key={slot}
                className="border-r border-slate-200 text-center text-sm font-medium flex items-center justify-center bg-slate-50"
              >
                {slot}
              </div>
            ))}
          </div>

          {/* Virtualized rows */}
          <div
            ref={scrollAreaViewportRef}
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vr) => (
              <DayRow
                key={vr.index}
                day={daysInMonth[vr.index]}
                currentDate={currentDate}
                timeSlots={timeSlots}
                bars={barsByDay.get(vr.index) ?? []}
                occupancy={occupancyByDay.get(vr.index) ?? Array(timeSlots.length).fill(0)}
                isTimeSlotPast={isTimeSlotPast}
                onSlotClick={handleSlotClick}
                style={{
                  position: "absolute",
                  top: `${vr.start}px`,
                  left: 0,
                  width: "100%",
                  height: `${vr.size}px`,
                }}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="bg-slate-300 flex items-center justify-center gap-7 ml-auto text-sm mt-3 max-w-[400px] min-h-[40px] rounded-br-4xl rounded-bl-4xl px-4 py-2">
        {/* Icons come from utils/status in the cells; legend can be added similarly if desired */}
        <span>Legend: Approved / Waiting / Cancelled</span>
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
