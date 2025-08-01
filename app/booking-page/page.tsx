import BookingCalendar from "@/components/calendar/calendar";
import React from "react";

function bookingPage() {
  return (
    <div className="flex flex-col mt-10 px-4 mx-auto w-full max-w-full sm:max-w-[700px] lg:max-w-[1500px]">
      <BookingCalendar />
    </div>
  );
}

export default bookingPage;
