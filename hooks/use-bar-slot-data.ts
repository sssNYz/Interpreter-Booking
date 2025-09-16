import { useMemo } from "react";
import type { BookingData, DayInfo, BarItem } from "@/types/booking";
import { MAX_LANES } from "@/utils/constants";

function toIndices(startStrIn: string, endStrIn: string, timeSlots: string[]) {
  // Accepts either 'YYYY-MM-DD HH:mm:ss' or ISO 'YYYY-MM-DDTHH:mm:ss'
  const s = startStrIn.includes("T")
    ? startStrIn.split("T")[1]
    : startStrIn.split(" ")[1];
  const e = endStrIn.includes("T")
    ? endStrIn.split("T")[1]
    : endStrIn.split(" ")[1];
  const startStr = s.slice(0, 5);
  const endStr = e.slice(0, 5);
  const startIndex = timeSlots.indexOf(startStr);
  // If end is 17:00, render bar to the final cell (after 16:30)
  const endIndex =
    endStr === "17:00" ? timeSlots.length : timeSlots.indexOf(endStr);
  return { startIndex, endIndex };
}

export function useSlotDataForBars({
  bookings,
  daysInMonth,
  timeSlots,
  maxLanes = MAX_LANES,
}: {
  bookings: BookingData[];
  daysInMonth: DayInfo[];
  timeSlots: string[];
  maxLanes?: number;
}): {
  barsByDay: Map<number, BarItem[]>;
  occupancyByDay: Map<number, number[]>;
} {
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
        const src = b.timeStart;
        const startDateISO = src.includes("T")
          ? src.split("T")[0]
          : src.split(" ")[0];
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
            interpreterId: b.interpreterId,
            interpreterName:
              (b.interpreterName && b.interpreterName.trim() !== "")
              ? b.interpreterName
              : "no assign now",
            meetingDetail: b.meetingDetail,
            ownerEmail: b.ownerEmail,
            ownerTel: b.ownerTel,
            ownerGroup: b.ownerGroup,
            meetingType: b.meetingType,
          } as Omit<BarItem, "lane"> & { lane?: number };
        })
        .filter(
          (iv) =>
            iv.startIndex !== -1 &&
            iv.endIndex !== -1 &&
            iv.endIndex > iv.startIndex
        );

      // Sort by startIndex then endIndex
      intervals.sort(
        (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex
      );

      // 3) Assign lanes greedily with UNLIMITED placement
      //    We dynamically grow lanes so all bars are placed for display.
      const lanesEnd: number[] = [];
      const placed: BarItem[] = [];
      for (const iv of intervals) {
        let laneUsed = -1;
        for (let l = 0; l < lanesEnd.length; l++) {
          if (iv.startIndex >= lanesEnd[l]) {
            laneUsed = l;
            break;
          }
        }
        if (laneUsed === -1) {
          // create a new lane
          lanesEnd.push(-Infinity);
          laneUsed = lanesEnd.length - 1;
        }
        placed.push({ ...iv, lane: laneUsed });
        lanesEnd[laneUsed] = iv.endIndex;
      }

      // 4) Build occupancy (capped by maxLanes for click blocking)
      const occ = Array(timeSlots.length).fill(0);
      for (const bar of placed) {
        for (let i = bar.startIndex; i < bar.endIndex; i++) {
          occ[i] = Math.min(maxLanes, occ[i] + 1);
        }
      }

      barsByDay.set(dayIdx, placed);
      occupancyByDay.set(dayIdx, occ);
    });

    return { barsByDay, occupancyByDay };
  }, [bookings, daysInMonth, timeSlots, maxLanes]);
}
