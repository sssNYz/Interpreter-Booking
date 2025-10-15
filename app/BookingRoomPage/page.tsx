"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { client as featureFlags } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, MapPin, Clock, X, Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";

interface Room {
  id: number;
  name: string;
  location: string | null;
  capacity: number;
  isActive: boolean;
}

interface Booking {
  id: string;
  roomId: number;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  readOnly?: boolean; // true when sourced from server (BookingPlan) occupancy
}

const BookingRoom = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [startIndex, setStartIndex] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    roomId: number;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [bookingTitle, setBookingTitle] = useState("");
  
  const VISIBLE_COLUMNS = 5;
  const timeSlots = generateTimeSlots();

  // Fetch rooms
  useEffect(() => {
    let alive = true;
    const loadRooms = async () => {
      try {
        const res = await fetch("/api/admin/add-room?isActive=true", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;
        if (json?.success && Array.isArray(json?.data?.rooms)) {
          setRooms(json.data.rooms);
        } else {
          setRooms([]);
        }
      } catch (e) {
        console.error("Failed to load rooms", e);
        toast.error("Failed to load rooms");
        setRooms([]);
      } finally {
        if (alive) setLoadingRooms(false);
      }
    };
    loadRooms();
    return () => {
      alive = false;
    };
  }, []);

  // Helper to convert "YYYY-MM-DD HH:mm:ss" → "HH:mm"
  function toHM(dateTimeStr: string): string {
    // Expecting 'YYYY-MM-DD HH:mm:ss' or 'HH:mm:ss'
    try {
      const parts = dateTimeStr.split(" ");
      const timePart = parts.length > 1 ? parts[1] : parts[0];
      const [hh, mm] = timePart.split(":");
      return `${hh}:${mm}`;
    } catch {
      return "00:00";
    }
  }

  // Fetch room occupancy (from BookingPlan) for the selected date
  useEffect(() => {
    let alive = true;
    const loadOccupancy = async () => {
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const res = await fetch(`/api/rooms/booked?date=${dateStr}`, { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) {
          setBookings([]);
          return;
        }
        const json = await res.json();
        if (json?.success && Array.isArray(json?.data?.rooms)) {
          const serverBookings: Booking[] = [];
          for (const room of json.data.rooms as Array<{ id: number; name: string; bookings: Array<{ id: number; start: string; end: string; status?: string }> }>) {
            for (const b of room.bookings) {
              serverBookings.push({
                id: String(b.id),
                roomId: room.id,
                title: b.status ? `Booked (${b.status})` : "Booked",
                startTime: toHM(b.start),
                endTime: toHM(b.end),
                date: dateStr,
                readOnly: true,
              });
            }
          }
          setBookings(serverBookings);
        } else {
          setBookings([]);
        }
      } catch (e) {
        console.error("Failed to load room occupancy", e);
        setBookings([]);
      }
    };
    loadOccupancy();
    return () => {
      alive = false;
    };
  }, [selectedDate]);

  function generateTimeSlots() {
    const slots: string[] = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
        slots.push(time);
      }
    }
    return slots;
  }

  const endIndex = Math.min(startIndex + VISIBLE_COLUMNS, rooms.length);
  const displayedRooms = rooms.slice(startIndex, endIndex);
  const placeholderCount = Math.max(0, VISIBLE_COLUMNS - displayedRooms.length);
  
  const canPrev = startIndex > 0;
  const canNext = rooms.length > 0 && startIndex < Math.max(0, rooms.length - VISIBLE_COLUMNS);
  const handlePrev = () => canPrev && setStartIndex((i) => i - 1);
  const handleNext = () => canNext && setStartIndex((i) => i + 1);

  const getRoomImagePath = (roomId: number): string => `/Room/${roomId}.jpg`;

  const isSlotBooked = (roomId: number, time: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.roomId === roomId &&
        b.date === selectedDate.toISOString().split("T")[0] &&
        b.startTime <= time &&
        b.endTime > time
    );
  };

  const handleSlotClick = (roomId: number, time: string) => {
    const booking = isSlotBooked(roomId, time);
    if (booking) {
      // For server-sourced occupancy, do not allow deletion
      if (booking.readOnly) {
        toast.error("This time is already booked.");
        return;
      }
      // Allow removing only locally-created placeholder bookings
      setBookings(bookings.filter((b) => b.id !== booking.id));
      toast.success("Booking removed");
    } else {
      // Create new booking
      const endTime = calculateEndTime(time);
      setSelectedSlot({ roomId, startTime: time, endTime });
      setIsDialogOpen(true);
    }
  };

  const calculateEndTime = (startTime: string): string => {
    const [hours] = startTime.split(":").map(Number);
    return `${hours + 1}:00`;
  };

  const handleCreateBooking = () => {
    if (!selectedSlot || !bookingTitle.trim()) {
      toast.error("Please enter a booking title");
      return;
    }

    const newBooking: Booking = {
      id: Date.now().toString(),
      roomId: selectedSlot.roomId,
      title: bookingTitle,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      date: selectedDate.toISOString().split("T")[0],
    };

    setBookings([...bookings, newBooking]);
    setIsDialogOpen(false);
    setBookingTitle("");
    setSelectedSlot(null);
    toast.success("✅ Booking created successfully!");
  };

  if (!featureFlags.enableRoomBooking) {
    return (
      <div className="flex flex-col gap-4 px-4 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold">Room Booking</h1>
        </div>
        <div className="rounded-xl border bg-white p-6 text-gray-700">
          This feature is coming soon.
        </div>
      </div>
    );
  }

  if (loadingRooms) {
    return (
      <div className="flex flex-col gap-4 px-4 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold">Room Booking</h1>
        </div>
        <div className="rounded-xl border bg-white p-6 text-gray-700">
          Loading rooms...
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold">Room Booking</h1>
        </div>
        <div className="rounded-xl border bg-white p-6 text-gray-700">
          No active rooms available. Please contact admin to add rooms.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Styled title block + Date picker */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 justify-center min-w-[280px] sm:min-w-[370px] rounded-t-4xl bg-neutral-700 px-4 py-2">
              <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
              <h1 className="text-[16px] sm:text-[20px] font-medium text-primary-foreground">Room Booking</h1>
            </div>
            {/* Date picker (shadcn) next to title */}
            <div className="relative">
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date-picker" variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-sm">
                      {selectedDate.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                  <DatePickerCalendar
                    mode="single"
                    selected={selectedDate}
                    month={selectedDate}
                    onMonthChange={(d) => d && setSelectedDate(new Date(d))}
                    onSelect={(d) => {
                      if (d) setSelectedDate(d);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Spacer to push right controls */}
          <div className="flex-1" />

          {/* Right: Room navigation only */}
          <div className="flex items-center gap-3">
            {rooms.length > VISIBLE_COLUMNS && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={!canPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  {startIndex + 1}-{endIndex} of {rooms.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={!canNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <div className="bg-white rounded-2xl shadow-sm border h-full flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="grid" style={{ gridTemplateColumns: `120px repeat(${VISIBLE_COLUMNS}, 1fr)` }}>
            {/* Time column header - sticky top-left */}
            <div className="sticky top-0 left-0 z-30 bg-gray-50 border-b border-r p-4">
              <Clock className="h-5 w-5 text-gray-400 mx-auto" />
            </div>

            {/* Room headers - sticky top */}
            {displayedRooms.map((room) => (
              <div key={room.id} className="sticky top-0 z-20 bg-gray-50 border-b border-r last:border-r-0 p-3">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full rounded-lg overflow-hidden bg-gray-200 relative" style={{ aspectRatio: '4 / 2.5' }}>
                    <img
                      src={getRoomImagePath(room.id)}
                      alt={room.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1';
                          img.src = '/Room/default.jpg';
                        }
                      }}
                    />
                  </div>
                  <div className="text-center w-full">
                    <h3 className="font-semibold text-sm text-gray-900 truncate">
                      {room.name}
                    </h3>
                    <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {room.capacity}
                      </span>
                      {room.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {room.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Placeholder columns to keep grid stable */}
            {Array.from({ length: placeholderCount }).map((_, idx) => (
              <div key={`placeholder-${idx}`} className="sticky top-0 z-20 bg-gray-100 border-b border-r last:border-r-0 p-3">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <div className="w-full rounded-lg bg-gray-300 relative" style={{ aspectRatio: '4 / 3' }}></div>
                  <div className="text-center w-full">
                    <h3 className="font-semibold text-sm text-gray-500">—</h3>
                  </div>
                </div>
              </div>
            ))}

            {/* Time slots */}
            {timeSlots.map((slot) => (
              <React.Fragment key={slot}>
                {/* Time label - sticky left */}
                <div className="sticky left-0 z-10 bg-gray-50 border-b border-r p-3 flex items-start justify-end">
                  <span className="text-xs font-medium text-gray-600">
                    {slot}
                  </span>
                </div>

                {/* Room slots */}
                {displayedRooms.map((room) => {
                  const booking = isSlotBooked(room.id, slot);
                  const isBooked = !!booking;

                  return (
                    <div
                      key={`${room.id}-${slot}`}
                      className={`border-b border-r last:border-r-0 p-2 min-h-[60px] cursor-pointer transition-all ${
                        isBooked
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "bg-white hover:bg-green-50"
                      }`}
                      onClick={() => handleSlotClick(room.id, slot)}
                    >
                      {isBooked ? (
                        <div className="bg-blue-500 text-white rounded-md p-2 h-full flex flex-col justify-between text-xs group relative">
                          <div className="font-medium truncate">{booking.title}</div>
                          <div className="text-blue-100 text-[10px]">
                            {booking.startTime} - {booking.endTime}
                          </div>
                          <div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-90 transition-opacity rounded-md flex items-center justify-center">
                            <X className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-xs text-green-600 font-medium">+ Book</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Placeholder slots */}
                {Array.from({ length: placeholderCount }).map((_, idx) => (
                  <div
                    key={`placeholder-slot-${slot}-${idx}`}
                    className="border-b border-r last:border-r-0 p-2 min-h-[60px] bg-gray-100"
                  ></div>
                ))}
              </React.Fragment>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="e.g., Team Meeting"
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBooking();
                }}
              />
            </div>
            {selectedSlot && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Room:</span>{" "}
                  {rooms.find((r) => r.id === selectedSlot.roomId)?.name}
                </p>
                <p>
                  <span className="font-medium">Time:</span> {selectedSlot.startTime} -{" "}
                  {selectedSlot.endTime}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {selectedDate.toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBooking}>Create Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingRoom;
