"use client";
import React, { useRef, useState } from "react";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
  currentDate: _currentDate,
  timeSlots,
  bars,
  occupancy,
  isTimeSlotPast,
  onSlotClick,
  style,
}) => {
  const [openBarId, setOpenBarId] = useState<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="grid relative p-0 m-0 box-border"
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${timeSlots.length}, ${CELL_WIDTH}px)`,
        height: `${ROW_HEIGHT}px`,
      }}
    >
      {/* ✅ คอลัมน์ซ้าย: ป้ายวัน (ต้องมีเสมอ) */}
      <div className="sticky left-0 z-20 bg-secondary border-r border-b border-border text-center text-xs flex
  flex-col justify-center text-secondary-foreground">
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {/* ✅ เส้นแบ่งล่าง (absolute; ไม่ควรมี children) */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border" />

      {/* พื้นหลังกริด (คอลัมน์ของ timeSlots จะเริ่มหลังคอลัมน์ป้ายวันโดยอัตโนมัติ) */}
      {timeSlots.map((slot, index) => {
        const isFull = occupancy[index] >= MAX_LANES;
        const isWeekend = ["Sat", "Sun"].includes(day.dayName);
        const isPastDay = day.isPast;
        const isPastTime = isTimeSlotPast(day.date, slot);

        const clickable = !isWeekend && !isPastDay && !isPastTime && !isFull;

        let stateClasses = "";
        if (isWeekend) {
          stateClasses = "bg-neutral-600 text-muted-foreground cursor-not-allowed";
        } else if (isPastDay || isPastTime) {
          stateClasses = "bg-neutral-100 text-muted-foreground cursor-not-allowed";
        } else if (isFull) {
          stateClasses = "bg-muted text-muted-foreground cursor-not-allowed";
        } else {
          stateClasses = "bg-background cursor-pointer hover:bg-accent";
        }

        const title = isWeekend
          ? "Weekend - No booking available"
          : isPastDay || isPastTime
            ? "Past"
            : isFull
              ? "Time full"
              : `Available: ${slot}`;

        // Use styled Tooltip from our UI library for non-clickable cells
        if (!clickable) {
          return (
            <Tooltip key={`${day.fullDate.toDateString()}-${slot}`}>
              <TooltipTrigger asChild>
                <div
                  className={`border-r border-border ${stateClasses}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{title}</div>
              </TooltipContent>
            </Tooltip>
          );
        }

        // Clickable cells: show "Available: {slot}" tooltip too
        return (
          <Tooltip key={`${day.fullDate.toDateString()}-${slot}`}>
            <TooltipTrigger asChild>
              <div
                className={`border-r border-border ${stateClasses}`}
                onClick={() => onSlotClick(day.date, slot)}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">{title}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* บาร์ overlay */}
      <div className="pointer-events-none absolute z-10" style={{
        top: 0, bottom: 0, left:
          DAY_LABEL_WIDTH, right: 0
      }}>
        {bars.map((bar) => {
          const left = bar.startIndex * CELL_WIDTH; // overlay already offset by day label
          const statusStyle = getStatusStyle(bar.status);
          const width = (bar.endIndex - bar.startIndex) * CELL_WIDTH;
          const top = LANE_TOP_OFFSET + bar.lane * BAR_STACK_GAP;
          return (
            <HoverCard
              key={`bar-${bar.bookingId}`}
              open={openBarId === bar.bookingId}
              onOpenChange={(isOpen) => {
                // Sync with Radix hover open state, but keep exclusive open per row
                setOpenBarId((current) => (isOpen ? bar.bookingId : current === bar.bookingId ? null : current));
              }}
            >
              <HoverCardTrigger asChild>
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
                  onMouseEnter={() => setOpenBarId(bar.bookingId)}
                  onMouseLeave={() => {
                    clearLongPressTimer();
                    setOpenBarId((current) => (current === bar.bookingId ? null : current));
                  }}
                  onPointerDown={() => {
                    clearLongPressTimer();
                    // Long-press to open on touch devices
                    longPressTimerRef.current = window.setTimeout(() => {
                      setOpenBarId(bar.bookingId);
                    }, 200);
                  }}
                  onPointerUp={clearLongPressTimer}
                  onPointerCancel={clearLongPressTimer}
                  onPointerLeave={clearLongPressTimer}
                />
              </HoverCardTrigger>
                             <HoverCardContent>
                 <div className="text-xs space-y-2">
                   {/* Owner Information */}
                   <div>
                     <div className="font-semibold text-sm mb-1 text-foreground">Owner</div>
                     <div className="font-medium text-foreground">{bar.name}</div>
                     <div className="text-muted-foreground">{bar.ownerGroup}</div>
                   </div>
                   
                   {/* Meeting Details */}
                   <div>
                     <div className="font-semibold text-sm mb-1 text-foreground">Meeting</div>
                     <div className="text-muted-foreground">{bar.room}</div>
                     {bar.meetingDetail && (
                       <div className="text-muted-foreground/70 text-xs mt-1">{bar.meetingDetail}</div>
                     )}
                   </div>
                   
                   {/* Status & Interpreter */}
                   <div>
                     <div className="font-semibold text-sm mb-1 text-foreground">Status</div>
                     <div className="text-muted-foreground">{bar.status}</div>
                     <div className="text-muted-foreground/70 text-xs mt-1">{bar.interpreterName}</div>
                   </div>
                   
                   {/* Contact Info */}
                   <div>
                     <div className="font-semibold text-sm mb-1 text-foreground">Contact</div>
                     <div className="text-muted-foreground text-xs">{bar.ownerEmail}</div>
                     <div className="text-muted-foreground text-xs">{bar.ownerTel}</div>
                   </div>
                 </div>
               </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(DayRow);