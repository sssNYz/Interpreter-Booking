"use client";

import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BookingRules() {
  return (
    <Sheet>
      <SheetTrigger asChild>

        <Button variant="outline" className="ml-0">Rules</Button>

      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Booking rules</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-9rem)] pr-2">
          <ul className="space-y-3 text-sm text-muted-foreground mt-4">
            <li>- Book at least 24 hours in advance.</li>
            <li>- Max 2 active bookings per user.</li>
            <li>- Cancel at least 2 hours before start.</li>
            <li>- No bookings on weekends.</li>
            <li>- Past time slots are disabled.</li>
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}