import type { DayInfo } from "@/types/booking";
import { generateStandardTimeSlots } from "@/utils/time";

export const generateTimeSlots = () => {
  return generateStandardTimeSlots();
};

export const getDaysInMonth = (date: Date): DayInfo[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: lastDay }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const isPast = (() => {
      const cmp = new Date(d);
      cmp.setHours(0, 0, 0, 0);
      return cmp < today;
    })();

    return {
      date: i + 1,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      fullDate: d,
      isPast,
    };
  });
};