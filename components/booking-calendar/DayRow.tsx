"use client";
import React from "react";
import { BookingSlot } from "./BookingSlot";
import { SlotData, DayInfo } from "@/components/hooks/useCalendarLogic";

interface DayRowProps {
  dayIndex: number;
  style: React.CSSProperties;
  timeSlots: string[];
  daysInMonth: DayInfo[];
  slotDataMap: Map<string, SlotData>;
  currentDate: Date;
  handleSlotClick: (day: number, slot: string) => void;
}

export const DayRow = React.memo(
  ({
    dayIndex,
    style,
    timeSlots,
    daysInMonth,
    slotDataMap,
    currentDate,
    handleSlotClick,
  }: DayRowProps) => {
    const day = daysInMonth[dayIndex];

    return (
      <div
        className="grid border-b border-slate-200"
        style={{
          ...style,
          display: "grid",
          gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
          height: "60px",
        }}
      >
        {/* Day label cell */}
        <div className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-center text-xs flex flex-col justify-center">
          <span className="font-semibold">{day.dayName}</span>
          <span>{day.date}</span>
        </div>

        {/* Time slot cells */}
        {timeSlots.map((slot) => {
          const paddedMonth = String(currentDate.getMonth() + 1).padStart(
            2,
            "0"
          );
          const paddedDay = String(day.date).padStart(2, "0");
          const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
          const key = `${dateString}-${slot}`;

          const slotData = slotDataMap.get(key);
          if (!slotData) {
            return <div key={key} className="border-r border-slate-200"></div>;
          }

          return (
            <BookingSlot
              key={key}
              slotData={slotData}
              onClick={() => {
                if (slotData.isClickable) {
                  handleSlotClick(day.date, slot);
                }
              }}
              title={
                slotData.isWeekend
                  ? "Weekend - No booking available"
                  : slotData.bookings.length > 0
                  ? slotData.bookings.length === 1
                    ? `${slotData.bookings[0].name} - ${slotData.bookings[0].room} (${slotData.bookings[0].status})`
                    : `${slotData.bookings.length} bookings in this slot`
                  : `Available slot: ${slot}`
              }
            />
          );
        })}
      </div>
    );
  }
);

DayRow.displayName = "DayRow";
