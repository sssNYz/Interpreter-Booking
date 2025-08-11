import type { DayInfo } from "@/types/booking";

export const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour < 18; hour++) {
    if (hour === 12) {
      slots.push(`${hour}:00`, `${hour}:20`);
      continue;
    }
    if (hour === 13) {
      slots.push(`${hour}:10`, `${hour}:30`);
      continue;
    }
    if (hour === 17) {
      slots.push(`${hour}:00`);
      continue;
    }
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
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

