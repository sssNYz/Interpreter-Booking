"use client";
import BookingCalendar from "@/components/BookingCalendar/booking-calendar";
import BookingRules from "@/components/BookingRules/booking-rules";

function BookingPage() {
  return (
    <div className="flex flex-col gap-3 mt-10 px-4 mx-auto w-full max-w-full sm:max-w-[700px] lg:max-w-[1500px]">
      <div className="flex items-center justify-end">
        <BookingRules />
      </div>
      <BookingCalendar />
    </div>
  );
}
export default BookingPage;
