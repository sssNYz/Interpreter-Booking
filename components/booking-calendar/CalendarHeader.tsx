import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface CalendarHeaderProps {
  currentDate: Date;
  shiftMonth: (direction: number) => void;
}

export const CalendarHeader = ({
  currentDate,
  shiftMonth,
}: CalendarHeaderProps) => {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ maxWidth: "1500px" }}
    >
      {/* Title of component */}
      <div className="flex items-center gap-2 justify-center min-w-[370px] rounded-t-4xl bg-slate-300 px-4 py-2">
        <Calendar className="w-8 h-8" />
        <h1 className="text-[30px] font-medium">Book Appointment</h1>
      </div>

      {/* Next and Previous month zone */}
      <div className="mt-auto mr-3.5 flex items-center justify-center ml-auto max-w-[280px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 border rounded-[10px] hover:bg-slate-50"
          >
            <ChevronLeft />
          </button>
          <span className="min-w-[150px] text-center font-medium">
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 border rounded-[10px] hover:bg-slate-50"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
};
