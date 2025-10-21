"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Disc,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookingForm } from "@/components/BookingForm/booking-form";

import DayRow from "./day-row";

import { generateTimeSlots, getDaysInMonth } from "@/utils/calendar";
import { useBookings } from "@/hooks/use-booking";
import { useSlotDataForBars } from "@/hooks/use-bar-slot-data";


import { ROW_HEIGHT } from "@/utils/constants";

import type { DayInfo } from "@/types/booking";
import { Button } from "@/components/ui/button";
import BookingRules from "@/components/BookingRules/booking-rules";
import LoadingThreeDotsJumping from "@/components/ui/loading-three-dots";
import { useMobile } from "@/hooks/use-mobile";
import { getInterpreterColor } from "@/utils/interpreter-color";
import { useSearchParams } from "next/navigation";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const BookingCalendar: React.FC = () => {
  // Helper function to render text with highlights
  const renderTextWithHighlights = (text: string) => {
    const parts = text.split(/(<highlight>.*?<\/highlight>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<highlight>') && part.endsWith('</highlight>')) {
        const content = part.replace(/<\/?highlight>/g, '');
        return (
          <span key={index} className="font-bold">
            {content}
          </span>
        );
      }
      return part;
    });
  };

  // State for current month/year being displayed
  const [currentDate, setCurrentDate] = useState(new Date());
  // Policy: how many months ahead allowed (current + N months)
  const [forwardMonthLimit, setForwardMonthLimit] = useState<number>(1);
  // Debounced date for fetching to avoid multiple API calls during rapid navigation
  const [debouncedDate, setDebouncedDate] = useState(currentDate);

  // Controls whether the booking form modal is open
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Tutorial modal state (first-time open via localStorage)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialApi, setTutorialApi] = useState<CarouselApi | null>(null);
  const [tutorialIndex, setTutorialIndex] = useState(0);

  const tutorialSlides = useMemo(
    () => [
      {
        title: "Start a booking : Click a calendar cell",
        text: "If you cannot click it: <highlight>Time Full</highlight>: no interpreter at that time. <highlight>Past time</highlight>: this time already passed. <highlight>Forward limit</highlight>: you can book up to N months ahead. Look at the <highlight>Rules</highlight> to know how far you can book ahead.",
        image: "/tutorial/1.gif",
      },
      {
        title: "Create the booking",
        text: "Fill in all details and click '<highlight>Create booking</highlight>.' If you see an error: <highlight>Room conflict</highlight>: someone uses this room at that time. Choose another time or room <highlight>DR/chairman busy</highlight>: the chairman is busy at this time. Choose another time",
        image: "/tutorial/2.gif",
      },
      {
        title: "See details",
        text: "Click the colored bar to see the booking details.",
        image: "/tutorial/3.gif",
      },
    ],
    []
  );

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

  // In booking-calendar.tsx
const [interpreterCount, setInterpreterCount] = useState(2); // default

// State for interpreter legend
const [activeInterpreters, setActiveInterpreters] = useState<Array<{id: string, name: string}>>([]);
const [interpreterColors, setInterpreterColors] = useState<Record<string, string>>({});

useEffect(() => {
  fetch('/api/employees/get-interpreter-number')
    .then(res => res.json())
    .then(data => setInterpreterCount(data.count));
}, []);

// Open tutorial on first visit (no DB)
useEffect(() => {
  if (typeof window === 'undefined') return;
  try {
    const seen = window.localStorage.getItem('booking_tutorial_seen');
    if (seen !== '1') setIsTutorialOpen(true);
  } catch {}
}, []);

const closeTutorial = useCallback(() => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('booking_tutorial_seen', '1');
    }
  } catch {}
  setIsTutorialOpen(false);
}, []);

// Sync active slide index to show matching image
useEffect(() => {
  if (!tutorialApi) return;
  const onSelect = () => {
    try {
      setTutorialIndex(tutorialApi.selectedScrollSnap() ?? 0);
    } catch {
      setTutorialIndex(0);
    }
  };
  onSelect();
  tutorialApi.on('select', onSelect);
  tutorialApi.on('reInit', onSelect);
  return () => {
    tutorialApi.off('select', onSelect);
  };
}, [tutorialApi]);

// Fetch interpreters and colors for legend
useEffect(() => {
  const fetchInterpretersAndColors = async () => {
    try {
      const [interpretersRes, colorsRes] = await Promise.all([
        fetch('/api/admin/interpreters'),
        fetch('/api/admin/interpreter-colors')
      ]);
      
      if (interpretersRes.ok && colorsRes.ok) {
        const interpretersData = await interpretersRes.json();
        const colorsData = await colorsRes.json();
        
        setActiveInterpreters(interpretersData.data);
        setInterpreterColors(colorsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch interpreters:', error);
    }
  };
  
  fetchInterpretersAndColors();
}, []);

// Periodically refresh interpreter colors to reflect admin changes without reload
useEffect(() => {
  let id: number | null = null;
  const start = () => {
    id = window.setInterval(async () => {
      try {
        const res = await fetch('/api/admin/interpreter-colors', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setInterpreterColors(json.data);
        }
      } catch {}
    }, 30000);
  };
  start();
  return () => {
    if (id !== null) window.clearInterval(id);
  };
}, []);

  // Admin vision toggle removed: rely on API defaults per role/environment

  // Debounce currentDate → debouncedDate by 1s
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedDate(currentDate), 1000);
    return () => window.clearTimeout(id);
  }, [currentDate]);

  // Fetch forward month limit policy once on load
  useEffect(() => {
    fetch('/api/policy/forward-limit')
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((json) => {
        const n = Number(json?.data?.forwardMonthLimit);
        if (Number.isFinite(n) && n >= 0) setForwardMonthLimit(n);
      })
      .catch(() => { /* keep default */ });
  }, []);

  // Fetch all bookings for the debounced month (use API role-based defaults)
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
  // barsByDay: Map of day index → array of booking bars for that day example output  : {0: [BarItem, BarItem, BarItem], 1: [BarItem, BarItem, BarItem], 2: [BarItem, BarItem, BarItem]}
  // occupancyByDay: Map of day index → array showing how many bookings per time slot example output  : {0: [1, 2, 3], 1: [1, 2, 3], 2: [1, 2, 3]}
  const { barsByDay, occupancyByDay } = useSlotDataForBars({
    bookings,
    daysInMonth,
    timeSlots,
    maxLanes: interpreterCount,
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
  const [highlightToday, setHighlightToday] = useState(false);
  const highlightTimerRef = useRef<number | null>(null);
  // Add this ref near the other refs
  const horizontalScrollRef = useRef<number>(0);
  const userScrollRef = useRef<number>(0);
  // Deep-link target management
  const searchParams = useSearchParams();
  const targetDateRef = useRef<Date | null>(null);
  const targetSlotIndexRef = useRef<number | null>(null);
  const hasAppliedDeepLinkRef = useRef<boolean>(false);
  // Deep-link highlight target
  const [highlightBookingId, setHighlightBookingId] = useState<number | null>(null);
  const [isBookingHighlightActive, setIsBookingHighlightActive] = useState(false);
  const bookingHighlightTimerRef = useRef<number | null>(null);
  const [autoOpenBookingId, setAutoOpenBookingId] = useState<number | null>(null);

// Track horizontal scroll position when user scrolls manually
useEffect(() => {
  if (!scrollAreaViewportRef.current) return;
  
  const handleScroll = () => {
    userScrollRef.current = scrollAreaViewportRef.current!.scrollLeft;
  };

  const scrollElement = scrollAreaViewportRef.current;
  scrollElement.addEventListener('scroll', handleScroll);
  
  return () => {
    scrollElement.removeEventListener('scroll', handleScroll);
  };
}, [loading]); // Re-run when loading changes

// Read deep-link params once and set up target jump
useEffect(() => {
  const dateStr = searchParams?.get("date"); // YYYY-MM-DD
  const timeStr = searchParams?.get("time"); // HH:MM
  const bookingIdStr = searchParams?.get("bookingId");
  // Set highlight target if provided
  if (bookingIdStr) {
    const idNum = Number(bookingIdStr);
    setHighlightBookingId(Number.isFinite(idNum) ? idNum : null);
  } else {
    setHighlightBookingId(null);
  }
  if (!dateStr) return;
  const parsed = new Date(dateStr + "T00:00:00");
  if (isNaN(parsed.getTime())) return;
  targetDateRef.current = parsed;
  // Move calendar to that month immediately
  setCurrentDate(new Date(parsed));

  if (timeStr) {
    const [h, m] = timeStr.split(":").map((x) => Number(x));
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const slotIndex = (h - 8) * 2 + Math.floor(m / 30);
      targetSlotIndexRef.current = Math.max(0, slotIndex);
    }
  }
}, [searchParams]);

  const goToToday = useCallback(() => {
  forceScrollToTodayRef.current = true;
  // Clear any existing highlight timer before starting a new blink
  if (highlightTimerRef.current !== null) {
    window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
  }
  setHighlightToday(true);
  setCurrentDate(new Date());

  // Scroll to current time horizontally
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  

  const slotIndex = (currentHour - 8) * 2 + Math.floor(currentMinute / 30);
  const scrollLeft = Math.max(0, slotIndex * cellWidth);

  // Store the scroll position and update user scroll
  horizontalScrollRef.current = scrollLeft;
  userScrollRef.current = scrollLeft; // Update user scroll when using TODAY

  // Scroll horizontally
  if (scrollAreaViewportRef.current) {
    scrollAreaViewportRef.current.scrollLeft = scrollLeft;
  }

  // Short, crisp blink that completes before data refresh debounce
  highlightTimerRef.current = window.setTimeout(() => {
    setHighlightToday(false);
    highlightTimerRef.current = null;
  }, 500);
}, [cellWidth]);

  // Cleanup on unmount to avoid dangling timers
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
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
      rowVirtualizer.scrollToIndex(Math.max(0, today.getDate() - 1), {
        align: "center",
      });
      autoScrolledMonthRef.current = monthKey;
      forceScrollToTodayRef.current = false;
    }
  }, [currentDate, rowVirtualizer]);
  
  // Add this effect after the existing effects
// Replace the existing restore effect (lines 203-210) with this:
// Replace the existing restore effect (lines 203-210) with this:
useEffect(() => {
  if (loading || !scrollAreaViewportRef.current) return;
  
  // Restore horizontal scroll position after data loads
  // Always use user's scroll position to preserve where they were
  const scrollPosition = userScrollRef.current;
  
  if (scrollPosition >= 0) {
    scrollAreaViewportRef.current.scrollLeft = scrollPosition;
  }
}, [loading]);

  // After data loads or month changes, apply deep-link jump once
  useEffect(() => {
    if (loading) return;
    if (hasAppliedDeepLinkRef.current) return;
    if (!targetDateRef.current) return;

    const target = targetDateRef.current;
    if (
      target.getFullYear() !== currentDate.getFullYear() ||
      target.getMonth() !== currentDate.getMonth()
    ) {
      // Wait until month matches (debounce may delay data fetch)
      return;
    }

    // Find day index and scroll
    const dayIdx = daysInMonth.findIndex(
      (d) => d.fullDate.getDate() === target.getDate()
    );
    if (dayIdx >= 0) {
      rowVirtualizer.scrollToIndex(Math.max(0, dayIdx), { align: "center" });
    }

    // Horizontal scroll to slot if provided
    if (targetSlotIndexRef.current !== null && scrollAreaViewportRef.current) {
      const scrollLeft = Math.max(0, targetSlotIndexRef.current * cellWidth);
      scrollAreaViewportRef.current.scrollLeft = scrollLeft;
      userScrollRef.current = scrollLeft;
    }

    // Brief highlight similar to TODAY and pulse booking if provided
    setHighlightToday(true);
    if (highlightBookingId != null) {
      setIsBookingHighlightActive(true);
      setAutoOpenBookingId(highlightBookingId);
      if (bookingHighlightTimerRef.current !== null) {
        window.clearTimeout(bookingHighlightTimerRef.current);
        bookingHighlightTimerRef.current = null;
      }
      bookingHighlightTimerRef.current = window.setTimeout(() => {
        setIsBookingHighlightActive(false);
        setAutoOpenBookingId(null);
        bookingHighlightTimerRef.current = null;
      }, 3000);
    }
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightToday(false);
      highlightTimerRef.current = null;
    }, 600);

    hasAppliedDeepLinkRef.current = true;
  }, [loading, currentDate, daysInMonth, rowVirtualizer, cellWidth, highlightBookingId]);

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
      rowVirtualizer.scrollToIndex(Math.max(0, today.getDate() - 1), {
        align: "center",
      });
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
    return () =>
      window.removeEventListener("booking:updated", onUpdated as EventListener);
  }, [refetch]);

  return (
    <div className="w-full">
      {/* Header section with title and month navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 gap-4">
        {/* Left side: Title with calendar icon */}
        <div className="flex items-center gap-2 justify-center min-w-[280px] sm:min-w-[370px] rounded-t-4xl bg-neutral-700 px-4 py-2">
          <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
          <h1 className="text-[16px] sm:text-[20px] font-medium text-primary-foreground">
            Interpreter Booking
          </h1>
        </div>

        {/* Right side: Month navigation buttons */}
        <div className="flex items-center justify-center max-w-[280px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-2 border border-border rounded-[10px] hover:bg-accent hover:border-primary shadow-md hover:shadow-lg active:shadow-md transition"
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
              className="p-2 border border-border rounded-[10px] hover:bg-accent hover:border-primary shadow-md hover:shadow-lg active:shadow-md transition"
            >
              <ChevronRight className="text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Main calendar grid */}
      <div className="border border-border rounded-3xl overflow-hidden bg-background shadow-lg">
        {/* KEEPING ScrollArea + virtualizer viewport TOGETHER */}
        <ScrollArea
          className="h-[clamp(500px,calc(100dvh-360px),550px)]"
          viewportRef={scrollAreaViewportRef}
        >
          {/* Fixed header row with time labels */}
          <div
            className="sticky top-0 z-30 bg-secondary border-b border-border min-w-[800px] shadow-sm"
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

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <LoadingThreeDotsJumping />
            </div>
          )}

          {/* Virtualized day rows - only renders visible rows for performance */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {/* Render only the day rows that are currently visible */}
            {/**sand to day-row.tsx */}
            {rowVirtualizer.getVirtualItems().map((vr) => (
              <DayRow
                key={vr.index}
                day={daysInMonth[vr.index]}
                currentDate={currentDate}
                timeSlots={timeSlots}
                bars={barsByDay.get(vr.index) ?? []}
                occupancy={
                  occupancyByDay.get(vr.index) ??
                  Array(timeSlots.length).fill(0)
                }
                isTimeSlotPast={isTimeSlotPast}
                onSlotClick={handleSlotClick}
                forwardMonthLimit={forwardMonthLimit}
                cellWidth={cellWidth}
                dayLabelWidth={dayLabelWidth}
                maxLanes={interpreterCount}  // ← Add this
                interpreterColorsMap={interpreterColors}
                highlightBookingId={isBookingHighlightActive ? highlightBookingId : null}
                autoOpenBookingId={autoOpenBookingId}
    
                isHighlighted={
                  highlightToday &&
                  daysInMonth[vr.index].fullDate.toDateString() ===
                    new Date().toDateString()
                }
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

      {/* Bottom controls and legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-3 gap-3">
        {/* Left: controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Today button */}
          <Button
            onClick={goToToday}
            className="bg-neutral-700 text-white rounded-full hover:bg-black/90 w-24 sm:w-28 h-10 text-sm sm:text-base shadow-md hover:shadow-lg active:shadow-md transition"
          >
            <Disc className="w-8 h-8 sm:w-10 sm:h-10" />
            Today
          </Button>
          <Button
            onClick={() => refetch()}
            className="bg-neutral-700 text-white rounded-full hover:bg-black/90 h-10 w-24 sm:w-28 text-sm sm:text-base shadow-md hover:shadow-lg active:shadow-md transition"
            disabled={loading}
          >
            <RefreshCw
              className={`w-8 h-8 sm:w-10 sm:h-10 ${
                loading ? "animate-spin" : ""
              }`}
            />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          {/* Help button to reopen tutorial */}
          <Button
            onClick={() => setIsTutorialOpen(true)}
            className="bg-white text-white rounded-full hover:bg-white h-15 w-15 p-0 transition overflow-hidden border-2 border-white shadow-none hover:shadow-none active:shadow-none focus-visible:outline-none focus-visible:ring-0 mb-4"
            aria-label="Help"
            title="Help"
          >
            <img src="/mascot/mascot.png" alt="Help" className="w-full h-full object-cover" />
          </Button>
          {/* Admin vision toggle removed */}
          <BookingRules forwardMonthLimit={forwardMonthLimit} />
        </div>

        {/* Right: interpreter legend */}
        <div 
          className="bg-neutral-700 flex items-center justify-center gap-2 sm:gap-3 text-sm rounded-br-4xl rounded-bl-4xl px-2 sm:px-3 py-2"
          style={{
            minWidth: activeInterpreters.length > 0 ? '200px' : '150px',
            width: 'fit-content',
            maxWidth: '90vw', // Use viewport width to prevent overflow
            minHeight: '40px'
          }}
        >
          {activeInterpreters.length > 0 ? (
            activeInterpreters.map((interpreter) => {
              const color = interpreterColors[interpreter.id] || getInterpreterColor(interpreter.id, interpreter.name)?.bg || '#6b7280';
              return (
                <div key={interpreter.id} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-primary-foreground"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-primary-foreground text-xs sm:text-sm whitespace-nowrap">
                    {interpreter.name}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-primary-foreground text-xs sm:text-sm">
                No interpreters found
              </span>
            </div>
          )}
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
            ? occupancyByDay.get(selectedSlot.day - 1) ??
              Array(timeSlots.length).fill(0)
            : undefined
        
        }
        maxLanes={interpreterCount}
        forwardMonthLimit={forwardMonthLimit}
      />
      {/* Tutorial Modal - first time + via help button */}
      <Modal
        backdrop="blur"
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        hideCloseButton
        classNames={{ backdrop: "backdrop-blur-md backdrop-saturate-150" }}
      >
        <ModalContent className="text-white max-w-5xl sm:max-w-7xl w-[min(96vw,85rem)] !border-0 !outline-none !ring-0 rounded-3xl" style={{ backgroundColor: '#262626' }}>
          {() => (
            <>
              <ModalBody className="py-6 px-6 sm:px-8">
                <div className="flex flex-col gap-6 items-center">
                  {/* Picture on top */}
                  <div className="w-full flex justify-center px-4 sm:px-8">
                    <img
                      src={tutorialSlides[tutorialIndex]?.image}
                      alt="Booking help"
                      className="w-full h-auto max-h-[450px] sm:max-h-[550px] object-cover rounded-xl"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Text below */}
                  <div className="w-full">
                    <Carousel className="w-full" setApi={setTutorialApi}>
                      <CarouselContent>
                        {tutorialSlides.map((s, idx) => (
                          <CarouselItem key={idx}>
                            <div className="space-y-2 leading-relaxed px-4 sm:px-8 text-center">
                              <p className="text-xl sm:text-2xl font-medium text-white">{s.title}</p>
                              <p className="text-base sm:text-lg text-gray-300 whitespace-pre-line">
                                {renderTextWithHighlights(s.text)}
                              </p>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex items-center justify-between mt-4 px-4">
                        <CarouselPrevious className="static translate-x-0 bg-black hover:bg-black/80 text-white border-black" />
                        <CarouselNext className="static translate-x-0 bg-black hover:bg-black/80 text-white border-black" />
                      </div>
                    </Carousel>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="justify-center pb-6">
                <Button onClick={closeTutorial} className="bg-neutral-700 text-white hover:bg-black/90 px-12 py-2 text-base">Got it</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default BookingCalendar;
