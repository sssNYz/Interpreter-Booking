"use client";
import BookingCalendar from "@/components/BookingCalendar/booking-calendar";

function BookingPage() {
  return (
    <div className="flex flex-col gap-3 mt-10 px-4 mx-auto w-full max-w-full sm:max-w-[700px] lg:max-w-[1500px]">
      <BookingCalendar />
    </div>
  );
}
export default BookingPage;
