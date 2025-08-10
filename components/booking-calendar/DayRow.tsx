"use client";
import React from "react";
import type { DayInfo, BarItem } from "@/types/booking";
import {
  MAX_LANES,
  ROW_HEIGHT,
  CELL_WIDTH,
  DAY_LABEL_WIDTH,
  BAR_HEIGHT,
  LANE_TOP_OFFSET,
  BAR_STACK_GAP,
} from "@/utils/constants";
import { getStatusStyle } from "@/utils/status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  day: DayInfo;
  currentDate: Date;
  timeSlots: string[];
  bars: BarItem[];
  occupancy: number[];
  isTimeSlotPast: (day: number, slot: string) => boolean;
  onSlotClick: (day: number, slot: string) => void;
  style: React.CSSProperties;
};

const DayRow: React.FC<Props> = ({
  day,
  currentDate,
  timeSlots,
  bars,
  occupancy,
  isTimeSlotPast,
  onSlotClick,
  style,
}) => {
  return (
    <div
      className="grid relative p-0 m-0 overflow-hidden box-border"
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${timeSlots.length}, ${CELL_WIDTH}px)`,
        height: `${ROW_HEIGHT}px`,
      }}
    >
      {/* ✅ คอลัมน์ซ้าย: ป้ายวัน (ต้องมีเสมอ) */}
      <div className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-center text-xs flex flex-col justify-center">
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {/* ✅ เส้นแบ่งล่าง (absolute; ไม่ควรมี children) */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-slate-200" />

      {/* พื้นหลังกริด (คอลัมน์ของ timeSlots จะเริ่มหลังคอลัมน์ป้ายวันโดยอัตโนมัติ) */}
      {timeSlots.map((slot, index) => {
        const isFull = occupancy[index] >= MAX_LANES;
        const isPastTime = isTimeSlotPast(day.date, slot);
        return (
          <div
            key={`${day.fullDate.toDateString()}-${slot}`}
            className={`border-r border-slate-200 ${
              isFull || isPastTime
                ? "cursor-not-allowed bg-slate-100"
                : "cursor-pointer hover:bg-slate-100"
            }`}
            onClick={() => {
              if (!isFull && !isPastTime) onSlotClick(day.date, slot);
            }}
            title={isFull ? "Time full" : isPastTime ? "Past" : `Available: ${slot}`}
          />
        );
      })}

      {/* บาร์ overlay */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {bars.map((bar) => {
          const statusStyle = getStatusStyle(bar.status);
          const left = DAY_LABEL_WIDTH + bar.startIndex * CELL_WIDTH;
          const width = (bar.endIndex - bar.startIndex) * CELL_WIDTH;
          const top = LANE_TOP_OFFSET + bar.lane * BAR_STACK_GAP;
          return (
            <Tooltip key={`bar-${bar.bookingId}`}>
              <TooltipTrigger asChild>
                <div
                  className={`pointer-events-auto rounded-sm border ${statusStyle.text} ${statusStyle.bg}`}
                  style={{
                    position: "absolute",
                    left,
                    width,
                    top,
                    height: BAR_HEIGHT,
                    borderRadius: 4,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-medium">{bar.name}</div>
                  <div className="opacity-80">{bar.room}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(DayRow);