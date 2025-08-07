// Main component export
export { default as BookingCalendar } from "./BookingCalendar";

// Individual component exports for potential reuse
export { CalendarHeader } from "./CalendarHeader";
export { CalendarGrid } from "./CalendarGrid";
export { DayRow } from "./DayRow";
export { BookingSlot } from "./BookingSlot";

// Hook export
export { useCalendarLogic } from "@/components/hooks/useCalendarLogic";

// Type exports
export type {
  BookingData,
  Booking,
  SlotData,
  DayInfo,
} from "@/components/hooks/useCalendarLogic";
