"use client";
import React from "react";
import { MapPin, User } from "lucide-react";
import type { DayInfo, SlotData } from "@/types/booking";

type Props = {
  day: DayInfo;
  currentDate: Date;
  timeSlots: string[];
  slotDataMap: Map<string, SlotData>;
  onSlotClick: (day: number, slot: string) => void;
  style: React.CSSProperties;
};

const DayRow: React.FC<Props> = ({
  day,
  currentDate,
  timeSlots,
  slotDataMap,
  onSlotClick,
  style,
}) => {
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
      <div className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-center text-xs flex flex-col justify-center">
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {timeSlots.map((slot) => {
        const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
        const paddedDay = String(day.date).padStart(2, "0");
        const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
        const key = `${dateString}-${slot}`;

        const slotData = slotDataMap.get(key);
        if (!slotData)
          return <div key={key} className="border-r border-slate-200" />;
        if (!slotData.shouldDisplay) return null;

        const clickable = slotData.isClickable;

        return (
          <div
            key={key}
            className={`border-r border-slate-200 rounded-[4px] flex flex-col items-center justify-center text-xs transition-all p-1 ${
              slotData.isWeekend
                ? "cursor-not-allowed"
                : slotData.isPast || slotData.isPastTime
                ? "cursor-not-allowed"
                : slotData.bookingId
                ? "cursor-default"
                : "cursor-pointer hover:bg-slate-100"
            } ${slotData.bgClass} ${slotData.textClass}`}
            style={{
              gridColumn:
                slotData.span > 1 ? `span ${slotData.span}` : undefined,
            }}
            onClick={() => clickable && onSlotClick(day.date, slot)}
            title={
              slotData.isWeekend
                ? "Weekend - No booking available"
                : slotData.bookingId
                ? `${slotData.name} - ${slotData.room} (${slotData.status})`
                : `Available slot: ${slot}`
            }
          >
            {slotData.bookingId && !slotData.isWeekend && (
              <>
                <div className="flex items-center gap-1 mb-1">
                  {slotData.icon}
                  <User className="w-3 h-3" />
                </div>
                <div className="text-center w-full">
                  <div className="font-medium truncate">{slotData.name}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <MapPin className="w-2 h-2" />
                    <span className="text-xs truncate">{slotData.room}</span>
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
    </div>
  );
};

export default React.memo(DayRow);
