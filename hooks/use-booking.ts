import { useCallback, useEffect, useState } from "react";
import type { BookingData } from "@/types/booking";

export function useBookings(currentDate: Date, view?: 'user' | 'admin' | 'all') {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    setLoading(true);
    setError(null);
    try {
      const qs = view ? `?view=${encodeURIComponent(view)}` : '';
      const res = await fetch(
        `/api/booking-data/get-booking-byDate/${year}/${month}${qs}`
      );
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [currentDate, view]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { bookings, loading, error, refetch };
}
