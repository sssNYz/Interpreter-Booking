import {
  SlotData,
  Booking,
  BookingWithLayer,
} from "@/components/hooks/useCalendarLogic";

interface BookingSlotProps {
  slotData: SlotData;
  timeSlot: string;
  onClick: () => void;
  title: string;
  timeSlots: string[]; // All time slots for the day
  currentSlotIndex: number; // Current slot position
  dayBookings: BookingWithLayer[]; // All bookings for this entire day with layer info
  maxLayers: number; // Maximum number of layers for proper container height
}

// User/room color mapping for visual distinction
const getBookingColor = (bookingId: number, room: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
  ];

  const hash = bookingId + room.length;
  return colors[hash % colors.length];
};

// Helper to find slot index for time
const findSlotIndexForTime = (timeSlots: string[], time: string): number => {
  const timeKey = time.substring(11, 16);
  return timeSlots.findIndex((slot) => slot === timeKey);
};

interface TimelineBarData {
  booking: Booking;
  width: number;
  height: number;
  left: number;
  top: number;
  color: string;
  slotsSpanned: number;
}

// Calculate horizontal timeline bars that span across time slots
const calculateHorizontalTimelineBars = (
  dayBookings: BookingWithLayer[],
  timeSlots: string[],
  currentSlotIndex: number
): TimelineBarData[] => {
  if (dayBookings.length === 0) return [];

  // Filter bookings that start exactly at this slot
  const bookingsStartingHere = dayBookings.filter(
    (booking) => booking.startSlotIndex === currentSlotIndex
  );

  const bars: TimelineBarData[] = [];

  bookingsStartingHere.forEach((booking) => {
    const slotWidth = 120;
    const slotsSpanned = Math.max(
      1,
      booking.endSlotIndex - booking.startSlotIndex
    );
    const barWidth = slotsSpanned * slotWidth - 2;

    const baseHeight = 20;
    const verticalSpacing = 4;
    const verticalOffset = booking.layerIndex * (baseHeight + verticalSpacing);

    bars.push({
      booking,
      width: Math.max(barWidth, 80),
      height: baseHeight,
      left: 0,
      top: 8 + verticalOffset,
      color: getBookingColor(booking.id, booking.room),
      slotsSpanned,
    });
  });

  return bars;
};

export const BookingSlot = ({
  slotData,
  onClick,
  title,
  timeSlots,
  currentSlotIndex,
  dayBookings = [],
}: BookingSlotProps) => {
  const { bookings, bgClass, textClass, isWeekend, isPast, isPastTime } =
    slotData;

  // Calculate horizontal timeline bars for bookings starting in this slot
  const timelineBars = calculateHorizontalTimelineBars(
    dayBookings,
    timeSlots,
    currentSlotIndex
  );

  // Determine cursor style
  const cursorClass =
    isWeekend || isPast || isPastTime
      ? "cursor-not-allowed"
      : "cursor-pointer hover:bg-slate-100";

  // Base slot background
  const slotBgClass = bookings.length === 0 ? bgClass : "bg-slate-50";

  return (
    <div
      className={`border-r border-slate-200 relative transition-all ${cursorClass} ${slotBgClass} ${textClass}`}
      onClick={onClick}
      title={title}
      style={{ height: "60px" }}
    >
      {/* Weekend display */}
      {isWeekend && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-white">Weekend</span>
        </div>
      )}

      {/* Horizontal timeline bars container */}
      {timelineBars.length > 0 && !isWeekend && (
        <div
          className="absolute inset-0 overflow-visible"
          style={{ pointerEvents: "none" }}
        >
          {timelineBars.map(
            ({ booking, width, height, left, top, color }, index) => (
              <div
                key={`horizontal-${booking.id}`}
                className={`absolute rounded-md shadow-sm border border-white ${color} transition-all hover:shadow-lg`}
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                  left: `${left}px`,
                  top: `${top}px`,
                  pointerEvents: "auto",
                  zIndex: 10 + index,
                  // Extend beyond current slot boundaries
                  minWidth: "80px",
                }}
                title={`${booking.name} - ${booking.room} (${
                  booking.status
                }) | ${booking.timeStart.substring(
                  11,
                  16
                )} - ${booking.timeEnd.substring(11, 16)}`}
              >
                {/* Bar content */}
                <div className="h-full flex items-center text-white px-2 text-xs">
                  {/* Show name if bar is wide enough */}
                  {width > 100 && (
                    <div className="font-medium truncate mr-2">
                      {booking.name.split(" ")[0]}
                    </div>
                  )}

                  {/* Show room if bar is very wide */}
                  {width > 180 && (
                    <div className="opacity-90 truncate">{booking.room}</div>
                  )}

                  {/* Show initials for medium bars */}
                  {width > 60 && width <= 100 && (
                    <div className="font-bold">
                      {booking.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                  )}

                  {/* Status dot for narrow bars */}
                  {width <= 60 && (
                    <div className="w-2 h-2 bg-white rounded-full opacity-90 mx-auto"></div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Booking indicator dot for slots that contain bookings */}
      {bookings.length > 0 && timelineBars.length === 0 && !isWeekend && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full opacity-75"></div>
      )}
    </div>
  );
};
