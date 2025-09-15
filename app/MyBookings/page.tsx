"use client";

import BookingHistory from "@/components/BookingHistory/booking-history";

function MyBookingsPage() {
  return (
    <div className="flex flex-col gap-8 px-4 mx-auto w-[min(100vw-100px,1700px)]">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-semibold">My Bookings</h1>
      </div>

      <div className="w-full">
        <BookingHistory />
      </div>
    </div>
  );
}

export default MyBookingsPage;
