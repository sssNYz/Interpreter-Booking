"use client";
import React from "react";
import { BookingSlot } from "./BookingSlot";
import { SlotData, DayInfo } from "@/components/hooks/useCalendarLogic";
import { Booking, BookingWithLayer } from "@/components/hooks/useCalendarLogic";

interface DayRowProps {
  dayIndex: number;
  style: React.CSSProperties;
  timeSlots: string[];
  daysInMonth: DayInfo[];
  slotDataMap: Map<string, SlotData>;
  currentDate: Date;
  handleSlotClick: (day: number, slot: string) => void;
  assignLayersByRoom: (bookings: Booking[]) => {
  bookingsWithLayers: BookingWithLayer[];
  maxLayers: number;
};
}

export const DayRow = React.memo(({ 
  dayIndex, 
  style, 
  timeSlots, 
  daysInMonth, 
  slotDataMap, 
  currentDate, 
  handleSlotClick,
  assignLayersByRoom
}: DayRowProps) => {
  const day = daysInMonth[dayIndex];
  
  // Collect all bookings for this day to pass to each slot
  const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
  const paddedDay = String(day.date).padStart(2, "0");
  const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
  
  // Get all unique bookings for this day and assign layers
  const dayBookings = new Map();
  timeSlots.forEach(slot => {
    const key = `${dateString}-${slot}`;
    const slotData = slotDataMap.get(key);
    if (slotData?.bookings) {
      slotData.bookings.forEach(booking => {
        dayBookings.set(booking.id, booking);
      });
    }
  });
  
  const uniqueDayBookings = Array.from(dayBookings.values());
  const { bookingsWithLayers, maxLayers } = assignLayersByRoom(uniqueDayBookings);
  
  // Calculate dynamic row height based on max layers
  const dynamicRowHeight = Math.max(60, 6 + (maxLayers * 24) + 6);
  
  return (
    <div 
      className="grid border-b border-slate-200 relative"
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
        height: `${dynamicRowHeight}px`,
        minHeight: '60px',
      }}
    >
      {/* Day label cell */}
      <div 
        className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-center text-xs flex flex-col justify-center"
        style={{ height: `${dynamicRowHeight}px`, minHeight: '60px' }}
      >
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {/* Render all time slots with horizontal timeline support */}
      {timeSlots.map((slot, slotIndex) => {
        const key = `${dateString}-${slot}`;
        const slotData = slotDataMap.get(key);
        
        if (!slotData) {
          return <div key={key} className="border-r border-slate-200"></div>;
        }

        return (
          <BookingSlot
            key={key}
            slotData={slotData}
            timeSlot={slot}
            timeSlots={timeSlots}
            currentSlotIndex={slotIndex}
            dayBookings={bookingsWithLayers} // Pass layered bookings
            maxLayers={maxLayers} // Pass max layers for height calculation
            onClick={() => {
              if (slotData.isClickable) {
                handleSlotClick(day.date, slot);
              }
            }}
            title={
              slotData.isWeekend
                ? "Weekend - No booking available"
                : slotData.bookings.length > 0
                ? slotData.bookings.map(b => `${b.name} - ${b.room} (${b.status})`).join(' | ')
                : `Available slot: ${slot}`
            }
          />
        );
      })}
    </div>
  );
});

DayRow.displayName = 'DayRow';