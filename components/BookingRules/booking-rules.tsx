"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale } from "lucide-react";

export default function BookingRules({ forwardMonthLimit }: { forwardMonthLimit?: number }) {
  const [limit, setLimit] = useState<number>(forwardMonthLimit ?? 1);
  useEffect(() => {
    if (typeof forwardMonthLimit === 'number') {
      setLimit(forwardMonthLimit);
      return;
    }
    // fallback fetch when prop not provided
    fetch('/api/policy/forward-limit')
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((json) => {
        const n = Number(json?.data?.forwardMonthLimit);
        if (Number.isFinite(n) && n >= 0) setLimit(n);
      })
      .catch(() => {});
  }, [forwardMonthLimit]);
  return (
    <Dialog>
      <DialogTrigger asChild>

        <Button className="ml-0 bg-neutral-700 text-white rounded-full hover:bg-black/90 w-28 h-10 shadow-md hover:shadow-lg active:shadow-md transition">
          <Scale className="w-20 h-20" />
          Rules
        </Button>

      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Booking rules</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-2">
          <ul className="space-y-3 text-sm text-muted-foreground mt-4">
            <li>- You can book up to {limit} month{limit === 1 ? '' : 's'} ahead.</li>
            <li>- Book at least 24 hours in advance.</li>
            <li>- Max 2 active bookings per user.</li>
            <li>- Cancel at least 2 hours before start.</li>
            <li>- No bookings on weekends.</li>
            <li>- Past time slots are disabled.</li>
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
