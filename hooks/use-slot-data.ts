import { useMemo } from "react";
import type { Booking, BookingData, DayInfo, SlotData } from "@/types/booking";
import { getStatusStyle } from "@/utils/status";

type Params = {
  bookings: BookingData[];
  currentDate: Date;
  daysInMonth: DayInfo[];
  timeSlots: string[];
  isTimeSlotPast: (day: number, timeSlot: string) => boolean;
};

export function useSlotData({
  bookings,
  currentDate,
  daysInMonth,
  timeSlots,
  isTimeSlotPast,
}: Params) {
  const slotDataMap: Map<string, SlotData> = useMemo(() => {
    const map = new Map<string, SlotData>();

    // Build booking map for fast lookup (key: YYYY-MM-DD-HH:mm)
    const bookingMap = new Map<string, Booking>();
    bookings.forEach((b) => {
      const name = `${b.ownerName} ${b.ownerSurname}`;
      const room = b.meetingRoom;
      const status = b.bookingStatus;
      const bookingId = b.bookingId;

      const startISO = b.timeStart;
      const endISO = b.timeEnd;

      const current = new Date(startISO);
      const end = new Date(endISO);

      // NOTE: Assumes stored times align with the displayed grid (UTC 30-min steps)
      while (current < end) {
        const dateKey = startISO.split("T")[0];
        const hours = current.getUTCHours().toString().padStart(2, "0");
        const minutes = current.getUTCMinutes().toString().padStart(2, "0");
        const timeKey = `${hours}:${minutes}`;
        const key = `${dateKey}-${timeKey}`;

        bookingMap.set(key, {
          id: bookingId,
          name,
          room,
          status,
          timeStart: b.timeStart,
          timeEnd: b.timeEnd,
        });

        current.setUTCMinutes(current.getUTCMinutes() + 30);
      }
    });

    daysInMonth.forEach((day) => {
      const isWeekend = ["Sat", "Sun"].includes(day.dayName);
      const isPast = day.isPast;

      timeSlots.forEach((timeSlot, timeIndex) => {
        const paddedMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
        const paddedDay = String(day.date).padStart(2, "0");
        const dateString = `${currentDate.getFullYear()}-${paddedMonth}-${paddedDay}`;
        const key = `${dateString}-${timeSlot}`;

        const booking = bookingMap.get(key);
        const isPastTime = isTimeSlotPast(day.date, timeSlot);

        let slotData: SlotData = {
          bookingId: null,
          name: null,
          room: null,
          status: null,
          bgClass: isWeekend
            ? "bg-slate-500 text-white"
            : isPast || isPastTime
            ? "bg-slate-300"
            : "bg-slate-50",
          textClass: "",
          icon: null,
          span: 1,
          shouldDisplay: true,
          isPast,
          isPastTime,
          isWeekend,
          isClickable: !isPast && !booking && !isWeekend && !isPastTime,
        };

        if (booking) {
          const statusStyle = getStatusStyle(booking.status);

          const isFirstSlot =
            timeIndex === 0 ||
            (() => {
              const prevSlot = timeSlots[timeIndex - 1];
              const prevKey = `${dateString}-${prevSlot}`;
              const prevBooking = bookingMap.get(prevKey);
              return !prevBooking || prevBooking.id !== booking.id;
            })();

          let span = 1;
          if (isFirstSlot) {
            for (let i = timeIndex + 1; i < timeSlots.length; i++) {
              const nextSlot = timeSlots[i];
              const nextKey = `${dateString}-${nextSlot}`;
              const nextBooking = bookingMap.get(nextKey);
              if (nextBooking && nextBooking.id === booking.id) span++;
              else break;
            }
          }

          slotData = {
            bookingId: booking.id,
            name: booking.name,
            room: booking.room,
            status: booking.status,
            bgClass: isWeekend ? "bg-slate-500 text-white" : statusStyle.bg,
            textClass: isWeekend ? "" : statusStyle.text,
            icon: isWeekend ? null : statusStyle.icon,
            span,
            shouldDisplay: isFirstSlot,
            isPast,
            isPastTime,
            isWeekend,
            isClickable: false,
          };
        }

        map.set(key, slotData);
      });
    });

    return map;
  }, [bookings, currentDate, daysInMonth, isTimeSlotPast, timeSlots]);

  return { slotDataMap };
}