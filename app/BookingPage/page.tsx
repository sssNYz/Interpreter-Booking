
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import BookingCalendar from "@/components/BookingCalendar/booking-calendar";
import BookingHistory from "@/components/BookingHistory/booking-history";

type TabKey = "calendar" | "bookings";

function BookingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "calendar";
  const [active, setActive] = useState<TabKey>(initialTab);
  const [bookingsLoaded, setBookingsLoaded] = useState<boolean>(initialTab === "bookings");

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, self: TabKey) => {
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

    <div className="flex flex-col gap-8 px-4 mx-auto w-full max-w-full lg:max-w-[1500px]">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-semibold">Appointments</h1>
      </div>

      <div role="tablist" aria-label="Appointment sections" className="flex gap-2 border-b">
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
            active === "calendar" ? "font-semibold border-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Calendar
        </button>
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
            active === "bookings" ? "font-semibold border-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          My bookings
        </button>
      </div>

      {active === "calendar" ? (
        <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar" className="w-full">
          <p className="text-sm text-muted-foreground mb-2">Select a time slot to start a booking.</p>
          <BookingCalendar />
        </div>
      ) : null}

      {active === "bookings" ? (
        <div role="tabpanel" id="panel-bookings" aria-labelledby="tab-bookings" className="w-full">
          <BookingHistory />
        </div>
      ) : bookingsLoaded ? null : null}

    </div>
  );
}
export default BookingPage;
