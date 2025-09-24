export const BUSINESS_HOURS_START = 8; // 08:00
export const BUSINESS_HOURS_END = 21; // 21:00 (exclusive for starts)
export const SLOT_STEP_MINUTES = 30; // minutes
export const START_OF_DAY = "08:00";
export const END_OF_DAY = "21:00"; // allowed as end time only

export const VALID_START_SLOTS: readonly string[] = (() => {
  const slots: string[] = [];
  for (let hour = BUSINESS_HOURS_START; hour < BUSINESS_HOURS_END; hour++) {
    const hh = String(hour).padStart(2, "0");
    slots.push(`${hh}:00`);
    // Always include :30 for each hour from START..(END-1)
    slots.push(`${hh}:30`);
  }
  // Remove 17:00 if somehow present
  return slots.filter((s) => s !== "17:00");
})();

export const generateStandardTimeSlots = (): string[] => {
  return [...VALID_START_SLOTS];
};

// End-time slots include 17:00 as the final selectable end
export const generateEndTimeSlots = (): string[] => {
  return [...VALID_START_SLOTS, END_OF_DAY];
};

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const isValidStartTime = (time: string): boolean => {
  return VALID_START_SLOTS.includes(time);
};

export const isValidTimeRange = (start: string, end: string): boolean => {
  return timeToMinutes(end) > timeToMinutes(start);
};

export const addMinutesToTime = (time: string, minutesToAdd: number): string => {
  const total = timeToMinutes(time) + minutesToAdd;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const formatYmdFromDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const buildDateTimeString = (ymd: string, hhmm: string): string => {
  // Returns "YYYY-MM-DD HH:mm:ss"
  return `${ymd} ${hhmm}:00`;
};

export const splitDateTime = (dateTime: string): { date: string; time: string } => {
  // Accepts either "YYYY-MM-DD HH:mm:ss" or ISO like "YYYY-MM-DDTHH:mm:ss..."
  if (dateTime.includes("T")) {
    const [date, tRest] = dateTime.split("T");
    const time = tRest.slice(0, 5);
    return { date, time };
  }
  const [date, timeFull] = dateTime.split(" ");
  const time = (timeFull || "").slice(0, 5);
  return { date, time };
};

export const isValidYmdHms = (s: string): boolean => {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
};

// Small shared helpers for string-based formatting
export const extractHHMM = (dateTimeStr: string): string => {
  const t = dateTimeStr.includes("T") ? dateTimeStr.split("T")[1] : dateTimeStr.split(" ")[1] || "";
  return t.slice(0, 5);
};

export const extractYMD = (dateTimeStr: string): string => {
  return dateTimeStr.includes("T") ? dateTimeStr.split("T")[0] : dateTimeStr.split(" ")[0];
};


