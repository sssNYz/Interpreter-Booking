"use client";

import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addMinutes,
  differenceInMinutes,
  format,
  isToday,
  startOfDay,
} from "date-fns";
import type {
  CalendarApi,
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { ResourceLaneContentArg } from "@fullcalendar/resource-common";
import { toast } from "sonner";
import { client as featureFlags } from "@/lib/feature-flags";
import {
  Button,
  type ButtonProps,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
});

type BookingStatus = "booked" | "unavailable";

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
    rawStatus?: string | null;
    createdBy?: string | null;
    description?: string | null;
  };
}

interface FocusPoint {
  roomIndex: number;
  slotIndex: number;
}

interface CreateBookingState {
  roomId: number | null;
  start: Date | null;
  end: Date | null;
  title: string;
  pending: boolean;
}

const SCHEDULER_LICENSE = "GPL-My-Project-Is-Open-Source";
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

  const [bookings, setBookings] = useState<NormalisedBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const [statusFilter, setStatusFilter] = useState<"all" | "booked" | "free" | "unavailable">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [createDialog, setCreateDialog] = useState<CreateBookingState>({
    roomId: null,
    start: null,
    end: null,
    title: "",
    pending: false,
  });

  const [detailsBooking, setDetailsBooking] = useState<NormalisedBooking | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState<number>(0);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const calendarRef = useRef<CalendarApi | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const focusCellRef = useRef<HTMLElement | null>(null);

  const roomsById = useMemo(() => {
    const index = new Map<number, Room>();
    for (const room of rooms) {
      index.set(room.id, room);
    }
    return index;
  }, [rooms]);

  const createDialogRoom = useMemo(() => {
    if (!createDialog.roomId) return null;
    return roomsById.get(createDialog.roomId) ?? null;
  }, [createDialog.roomId, roomsById]);

  const quickFilters: Array<{
    value: typeof statusFilter;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }> = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "booked", label: "Booked" },
      { value: "free", label: "Free" },
      { value: "unavailable", label: "Unavailable" },
    ],
    [],
  );

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return rooms;
    const lookFor = searchTerm.trim().toLowerCase();
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(lookFor) ||
      (room.location ?? "").toLowerCase().includes(lookFor),
    );
  }, [rooms, searchTerm]);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 900);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setActiveRoomIndex((index) => {
      const maxIndex = Math.max(filteredRooms.length - 1, 0);
      return Math.min(index, maxIndex);
    });
  }, [filteredRooms.length]);

  const displayedRooms = useMemo(() => {
    if (!isMobile) {
      return filteredRooms;
    }
    const startIndex = Math.min(activeRoomIndex, Math.max(filteredRooms.length - 1, 0));
    return filteredRooms.slice(startIndex, startIndex + 1);
  }, [activeRoomIndex, filteredRooms, isMobile]);

  const focusCapable = displayedRooms.length > 0 && slotTimes.length > 0;

  const ensureFocusPoint = useCallback(() => {
    if (!focusCapable) {
      setFocusPoint(null);
      return;
    }

    setFocusPoint((current) => {
      if (!current) {
        return { roomIndex: 0, slotIndex: 0 };
      }
      const maxRoomIndex = displayedRooms.length - 1;
      const maxSlotIndex = slotTimes.length - 1;
      return {
        roomIndex: Math.min(current.roomIndex, maxRoomIndex),
        slotIndex: Math.min(current.slotIndex, maxSlotIndex),
      };
    });
  }, [displayedRooms.length, focusCapable]);

  useEffect(() => {
    ensureFocusPoint();
  }, [ensureFocusPoint]);

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

  const fetchBookings = useCallback(async (date: Date, roomsList: Room[]) => {
    if (!BOOKINGS_ENDPOINT) return;
    if (roomsList.length === 0) {
      setBookings([]);
      setBookingsError(null);
      return;
    }

    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const isoDate = format(date, "yyyy-MM-dd");
      const separator = BOOKINGS_ENDPOINT.includes("?") ? "&" : "?";
      const requestUrl = `${BOOKINGS_ENDPOINT}${separator}date=${encodeURIComponent(isoDate)}`;
      const response = await fetch(requestUrl, {
        cache: "no-store",
      });
      if (response.status === 404) {
        setBookings([]);
        setBookingsError(null);
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const json = await response.json();
      const bookingsPayload = json?.data ?? json?.bookings ?? json;
      setBookings(normaliseBookings(bookingsPayload, date, roomsList));
    } catch (error) {
      console.error("Failed to load bookings", error);
      setBookings([]);
      setBookingsError("Could not load bookings");
      toast.error("Could not load bookings");
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!BOOKINGS_ENDPOINT) {
      return;
    }
    if (roomsLoading || rooms.length === 0) {
      return;
    }
    fetchBookings(selectedDate, rooms).catch((error: unknown) => {
      console.error("Booking load aborted", error);
    });
  }, [fetchBookings, rooms, roomsLoading, selectedDate]);

  const appointmentsByRoom = useMemo(() => {
    const map = new Map<number, NormalisedBooking[]>();
    for (const booking of bookings) {
      if (!map.has(booking.roomId)) {
        map.set(booking.roomId, []);
      }
      map.get(booking.roomId)?.push(booking);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [bookings]);

  const findBookingForSlot = useCallback(
    (roomId: number, slotIndex: number) => {
      if (slotIndex < 0 || slotIndex >= slotTimes.length) return null;
      const roomBookings = appointmentsByRoom.get(roomId);
      if (!roomBookings) return null;
      const slotStart = combineDateTime(selectedDate, slotTimes[slotIndex]);
      return (
        roomBookings.find(
          (booking) =>
            booking.start.getTime() <= slotStart.getTime() &&
            booking.end.getTime() > slotStart.getTime(),
        ) ?? null
      );
    },
    [appointmentsByRoom, selectedDate],
  );

  const applyFocusRing = useCallback(() => {
    const container = calendarContainerRef.current;
    const currentFocus = focusPoint;
    if (!container || !currentFocus) return;
    const room = displayedRooms[currentFocus.roomIndex];
    const slot = slotTimes[currentFocus.slotIndex];
    if (!room || !slot) return;
    const selector = `td[data-resource-id="${room.id}"][data-time$="${slot}"]`;
    const target = container.querySelector<HTMLElement>(selector);
    if (!target) return;
    focusCellRef.current?.classList.remove("book-room-focus-cell");
    target.classList.add("book-room-focus-cell");
    focusCellRef.current = target;
  }, [displayedRooms, focusPoint]);

  useEffect(() => {
    applyFocusRing();
  }, [applyFocusRing, bookings, displayedRooms, selectedDate]);

  const gotoSelectedDate = useCallback(() => {
    if (!calendarRef.current) return;
    calendarRef.current.gotoDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    gotoSelectedDate();
  }, [gotoSelectedDate]);

  const resources = useMemo(() => {
    return displayedRooms.map((room) => ({
      id: room.id.toString(),
      title: room.name,
      extendedProps: {
        capacity: room.capacity,
        location: room.location,
        amenities: room.amenities ?? [],
        photoUrl: getPhotoForRoom(room.id, room.photoUrl),
      },
    }));
  }, [displayedRooms]);

  const visibleBookings = useMemo(() => {
    if (statusFilter === "free") {
      return [];
    }
    if (statusFilter === "all") {
      return bookings;
    }
    return bookings.filter((booking) => booking.status === statusFilter);
  }, [bookings, statusFilter]);

  const events: EventInput[] = useMemo(() => {
    return visibleBookings.map((booking) => ({
      id: booking.id,
      resourceId: booking.roomId.toString(),
      start: booking.start.toISOString(),
      end: booking.end.toISOString(),
      title: booking.title,
      display: "block",
      classNames: [
        "book-room-event",
        booking.status === "unavailable"
          ? "book-room-event-unavailable"
          : "book-room-event-booked",
      ],
      extendedProps: {
        status: booking.status,
        meta: booking.meta,
        timeRange: formatTimeRange(booking.start, booking.end),
      },
    }));
  }, [visibleBookings]);

  const handleCalendarRef = useCallback((calendar: { getApi: () => CalendarApi } | null) => {
    if (!calendar) return;
    calendarRef.current = calendar.getApi();
  }, []);

  const handleSelect = useCallback(
    (selection: DateSelectArg) => {
      const resourceId = selection.resource?.id ?? selection.resource?.extendedProps?.id;
      const numericRoomId = Number(resourceId);
      if (!Number.isFinite(numericRoomId)) return;

      const duration = differenceInMinutes(selection.end, selection.start);
      if (duration <= 0) return;

      const overlaps = findBookingForSlot(numericRoomId, slotTimes.findIndex((slot) => {
        const slotStart = combineDateTime(selectedDate, slot);
        return slotStart.getTime() === selection.start.getTime();
      }));

      if (overlaps) {
        setDetailsBooking(overlaps);
        return;
      }

      setCreateDialog({
        roomId: numericRoomId,
        start: selection.start,
        end: selection.end,
        title: "",
        pending: false,
      });
    },
    [findBookingForSlot, selectedDate],
  );

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const booking = bookings.find((item) => item.id === arg.event.id);
    if (booking) {
      setDetailsBooking(booking);
    }
  }, [bookings]);

  const handleFilterClick = useCallback(
    (value: typeof statusFilter) => {
      setStatusFilter(value);
    },
    [],
  );

  const moveFocus = useCallback(
    (deltaRoom: number, deltaSlot: number) => {
      if (!focusCapable) return;
      setFocusPoint((current) => {
        const currentPoint = current ?? { roomIndex: 0, slotIndex: 0 };
        const nextRoom = Math.min(
          Math.max(currentPoint.roomIndex + deltaRoom, 0),
          displayedRooms.length - 1,
        );
        const nextSlot = Math.min(
          Math.max(currentPoint.slotIndex + deltaSlot, 0),
          slotTimes.length - 1,
        );
        return { roomIndex: nextRoom, slotIndex: nextSlot };
      });
    },
    [displayedRooms.length, focusCapable],
  );

  const stepRoom = useCallback(
    (delta: number) => {
      setActiveRoomIndex((index) => {
        const maxIndex = Math.max(filteredRooms.length - 1, 0);
        const nextIndex = Math.min(Math.max(index + delta, 0), maxIndex);
        return nextIndex;
      });
    },
    [filteredRooms.length],
  );

  const handleKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!focusCapable) return;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          moveFocus(-1, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveFocus(1, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveFocus(0, -1);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveFocus(0, 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (!focusPoint) return;
          const room = displayedRooms[focusPoint.roomIndex];
          const slot = slotTimes[focusPoint.slotIndex];
          if (!room || !slot) return;
          const booking = findBookingForSlot(room.id, focusPoint.slotIndex);
          if (booking) {
            setDetailsBooking(booking);
            return;
          }
          const startDate = combineDateTime(selectedDate, slot);
          const endDate = addMinutes(startDate, SLOT_MINUTES);
          setCreateDialog({
            roomId: room.id,
            start: startDate,
            end: endDate,
            title: "",
            pending: false,
          });
          break;
        default:
          break;
      }
    },
    [displayedRooms, findBookingForSlot, focusCapable, focusPoint, moveFocus, selectedDate],
  );

  useEffect(() => {
    if (!isMobile) return;
    const totalRooms = filteredRooms.length;
    if (totalRooms < 2) return;
    const root = calendarContainerRef.current;
    if (!root) return;

    let touchStartX: number | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartX = event.touches[0]?.clientX ?? null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartX == null) return;
      const endX = event.changedTouches[0]?.clientX ?? touchStartX;
      const deltaX = endX - touchStartX;
      if (Math.abs(deltaX) > 60) {
        stepRoom(deltaX < 0 ? 1 : -1);
      }
      touchStartX = null;
    };

    root.addEventListener("touchstart", handleTouchStart, { passive: true });
    root.addEventListener("touchend", handleTouchEnd);

    return () => {
      root.removeEventListener("touchstart", handleTouchStart);
      root.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, stepRoom, filteredRooms.length]);

  const closeCreateDialog = useCallback(() => {
    setCreateDialog({
      roomId: null,
      start: null,
      end: null,
      title: "",
      pending: false,
    });
  }, []);

  const handleCreateBooking = useCallback(async () => {
    if (!createDialog.roomId || !createDialog.start || !createDialog.end) {
      toast.error("Select a valid time");
      return;
    }
    if (!createDialog.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!BOOKINGS_ENDPOINT) {
      const localBooking: NormalisedBooking = {
        id: `temp-${Date.now()}`,
        roomId: createDialog.roomId,
        title: createDialog.title.trim(),
        start: createDialog.start,
        end: createDialog.end,
        status: "booked",
        meta: { rawStatus: "booked", createdBy: null, description: null },
      };
      setBookings((current) =>
        [...current, localBooking].sort((a, b) => a.start.getTime() - b.start.getTime()),
      );
      toast.success("Booking created");
      closeCreateDialog();
      return;
    }

    const payload = {
      roomId: createDialog.roomId,
      title: createDialog.title.trim(),
      start: createDialog.start.toISOString(),
      end: createDialog.end.toISOString(),
    };

    try {
      setCreateDialog((state) => ({ ...state, pending: true }));
      const response = await fetch(BOOKINGS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const json = await response.json();
      const created =
        normaliseBookings(
          Array.isArray(json?.data) ? json?.data : [json?.data ?? json],
          selectedDate,
          rooms,
        )[0] ?? {
          id: `temp-${Date.now()}`,
          roomId: createDialog.roomId,
          title: createDialog.title.trim(),
          start: createDialog.start,
          end: createDialog.end,
          status: "booked" as const,
          meta: { rawStatus: "booked", createdBy: null, description: null },
        };

      setBookings((current) =>
        [...current, created].sort((a, b) => a.start.getTime() - b.start.getTime()),
      );
      toast.success("Booking created");
      closeCreateDialog();
    } catch (error) {
      console.error("Booking creation failed", error);
      toast.error("Could not create booking");
      setCreateDialog((state) => ({ ...state, pending: false }));
    }
  }, [closeCreateDialog, createDialog, rooms, selectedDate]);

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

  const renderResourceLane = useCallback((arg: ResourceLaneContentArg) => {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background/30 text-xs font-medium text-muted-foreground">
        {arg.resource.title}
      </div>
    );
  }, []);

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const status = arg.event.extendedProps.status as BookingStatus;
      const timeRange = arg.event.extendedProps.timeRange as string;
      const meta = (arg.event.extendedProps.meta ?? {}) as NormalisedBooking["meta"];
      const isUnavailable = status === "unavailable";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "group/book-card flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm font-medium shadow-sm transition-[transform,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isUnavailable
                  ? "book-room-event-unavailable"
                  : "book-room-event-booked",
              )}
            >
              <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-foreground">
                {status === "unavailable" ? "Unavailable" : "Booked"}
                <Clock className="size-3.5 text-muted-foreground" />
              </span>
              <span className="truncate text-base font-semibold text-foreground">
                {arg.event.title}
              </span>
              <span className="text-xs text-muted-foreground">{timeRange}</span>
              {meta.createdBy && (
                <span className="text-[11px] text-muted-foreground/80">
                  Created by {meta.createdBy}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent align="start" side="top">
            <div className="flex min-w-[180px] flex-col gap-1">
              <span className="font-semibold text-foreground">{arg.event.title}</span>
              <span className="text-xs">{timeRange}</span>
              {meta.description && (
                <span className="text-xs text-muted-foreground">
                  {meta.description}
                </span>
              )}
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {status === "unavailable" ? "Unavailable" : "Booked"}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    },
    [],
  );

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
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 pb-12 pt-6">
      <style jsx global>{`
        .book-room-calendar .fc-scrollgrid {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid hsl(var(--border));
          box-shadow: var(--tw-shadow, 0 10px 40px rgba(15, 23, 42, 0.08));
        }
        .book-room-calendar .fc-timegrid-slot {
          height: 54px;
          border-bottom: 1px solid hsl(var(--border) / 0.7);
        }
        .book-room-calendar .fc-timegrid-slot.fc-timegrid-slot-lane {
          background-image: linear-gradient(
            to right,
            rgba(148, 163, 184, 0.08) 0,
            rgba(148, 163, 184, 0.08) 1px,
            transparent 1px,
            transparent 100%
          );
          background-size: 60px 100%;
        }
        .book-room-calendar .fc-timegrid-slot-major {
          border-bottom: 1px solid hsl(var(--border));
        }
        .book-room-calendar .fc-timegrid-axis {
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          background-color: hsl(var(--background));
        }
        .book-room-calendar .fc-timegrid-body,
        .book-room-calendar .fc-timegrid-slots {
          background: linear-gradient(
              90deg,
              rgba(226, 232, 240, 0.45) 0,
              rgba(226, 232, 240, 0.45) 1px,
              transparent 1px,
              transparent 100%
            ),
            hsl(var(--background));
          background-size: 60px 100%, 100% 100%;
        }
        .book-room-calendar .fc-col-header,
        .book-room-calendar .fc-col-header-cell {
          background-color: hsl(var(--background));
        }
        .book-room-calendar .fc-col-header-cell {
          padding: 10px 8px;
        }
        .book-room-calendar .fc-col-header-cell-cushion {
          padding: 0 !important;
        }
        .book-room-calendar .fc-resource-timegrid-divider {
          display: none;
        }
        .book-room-calendar .fc-resource-area {
          display: none;
        }
        .book-room-calendar .fc-event {
          border: none;
        }
        .book-room-calendar .fc-timegrid-axis-cushion {
          padding: 0 12px;
        }
        .book-room-calendar .fc-now-indicator-line {
          border-color: #ef4444;
          border-width: 2px;
        }
        .book-room-calendar .fc-scrollgrid-section > td {
          border: none;
        }
        .book-room-event {
          border-width: 1px;
        }
        .book-room-event-booked {
          background-color: rgba(34, 197, 94, 0.18);
          border-color: rgba(34, 197, 94, 0.35);
        }
        .book-room-event-unavailable {
          background: repeating-linear-gradient(
              135deg,
              rgba(148, 163, 184, 0.15),
              rgba(148, 163, 184, 0.15) 6px,
              rgba(148, 163, 184, 0.35) 6px,
              rgba(148, 163, 184, 0.35) 12px
            ),
            rgba(226, 232, 240, 0.7);
          border-color: rgba(148, 163, 184, 0.45);
        }
        td.book-room-focus-cell {
          outline: 3px solid rgba(59, 130, 246, 0.8);
          outline-offset: -2px;
          transition: outline 0.12s ease;
        }
        @media (max-width: 900px) {
          .book-room-calendar .fc-scroller.fc-scroller-liquid-absolute {
            overflow-x: auto;
          }
          .book-room-calendar .fc-resource-area {
            display: none;
          }
        }

        .book-room-gallery::-webkit-scrollbar {
          height: 8px;
        }

        .book-room-gallery::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 999px;
        }
      `}</style>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Room Booking
            </h1>
            <p className="text-sm text-muted-foreground">
              Check availability, review reservations, and create new bookings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() =>
                setSelectedDate((current) => startOfDay(addMinutes(current, -1 * 24 * 60)))
              }
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() =>
                setSelectedDate((current) => startOfDay(addMinutes(current, 24 * 60)))
              }
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays className="size-4" />
                  {format(selectedDate, "EEE, MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(day) => {
                    if (day) {
                      setSelectedDate(startOfDay(day));
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="secondary"
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              disabled={isToday(selectedDate)}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="book-room-gallery flex w-full gap-4 overflow-x-auto pb-1" aria-label="Rooms">
          {filteredRooms.map((room) => (
            <article
              key={room.id}
              className="flex min-w-[240px] max-w-[260px] flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPhotoForRoom(room.id, room.photoUrl)}
                  alt={`${room.name} photo`}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-2 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{room.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {room.capacity ?? "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {room.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {room.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Filter className="size-3.5" />
                    {Array.isArray(room.amenities) && room.amenities.length > 0
                      ? `${room.amenities.length} amenities`
                      : "0 amenities"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search rooms by name or location"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="text-muted-foreground transition hover:text-foreground"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {quickFilters.map((filter) => {
                const buttonVariant: ButtonProps["variant"] =
                  statusFilter === filter.value ? "default" : "outline";
                return (
                  <Button
                    key={filter.value}
                    variant={buttonVariant}
                    size="sm"
                    onClick={() => handleFilterClick(filter.value)}
                    className="rounded-full px-4"
                  >
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </div>
          {bookingsError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <X className="size-4" />
              {bookingsError}
            </div>
          )}
        </div>
      </header>

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

      <div
        ref={calendarContainerRef}
        className="book-room-calendar focus-visible:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyboard}
        role="application"
        aria-label="Room booking calendar"
      >
        <FullCalendar
          ref={handleCalendarRef}
          height="auto"
          plugins={[timeGridPlugin, resourceTimeGridPlugin, interactionPlugin]}
          schedulerLicenseKey={SCHEDULER_LICENSE}
          initialView="resourceTimeGridDay"
          initialDate={selectedDate}
          slotDuration={{ hours: 0, minutes: SLOT_MINUTES }}
          slotLabelInterval={{ hours: 1 }}
          slotMinTime={`${DAY_START_HOUR.toString().padStart(2, "0")}:00:00`}
          slotMaxTime={`${DAY_END_HOUR.toString().padStart(2, "0")}:00:00`}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }}
          nowIndicator={isToday(selectedDate)}
          resources={resources}
          events={events}
          eventContent={renderEventContent}
          resourceLaneContent={renderResourceLane}
          resourceAreaWidth={0}
          headerToolbar={false}
          dayHeaders={false}
          selectable
          selectMirror
          select={handleSelect}
          eventClick={handleEventClick}
          selectOverlap={false}
          longPressDelay={0}
          selectAllow={(selection) => {
            const isSame =
              selection.start.getTime() >= combineDateTime(selectedDate, slotTimes[0]).getTime() &&
              selection.end.getTime() <= combineDateTime(selectedDate, slotTimes[slotTimes.length - 1])
                .getTime() + SLOT_MINUTES * 60 * 1000;
            const duration = differenceInMinutes(selection.end, selection.start);
            return isSame && duration % SLOT_MINUTES === 0 && duration > 0;
          }}
          eventOverlap
          eventMaxStack={3}
          scrollTime={`${Math.min(DAY_START_HOUR + 1, DAY_END_HOUR - 1)
            .toString()
            .padStart(2, "0")}:00:00`}
          loading={(isLoading) => {
            setBookingsLoading(isLoading);
          }}
        />
      </div>

      {bookingsLoading && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="rounded-md border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow">
            Updating…
          </div>
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
