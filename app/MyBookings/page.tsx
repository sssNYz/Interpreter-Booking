"use client";

import BookingHistory from "@/components/BookingHistory/booking-history";

function MyBookingsPage() {
  return (
    <div className="flex flex-col h-[90dvh] px-4 mx-auto w-[min(100vw-100px,1700px)] overflow-hidden">
      <div className="flex gap-4 w-full flex-1 min-h-0">
        <div className="w-1/2 flex flex-col min-h-0">
          <BookingHistory
            renderEmpty={() => (
              <div className="flex flex-col items-center justify-center py-6">
                <img
                  src="/illustrations/55024598_9264826.svg"
                  alt="No bookings"
                  className="max-w-[480px] w-full opacity-90"
                />
                <div className="mt-4 text-sm text-muted-foreground">No bookings yet</div>
              </div>
            )}
          />
        </div>
        <div className="w-1/2 h-full">
          {/* Right side content can be added here */}
        </div>
      </div>
    </div>
  );
}

export default MyBookingsPage;
