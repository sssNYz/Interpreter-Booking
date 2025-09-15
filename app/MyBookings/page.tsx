"use client";

import BookingHistory from "@/components/BookingHistory/booking-history";

function MyBookingsPage() {
  return (
    <div className="flex flex-col h-[90dvh] px-4 mx-auto w-[min(100vw-100px,1700px)] overflow-hidden">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-semibold">My Bookings</h1>
      </div>

      <div className="flex gap-4 w-full flex-1 min-h-0">
        <div className="w-1/2 flex flex-col">
          <BookingHistory />
        </div>
        <div className="w-1/2 h-full">
          {/* Right side content can be added here */}
        </div>
      </div>
    </div>
  );
}

export default MyBookingsPage;
