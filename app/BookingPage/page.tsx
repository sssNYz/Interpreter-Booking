"use client";

import BookingCalendar from "@/components/BookingCalendar/booking-calendar";

function BookingPage() {
  return (
    <div className="flex flex-col gap-8 px-4 md:px-6 mx-auto w-full max-w-[1700px]">
      <div className="flex items-center justify-between py-2">
    
      </div>

      <div className="w-full">
        <BookingCalendar />
      </div>
    </div>
  );
}
export default BookingPage;
