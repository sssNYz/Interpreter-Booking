"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Calendar, ChevronLeft, ChevronRight, Clock, RefreshCw, Disc } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookingForm } from "@/components/BookingForm/booking-form";

import DayRow from "./day-row";

import { generateTimeSlots, getDaysInMonth } from "@/utils/calendar";
import { useBookings } from "@/hooks/use-booking";
import { useSlotDataForBars } from "@/hooks/use-bar-slot-data";
import { ROW_HEIGHT, BAR_HEIGHT, LANE_TOP_OFFSET, BAR_STACK_GAP } from "@/utils/constants";
import { getStatusStyle } from "@/utils/status";
import type { DayInfo } from "@/types/booking";
import { Button } from "@/components/ui/button";
import BookingRules from "@/components/BookingRules/booking-rules";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobile } from "@/hooks/use-mobile";

const BookingCalendar: React.FC = () => {
  // State for current month/year being displayed
  const [currentDate, setCurrentDate] = useState(new Date());
  // Debounced date for fetching to avoid multiple API calls during rapid navigation
  const [debouncedDate, setDebouncedDate] = useState(currentDate);

  
  // Controls whether the booking form modal is open
  const [isFormOpen, setIsFormOpen] = useState(false);
  

  // Stores which time slot was clicked (day + time) to pass to booking form
  const [selectedSlot, setSelectedSlot] = useState<
    { day: number; slot: string } | undefined
  >(undefined);

  // Get responsive sizes
  const { getResponsiveSizes } = useMobile();
  const { cellWidth, dayLabelWidth } = getResponsiveSizes();

  // IMPORTANT: keep ScrollArea viewport ref together with virtualizer
  // This ref is used by the virtualizer to know the scrollable container
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  // Generate time slots for the day (e.g., ["08:00", "08:30", "09:00", ...])
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  

  // Get all days in the current month with their date info
  const daysInMonth: DayInfo[] = useMemo(
    () => getDaysInMonth(currentDate),
    [currentDate]
  );

  // Debounce currentDate → debouncedDate by 1s
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedDate(currentDate), 1000);
    return () => window.clearTimeout(id);
  }, [currentDate]);

  // Fetch all bookings for the debounced month
  const { bookings, refetch, loading } = useBookings(debouncedDate);

  /**
   * Check if a time slot is in the past (for today only)
   * Used to disable past time slots from being clicked
   */
  const isTimeSlotPast = useCallback(
    (day: number, timeSlot: string) => {
      const now = new Date();
      const [slotHour, slotMinute] = timeSlot.split(":").map(Number);

      // Only check past slots for today
      const isToday =
        day === now.getDate() &&
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getFullYear() === now.getFullYear();

      if (!isToday) return false;

      // Calculate when this 30-minute slot ends
      let slotEndHour = slotHour;
      let slotEndMinute = slotMinute + 30;
      if (slotEndMinute >= 60) {
        slotEndHour += 1;
        slotEndMinute -= 60;
      }

      // Check if current time is past the slot end time
      if (now.getHours() > slotEndHour) return true;
      if (now.getHours() === slotEndHour && now.getMinutes() >= slotEndMinute)
        return true;
      return false;
    },
    [currentDate]
  );

  // Process booking data to create visual bars and occupancy data
  // barsByDay: Map of day index → array of booking bars for that day
  // occupancyByDay: Map of day index → array showing how many bookings per time slot
  const { barsByDay, occupancyByDay } = useSlotDataForBars({
    bookings,
    daysInMonth,
    timeSlots,
  });

  // Virtualization setup for rendering only visible day rows
  // This improves performance when there are many days
  const rowVirtualizer = useVirtualizer({
    count: daysInMonth.length, // Total number of days to render

    getScrollElement: () => scrollAreaViewportRef.current, // Scroll container

    estimateSize: () => ROW_HEIGHT, // Height of each day row
    overscan: 1, // Render fewer extra rows for better performance
  });

  /**

   * Navigate to previous or next month
   * @param direction -1 for previous month, +1 for next month
   */
  const shiftMonth = useCallback((direction: number) => {
    setCurrentDate((current) => {
      const d = new Date(current);
      d.setMonth(current.getMonth() + direction);
      return d;
    });
  }, []);

  /**
   * Jump to today's date and scroll the list to today's row
   */
  // Track whether we've already auto-scrolled for a given month to avoid jumping on data refreshes
  const autoScrolledMonthRef = useRef<string | null>(null);
  const forceScrollToTodayRef = useRef<boolean>(false);

  const goToToday = useCallback(() => {
    // Force a scroll-to-today on next layout cycle
    forceScrollToTodayRef.current = true;
    setCurrentDate(new Date());
  }, []);

  // When viewing the current month, scroll to today's row
  useEffect(() => {
    const today = new Date();
    const isCurrentMonth =
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth();
    if (!isCurrentMonth) return;
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const shouldForce = forceScrollToTodayRef.current;
    const notYetScrolledThisMonth = autoScrolledMonthRef.current !== monthKey;
    if (shouldForce || notYetScrolledThisMonth) {
      rowVirtualizer.scrollToIndex(Math.max(0, today.getDate() - 1), { align: "center" });
      autoScrolledMonthRef.current = monthKey;
      forceScrollToTodayRef.current = false;
    }
  }, [currentDate, rowVirtualizer]);

  // Ensure scroll happens after loading completes (since the grid isn't mounted during skeleton)
  useEffect(() => {
    if (loading) return;
    const today = new Date();
    const isCurrentMonth =
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth();
    if (!isCurrentMonth) return;
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const shouldForce = forceScrollToTodayRef.current;
    const notYetScrolledThisMonth = autoScrolledMonthRef.current !== monthKey;
    if (shouldForce || notYetScrolledThisMonth) {
      rowVirtualizer.scrollToIndex(Math.max(0, today.getDate() - 1), { align: "center" });
      autoScrolledMonthRef.current = monthKey;
      forceScrollToTodayRef.current = false;
    }
  }, [loading, currentDate, rowVirtualizer]);

  /**
   * Handle clicking on a time slot - opens booking form
   * @param day - Day of month (1-31)
   * @param slot - Time slot string (e.g., "08:00")
   */
  const handleSlotClick = useCallback((day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  }, []);

  // Light auto-refresh every ~60s while tab is visible
  useEffect(() => {
    let intervalId: number | null = null;

    const startInterval = () => {
      // add small jitter up to +5s to avoid all clients hitting at the exact same time
      const intervalMs = 60000 + Math.floor(Math.random() * 5000);
      intervalId = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          refetch();
        }
      }, intervalMs);
    };

    const clear = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // When user comes back, refresh now to catch up
        refetch();
      }
    };

    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clear();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refetch, currentDate]);

  // Listen for booking updates from the form and refetch
  useEffect(() => {
    const onUpdated = () => {
      refetch();
    };
    window.addEventListener("booking:updated", onUpdated as EventListener);
    return () => window.removeEventListener("booking:updated", onUpdated as EventListener);
  }, [refetch]);

  return (
    <div className="w-full">
      {/* Header section with title and month navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 gap-4">
        {/* Left side: Title with calendar icon */}
        <div className="flex items-center gap-2 justify-center min-w-[280px] sm:min-w-[370px] rounded-t-4xl bg-neutral-700 px-4 py-2">
          <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
          <h1 className="text-[16px] sm:text-[20px] font-medium text-primary-foreground">Book Appointment</h1>
        </div>
        
        {/* Right side: Month navigation buttons */}
        <div className="flex items-center justify-center max-w-[280px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-2 border border-border rounded-[10px] hover:bg-accent hover:border-primary transition-colors"
            >
              <ChevronLeft className="text-foreground" />
            </button>
            <span className="min-w-[120px] sm:min-w-[150px] text-center font-medium text-foreground text-sm sm:text-base">
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-2 border border-border rounded-[10px] hover:bg-accent hover:border-primary transition-colors"
            >
              <ChevronRight className="text-foreground" />
            </button>
          </div>
        </div>
      </div>


      {/* Main calendar grid */}
      <div className="border border-border rounded-3xl overflow-hidden bg-background">
        {/* KEEPING ScrollArea + virtualizer viewport TOGETHER */}
        {loading ? (
          <div className="h-[calc(60vh-260px)] min-h-[70vh] overflow-x-auto">
            {/* Header skeleton (time labels row) */}
            <div
              className="sticky top-0 z-30 bg-secondary border-b border-border min-w-[800px]"
              style={{
                display: "grid",
                gridTemplateColumns: `${dayLabelWidth}px repeat(${timeSlots.length}, ${cellWidth}px)`,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              {/* Left header cell (clock) */}
              <div className="sticky left-0 z-30 flex items-center justify-center border-r border-border bg-secondary">
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              {/* Time slot header cells */}
              {timeSlots.map((slot) => (
                <div
                  key={`skh-${slot}`}
                  className="border-r border-border flex items-center justify-center bg-secondary"
                >
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>

            {/* Body skeleton rows */}
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <div
                key={`skr-${rowIdx}`}
                className="border-b border-border min-w-[800px]"
                style={{
                  display: "grid",
                  gridTemplateColumns: `${dayLabelWidth}px repeat(${timeSlots.length}, ${cellWidth}px)`,
                  height: `${ROW_HEIGHT}px`,
                }}
              >
                {/* Day label cell */}
                <div className="sticky left-0 z-10 bg-background border-r border-border flex items-center justify-center">
                  <Skeleton className="h-4 w-10" />
                </div>
                {/* Time slot cells */}
                {timeSlots.map((slot, colIdx) => (
                  <div
                    key={`skc-${rowIdx}-${colIdx}`}
                    className="border-r border-border flex items-center justify-center"
                  >
                    <Skeleton className="h-2 w-10" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-260px)] min-h-[70vh]" viewportRef={scrollAreaViewportRef}>
            {/* Fixed header row with time labels */}
            <div
              className="sticky top-0 z-30 bg-secondary border-b border-border min-w-[800px]"
              style={{
                display: "grid",
                gridTemplateColumns: `${dayLabelWidth}px repeat(${timeSlots.length}, ${cellWidth}px)`,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              {/* Left column: Clock icon */}
              <div className="sticky left-0 z-30 flex items-center justify-center border-r border-border bg-secondary">
                <Clock className="w-4 h-4 text-secondary-foreground" />
              </div>

              {/* Time slot headers (08:00, 08:30, 09:00, etc.) */}
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="border-r border-border text-center text-sm font-medium flex items-center justify-center bg-secondary text-secondary-foreground"
                >
                  {slot}
                </div>
              ))}
            </div>

            {/* Virtualized day rows - only renders visible rows for performance */}
            <div
              ref={scrollAreaViewportRef}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {/* Render only the day rows that are currently visible */}
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
                  cellWidth={cellWidth}
                  dayLabelWidth={dayLabelWidth}
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

            {/* Horizontal scrollbar */}
            <ScrollBar orientation="horizontal" className="z-[10]"/>
          </ScrollArea>
        )}
      </div>


      {/* Bottom controls and legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-3 gap-3">
        {/* Left: controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={goToToday}
            className="bg-neutral-700 text-white rounded-full hover:bg-black/90 w-24 sm:w-28 h-10 text-sm sm:text-base"
          >
            <Disc className="w-8 h-8 sm:w-10 sm:h-10" />
            Today
          </Button>
          <Button
            onClick={() => refetch()}
            className="bg-neutral-700 text-white rounded-full hover:bg-black/90 h-10 w-24 sm:w-28 text-sm sm:text-base"
            disabled={loading}
          >
            <RefreshCw className={`w-8 h-8 sm:w-10 sm:h-10 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <BookingRules />
        </div>

        {/* Right: legend */}
        <div className="bg-neutral-700 flex items-center justify-center gap-3 sm:gap-6 text-sm max-w-[280px] sm:max-w-[320px] min-h-[40px] rounded-br-4xl rounded-bl-4xl px-3 sm:px-4 py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${getStatusStyle("approve").bg}`} />
            <span className="text-primary-foreground text-xs sm:text-sm">Approved</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${getStatusStyle("waiting").bg}`} />
            <span className="text-primary-foreground text-xs sm:text-sm">Waiting</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${getStatusStyle("cancel").bg}`} />
            <span className="text-primary-foreground text-xs sm:text-sm">Cancelled</span>
          </div>
        </div>
      </div>

      {/* Booking form modal - opens when clicking on a time slot */}
      <BookingForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedSlot={selectedSlot}
        daysInMonth={daysInMonth}
        dayOccupancy={
          selectedSlot
            ? occupancyByDay.get(selectedSlot.day - 1) ?? Array(timeSlots.length).fill(0)
            : undefined
        }
      />

      
    </div>
  );
};

export default BookingCalendar;

