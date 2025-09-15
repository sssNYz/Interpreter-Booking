import type { DayInfo } from "./booking";

export type BookingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot?: {
    day: number;
    slot: string;
  };
  daysInMonth: DayInfo[];
  dayOccupancy?: number[];
  interpreters?: {
    interpreterId: number;
    interpreterName: string;
    interpreterSurname: string;
  }[];
  rooms?: string[];
  maxLanes?: number;
};


