import { User, MapPin } from "lucide-react";
import { SlotData } from "@/components/hooks/useCalendarLogic";

interface BookingSlotProps {
  slotData: SlotData;
  onClick: () => void;
  title: string;
}

export const BookingSlot = ({ slotData, onClick, title }: BookingSlotProps) => {
  const { bookings, bgClass, textClass, icon, isWeekend, isPast, isPastTime } =
    slotData;

  // Determine cursor style
  const cursorClass =
    isWeekend || isPast || isPastTime
      ? "cursor-not-allowed"
      : bookings.length > 0
      ? "cursor-default"
      : "cursor-pointer hover:bg-slate-100";

  return (
    <div
      className={`border-r border-slate-200 rounded-[4px] flex flex-col items-center justify-center text-xs transition-all p-1 ${cursorClass} ${bgClass} ${textClass}`}
      onClick={onClick}
      title={title}
    >
      {/* Single booking display */}
      {bookings.length === 1 && !isWeekend && (
        <>
          <div className="flex items-center gap-1 mb-1">
            {icon}
            <User className="w-3 h-3" />
          </div>
          <div className="text-center w-full">
            <div className="font-medium truncate">{bookings[0].name}</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-2 h-2" />
              <span className="text-xs truncate">{bookings[0].room}</span>
            </div>
          </div>
        </>
      )}

      {/* Multiple bookings display - NEW FEATURE FOR OVERLAPPING UI */}
      {bookings.length > 1 && !isWeekend && (
        <div className="text-center w-full">
          <div className="font-medium text-xs">{bookings.length} Bookings</div>
          <div className="flex flex-wrap gap-1 mt-1 justify-center">
            {bookings.slice(0, 2).map((booking) => (
              <div key={booking.id} className="text-xs truncate max-w-[40px]">
                {booking.name.split(" ")[0]}
              </div>
            ))}
            {bookings.length > 2 && (
              <span className="text-xs">+{bookings.length - 2}</span>
            )}
          </div>
        </div>
      )}

      {/* Weekend display */}
      {isWeekend && <span className="text-xs font-medium">Weekend</span>}
    </div>
  );
};
