import { useMemo } from "react";
import type { BookingData, DayInfo, BarItem } from "@/types/booking";
import { MAX_LANES } from "@/utils/constants";

function toIndices(startISO: string, endISO: string, timeSlots: string[]) {
  // Assumes timeSlots are strings like "08:00" aligning to booking times
  // Use UTC parsing as existing code does
  const start = new Date(startISO);
  const end = new Date(endISO);
  const startStr = `${String(start.getUTCHours()).padStart(2, "0")}:${String(
    start.getUTCMinutes()
  ).padStart(2, "0")}`;
  const endStr = `${String(end.getUTCHours()).padStart(2, "0")}:${String(
    end.getUTCMinutes()
  ).padStart(2, "0")}`;
  const startIndex = timeSlots.indexOf(startStr);
  const endIndex = timeSlots.indexOf(endStr);
  return { startIndex, endIndex };
}

export function useSlotDataForBars({
  bookings,
  daysInMonth,
  timeSlots,
}: {
  bookings: BookingData[];
  daysInMonth: DayInfo[];
  timeSlots: string[];
}) {
  return useMemo(() => {
    const barsByDay = new Map<number, BarItem[]>();
    const occupancyByDay = new Map<number, number[]>();

    daysInMonth.forEach((day, dayIdx) => {
      // 1) Build the same local-like date string used by cells: YYYY-MM-DD
      const year = day.fullDate.getFullYear();
      const month = String(day.fullDate.getMonth() + 1).padStart(2, "0");
      const date = String(day.date).padStart(2, "0");
      const dayLocalStr = `${year}-${month}-${date}`;

      const dayBookings = bookings.filter((b) => {
        const startDateISO = b.timeStart.split("T")[0];
        return startDateISO === dayLocalStr;
      });

      // 2) Map to intervals
      const intervals = dayBookings
        .map((b) => {
          const { startIndex, endIndex } = toIndices(
            b.timeStart,
            b.timeEnd,
            timeSlots
          );
          return {
            bookingId: b.bookingId,
            name: `${b.ownerName} ${b.ownerSurname}`,
            room: b.meetingRoom,
            status: b.bookingStatus,
            startIndex,
            endIndex,
          } as Omit<BarItem, "lane"> & { lane?: 0 | 1 };
        })
        .filter(
          (iv) =>
            iv.startIndex !== -1 && iv.endIndex !== -1 && iv.endIndex > iv.startIndex
        );

      // Sort by startIndex then endIndex
      intervals.sort(
        (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex
      );

      // 3) Assign lanes greedily
      const lanesEnd: number[] = Array(MAX_LANES).fill(-Infinity);
      const placed: BarItem[] = [];
      for (const iv of intervals) {
        let laneUsed = -1;
        for (let l = 0; l < MAX_LANES; l++) {
          if (iv.startIndex >= lanesEnd[l]) {
            laneUsed = l;
            break;
          }
        }
        if (laneUsed >= 0) {
          placed.push({ ...(iv as any), lane: laneUsed as 0 | 1 });
          lanesEnd[laneUsed] = iv.endIndex;
        }
      }

      // 4) Build occupancy
      const occ = Array(timeSlots.length).fill(0);
      for (const bar of placed) {
        for (let i = bar.startIndex; i < bar.endIndex; i++) {
          occ[i] = Math.min(MAX_LANES, occ[i] + 1);
        }
      }

      barsByDay.set(dayIdx, placed);
      occupancyByDay.set(dayIdx, occ);
    });

    return { barsByDay, occupancyByDay };
  }, [bookings, daysInMonth, timeSlots]);
}
