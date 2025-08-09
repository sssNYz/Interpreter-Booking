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
      className="grid border-b border-slate-200"
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${timeSlots.length}, ${CELL_WIDTH}px)`,
        height: `${ROW_HEIGHT}px`,
        position: "relative",
      }}
    >
      <div className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-center text-xs flex flex-col justify-center">
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {/* Background Grid Layer */}
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

      {/* Bars Overlay Layer */}
      <div
        className="pointer-events-none"
        style={{ position: "absolute", inset: 0, zIndex: 5 }}
      >
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
