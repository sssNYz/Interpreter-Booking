import { useCallback, useEffect, useState } from "react";
import type { BookingData } from "@/types/booking";

export function useBookings(currentDate: Date) {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/booking-data/get-booking-byDate/${year}/${month}`
      );
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { bookings, loading, error, refetch };
}