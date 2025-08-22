import type { DayInfo } from "./booking";

export type BookingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot?: {
    day: number;
    slot: string;
  };
  daysInMonth: DayInfo[];
  interpreters?: {
    interpreterId: number;
    interpreterName: string;
    interpreterSurname: string;
  }[];
  rooms?: string[];
};


