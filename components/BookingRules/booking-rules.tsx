"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale } from "lucide-react";

export default function BookingRules() {
  return (
    <Dialog>
      <DialogTrigger asChild>

        <Button className="ml-0 bg-neutral-700 text-white rounded-full hover:bg-black/90 w-28 h-10">
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