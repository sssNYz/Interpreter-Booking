"use client";

import BookingHistory from "@/components/BookingHistory/booking-history";
import Calendar05 from "@/components/calendar-05";
import LoadingThreeDotsJumping from "@/components/ui/loading-three-dots";
import * as React from "react";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import Image from "next/image";

function MyBookingsPage() {
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [queryRange, setQueryRange] = React.useState<{ startDate?: string; endDate?: string }>({});
  const [bookedDays, setBookedDays] = React.useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [userEmpCode, setUserEmpCode] = React.useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = React.useState(false);

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  // Auto-load dots for the visible months
  // But requirement changed: show dots for ALL bookings always
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setUserEmpCode(parsed.empCode || null);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!userEmpCode) return;
    const controller = new AbortController();
    setCalendarLoading(true);
    fetch(`/api/booking-data/get-booking-dates-by-owner/${userEmpCode}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        const j = await r.json();
        setBookedDays(Array.isArray(j.dates) ? j.dates : []);
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
    return () => controller.abort();
  }, [userEmpCode]);

  const handleShowAll = () => {
    setRange(undefined);
    setQueryRange({});
  };

  const handleFind = () => {
    const startDate = range?.from ? toYMD(range.from) : undefined;
    const endDate = range?.to ? toYMD(range.to) : startDate;
    setQueryRange({ startDate, endDate });
  };
  return (
    <div className="flex flex-col h-[90dvh] px-4 mx-auto w-[min(100vw-100px,1700px)] overflow-hidden">
      <div className="flex gap-4 w-full flex-1 min-h-0">
        <div className="w-1/2 flex flex-col min-h-0">
          <BookingHistory
            renderEmpty={() => (
              <div className="flex flex-col items-center justify-center py-6">
                <Image
                  src="/illustrations/55024598_9264826.svg"
                  alt="No bookings"
                  width={480}
                  height={320}
                  className="max-w-[480px] w-full opacity-90"
                />
                <div className="mt-4 text-sm text-muted-foreground">No bookings yet</div>
              </div>
            )}
            startDate={queryRange.startDate}
            endDate={queryRange.endDate}
          />
        </div>
        <div className="w-1/2 h-full">
          <div className="flex flex-col h-full gap-4">
            <div className="flex-1 rounded-lg border p-4 min-h-0 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="text-lg font-semibold">Filter by date</div>
                <div className="flex gap-3">
                  <Button 
                    size="default" 
                    variant="outline" 
                    onClick={handleShowAll}
                    className="px-6 py-2 font-medium shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-[0_0_25px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all duration-200"
                  >
                    ALL
                  </Button>
                  <Button 
                    size="default" 
                    onClick={handleFind} 
                    disabled={!range?.from}
                    className="px-6 py-2 font-medium bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_25px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-200 disabled:hover:translate-y-0 disabled:hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]"
                  >
                    FIND
                  </Button>
                </div>
              </div>
              <div className="flex-1 flex items-stretch justify-center pt-4 min-h-0 relative">
                <Calendar05
                  value={range}
                  onChange={setRange}
                  highlightedDays={bookedDays}
                  defaultMonth={currentMonth}
                  onMonthChange={(m) => setCurrentMonth(m)}
                />
                {calendarLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
                    <LoadingThreeDotsJumping />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 rounded-lg border flex items-center justify-center text-muted-foreground">
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyBookingsPage;
