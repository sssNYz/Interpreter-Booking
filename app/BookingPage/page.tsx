"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle } from "lucide-react";
import BookingCalendar from "@/components/BookingCalendar/booking-calendar";
import BookingHistory from "@/components/BookingHistory/booking-history";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TabKey = "calendar" | "bookings";

function BookingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "calendar";
  const [active, setActive] = useState<TabKey>(initialTab);
  const [bookingsLoaded, setBookingsLoaded] = useState<boolean>(
    initialTab === "bookings"
  );

  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", active);
    router.replace(`${pathname}?${sp.toString()}`);
    if (active === "bookings" && !bookingsLoaded) setBookingsLoaded(true);
  }, [active, bookingsLoaded, pathname, router, searchParams]);

  const calRef = useRef<HTMLButtonElement>(null);
  const hisRef = useRef<HTMLButtonElement>(null);
  const focusNext = (current: TabKey, dir: 1 | -1) => {
    const order: TabKey[] = ["calendar", "bookings"];
    const idx = order.indexOf(current);
    const next = order[(idx + dir + order.length) % order.length];
    if (next === "calendar") calRef.current?.focus();
    else hisRef.current?.focus();
  };

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    self: TabKey
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusNext(self, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusNext(self, -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActive(self);
    }
  };

  return (
    <div className="flex flex-col gap-8 px-4 mx-auto w-[min(100vw-100px,1700px)]">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        
        <div
          role="tablist"
          aria-label="Appointment sections"
          className="flex bg-muted rounded-full p-0.5"
        >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={calRef}
              role="tab"
              id="tab-calendar"
              aria-controls="panel-calendar"
              aria-selected={active === "calendar"}
              tabIndex={active === "calendar" ? 0 : -1}
              onClick={() => setActive("calendar")}
              onKeyDown={(e) => onKeyDown(e, "calendar")}
              className={`min-h-[44px] px-3 py-2 border-b-2 transition-colors ${
                active === "calendar"
                  ? "font-semibold border-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Calendar</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={hisRef}
              role="tab"
              id="tab-bookings"
              aria-controls="panel-bookings"
              aria-selected={active === "bookings"}
              tabIndex={active === "bookings" ? 0 : -1}
              onClick={() => setActive("bookings")}
              onKeyDown={(e) => onKeyDown(e, "bookings")}
              className={`min-h-[44px] px-3 py-2 border-b-2 transition-colors ${
                active === "bookings"
                  ? "font-semibold border-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>My bookings</p>
          </TooltipContent>
        </Tooltip>
        </div>
      </div>

      {active === "calendar" ? (
        <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar" className="w-full">
          <BookingCalendar />
        </div>
      ) : null}

      {active === "bookings" ? (
        <div
          role="tabpanel"
          id="panel-bookings"
          aria-labelledby="tab-bookings"
          className="w-full"
        >
          <BookingHistory />
        </div>
      ) : bookingsLoaded ? null : null}
    </div>
  );
}
export default BookingPage;
