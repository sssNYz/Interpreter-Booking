import { useEffect, useState } from "react";
import type { BookingData } from "@/types/booking";

export function useBookings(currentDate: Date) {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const fetchBookings = async () => {
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
    };

    fetchBookings();
  }, [currentDate]);

  return { bookings, loading, error };
}
