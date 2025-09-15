"use client";

import BookingCalendar from "@/components/BookingCalendar/booking-calendar";

function BookingPage() {
  return (
    <div className="flex flex-col gap-8 px-4 mx-auto w-[min(100vw-100px,1700px)]">
      <div className="flex items-center justify-between py-2">
    
      </div>

      <div className="w-full">
        <BookingCalendar />
      </div>
    </div>
  );
}
export default BookingPage;
