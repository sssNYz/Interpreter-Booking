"use client";

import React, { useEffect, useState, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { BookingData } from "@/types/booking";
import { extractHHMM as extractHHMMFromUtil } from "@/utils/time";
import { getStatusStyle } from "@/utils/status";
// Date picker removed per requirement

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// Select removed in favor of dropdown multi-select
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
// DropdownMenu not used; using Popover + Command pattern
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterIcon, UserSearchIcon, XIcon,ArrowUpLeft, ArrowUpDown, ChevronDown } from "lucide-react";
import { client as featureFlags } from "@/lib/feature-flags";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

type StatusFilter = "all" | "approve" | "waiting" | "cancel" | "complete";

// monthSpan no longer needed

// format helper kept for future but not used in the new card layout

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
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
};

export default function BookingHistory({ renderEmpty, startDate, endDate }: BookingHistoryProps) {
  const [userEmpCode, setUserEmpCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<Array<Exclude<StatusFilter, "all">>>([
    "approve",
    "waiting",
    "cancel",
  ]);
  // Removed date picker per requirement
  const [interpreterFilterOpen, setInterpreterFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [interpreters, setInterpreters] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInterpreterIds, setSelectedInterpreterIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // dialog state removed in simplified design

  const [page, setPage] = useState(1);
  const pageSize = 4; // show up to 4 cards per page
  const router = useRouter();
  
  // Meeting detail dialog state
  const [meetingDetailDialogOpen, setMeetingDetailDialogOpen] = useState(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<BookingData | null>(null);
  const [fetchedBookingById, setFetchedBookingById] = useState<BookingData | null>(null);
  

  useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setUserEmpCode(parsed.empCode || null);
    } catch {}
  }, []);

  // Reset to page 1 when date filter changes
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  // Load interpreters for filter
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
        // Server paginates, but also keep client pagination UI stable if needed
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError("Failed to load bookings");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [userEmpCode, page, pageSize, statusFilter, sortOrder, startDate, endDate, selectedInterpreterIds, selectedStatuses]);

  // Data returned is already paginated/sorted by API
  const pageItems = bookings;
  const currentPage = page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dialogBooking = fetchedBookingById || selectedBookingForDetail;
  const dialogStatusStyle = dialogBooking ? getStatusStyle(dialogBooking.bookingStatus) : null;
  const dialogStatusLabel = dialogBooking ? formatStatusLabel(dialogBooking.bookingStatus) : "";

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

  // Meeting detail handler
  const handleMeetingDetail = (booking: BookingData) => {
    setSelectedBookingForDetail(booking);
    setMeetingDetailDialogOpen(true);
  };

  // When dialog opens, fetch freshest data for this booking by ID from DB (via owner endpoint)
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
      .catch(() => {
        // Swallow; fall back to existing data
      })
      .finally(() => {
        // no-op
      });
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
      router.push(`/BookingPage?date=${date}&time=${time}`);
    } catch {}
  };

  // Detail dialog handlers not needed in simplified card but retained for future use

  return (
    <div className="w-full h-full border rounded-3xl p-4 flex flex-col bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FilterIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="font-semibold text-lg">My Booking History</span>
        </div>
        <div className="flex items-center gap-2" />
      </div>

      <div className="flex flex-col gap-4 pt-4 flex-1 min-h-0">
        <div className="flex h-12 flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Filter by:</span>
            <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 min-w-[140px] justify-between">
                  Status
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[240px]">
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
                        <XIcon className="w-4 h-4 mr-2" />
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
                            <span className={`mr-2 inline-block w-4 h-4 rounded border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
                            {s.toUpperCase()}
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
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <UserSearchIcon className="w-4 h-4" />
                Interpreter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[280px]">
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
                      <XIcon className="w-4 h-4 mr-2" />
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
                          <span className={`mr-2 inline-block w-4 h-4 rounded border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
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

        <div className="bg-background rounded-xl overflow-hidden flex flex-col h-full min-h-0 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b bg-muted/20">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                Showing {total > 0 ? ((page - 1) * pageSize + 1) : 0}-{Math.min(page * pageSize, total)} of {total} bookings
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
              aria-label="Sort by date"
            >
              Sort by Date
              <ArrowUpDown className="w-4 h-4" />
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
                        <div className="rounded-xl border my-2 p-4 bg-card shadow-lg">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            {/* Left: Date skeleton */}
                            <div className="flex flex-col items-center text-center gap-1">
                              <Skeleton className="h-8 w-8 rounded" />
                              <Skeleton className="h-4 w-12 rounded" />
                            </div>
                            
                            {/* Left: Status skeleton */}
                            <div className="flex justify-start">
                              <Skeleton className="h-7 w-20 rounded-full" />
                            </div>
                            
                            {/* Center: Time and room skeleton */}
                          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                              <Skeleton className="h-10 w-32 rounded" />
                              <Skeleton className="h-4 w-24 rounded" />
                            </div>
                            
                            {/* Right: Interpreter and buttons skeleton */}
                            <div className="flex flex-col gap-2 items-end">
                              <Skeleton className="h-3 w-16 rounded" />
                              <Skeleton className="h-5 w-32 rounded" />
                              <div className="flex gap-2">
                                <Skeleton className="h-7 w-16 rounded" />
                                <Skeleton className="h-7 w-16 rounded" />
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
                    {renderEmpty ? (
                      renderEmpty()
                    ) : (
                      <span>No bookings yet.</span>
                    )}
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
                      <div className="rounded-xl border my-2 p-4 bg-card hover:bg-accent/50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1 cursor-pointer">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          {/* Left: Date */}
                          <div className="flex flex-col items-center text-center">
                            <span className="text-2xl font-bold text-foreground">{dayNumber}</span>
                            <span className="text-sm text-muted-foreground font-medium">{monthName}</span>
                          </div>
                          
                          {/* Left: Status */}
                            <div className="flex justify-start">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${ss.bg} ${ss.text} shadow-sm`}>
                                {ss.icon}
                                {statusLabel}
                              </span>
                            </div>
                          
                          {/* Center: Time duration with room below */}
                          <div className="flex flex-col items-center flex-1 min-w-0">
                            <span className="font-medium text-2xl sm:text-3xl md:text-4xl text-foreground leading-tight text-center">
                              {extractHHMM(b.timeStart as unknown as string)} - {extractHHMM(b.timeEnd as unknown as string)}
                            </span>
                            <span className="text-sm text-muted-foreground mt-1 text-center">
                              Room : {b.meetingRoom || "No room"}
                            </span>
                          </div>
                          
                          {/* Right: Interpreter name with buttons below */}
                          <div className="flex flex-col gap-2 items-start sm:items-end">
                            <span className="text-xs text-muted-foreground text-left sm:text-right">interpreter</span>
                            <span className="font-medium text-foreground text-left sm:text-right">
                              {(b.interpreterName && b.interpreterName.trim()) || b.interpreterId || "Not assigned"}
                            </span>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="px-7 py-1 text-xs bg-neutral-50 text-neutral-700 border-neutral-700 hover:bg-neutral-700 hover:text-neutral-50 rounded-full"
                                onClick={() => handleMeetingDetail(b)}
                              >
                                SEE DETAIL
                              </Button>
                              {featureFlags.enableJumpToCalendar && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="px-3 py-1 text-xs bg-neutral-50 text-neutral-700 border-neutral-700 hover:bg-neutral-700 hover:text-neutral-50 rounded-full"
                                  onClick={() => handleJumpToCalendar(b)}
                                  aria-label="Open in calendar"
                                >
                                  <ArrowUpLeft />
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
              {/* no padding rows; show actual items only */}
            </TableBody>
            <TableCaption className="text-xs">Showing your own bookings only</TableCaption>
          </Table>
          </div>
          
          {(total > pageSize) && (
          <div className="pt-4 border-t bg-muted/20" onClick={(e) => e.preventDefault()}>
            <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={handlePrev} href="#" />
              </PaginationItem>
              
              {/* Smart pagination: show first few, last few, and current page */}
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
                  // Smart pagination for many pages
                  
                  // Always show first page
                  pages.push(
                    <PaginationItem key={1}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === 1}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(1);
                        }}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                  );
                  
                  if (currentPage <= 3) {
                    // Show 1, 2, 3, ..., last
                    for (let i = 2; i <= 3; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                              e.preventDefault();
                              goToPage(i);
                            }}
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    pages.push(
                      <PaginationItem key="ellipsis1">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                    pages.push(
                      <PaginationItem key={totalPages}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === totalPages}
                          onClick={(e) => {
                            e.preventDefault();
                            goToPage(totalPages);
                          }}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (currentPage >= totalPages - 2) {
                    // Show 1, ..., last-2, last-1, last
                    pages.push(
                      <PaginationItem key="ellipsis2">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                    for (let i = totalPages - 2; i <= totalPages; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                              e.preventDefault();
                              goToPage(i);
                            }}
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                  } else {
                    // Show 1, ..., current-1, current, current+1, ..., last
                    pages.push(
                      <PaginationItem key="ellipsis3">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                              e.preventDefault();
                              goToPage(i);
                            }}
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    pages.push(
                      <PaginationItem key="ellipsis4">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                    pages.push(
                      <PaginationItem key={totalPages}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === totalPages}
                          onClick={(e) => {
                            e.preventDefault();
                            goToPage(totalPages);
                          }}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }}
                  
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
         <DialogContent className="w-[min(96vw,1200px)] max-w-[1200px] max-h-[92vh] overflow-hidden p-0 rounded-3xl shadow-2xl border-2 border-primary/10">
           <DialogHeader className="sr-only">
             <DialogTitle>Meeting Detail</DialogTitle>  
           </DialogHeader>
           
           {dialogBooking ? (
             <div className="flex flex-col h-full max-h-[92vh]">
               {/* Hero Section: Date, Time, and Status - Fixed */}
               <div className="relative bg-gradient-to-br from-primary/15 via-primary/8 to-background px-8 py-8 border-b-2 border-primary/10 overflow-hidden">
                 {/* Decorative background shapes */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                 <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
                 
                 <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
                   {/* Date Card + Time */}
                   <div className="flex items-center gap-6">
                     <motion.div 
                       initial={{ scale: 0.9, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       transition={{ duration: 0.3 }}
                       className="bg-gradient-to-br from-white to-primary/5 rounded-3xl px-7 py-5 shadow-xl border-2 border-primary/20 backdrop-blur-sm"
                     >
                       <div className="text-center">
                         <div className="text-6xl font-black text-primary leading-none bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                           {new Date(dialogBooking.timeStart as unknown as string).getDate()}
                         </div>
                         <div className="text-sm font-black text-muted-foreground mt-2 tracking-widest">
                           {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                         </div>
                       </div>
                     </motion.div>
                     
                     <motion.div
                       initial={{ x: -20, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.1 }}
                     >
                       <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight mb-2 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                         {extractHHMM(dialogBooking.timeStart as unknown as string)} - {extractHHMM(dialogBooking.timeEnd as unknown as string)}
                       </div>
                       <div className="text-base text-muted-foreground font-medium">
                         {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                       </div>
                     </motion.div>
                   </div>
                   
                   {/* Status Badge */}
                   {dialogStatusStyle && (
                     <motion.div
                       initial={{ scale: 0.9, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.2 }}
                       className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-base font-black shadow-lg border-2 ${dialogStatusStyle.bg} ${dialogStatusStyle.text} backdrop-blur-sm`}
                     >
                       <span className="text-xl">{dialogStatusStyle.icon}</span>
                       <span className="tracking-wide">{dialogStatusLabel}</span>
                     </motion.div>
                   )}
                 </div>
               </div>

               {/* Scrollable Content Section */}
               <div className="flex-1 overflow-y-auto px-8 py-8 bg-gradient-to-b from-background to-muted/20">
                 <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-8">
                   {/* Left Column */}
                   <div className="space-y-6">
                     {/* Room */}
                     <motion.div
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.1 }}
                       className="group bg-gradient-to-br from-card to-card/50 rounded-3xl p-6 border-2 border-primary/10 shadow-md hover:shadow-xl hover:border-primary/25 transition-all duration-300 hover:-translate-y-1"
                     >
                       <div className="flex items-start gap-4">
                         <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                           <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                           </svg>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">MEETING ROOM</div>
                           <div className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                             {dialogBooking.meetingRoom || 'No room assigned'}
                           </div>
                         </div>
                       </div>
                     </motion.div>
                     
                     {/* Interpreter */}
                     <motion.div
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.2 }}
                       className="group bg-gradient-to-br from-card to-card/50 rounded-3xl p-6 border-2 border-primary/10 shadow-md hover:shadow-xl hover:border-primary/25 transition-all duration-300 hover:-translate-y-1"
                     >
                       <div className="flex items-start gap-4">
                         <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                           <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                           </svg>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">INTERPRETER</div>
                           <div className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                             {dialogBooking.interpreterName || dialogBooking.interpreterId || 'Not assigned'}
                           </div>
                         </div>
                       </div>
                     </motion.div>
                     
                     {/* Application Model */}
                     <motion.div
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.3 }}
                       className="group bg-gradient-to-br from-card to-card/50 rounded-3xl p-6 border-2 border-primary/10 shadow-md hover:shadow-xl hover:border-primary/25 transition-all duration-300 hover:-translate-y-1"
                     >
                       <div className="flex items-start gap-4">
                         <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                           <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                           </svg>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">APPLICATION MODEL</div>
                           <div className="text-xl font-semibold text-foreground break-words leading-relaxed">
                             {dialogBooking.applicableModel || 'No model specified'}
                           </div>
                         </div>
                       </div>
                     </motion.div>
                     
                     {/* Meeting Detail */}
                     <motion.div
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.4 }}
                       className="group bg-gradient-to-br from-card to-card/50 rounded-3xl p-6 border-2 border-primary/10 shadow-md hover:shadow-xl hover:border-primary/25 transition-all duration-300"
                     >
                       <div className="flex items-start gap-4 mb-4">
                         <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                           <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                           </svg>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">MEETING DETAILS</div>
                         </div>
                       </div>
                       <div className="text-base text-foreground/90 leading-relaxed whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto pr-3 pl-14 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                         {dialogBooking.meetingDetail || (
                           <span className="text-muted-foreground italic">No meeting details provided...</span>
                         )}
                       </div>
                     </motion.div>
                   </div>
                   
                   {/* Right Column - Email */}
                   <div className="lg:sticky lg:top-0 lg:self-start">
                     <motion.div
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       transition={{ duration: 0.3, delay: 0.5 }}
                       className="bg-gradient-to-br from-card to-card/50 rounded-3xl p-6 border-2 border-primary/10 shadow-md hover:shadow-xl transition-all duration-300"
                     >
                       <div className="flex items-center gap-3 mb-5">
                         <div className="p-3 rounded-2xl bg-primary/10">
                           <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                           </svg>
                         </div>
                         <div>
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">EMAIL INVITES</div>
                           {dialogBooking.inviteEmails && dialogBooking.inviteEmails.length > 0 && (
                             <div className="text-sm text-primary font-bold mt-0.5">
                               {dialogBooking.inviteEmails.length} {dialogBooking.inviteEmails.length === 1 ? 'recipient' : 'recipients'}
                             </div>
                           )}
                         </div>
                       </div>
                       
                       {dialogBooking.inviteEmails && dialogBooking.inviteEmails.length > 0 ? (
                         <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                           {dialogBooking.inviteEmails.map((email, idx) => (
                             <motion.div
                               key={idx}
                               initial={{ x: 20, opacity: 0 }}
                               animate={{ x: 0, opacity: 1 }}
                               transition={{ duration: 0.2, delay: 0.05 * idx }}
                               className="group flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 hover:from-primary/10 hover:to-primary/5 border border-primary/5 hover:border-primary/20 transition-all duration-200 hover:shadow-md"
                             >
                               <div className="h-3 w-3 rounded-full bg-primary/60 mt-1.5 flex-shrink-0 group-hover:bg-primary group-hover:scale-125 transition-all" />
                               <span className="text-sm text-foreground/90 break-all leading-relaxed font-medium group-hover:text-foreground transition-colors">{email}</span>
                             </motion.div>
                           ))}
                         </div>
                       ) : (
                         <div className="flex flex-col items-center justify-center py-16 text-center">
                           <div className="h-20 w-20 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4 shadow-inner">
                             <svg className="w-10 h-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                             </svg>
                           </div>
                           <p className="text-base font-semibold text-muted-foreground mb-1">No email invites</p>
                           <p className="text-sm text-muted-foreground/60">This meeting has no email recipients</p>
                         </div>
                       )}
                     </motion.div>
                   </div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="p-10 space-y-8">
               <div className="flex items-center gap-8">
                 <Skeleton className="h-24 w-24 rounded-3xl" />
                 <div className="space-y-4 flex-1">
                   <Skeleton className="h-10 w-64" />
                   <Skeleton className="h-6 w-80" />
                 </div>
                 <Skeleton className="h-12 w-32 rounded-full" />
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Skeleton className="h-32 rounded-3xl" />
                 <Skeleton className="h-32 rounded-3xl" />
                 <Skeleton className="h-32 rounded-3xl" />
                 <Skeleton className="h-32 rounded-3xl" />
               </div>
             </div>
           )}
         </DialogContent>
       </Dialog>
    
    </div>
  );
}
