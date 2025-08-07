"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Clock } from "lucide-react";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { DayRow } from "./DayRow";
import { SlotData, DayInfo } from "@/components/hooks/useCalendarLogic";

interface CalendarGridProps {
  timeSlots: string[];
  daysInMonth: DayInfo[];
  slotDataMap: Map<string, SlotData>;
  currentDate: Date;
  handleSlotClick: (day: number, slot: string) => void;
}

export const CalendarGrid = ({
  timeSlots,
  daysInMonth,
  slotDataMap,
  currentDate,
  handleSlotClick,
}: CalendarGridProps) => {
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  // Setup virtualization - connected to ScrollArea's viewport
  const rowVirtualizer = useVirtualizer({
    count: daysInMonth.length,
    getScrollElement: () => scrollAreaViewportRef.current,
    estimateSize: () => 60, // Fixed row height: 60px
    overscan: 2,
  });

  return (
    <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white">
      {/* Sticky header row for time slots */}
      <div
        className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200"
        style={{
          display: "grid",
          gridTemplateColumns: `120px repeat(${timeSlots.length}, 120px)`,
          height: "60px",
        }}
      >
        {/* Header corner */}
        <div className="border-r border-slate-200 flex items-center justify-center bg-slate-100">
          <Clock className="w-4 h-4 text-gray-600" />
        </div>

        {/* Time slot headers */}
        {timeSlots.map((slot) => (
          <div
            key={slot}
            className="border-r border-slate-200 text-center text-sm font-medium flex items-center justify-center bg-slate-50"
          >
            {slot}
          </div>
        ))}
      </div>

      {/* ScrollArea with virtualized content */}
      <ScrollArea className="h-[500px]">
        <div
          ref={scrollAreaViewportRef}
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {/* Only render visible rows */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <DayRow
              key={virtualRow.index}
              dayIndex={virtualRow.index}
              style={{
                position: "absolute",
                top: `${virtualRow.start}px`,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
              }}
              timeSlots={timeSlots}
              daysInMonth={daysInMonth}
              slotDataMap={slotDataMap}
              currentDate={currentDate}
              handleSlotClick={handleSlotClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
