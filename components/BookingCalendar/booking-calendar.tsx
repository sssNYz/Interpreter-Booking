"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookingForm } from "@/components/BookingForm/booking-form";
import BookingRules from "@/components/BookingRules/booking-rules";
import DayRow from "./day-row";

import { generateTimeSlots, getDaysInMonth } from "@/utils/calendar";
import { useBookings } from "@/hooks/use-booking";
import { useSlotDataForBars } from "@/hooks/use-bar-slot-data";
import { ROW_HEIGHT, DAY_LABEL_WIDTH, CELL_WIDTH } from "@/utils/constants";
import { getStatusStyle } from "@/utils/status";
import type { DayInfo } from "@/types/booking";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const BookingCalendar: React.FC = () => {
  // State for current month/year being displayed
  const [currentDate, setCurrentDate] = useState(new Date());

  // Controls whether the booking form modal is open
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Stores which time slot was clicked (day + time) to pass to booking form
  const [selectedSlot, setSelectedSlot] = useState<
    { day: number; slot: string } | undefined
  >(undefined);

  // Ref to the actual Radix ScrollArea viewport (the real scroll container)
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  // Guard to ensure we auto-scroll only once on initial mount
  const hasAutoScrolledRef = useRef(false);

  // Generate time slots for the day (e.g., ["08:00", "08:30", "09:00", ...])
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Get all days in the current month with their date info
  const daysInMonth: DayInfo[] = useMemo(
    () => getDaysInMonth(currentDate),
    [currentDate]
  );

  // Fetch all bookings for the current month
  const { bookings } = useBookings(currentDate);

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
    getScrollElement: () => scrollViewportRef.current, // Scroll container
    estimateSize: () => ROW_HEIGHT, // Height of each day row
    overscan: 2, // Render 2 extra rows above/below for smooth scrolling
  });

  /**
   * Scroll to today's row in the calendar
   * Only works when viewing the current month
   */
  const scrollToToday = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const today = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    if (!isCurrentMonth || daysInMonth.length === 0) return;

    const todayIndex = today.getDate() - 1; // 0-based index
    if (todayIndex < 0 || todayIndex >= daysInMonth.length) return;

    const targetOffset = Math.max(0, todayIndex * ROW_HEIGHT);

    // Use native smooth scrolling for better UX
    viewport.scrollTo({ top: targetOffset, behavior: "smooth" });
  }, [currentDate, daysInMonth.length]);

  /**
   * Navigate to current month and scroll to today
   */
  const goToToday = useCallback(() => {
    const now = new Date();
    const alreadyCurrentMonth =
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear();

    if (!alreadyCurrentMonth) {
      setCurrentDate(now);
      return; // Let useEffect handle the scroll after month change
    }

    // If already on current month, scroll immediately
    requestAnimationFrame(() => scrollToToday());
  }, [currentDate, scrollToToday]);

  // Auto-scroll to today when component mounts
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;

    const now = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear();

    const viewportReady = !!scrollViewportRef.current;
    if (!viewportReady || daysInMonth.length === 0 || !isCurrentMonth) return;

    // Auto-scroll once on initial mount if viewing current month
    requestAnimationFrame(() => {
      scrollToToday();
      hasAutoScrolledRef.current = true;
    });
  }, [scrollToToday, daysInMonth.length]);

  // Handle scroll when "Today" button switches to current month
  useEffect(() => {
    const now = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear();

    const viewportReady = !!scrollViewportRef.current;
    if (!viewportReady || daysInMonth.length === 0 || !isCurrentMonth) return;
    if (hasAutoScrolledRef.current && currentDate.getTime() === now.getTime())
      return; // Skip if just mounted

    // Scroll when month changes to current month (e.g., via Today button)
    requestAnimationFrame(() => scrollToToday());
  }, [currentDate, scrollToToday, daysInMonth.length]);

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
   * Handle clicking on a time slot - opens booking form
   * @param day - Day of month (1-31)
   * @param slot - Time slot string (e.g., "08:00")
   */
  const handleSlotClick = useCallback((day: number, slot: string) => {
    setSelectedSlot({ day, slot });
    setIsFormOpen(true);
  }, []);

  return (
    <div className="max-w-[1500px]">
      {/* Header section with title and month navigation */}
      <div
        className="flex items-center justify-between py-3"
        style={{ maxWidth: "1500px" }}
      >
        {/* Left side: Title with calendar icon */}
        <div className="flex items-center gap-2 justify-center min-w-[370px] rounded-t-4xl bg-neutral-600 px-4 py-2">
          <Calendar className="w-8 h-8 text-primary-foreground" />
          <h1 className="text-[20px] font-medium text-primary-foreground">
            Book Appointment
          </h1>
        </div>

        {/* Right side: Month navigation buttons */}
        <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto max-w-[280px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-2 border border-border rounded-[10px] hover:bg-accent hover:border-primary transition-colors"
            >
              <ChevronLeft className="text-foreground" />
            </button>
            <span className="min-w-[150px] text-center font-medium text-foreground">
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

      {/* Main calendar grid (table) */}
      <div className="border border-border rounded-3xl overflow-hidden bg-background">
        {/* KEEPING ScrollArea + virtualizer viewport TOGETHER */}
        <ScrollArea className="h-[500px]" viewportRef={scrollViewportRef}>
          {/* Fixed header row with time labels */}
          <div
            className="sticky top-0 z-30 bg-secondary border-b border-border"
            style={{
              display: "grid",
              gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${timeSlots.length}, ${CELL_WIDTH}px)`,
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
                bars={barsByDay.get(vr.index) ?? []} // Booking bars for this day
                occupancy={
                  occupancyByDay.get(vr.index) ??
                  Array(timeSlots.length).fill(0)
                } // How many bookings per time slot
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

          {/* Horizontal scrollbar */}
          <ScrollBar orientation="horizontal" className="z-[10]" />
        </ScrollArea>
      </div>

      {/* Row next to the table: left controls + right legend (outside the calendar box) */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <BookingRules />
          <Button
            onClick={goToToday}
            variant="secondary"
            size="sm"
            className="bg-neutral-600 text-white hover:bg-neutral-700 flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Today
          </Button>
        </div>
        <div className="bg-primary flex items-center justify-center gap-6 text-sm min-h-[40px] rounded-br-4xl rounded-bl-4xl px-4 py-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${
                getStatusStyle("approve").bg
              }`}
            />
            <span className="text-primary-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${
                getStatusStyle("waiting").bg
              }`}
            />
            <span className="text-primary-foreground">Waiting</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground ${
                getStatusStyle("cancel").bg
              }`}
            />
            <span className="text-primary-foreground">Cancelled</span>
          </div>
        </div>
      </div>

      {/* Booking form modal - opens when clicking on a time slot */}
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
