"use client";

import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addMinutes,
  differenceInMinutes,
  format,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import { client as featureFlags } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, MapPin, Clock, X, Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  capacity: number | null;
  isActive: boolean;
  amenities?: string[] | null;
  photoUrl?: string | null;
}

interface RawBooking {
  id?: string | number;
  bookingId?: string | number;
  roomId?: number;
  meetingRoomId?: number;
  meetingRoom?: number | string | null;
  title?: string | null;
  meetingDetail?: string | null;
  meetingType?: string | null;
  status?: string | null;
  bookingStatus?: string | null;
  timeStart?: string;
  start?: string;
  startTime?: string;
  timeEnd?: string;
  end?: string;
  endTime?: string;
  createdBy?: string | null;
  owner?: string | null;
  description?: string | null;
}

interface NormalisedBooking {
  id: string;
  roomId: number;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  meta: {
    rawStatus: string | null;
    createdBy: string | null;
    description: string | null;
  };
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

type BookingStatus = "booked" | "unavailable";

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;
const BOOKINGS_ENDPOINT = process.env.NEXT_PUBLIC_ROOM_BOOKINGS_ENDPOINT ?? null;

const formatTimeRange = (start: Date, end: Date): string => {
  return `${format(start, "p")} – ${format(end, "p")}`;
};

const normaliseStatus = (value: unknown): BookingStatus => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "booked";
  if (
    raw.includes("unavailable") ||
    raw.includes("maintenance") ||
    raw.includes("blocked") ||
    raw.includes("closed")
  ) {
    return "unavailable";
  }
  return "booked";
};

const combineDateTime = (date: Date, time: string): Date => {
  const [hour, minute] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hour ?? 0, minute ?? 0, 0, 0);
  return combined;
};

const generateSlots = (): string[] => {
  const slots: string[] = [];
  const startMinutes = DAY_START_HOUR * 60;
  const endMinutes = DAY_END_HOUR * 60;
  for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const hourString = hour.toString().padStart(2, "0");
    const minuteString = minute.toString().padStart(2, "0");
    slots.push(`${hourString}:${minuteString}`);
  }
  return slots;
};

const slotTimes = generateSlots();

const findNextSlot = (time: Date): Date => addMinutes(time, SLOT_MINUTES);

const normaliseBookings = (
  payload: unknown,
  selectedDate: Date,
  rooms: Room[],
): NormalisedBooking[] => {
  if (!Array.isArray(payload)) return [];

  const roomIdLookup = new Map<number, Room>();
  const roomNameLookup = new Map<string, Room>();
  for (const room of rooms) {
    roomIdLookup.set(room.id, room);
    roomNameLookup.set(room.name.trim().toLowerCase(), room);
  }

  const dayStart = startOfDay(selectedDate);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  return payload
    .map<NormalisedBooking | null>((raw: RawBooking) => {
      let roomId: number | null = null;
      if (typeof raw.roomId === "number" && !Number.isNaN(raw.roomId)) {
        roomId = raw.roomId;
      } else if (typeof raw.meetingRoomId === "number" && !Number.isNaN(raw.meetingRoomId)) {
        roomId = raw.meetingRoomId;
      } else if (
        typeof raw.meetingRoom === "number" &&
        !Number.isNaN(raw.meetingRoom)
      ) {
        roomId = raw.meetingRoom;
      } else if (typeof raw.meetingRoom === "string") {
        const match = roomNameLookup.get(raw.meetingRoom.trim().toLowerCase());
        if (match) {
          roomId = match.id;
        }
      }

      if (!roomId || Number.isNaN(roomId)) return null;
      if (!roomIdLookup.has(roomId) && typeof raw.meetingRoom === "string") {
        const fallback = roomNameLookup.get(raw.meetingRoom.trim().toLowerCase());
        if (fallback) {
          roomId = fallback.id;
        }
      }

      if (!roomId || Number.isNaN(roomId) || !roomIdLookup.has(roomId)) return null;

      const startValue = raw.start ?? raw.startTime ?? raw.timeStart;
      const endValue = raw.end ?? raw.endTime ?? raw.timeEnd;

      if (!startValue && !endValue) return null;

      const startCandidate = startValue ? new Date(startValue) : new Date(dayStart);
      let endCandidate = endValue
        ? new Date(endValue)
        : addMinutes(startCandidate, SLOT_MINUTES);

      if (Number.isNaN(startCandidate.getTime()) || Number.isNaN(endCandidate.getTime())) {
        return null;
      }

      if (endCandidate <= startCandidate) {
        endCandidate = addMinutes(startCandidate, SLOT_MINUTES);
      }

      const overlapsDay =
        startCandidate < dayEnd && endCandidate > dayStart;
      if (!overlapsDay) return null;

      const idValue = raw.id ?? raw.bookingId ?? `${roomId}-${startCandidate.toISOString()}`;
      const rawStatus = raw.status ?? raw.bookingStatus ?? null;
      const statusLower = String(rawStatus ?? "").toLowerCase();
      if (statusLower.includes("cancel") || statusLower.includes("delete")) {
        return null;
      }
      const status = normaliseStatus(rawStatus);
      const title =
        raw.title ??
        raw.meetingDetail ??
        raw.meetingType ??
        (status === "unavailable" ? "Unavailable" : "Booking");

      return {
        id: String(idValue),
        roomId,
        title,
        start: startCandidate,
        end: endCandidate,
        status,
        meta: {
          rawStatus,
          createdBy: raw.createdBy ?? raw.owner ?? null,
          description: raw.description ?? raw.meetingDetail ?? null,
        },
      };
    })
    .filter((booking): booking is NormalisedBooking => Boolean(booking))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

const getPhotoForRoom = (roomId: number, fallback?: string | null): string => {
  if (fallback) return fallback;
  return `/Room/${roomId}.jpg`;
};

const BookingRoomPage = (): JSX.Element => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [focusPoint, setFocusPoint] = useState<{ roomIndex: number; slotIndex: number } | null>(null);
  const [createDialog, setCreateDialog] = useState<{
    roomId: number;
    start: Date;
    end: Date;
    title: string;
    pending: boolean;
  }>({ roomId: 0, start: new Date(), end: new Date(), title: "", pending: false });
  const [detailsBooking, setDetailsBooking] = useState<NormalisedBooking | null>(null);

  const VISIBLE_COLUMNS = 5;
  const SLOT_HEIGHT_PX = 60; // fixed height for each 30-min slot

  // Fetch rooms
  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 900);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);


  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      setRoomsLoading(true);
      setRoomsError(null);
      try {
        const params = new URLSearchParams({
          isActive: "true",
          pageSize: "100",
        });
        const response = await fetch(`/api/admin/add-room?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        const json = await response.json();
        if (cancelled) return;
        const dataRooms: Room[] = Array.isArray(json?.data?.rooms) ? json.data.rooms : [];
        setRooms(dataRooms);
      } catch (error) {
        console.error("Failed to load rooms", error);
        if (!cancelled) {
          setRooms([]);
          setRoomsError("Could not load rooms");
          toast.error("Could not load rooms");
        }
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
        }
      }
    };
    loadRooms();
    return () => {
      cancelled = true;
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

  // Helper to format local date as YYYY-MM-DD (avoid UTC shifting)
  function toYMDLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function hmToMinutes(hm: string): number {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  }

  function slotsSpanned(startHM: string, endHM: string): number {
    const diff = Math.max(0, hmToMinutes(endHM) - hmToMinutes(startHM));
    return Math.max(1, Math.ceil(diff / 30));
  }

  // Fetch room occupancy (from BookingPlan) for the selected date
  useEffect(() => {
    let alive = true;
    const loadOccupancy = async () => {
      try {
        const dateStr = toYMDLocal(selectedDate);
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

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
        slots.push(time);
      }
    }
    return slots;
  }, []);

  const filteredRooms = useMemo(() => rooms.filter(r => r.isActive), [rooms]);

  const endIndex = Math.min(startIndex + VISIBLE_COLUMNS, rooms.length);
  const displayedRooms = useMemo(() => {
    if (!isMobile) {
      return rooms.slice(startIndex, endIndex);
    }
    const idx = Math.min(activeRoomIndex, Math.max(rooms.length - 1, 0));
    return rooms.slice(idx, idx + 1);
  }, [isMobile, activeRoomIndex, rooms, startIndex, endIndex]);

  const placeholderCount = Math.max(0, VISIBLE_COLUMNS - displayedRooms.length);

  const getRoomImagePath = (roomId: number): string => {
    return `/Room/${roomId}.jpg`;
  };

  const createDialogRoom = useMemo(() => {
    return rooms.find(r => r.id === createDialog.roomId);
  }, [rooms, createDialog.roomId]);

  const closeCreateDialog = useCallback(() => {
    setCreateDialog({ roomId: 0, start: new Date(), end: new Date(), title: "", pending: false });
  }, []);

  const stepRoom = useCallback((delta: number) => {
    setActiveRoomIndex(prev => {
      const next = prev + delta;
      return Math.max(0, Math.min(next, filteredRooms.length - 1));
    });
  }, [filteredRooms.length]);


  
  const canPrev = startIndex > 0;
  const canNext = rooms.length > 0 && startIndex < Math.max(0, rooms.length - VISIBLE_COLUMNS);
  const handlePrev = () => canPrev && setStartIndex((i) => i - 1);
  const handleNext = () => canNext && setStartIndex((i) => i + 1);

  const isSlotBooked = (roomId: number, time: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.roomId === roomId &&
        b.date === toYMDLocal(selectedDate) &&
        b.startTime <= time &&
        b.endTime > time
    );
  };

  const handleSlotClick = useCallback((roomId: number, time: string) => {
    const booking = isSlotBooked(roomId, time);
    if (booking) {
      if (booking.readOnly) {
        toast.error("This time is already booked.");
        return;
      }
      // Allow removing locally-created bookings
      setBookings(prev => prev.filter((b) => b.id !== booking.id));
      toast.success("Booking removed");
    } else {
      // Create new booking
      const [hours, minutes] = time.split(":").map(Number);
      const endHour = hours + 1;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

      const start = combineDateTime(selectedDate, time);
      const end = combineDateTime(selectedDate, endTime);

      setCreateDialog({
        roomId,
        start,
        end,
        title: "",
        pending: false,
      });
    }
  }, [bookings, selectedDate]);


  const handleCreateBooking = useCallback(async () => {
    if (!createDialog.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!createDialog.roomId) {
      toast.error("Please select a room");
      return;
    }

    const newBooking: Booking = {
      id: `temp-${Date.now()}`,
      roomId: createDialog.roomId,
      title: createDialog.title.trim(),
      startTime: format(createDialog.start, "HH:mm"),
      endTime: format(createDialog.end, "HH:mm"),
      date: toYMDLocal(selectedDate),
    };

    setBookings((current) => [...current, newBooking]);
    toast.success("Booking created");
    closeCreateDialog();
  }, [closeCreateDialog, createDialog, selectedDate]);

  const handleDeleteBooking = useCallback(async (booking: NormalisedBooking) => {
    if (!BOOKINGS_ENDPOINT) {
      setBookings((current) => current.filter((item) => item.id !== booking.id));
      toast.success("Booking removed");
      setDetailsBooking(null);
      return;
    }

    try {
      const baseUrl = BOOKINGS_ENDPOINT.endsWith("/")
        ? BOOKINGS_ENDPOINT.slice(0, -1)
        : BOOKINGS_ENDPOINT;
      const response = await fetch(`${baseUrl}/${booking.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      setBookings((current) => current.filter((item) => item.id !== booking.id));
      toast.success("Booking removed");
      setDetailsBooking(null);
    } catch (error) {
      console.error("Failed to delete booking", error);
      toast.error("Could not delete booking");
    }
  }, []);


  if (!featureFlags.enableRoomBooking) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Room Booking</h1>
          <p className="text-muted-foreground">
            Room booking experience will be available soon.
          </p>
        </header>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          This feature is turned off.
        </div>
      </div>
    );
  }

  if (roomsLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </header>
        <div className="rounded-xl border bg-card p-6">
          <div className="grid gap-3">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-[480px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (roomsError || rooms.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Room Booking</h1>
          <p className="text-muted-foreground">
            Manage rooms, bookings, and availability.
          </p>
        </header>
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <CalendarDays className="size-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">No rooms today</h2>
            <p className="text-muted-foreground">
              {roomsError ?? "There are no active rooms to show right now."}
            </p>
          </div>
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
                <div className="sticky left-0 z-10 bg-gray-50 border-b border-r p-3 flex items-start justify-end h-[60px]">
                  <span className="text-xs font-medium text-gray-600">
                    {slot}
                  </span>
                </div>

                {/* Room slots */}
                {displayedRooms.map((room) => {
                  const booking = isSlotBooked(room.id, slot);
                  const isBooked = !!booking;
                  const isStart = isBooked && booking!.startTime === slot;

                  return (
                    <div
                      key={`${room.id}-${slot}`}
                      className={`border-b border-r last:border-r-0 p-2 h-[60px] cursor-pointer transition-all relative ${
                        isBooked
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "bg-white hover:bg-black/20"
                      }`}
                      onClick={() => handleSlotClick(room.id, slot)}
                    >
                      {isBooked ? (
                        isStart ? (
                          <div
                            className="absolute inset-x-1 top-1 z-10 text-white rounded-md p-2 text-xs shadow-md"
                            style={{
                              height: `${slotsSpanned(booking!.startTime, booking!.endTime) * SLOT_HEIGHT_PX - 8}px`,
                              backgroundColor: '#8BA888',
                            }}
                          >
                            <div className="font-medium truncate">{booking!.title}</div>
                            <div className="text-white/80 text-[10px]">
                              {booking!.startTime} - {booking!.endTime}
                            </div>
                          </div>
                        ) : null
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-xs text-black font-medium">+ Book</span>
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
          {bookingsError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <X className="size-4" />
              {bookingsError}
            </div>
          )}
        </div>
      </div>

      {isMobile && filteredRooms.length > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => stepRoom(-1)}
            disabled={activeRoomIndex === 0}
            aria-label="Previous room"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Room
            </span>
            <span className="text-base font-semibold">
              {displayedRooms[0]?.name ?? filteredRooms[activeRoomIndex]?.name}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => stepRoom(1)}
            disabled={activeRoomIndex >= filteredRooms.length - 1}
            aria-label="Next room"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}


      <Dialog
        open={Boolean(createDialog.roomId)}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog();
        }}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="booking-title">Title</Label>
              <Input
                id="booking-title"
                placeholder="Team sync"
                autoFocus
                value={createDialog.title}
                onChange={(event) =>
                  setCreateDialog((state) => ({ ...state, title: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Room</Label>
              <div className="flex items-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/40 px-3 py-2">
                <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {createDialogRoom ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`${createDialogRoom.name} photo`}
                        src={getPhotoForRoom(createDialogRoom.id, createDialogRoom.photoUrl)}
                        className="size-full object-cover"
                      />
                    </>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Select
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {createDialogRoom?.name ?? "Pick a slot"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {createDialogRoom
                      ? [
                          createDialogRoom.location ?? "No location",
                          createDialogRoom.capacity != null
                            ? `${createDialogRoom.capacity} seats`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No extra details"
                      : "Tap an empty cell in the grid"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Starts</Label>
              <Input
                value={
                  createDialog.start ? format(createDialog.start, "MMM d, yyyy — p") : ""
                }
                readOnly
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="booking-end">Ends</Label>
              <Select
                value={
                  createDialog.end
                    ? format(createDialog.end, "HH:mm")
                    : createDialog.start
                      ? format(findNextSlot(createDialog.start), "HH:mm")
                      : undefined
                }
                onValueChange={(value) => {
                  if (!createDialog.start) return;
                  const nextEnd = combineDateTime(
                    createDialog.start,
                    value,
                  );
                  setCreateDialog((state) => ({
                    ...state,
                    end: nextEnd <= state.start ? findNextSlot(state.start) : nextEnd,
                  }));
                }}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {slotTimes
                    .filter((slot) => {
                      if (!createDialog.start) return true;
                      const slotDate = combineDateTime(createDialog.start, slot);
                      return slotDate > createDialog.start;
                    })
                    .map((timeSlot) => (
                      <SelectItem key={timeSlot} value={timeSlot}>
                        {format(combineDateTime(selectedDate, timeSlot), "p")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeCreateDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBooking}
              disabled={createDialog.pending}
            >
              {createDialog.pending ? "Saving…" : "Save booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsBooking)} onOpenChange={(open) => !open && setDetailsBooking(null)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Booking details</DialogTitle>
          </DialogHeader>
          {detailsBooking && (
            <div className="grid gap-3 py-2 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Title</p>
                <p className="font-medium text-foreground">{detailsBooking.title}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Time</p>
                <p className="font-medium text-foreground">
                  {formatTimeRange(detailsBooking.start, detailsBooking.end)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs">
                  <Users className="size-3.5" />
                  Room {detailsBooking.roomId}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs">
                  <Clock className="size-3.5" />
                  {differenceInMinutes(detailsBooking.end, detailsBooking.start)} minutes
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                    detailsBooking.status === "unavailable"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {detailsBooking.status === "unavailable" ? "Unavailable" : "Booked"}
                </span>
              </div>
              {detailsBooking.meta.description && (
                <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                  {detailsBooking.meta.description}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDetailsBooking(null)}>
              Close
            </Button>
            {detailsBooking && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteBooking(detailsBooking)}
              >
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingRoomPage;
