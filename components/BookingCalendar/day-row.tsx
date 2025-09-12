"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import type { DayInfo, BarItem } from "@/types/booking";
import {
  MAX_LANES,
  ROW_HEIGHT,
  BAR_HEIGHT,
  LANE_TOP_OFFSET,
  BAR_STACK_GAP,
} from "@/utils/constants";
import { getStatusStyle } from "@/utils/status";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getInterpreterColor } from "@/utils/interpreter-color";

type Props = {
  day: DayInfo;
  currentDate: Date;
  timeSlots: string[];
  bars: BarItem[];
  occupancy: number[];
  isTimeSlotPast: (day: number, slot: string) => boolean;
  onSlotClick: (day: number, slot: string) => void;
  style: React.CSSProperties;
  cellWidth?: number;
  dayLabelWidth?: number;
  isHighlighted: boolean;
  maxLanes?: number; // ← Add this
};

const DayRow: React.FC<Props> = ({
  day,
  // currentDate is not used in this component
  timeSlots,
  bars,
  occupancy,
  isTimeSlotPast,
  onSlotClick,
  style,
  cellWidth = 120,
  dayLabelWidth = 120,
  isHighlighted = false,
  maxLanes = MAX_LANES, // ← Add this
}) => {
  const isWeekendDay = ["Sat", "Sun"].includes(day.dayName);
  const isPastDay = day.isPast;
  const [openBarId, setOpenBarId] = useState<number | null>(null);

  // Visible lanes logic is based on TRUE overlaps from bars (unlimited lanes),
  // not on capped occupancy. This ensures UI always shows all bookings even
  // if interpreter count changes later.
  // Build true overlap per slot by counting bars covering each slot.
  const trueOverlap: number[] = React.useMemo(() => {
    const arr = Array(timeSlots.length).fill(0);
    for (const b of bars) {
      for (
        let i = b.startIndex;
        i < Math.min(b.endIndex, timeSlots.length);
        i++
      ) {
        arr[i] += 1;
      }
    }
    return arr;
  }, [bars, timeSlots.length]);

  // Decide whether to show 3 lanes or switch to "See more" based on true overlaps
  const maxTrueOverlap = trueOverlap.reduce((m, v) => (v > m ? v : m), 0);
  const showThreeLanes = maxTrueOverlap <= 3;
  const visibleBars = bars.filter((b) =>
    showThreeLanes ? b.lane < 3 : b.lane < 2
  );
  const hiddenBars = showThreeLanes ? [] : bars.filter((b) => b.lane >= 2);

  // Build hidden count per slot from TRUE overlap when in overflow mode (>3)
  const hiddenCount = showThreeLanes
    ? trueOverlap.map(() => 0)
    : trueOverlap.map((cnt) => Math.max(0, cnt - 2));

  type OverflowSeg = {
    startIndex: number;
    endIndex: number;
    maxHidden: number;
  };
  const overflowSegments: OverflowSeg[] = [];
  if (!showThreeLanes) {
    let i = 0;
    while (i < hiddenCount.length) {
      if (hiddenCount[i] > 0) {
        const start = i;
        let maxHidden = hiddenCount[i];
        i++;
        while (i < hiddenCount.length && hiddenCount[i] > 0) {
          if (hiddenCount[i] > maxHidden) maxHidden = hiddenCount[i];
          i++;
        }
        const end = i; // exclusive
        overflowSegments.push({ startIndex: start, endIndex: end, maxHidden });
      } else {
        i++;
      }
    }
  }

  return (
    <div
      className="grid relative p-0 m-0 box-border"
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `${dayLabelWidth}px repeat(${timeSlots.length}, ${cellWidth}px)`,
        height: `${ROW_HEIGHT}px`,
      }}
    >
      {/* ✅ คอลัมน์ซ้าย: ป้ายวัน (ต้องมีเสมอ) */}
      <div
        className={`sticky left-0 z-20 bg-secondary border-r border-b border-border text-center text-xs flex
  flex-col justify-center text-secondary-foreground ${isHighlighted ? "" : ""}`}
      >
        <span className="font-semibold">{day.dayName}</span>
        <span>{day.date}</span>
      </div>

      {/* ✅ เส้นแบ่งล่าง (absolute; ไม่ควรมี children) */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border" />

      {/* พื้นหลังกริด (คอลัมน์ของ timeSlots จะเริ่มหลังคอลัมน์ป้ายวันโดยอัตโนมัติ) */}
      {timeSlots.map((slot, index) => {
        const isFull = occupancy[index] >= maxLanes;
        const isPastTime = isTimeSlotPast(day.date, slot);

        const clickable = !isWeekendDay && !isPastDay && !isPastTime && !isFull;

        let stateClasses = "";
        if (isWeekendDay) {
          stateClasses =
            "bg-neutral-700 text-muted-foreground cursor-not-allowed";
        } else if (isPastDay || isPastTime) {
          stateClasses =
            "bg-neutral-100 text-muted-foreground cursor-not-allowed";
        } else if (isFull) {
          stateClasses = "bg-muted text-muted-foreground cursor-not-allowed";
        } else {
          stateClasses = "bg-background cursor-pointer hover:bg-accent";
        }

        const title = isWeekendDay
          ? "Weekend - No booking available"
          : isPastDay || isPastTime
          ? "Past"
          : isFull
          ? "Time full"
          : `Available: ${slot}`;

        if (!clickable) {
          return (
            <div
              key={`${day.fullDate.toDateString()}-${slot}`}
              className={`border-r border-border ${stateClasses}`}
              title={title}
            />
          );
        }

        return (
          <div
            key={`${day.fullDate.toDateString()}-${slot}`}
            className={`border-r border-border ${stateClasses}`}
            title={title}
            onClick={() => onSlotClick(day.date, slot)}
          />
        );
      })}

      {/* บาร์ overlay */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          top: 0,
          bottom: 0,
          left: dayLabelWidth,
          right: 0,
        }}
      >
        {/* Visible bars */}
        {visibleBars.map((bar) => {
          const left = bar.startIndex * cellWidth; // overlay already offset by day label
          const statusStyle = getStatusStyle(bar.status);
          const width = (bar.endIndex - bar.startIndex) * cellWidth;
          const top = LANE_TOP_OFFSET + bar.lane * (BAR_HEIGHT + BAR_STACK_GAP);
          const interpreterColor = getInterpreterColor(
            bar.interpreterId,
            bar.interpreterName
          );
          const barClassName = interpreterColor
            ? "pointer-events-auto rounded-sm border"
            : `pointer-events-auto rounded-sm border ${statusStyle.text} ${statusStyle.bg}`;
          const statusLabel =
            bar.status === "approve"
              ? "Approved"
              : bar.status === "waiting"
              ? "Waiting"
              : bar.status === "cancel"
              ? "Cancelled"
              : bar.status;
          return (
            <Popover
              key={`bar-${bar.bookingId}`}
              open={openBarId === bar.bookingId}
              onOpenChange={(isOpen) => {
                setOpenBarId((current) =>
                  isOpen
                    ? bar.bookingId
                    : current === bar.bookingId
                    ? null
                    : current
                );
              }}
            >
              <PopoverTrigger asChild>
                <motion.div
                  className={barClassName}
                  style={{
                    position: "absolute",
                    left,
                    width,
                    top,
                    height: BAR_HEIGHT,
                    borderRadius: 10,
                    cursor: "pointer",
                    backgroundColor: interpreterColor?.bg,
                    borderColor: interpreterColor?.border,
                  }}
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 520,
                    damping: 30,
                    mass: 0.7,
                  }}
                />
              </PopoverTrigger>
              <PopoverContent asChild>
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 460,
                    damping: 28,
                    mass: 0.6,
                  }}
                  className="w-80 rounded-lg border bg-white shadow-xl ring-1 ring-gray-200 p-0 text-foreground overflow-hidden"
                >
                  {/* Header */}
                  <div className="text-center">
                    <div className="text-neutral-700 text-xl mt-1">
                      {day.fullDate.toLocaleString("en-US", { month: "short" })}{" "}
                      {day.date} • {timeSlots[bar.startIndex]} -{" "}
                      {timeSlots[bar.endIndex - 1]}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-1 space-y-3">
                    {/* Booking By */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-neutral-600 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-500 text-sm mb-1">
                          Booking By
                        </div>
                        <div className="font-medium text-neutral-700">
                          {bar.name}
                        </div>
                        <div className="text-neutral-600 text-sm capitalize">
                          {bar.ownerGroup} Department
                        </div>
                      </div>
                    </div>

                    {/* Meeting Room */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-neutral-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-500 text-sm mb-1">
                          Meeting Room
                        </div>
                        <div className="text-neutral-700 font-medium">
                          {bar.room}
                        </div>
                      </div>
                    </div>

                    {/* Interpreter */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-neutral-400 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-500 text-sm mb-1">
                          Interpreter
                        </div>
                        <div
                          className={`font-medium ${
                            bar.interpreterName 
                          }`}
                        >
                          {bar.interpreterName || "No assignment yet"}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-neutral-400 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-500 text-sm mb-1">
                          Status
                        </div>
                        <div className="flex items-center gap-2 text-neutral-700">
                          <span className="font-medium">{statusLabel}</span>
                          <div
                             className={`h-2 w-full rounded-sm mt-1 ${statusStyle.bg}`}
                             ></div>
                        </div>
                        
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="border-t pt-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-neutral-300 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-semibold text-neutral-500 text-sm mb-2">
                            Contact Information
                          </div>
                          <div className="space-y-1">
                            <div className="text-neutral-700 text-sm flex items-center">
                              <span className="font-medium w-12">Email:</span>
                              <span className="text-neutral-700">
                                {bar.ownerEmail}
                              </span>
                            </div>
                            <div className="text-neutral-700 text-sm flex items-center">
                              <span className="font-medium w-12">Phone:</span>
                              <span>{bar.ownerTel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </PopoverContent>
            </Popover>
          );
        })}

        {/* Overflow lane (lane 2) as "See more" segments when there are >3 overlaps */}
        {!showThreeLanes &&
          overflowSegments.map((seg, idx) => {
            const left = seg.startIndex * cellWidth;
            const width = (seg.endIndex - seg.startIndex) * cellWidth;
            const top = LANE_TOP_OFFSET + 2 * (BAR_HEIGHT + BAR_STACK_GAP); // lane index 2 (third row)
            const overflowBars = hiddenBars.filter(
              (b) => b.startIndex < seg.endIndex && b.endIndex > seg.startIndex
            );
            const label = `See more (+${seg.maxHidden})`;
            return (
              <Popover key={`overflow-${idx}`}>
                <PopoverTrigger asChild>
                   <motion.div
                     className="pointer-events-auto rounded-sm border border-neutral-600 bg-neutral-50 text-foreground/80"
                     style={{
                       position: "absolute",
                       left,
                       width,
                       top,
                       height: BAR_HEIGHT,
                       borderRadius: 10,
                       cursor: "pointer",
                       backgroundImage: `radial-gradient(#f5f5f5 0.5px, transparent 0.5px)`,
                       backgroundSize: "4px 4px",
                       opacity: 0.6,
                     }}
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{
                      type: "spring",
                      stiffness: 520,
                      damping: 30,
                      mass: 0.7,
                    }}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center text-neutral-600"
                      style={{ fontSize: 10 }}
                    >
                      {label}
                    </div>
                  </motion.div>
                </PopoverTrigger>
                <PopoverContent asChild>
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{
                      type: "spring",
                      stiffness: 460,
                      damping: 28,
                      mass: 0.6,
                    }}
                    className="w-96 rounded-lg border bg-white shadow-xl ring-1 ring-gray-200 p-4 text-foreground text-sm"
                  >
                    <div className="font-semibold text-neutral-700 mb-3">
                      Hidden bookings ({overflowBars.length})
                    </div>
                    <div className="space-y-3 max-h-80 overflow-auto pr-1">
                      {overflowBars.map((b) => {
                        const timeStart = timeSlots[b.startIndex];
                        const timeEnd =
                          b.endIndex >= timeSlots.length
                            ? timeSlots[timeSlots.length - 1]
                            : timeSlots[b.endIndex];
                        return (
                          <div
                            key={`hidden-${b.bookingId}`}
                            className="border rounded-md p-3 bg-gray-50"
                          >
                            <div className="space-y-2 text-sm">
                              {/* Line 1: Room + Date time - RIGHT ALIGNED */}
                              <div className="flex justify-between items-center text-neutral-700">
                                <span className="text-sm font-medium">
                                  Room: {b.room}
                                </span>
                                <span className="text-base font-semibold">
                                  {day.fullDate.toLocaleString("en-US", {
                                    month: "short",
                                  })}{" "}
                                  {day.date} • {timeStart} - {timeEnd}
                                </span>
                              </div>

                              {/* Line 2: Name - LEFT ALIGNED */}
                              <div className="text-left">
                                <span className="font-semibold text-neutral-500">
                                  Name:{" "}
                                </span>
                                <span className="font-medium text-neutral-700">
                                  {b.name}
                                </span>
                              </div>

                              {/* Line 3: Interpreter - LEFT ALIGNED */}
                              <div className="text-left">
                                <span className="font-semibold text-neutral-500">
                                  Interpreter:{" "}
                                </span>
                                <span
                                  className={`font-medium ${
                                    b.interpreterName
                                  }`}
                                >
                                  {b.interpreterName || "No assignment"}
                                </span>
                              </div>

                              {/* Status */}
                              <div className="text-left">
                                <span className="font-semibold text-neutral-500">
                                  Status:{" "}
                                </span>
                                <span className="font-medium text-neutral-700">
                                  {b.status === "approve"
                                    ? "Approved"
                                    : b.status === "waiting"
                                    ? "Waiting"
                                    : b.status === "cancel"
                                    ? "Cancelled"
                                    : b.status}
                                </span>
                                <div
                                  className={`h-2 w-full rounded-sm mt-1 ${getStatusStyle(b.status).bg}`}
                                ></div>
                              </div>

                              {/* Contact info (optional) */}
                              <div className="border-t pt-2 mt-2 text-center">
                                <div className="text-neutral-600 text-xs">
                                  {b.ownerEmail} • {b.ownerTel}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </PopoverContent>
              </Popover>
            );
          })}
      </div>
      {/* Neon glow when click TODAY */}
      {isHighlighted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Neon wave glow background */}
          <div className="absolute inset-0 rounded-lg neon-glow" />
          {/* Ripple border glow */}
          <div className="absolute inset-0 rounded-lg neon-border" />
          <style jsx>{`
            @keyframes neonGlowKeyframes {
              0% {
                opacity: 0;
                box-shadow: 0 0 0 rgba(63, 63, 70, 0);
              }
              40% {
                opacity: 1;
                box-shadow: 0 0 22px rgba(63, 63, 70, 0.65),
                  0 0 36px rgba(63, 63, 70, 0.35);
              }
              100% {
                opacity: 0;
                box-shadow: 0 0 0 rgba(63, 63, 70, 0);
              }
            }
            @keyframes neonBorderKeyframes {
              0% {
                opacity: 0.9;
                transform: scale(0.985);
              }
              55% {
                opacity: 1;
                transform: scale(1.005);
              }
              100% {
                opacity: 0;
                transform: scale(1.035);
              }
            }
            .neon-glow {
              background: radial-gradient(
                120% 100% at 50% 50%,
                rgba(63, 63, 70, 0.18) 0%,
                rgba(63, 63, 70, 0.12) 35%,
                rgba(63, 63, 70, 0.06) 65%,
                rgba(63, 63, 70, 0) 100%
              );
              animation: neonGlowKeyframes 0.5s ease-out 1 forwards;
            }
            .neon-border {
              border: 2px solid #3f3f46; /* zinc-700 */
              box-shadow: 0 0 22px rgba(63, 63, 70, 0.65),
                0 0 34px rgba(63, 63, 70, 0.35);
              animation: neonBorderKeyframes 0.5s ease-out 1 forwards;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default React.memo(DayRow);
