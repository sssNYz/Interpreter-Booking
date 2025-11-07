"use client";

import React, { useEffect, useState, MouseEvent, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { BookingData } from "@/types/booking";
import { extractHHMM as extractHHMMFromUtil } from "@/utils/time";
import { getStatusStyle } from "@/utils/status";

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterIcon, UserSearchIcon, XIcon, ArrowUpLeft, ArrowUpDown, ChevronDown, DoorClosed, Languages, ListFilter, Trash2, Edit, Pencil } from "lucide-react";
import { client as featureFlags } from "@/lib/feature-flags";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CopyButton } from "@/components/ui/shadcn-io/copy-button";
import { UserBookingEditDialog } from "./user-booking-edit-dialog";

type StatusFilter = "all" | "approve" | "waiting" | "cancel" | "complete";

function extractHHMM(dateTimeStr: string) {
  return extractHHMMFromUtil(dateTimeStr);
}

const statusLabelMap: Record<string, string> = {
  approve: "Approved",
  waiting: "Waiting",
  cancel: "Cancelled",
  complete: "Completed",
};

function formatStatusLabel(status: string) {
  if (!status) return "";
  const normalized = status.toLowerCase();
  const label = statusLabelMap[normalized];
  if (label) return label;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

type BookingHistoryProps = {
  renderEmpty?: () => React.ReactNode;
  startDate?: string;
  endDate?: string;
};

export default function BookingHistory({ renderEmpty, startDate, endDate }: BookingHistoryProps) {
  // Helper function to render text with highlights
  const renderTextWithHighlights = (text: string) => {
    const parts = text.split(/(<highlight>.*?<\/highlight>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<highlight>') && part.endsWith('</highlight>')) {
        const content = part.replace(/<\/?highlight>/g, '');
        return (
          <span key={index} className="font-bold">
            {content}
          </span>
        );
      }
      return part;
    });
  };

  const [userEmpCode, setUserEmpCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<Array<Exclude<StatusFilter, "all">>>([
    "approve",
    "waiting",
    "cancel",
  ]);
  const [interpreterFilterOpen, setInterpreterFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [bookingTypeFilterOpen, setBookingTypeFilterOpen] = useState(false);
  const [interpreters, setInterpreters] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInterpreterIds, setSelectedInterpreterIds] = useState<string[]>([]);
  const [selectedBookingTypes, setSelectedBookingTypes] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 4;
  const router = useRouter();
  
  const [meetingDetailDialogOpen, setMeetingDetailDialogOpen] = useState(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<BookingData | null>(null);
  const [fetchedBookingById, setFetchedBookingById] = useState<BookingData | null>(null);
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<BookingData | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<BookingData | null>(null);

  // Tutorial modal state
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialApi, setTutorialApi] = useState<CarouselApi | null>(null);
  const [tutorialIndex, setTutorialIndex] = useState(0);

  const tutorialSlides = useMemo(
    () => [
      {
        title: "See Details",
        text: "Click See details to view all details of your booking.",
        image: "/tutorial/4.gif",
      },
      {
        title: "Calendar to filter",
        text: "Use the calendar to filter and find your booking. A dot means there is a booking on that date.",
        image: "/tutorial/5.gif",
      },
    ],
    []
  );

  // Open tutorial on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem('booking_history_tutorial_seen');
      if (seen !== '1') setIsTutorialOpen(true);
    } catch {}
  }, []);

  const closeTutorial = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('booking_history_tutorial_seen', '1');
      }
    } catch {}
    setIsTutorialOpen(false);
  }, []);

  // Sync active slide index
  useEffect(() => {
    if (!tutorialApi) return;
    const onSelect = () => {
      try {
        setTutorialIndex(tutorialApi.selectedScrollSnap() ?? 0);
      } catch {
        setTutorialIndex(0);
      }
    };
    onSelect();
    tutorialApi.on('select', onSelect);
    tutorialApi.on('reInit', onSelect);
    return () => {
      tutorialApi.off('select', onSelect);
    };
  }, [tutorialApi]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setUserEmpCode(parsed.empCode || null);
    } catch {}
  }, []);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    fetch('/api/admin/interpreters', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load interpreters');
        const j = await r.json();
        const data: Array<{ id: string; name: string }> = Array.isArray(j?.data) ? j.data : [];
        if (!aborted) setInterpreters(data);
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      aborted = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!userEmpCode) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status: statusFilter,
      sort: sortOrder,
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedInterpreterIds.length > 0) params.set('interpreterIds', selectedInterpreterIds.join(','));
    if (selectedStatuses.length > 0) params.set('statuses', selectedStatuses.join(','));
    fetch(`/api/booking-data/get-booking-by-owner/${userEmpCode}?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load bookings");
        const j = await r.json();
        setBookings(j.items || []);
        setTotal(Number(j.total || 0));
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError("Failed to load bookings");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [userEmpCode, page, pageSize, statusFilter, sortOrder, startDate, endDate, selectedInterpreterIds, selectedStatuses]);

  // Client-side filter by booking type
  const pageItems = useMemo(() => {
    if (selectedBookingTypes.length === 0) return bookings;
    return bookings.filter((b) => {
      const kind = b.bookingKind || 'INTERPRETER';
      return selectedBookingTypes.includes(kind);
    });
  }, [bookings, selectedBookingTypes]);

  const currentPage = page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dialogBooking = fetchedBookingById || selectedBookingForDetail;
  const dialogStatusStyle = dialogBooking ? getStatusStyle(dialogBooking.bookingStatus) : null;
  const dialogStatusLabel = dialogBooking ? formatStatusLabel(dialogBooking.bookingStatus) : "";
  const dialogInviteEmails = useMemo(() => {
    const a = fetchedBookingById?.inviteEmails;
    if (Array.isArray(a) && a.length > 0) return a;
    const b = selectedBookingForDetail?.inviteEmails;
    return Array.isArray(b) ? b : [];
  }, [fetchedBookingById, selectedBookingForDetail]);

  const safeCopy = useCallback(async (text: string) => {
    try {
      if ((navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const handleCopyInviteEmails = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dialogBooking?.bookingId;
    if (!id) return;
    try {
      const res = await fetch(`/api/booking-data/invite-emails/${encodeURIComponent(String(id))}`);
      const j = await res.json();
      const emails: string[] = Array.isArray(j?.emails) ? j.emails : [];
      const text = emails.join(', ');
      if (text.length === 0) return;
      await safeCopy(text);
    } catch {}
  }, [dialogBooking?.bookingId, safeCopy]);

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return;
    setPage(next);
  };

  const handlePrev = (e: MouseEvent) => {
    e.preventDefault();
    goToPage(page - 1);
  };

  const handleNext = (e: MouseEvent) => {
    e.preventDefault();
    goToPage(page + 1);
  };

  const handleMeetingDetail = (booking: BookingData) => {
    setSelectedBookingForDetail(booking);
    setMeetingDetailDialogOpen(true);
  };

  useEffect(() => {
    const b = selectedBookingForDetail;
    if (!meetingDetailDialogOpen || !b?.bookingId || !b?.ownerEmpCode) {
      return;
    }
    let aborted = false;
    const controller = new AbortController();
    setFetchedBookingById(null);
    const url = `/api/booking-data/get-booking-by-owner/${encodeURIComponent(b.ownerEmpCode)}?page=1&pageSize=100&status=all&sort=desc`;
    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load booking detail");
        const j = await r.json();
        const items: BookingData[] = Array.isArray(j?.items) ? j.items : [];
        const found = items.find((it) => it.bookingId === b.bookingId) || null;
        if (!aborted) setFetchedBookingById(found);
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [meetingDetailDialogOpen, selectedBookingForDetail]);

  const handleJumpToCalendar = (booking: BookingData) => {
    try {
      const start = new Date(booking.timeStart as unknown as string);
      const yyyy = String(start.getFullYear());
      const mm = String(start.getMonth() + 1).padStart(2, "0");
      const dd = String(start.getDate()).padStart(2, "0");
      const hh = String(start.getHours()).padStart(2, "0");
      const mi = String(start.getMinutes()).padStart(2, "0");
      const date = `${yyyy}-${mm}-${dd}`;
      const time = `${hh}:${mi}`;
      const bookingId = encodeURIComponent(String(booking.bookingId));
      router.push(`/BookingPage?date=${date}&time=${time}&bookingId=${bookingId}`);
    } catch {}
  };

  const handleCancelClick = (booking: BookingData) => {
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const handleEditClick = (booking: BookingData) => {
    setBookingToEdit(booking);
    setEditDialogOpen(true);
  };

  const handleEditComplete = () => {
    // Refresh bookings list after edit
    if (!userEmpCode) return;
    
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status: statusFilter,
      sort: sortOrder,
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedInterpreterIds.length > 0) params.set('interpreterIds', selectedInterpreterIds.join(','));
    if (selectedStatuses.length > 0) params.set('statuses', selectedStatuses.join(','));
    
    fetch(`/api/booking-data/get-booking-by-owner/${userEmpCode}?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load bookings");
        const j = await r.json();
        setBookings(j.items || []);
        setTotal(Number(j.total || 0));
      })
      .catch((e) => {
        console.error("Failed to refresh bookings:", e);
      })
      .finally(() => setLoading(false));
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel || !userEmpCode) return;
    
    setCancellingBooking(true);
    try {
      const response = await fetch(`/api/booking-data/cancel-booking/${bookingToCancel.bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmpCode }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel booking');
      }
      
      // Refresh bookings list
      setBookings((prev) => 
        prev.map((b) => 
          b.bookingId === bookingToCancel.bookingId 
            ? { ...b, bookingStatus: 'cancel' } 
            : b
        )
      );
      
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel booking');
    } finally {
      setCancellingBooking(false);
    }
  };

  return (
    <div className="w-full h-full border rounded-[28px] p-5 flex flex-col bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[12px] bg-primary/10">
            <FilterIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="font-medium text-lg">My Booking History</span>
        </div>
        <Button
          onClick={() => setIsTutorialOpen(true)}
          className="fixed bottom-6 right-6 bg-white text-white rounded-full hover:bg-white h-15 w-15 p-0 transition overflow-hidden border-2 border-white shadow-none hover:shadow-none active:shadow-none focus-visible:outline-none focus-visible:ring-0 z-50"
          aria-label="Help"
          title="Help"
        >
          <img src="/mascot/mascot.png" alt="Help" className="w-full h-full object-cover" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 pt-4 flex-1 min-h-0">
        <div className="flex h-11 flex-wrap items-center gap-2.5 px-3 py-2 bg-muted/25 rounded-[16px]">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-normal text-muted-foreground">Filter by:</span>
            <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 min-w-[130px] justify-between rounded-[12px] font-normal">
                  Status
                  <ChevronDown className="w-3.5 h-3.5 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[220px] rounded-[16px]">
                <Command>
                  <CommandList>
                    <CommandGroup heading="Status">
                      <CommandItem
                        onSelect={() => {
                          setStatusFilter('all');
                          setSelectedStatuses([]);
                          setStatusFilterOpen(false);
                        }}
                      >
                        <XIcon className="w-3.5 h-3.5 mr-2" />
                        Clear filter
                      </CommandItem>
                      {(['approve','waiting','cancel','complete'] as Array<Exclude<StatusFilter,'all'>>).map((s) => {
                        const checked = selectedStatuses.includes(s);
                        return (
                          <CommandItem
                            key={s}
                            onSelect={() => {
                              setStatusFilter('all');
                              setSelectedStatuses((prev) => {
                                return checked
                                  ? prev.filter((x) => x !== s)
                                  : [...prev, s];
                              });
                            }}
                          >
                            <span className={`mr-2 inline-block w-3.5 h-3.5 rounded border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
                            {s.toUpperCase()}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover open={bookingTypeFilterOpen} onOpenChange={setBookingTypeFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 rounded-[12px] font-normal">
                  <ListFilter className="w-3.5 h-3.5" />
                  Booking Type
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[220px] rounded-[16px]">
                <Command>
                  <CommandList>
                    <CommandGroup heading="Booking Type">
                      <CommandItem
                        onSelect={() => {
                          setSelectedBookingTypes([]);
                          setBookingTypeFilterOpen(false);
                        }}
                      >
                        <XIcon className="w-3.5 h-3.5 mr-2" />
                        Clear filter
                      </CommandItem>
                      {[
                        { value: 'INTERPRETER', label: 'Interpreter Booking', icon: <Languages className="w-3.5 h-3.5" /> },
                        { value: 'ROOM', label: 'Room Booking', icon: <DoorClosed className="w-3.5 h-3.5" /> }
                      ].map((type) => {
                        const checked = selectedBookingTypes.includes(type.value);
                        return (
                          <CommandItem
                            key={type.value}
                            onSelect={() => {
                              setSelectedBookingTypes((prev) => {
                                return checked
                                  ? prev.filter((x) => x !== type.value)
                                  : [...prev, type.value];
                              });
                            }}
                          >
                            <span className={`mr-2 inline-block w-3.5 h-3.5 rounded border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
                            <span className="flex items-center gap-2">
                              {type.icon}
                              {type.label}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Popover open={interpreterFilterOpen} onOpenChange={setInterpreterFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 rounded-[12px] font-normal">
                <UserSearchIcon className="w-3.5 h-3.5" />
                Interpreter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[260px] rounded-[16px]">
              <Command>
                <CommandInput placeholder="Search interpreter..." />
                <CommandList>
                  <CommandEmpty>No interpreter available</CommandEmpty>
                  <CommandGroup heading="Interpreters">
                    <CommandItem
                      onSelect={() => {
                        setSelectedInterpreterIds([]);
                        setInterpreterFilterOpen(false);
                      }}
                    >
                      <XIcon className="w-3.5 h-3.5 mr-2" />
                      Clear filter
                    </CommandItem>
                    {interpreters.map((it) => {
                      const checked = selectedInterpreterIds.includes(it.id);
                      return (
                        <CommandItem
                          key={it.id}
                          onSelect={() => {
                            setSelectedInterpreterIds((prev) => {
                              return checked
                                ? prev.filter((id) => id !== it.id)
                                : [...prev, it.id];
                            });
                          }}
                        >
                          <span className={`mr-2 inline-block w-3.5 h-3.5 rounded border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
                          {it.name || it.id}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="bg-background rounded-[20px] overflow-hidden flex flex-col h-full min-h-0 shadow-sm border border-border/40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-4">
              <span className="text-sm font-normal text-muted-foreground">
                Showing {total > 0 ? ((page - 1) * pageSize + 1) : 0}-{Math.min(page * pageSize, total)} of {total} bookings
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 rounded-[10px]"
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
              aria-label="Sort by date"
            >
              Sort by Date
              <ArrowUpDown className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Table>
              <TableHeader className="sr-only">
                <TableRow>
                  <TableHead>Booking Information</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={`loading-${i}`} className="border-0">
                        <TableCell colSpan={5} className="p-0">
                          <div className="rounded-[20px] border border-border/40 my-2 p-4 bg-card">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex flex-col items-center text-center gap-1">
                                <Skeleton className="h-7 w-7 rounded-[8px]" />
                                <Skeleton className="h-3 w-10 rounded-[6px]" />
                              </div>
                              <div className="flex justify-start">
                                <Skeleton className="h-6 w-18 rounded-full" />
                              </div>
                              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                <Skeleton className="h-9 w-28 rounded-[8px]" />
                                <Skeleton className="h-3 w-20 rounded-[6px]" />
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <Skeleton className="h-3 w-14 rounded-[6px]" />
                                <Skeleton className="h-4 w-28 rounded-[6px]" />
                                <div className="flex gap-2">
                                  <Skeleton className="h-7 w-20 rounded-full" />
                                  <Skeleton className="h-7 w-8 rounded-full" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-red-500">
                      {error}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && pageItems.length === 0 && (
                  <TableRow className="h-32">
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {renderEmpty ? renderEmpty() : <span>No bookings yet.</span>}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && pageItems.map((b) => {
                  const ss = getStatusStyle(b.bookingStatus);
                  const statusLabel = formatStatusLabel(b.bookingStatus);
                  const dateObj = new Date(b.timeStart as unknown as string);
                  const dayNumber = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString('en', { month: 'short' }).toUpperCase();
                  
                  return (
                    <TableRow key={b.bookingId} className="border-0">
                      <TableCell colSpan={5} className="p-0">
                        <div className="rounded-[20px] border border-border/40 my-2 p-4 bg-card hover:bg-accent/30 hover:border-primary/20 transition-all duration-200 cursor-pointer">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-col items-center text-center">
                              <span className="text-2xl font-medium text-foreground">{dayNumber}</span>
                              <span className="text-xs text-muted-foreground font-normal">{monthName}</span>
                            </div>
                            
                            <div className="flex justify-start">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-normal ${ss.bg} ${ss.text}`}>
                                {ss.icon}
                                {statusLabel}
                              </span>
                            </div>
                          
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <span className="font-normal text-xl sm:text-2xl md:text-3xl text-foreground leading-tight text-center">
                                {extractHHMM(b.timeStart as unknown as string)} - {extractHHMM(b.timeEnd as unknown as string)}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1 text-center font-normal">
                                Room: {b.meetingRoom || "No room"}
                              </span>
                            </div>
                          
                            <div className="flex flex-col gap-2 items-start sm:items-end">
                              {/* Booking type label */}
                              {b.bookingKind === 'ROOM' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-normal bg-gray-100 text-gray-700 border border-gray-400 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-600">
                                  <DoorClosed className="w-3.5 h-3.5" />
                                  Room Booking
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-normal bg-gray-100 text-gray-700 border border-gray-400 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-600">
                                  <Languages className="w-3.5 h-3.5" />
                                  Interpreter Booking
                                </span>
                              )}
                              <div className="flex gap-2">
                                {/* Edit button - only for WAITING status bookings */}
                                {b.bookingStatus.toLowerCase() === 'waiting' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="px-2 py-1 text-xs bg-background hover:bg-primary/10 rounded-full border-border/60"
                                    onClick={() => handleEditClick(b)}
                                    aria-label="Edit booking"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {/* Cancel button - for WAITING status bookings (both ROOM and INTERPRETER) */}
                                {b.bookingStatus.toLowerCase() === 'waiting' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="px-2 py-1 text-xs bg-background hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:border-red-800 rounded-full border-border/60"
                                    onClick={() => handleCancelClick(b)}
                                    aria-label="Cancel booking"
                                    disabled={cancellingBooking}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="px-4 py-1 text-xs font-normal bg-background hover:bg-primary/10 rounded-full border-border/60"
                                  onClick={() => handleMeetingDetail(b)}
                                >
                                  See Detail
                                </Button>
                                {featureFlags.enableJumpToCalendar && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="px-2 py-1 text-xs bg-background hover:bg-primary/10 rounded-full border-border/60"
                                    onClick={() => handleJumpToCalendar(b)}
                                    aria-label="Open in calendar"
                                  >
                                    <ArrowUpLeft className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableCaption className="text-xs font-normal">Showing your own bookings only</TableCaption>
            </Table>
          </div>
          
          {(total > pageSize) && (
            <div className="pt-3 border-t border-border/40 bg-muted/10" onClick={(e) => e.preventDefault()}>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={handlePrev} href="#" />
                  </PaginationItem>
                  
                  {(() => {
                    const pages: React.ReactNode[] = [];
                    const maxVisiblePages = 5;

                    if (totalPages <= maxVisiblePages) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(
                          <PaginationItem key={i}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === i}
                              onClick={(e) => { e.preventDefault(); goToPage(i); }}
                            >
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                    } else {
                      pages.push(
                        <PaginationItem key={1}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === 1}
                            onClick={(e) => { e.preventDefault(); goToPage(1); }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                      );
                      
                      if (currentPage <= 3) {
                        for (let i = 2; i <= 3; i++) {
                          pages.push(
                            <PaginationItem key={i}>
                              <PaginationLink
                                href="#"
                                isActive={currentPage === i}
                                onClick={(e) => { e.preventDefault(); goToPage(i); }}
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        pages.push(<PaginationItem key="ellipsis1"><PaginationEllipsis /></PaginationItem>);
                        pages.push(
                          <PaginationItem key={totalPages}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === totalPages}
                              onClick={(e) => { e.preventDefault(); goToPage(totalPages); }}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(<PaginationItem key="ellipsis2"><PaginationEllipsis /></PaginationItem>);
                        for (let i = totalPages - 2; i <= totalPages; i++) {
                          pages.push(
                            <PaginationItem key={i}>
                              <PaginationLink
                                href="#"
                                isActive={currentPage === i}
                                onClick={(e) => { e.preventDefault(); goToPage(i); }}
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                      } else {
                        pages.push(<PaginationItem key="ellipsis3"><PaginationEllipsis /></PaginationItem>);
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(
                            <PaginationItem key={i}>
                              <PaginationLink
                                href="#"
                                isActive={currentPage === i}
                                onClick={(e) => { e.preventDefault(); goToPage(i); }}
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        pages.push(<PaginationItem key="ellipsis4"><PaginationEllipsis /></PaginationItem>);
                        pages.push(
                          <PaginationItem key={totalPages}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === totalPages}
                              onClick={(e) => { e.preventDefault(); goToPage(totalPages); }}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                    }
                    
                    return pages;
                  })()}
                  
                  <PaginationItem>
                    <PaginationNext onClick={handleNext} href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Detail Dialog */}
      <Dialog open={meetingDetailDialogOpen} onOpenChange={setMeetingDetailDialogOpen}>
        <DialogContent showCloseButton={false} className="w-[min(96vw,1200px)] max-w-[1200px] max-h-[92vh] overflow-hidden p-0 rounded-[32px] shadow-xl border border-primary/10">
          <DialogHeader className="sr-only">
            <DialogTitle>Meeting Detail</DialogTitle>  
          </DialogHeader>
          
          {dialogBooking ? (
            <div className="flex flex-col h-full max-h-[92vh]">
              <div className="relative bg-gradient-to-br from-primary/8 via-primary/4 to-background px-8 py-7 border-b border-primary/10 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
                
                <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
                  <div className="flex items-center gap-5">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white rounded-[24px] px-6 py-4 shadow-sm border border-primary/15"
                    >
                      <div className="text-center">
                        <div className="text-4xl font-medium text-primary leading-none">
                          {new Date(dialogBooking.timeStart as unknown as string).getDate()}
                        </div>
                        <div className="text-xs font-normal text-muted-foreground mt-1.5 tracking-wide">
                          {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <div className="text-2xl md:text-3xl font-medium text-foreground tracking-tight mb-1">
                        {extractHHMM(dialogBooking.timeStart as unknown as string)} - {extractHHMM(dialogBooking.timeEnd as unknown as string)}
                      </div>
                      <div className="text-sm text-muted-foreground font-normal">
                        {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </motion.div>
                  </div>
                  
                  {dialogStatusStyle && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-normal shadow-sm ${dialogStatusStyle.bg} ${dialogStatusStyle.text}`}
                    >
                      <span className="text-base">{dialogStatusStyle.icon}</span>
                      <span>{dialogStatusLabel}</span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-7 bg-gradient-to-b from-background to-muted/10">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6">
                  <div className="space-y-5">
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="group bg-card rounded-[24px] p-5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2.5 rounded-[16px] bg-primary/10 group-hover:bg-primary/15 transition-colors">
                          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Meeting Room</div>
                          <div className="text-xl font-medium text-foreground">
                            {dialogBooking.meetingRoom || 'No room assigned'}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Show interpreter section only for INTERPRETER bookings */}
                    {dialogBooking.bookingKind === 'INTERPRETER' && (
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="group bg-card rounded-[24px] p-5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 rounded-[16px] bg-primary/10 group-hover:bg-primary/15 transition-colors">
                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Interpreter</div>
                            <div className="text-xl font-medium text-foreground">
                              {dialogBooking.interpreterName || dialogBooking.interpreterId || 'Not assigned'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="group bg-card rounded-[24px] p-5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2.5 rounded-[16px] bg-primary/10 group-hover:bg-primary/15 transition-colors">
                          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Applicable Model</div>
                          <div className="text-base font-normal text-foreground break-words leading-relaxed">
                            {dialogBooking.applicableModel || 'No model specified'}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="group bg-card rounded-[24px] p-5 border border-primary/10 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div className="p-2.5 rounded-[16px] bg-primary/10 group-hover:bg-primary/15 transition-colors">
                          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meeting Details</div>
                        </div>
                      </div>
                      <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto pr-2 pl-12 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                        {dialogBooking.meetingDetail || (
                          <span className="text-muted-foreground italic">No meeting details provided...</span>
                        )}
                      </div>
                    </motion.div>
                  </div>
                  
                  <div className="lg:sticky lg:top-0 lg:self-start">
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.5 }}
                      className="bg-card rounded-[24px] p-5 border border-primary/10 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="p-2.5 rounded-[16px] bg-primary/10">
                          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Invites</div>
                          {dialogInviteEmails.length > 0 && (
                            <div className="text-xs text-primary font-medium mt-0.5">
                              {dialogInviteEmails.length} {dialogInviteEmails.length === 1 ? 'recipient' : 'recipients'}
                            </div>
                          )}
                        </div>
                        <CopyButton
                          type="button"
                          // Let onClick handle DB fetch + copy; keep content undefined to skip internal copy
                          content={undefined}
                          variant="outline"
                          size="sm"
                          aria-label="Copy all emails"
                          disabled={!dialogBooking?.bookingId}
                          onClick={handleCopyInviteEmails}
                        />
                      </div>
                      
                      {dialogInviteEmails.length > 0 ? (
                        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                          {dialogInviteEmails.map((email, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ x: 10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ duration: 0.2, delay: 0.05 * idx }}
                              className="group flex items-start gap-2.5 p-3 rounded-[16px] bg-muted/50 hover:bg-primary/8 border border-transparent hover:border-primary/15 transition-all duration-200"
                            >
                              <div className="h-2 w-2 rounded-full bg-primary/60 mt-1.5 flex-shrink-0 group-hover:bg-primary transition-all" />
                              <span className="text-sm text-foreground/80 break-all leading-relaxed font-normal group-hover:text-foreground transition-colors">{email}</span>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                            <svg className="w-8 h-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground mb-0.5">No email invites</p>
                          <p className="text-xs text-muted-foreground/60">This meeting has no email recipients</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-[24px]" />
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-8 w-56" />
                  <Skeleton className="h-5 w-72" />
                </div>
                <Skeleton className="h-10 w-28 rounded-full" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Skeleton className="h-28 rounded-[24px]" />
                <Skeleton className="h-28 rounded-[24px]" />
                <Skeleton className="h-28 rounded-[24px]" />
                <Skeleton className="h-28 rounded-[24px]" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tutorial Modal */}
      <Modal
        backdrop="blur"
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        hideCloseButton
        classNames={{ backdrop: "backdrop-blur-md backdrop-saturate-150" }}
      >
        <ModalContent className="text-white max-w-5xl sm:max-w-7xl w-[min(96vw,85rem)] !border-0 !outline-none !ring-0 rounded-3xl" style={{ backgroundColor: '#262626' }}>
          {() => (
            <>
              <ModalBody className="py-6 px-6 sm:px-8">
                <div className="flex flex-col gap-6 items-center">
                  {/* Picture on top */}
                  <div className="w-full flex justify-center px-4 sm:px-8">
                    <img
                      src={tutorialSlides[tutorialIndex]?.image}
                      alt="Booking history help"
                      className="w-full h-auto max-h-[450px] sm:max-h-[550px] object-cover rounded-xl"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Text below */}
                  <div className="w-full">
                    <Carousel className="w-full" setApi={setTutorialApi}>
                      <CarouselContent>
                        {tutorialSlides.map((s, idx) => (
                          <CarouselItem key={idx}>
                            <div className="space-y-2 leading-relaxed px-4 sm:px-8 text-center">
                              <p className="text-xl sm:text-2xl font-medium text-white">{s.title}</p>
                              <p className="text-base sm:text-lg text-gray-300 whitespace-pre-line">
                                {renderTextWithHighlights(s.text)}
                              </p>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex items-center justify-between mt-4 px-4">
                        <CarouselPrevious className="static translate-x-0 bg-black hover:bg-black/80 text-white border-black" />
                        <CarouselNext className="static translate-x-0 bg-black hover:bg-black/80 text-white border-black" />
                      </div>
                    </Carousel>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="justify-center pb-6">
                <Button onClick={closeTutorial} className="bg-neutral-700 text-white hover:bg-black/90 px-12 py-2 text-base">Got it</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-foreground" />
              Cancel Room Booking
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to cancel this room booking?
            </p>
            
            {bookingToCancel && (
              <div className="bg-muted/30 rounded-[16px] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <DoorClosed className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{bookingToCancel.meetingRoom}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(bookingToCancel.timeStart as unknown as string).toLocaleDateString('en', { 
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {extractHHMM(bookingToCancel.timeStart as unknown as string)} - {extractHHMM(bookingToCancel.timeEnd as unknown as string)}
                </div>
              </div>
            )}
            
            <p className="text-sm text-red-600 mt-4">
              This action cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setBookingToCancel(null);
              }}
              disabled={cancellingBooking}
              className="rounded-full"
            >
              No, Keep it
            </Button>
            <Button
              onClick={handleCancelConfirm}
              disabled={cancellingBooking}
              className="rounded-full text-white hover:bg-black/90"
              style={{ backgroundColor: '#262626' }}
            >
              {cancellingBooking ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <UserBookingEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        booking={bookingToEdit}
        onEditComplete={handleEditComplete}
      />
    </div>
  );
}
