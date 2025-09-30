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
         <DialogContent className="w-[min(96vw,1280px)] max-h-[92dvh] overflow-hidden p-0 rounded-2xl shadow-2xl">
           <DialogHeader className="sr-only">
             <DialogTitle>Meeting Detail</DialogTitle>  
           </DialogHeader>
          <div className="h-full overflow-hidden">
             {/* Header with Date and Status */}
             <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 border-b">
               {dialogBooking ? (
                 <div className="flex items-center justify-between flex-wrap gap-4">
                   <div className="flex items-center gap-4">
                     <div className="bg-white rounded-2xl p-4 shadow-sm">
                       <div className="text-center">
                         <div className="text-3xl font-bold text-foreground">
                           {new Date(dialogBooking.timeStart as unknown as string).getDate()}
                         </div>
                         <div className="text-sm font-medium text-muted-foreground">
                           {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                         </div>
                       </div>
                     </div>
                     <div>
                       <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                        {extractHHMM(dialogBooking.timeStart as unknown as string)} - {extractHHMM(dialogBooking.timeEnd as unknown as string)}
                      </div>
                       <div className="text-sm text-muted-foreground">
                         {new Date(dialogBooking.timeStart as unknown as string).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                       </div>
                     </div>
                   </div>
                   {dialogStatusStyle && (
                     <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${dialogStatusStyle.bg} ${dialogStatusStyle.text}`}>
                       {dialogStatusStyle.icon}
                       <span>{dialogStatusLabel}</span>
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="flex items-center gap-4">
                   <Skeleton className="h-16 w-16 rounded-2xl" />
                   <div className="space-y-2">
                     <Skeleton className="h-6 w-32" />
                     <Skeleton className="h-4 w-48" />
                   </div>
                 </div>
               )}
             </div>

             {/* Content Area */}
             <div className="p-3 md:p-4 overflow-y-auto md:overflow-visible max-h-[calc(92dvh-140px)]">
               {dialogBooking ? (
                <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
                  {/* Left column: room, interpreter, model, detail */}
                  <div className="space-y-4 min-w-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{dialogBooking.meetingRoom || 'No room assigned'}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interpreter</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{dialogBooking.interpreterName || dialogBooking.interpreterId || 'Not assigned'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicable Model</p>
                      <p className="mt-2 text-base text-foreground break-words">{dialogBooking.applicableModel || 'No model specified'}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting Details</p>
                      <div className="mt-2 max-h-[48vh] overflow-y-auto pr-1">
                        <p className="text-sm leading-6 text-foreground whitespace-pre-wrap break-words">{dialogBooking.meetingDetail || 'No meeting details provided...'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right column: emails */}
                  <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Invites</p>
                      {dialogBooking.inviteEmails && dialogBooking.inviteEmails.length > 0 ? (
                        <ul className="mt-3 space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                          {dialogBooking.inviteEmails.map((email, idx) => (
                            <li key={idx} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm text-foreground break-words">
                              <span className="h-2 w-2 rounded-full bg-primary/70" />
                              <span className="flex-1 leading-5">{email}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <Image src="/illustrations/47718920_9169204.svg" alt="No email invites" width={32} height={32} className="opacity-60" />
                          </div>
                          <p className="text-sm">No email invites for this meeting</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </div>
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
       </Dialog>
    
    </div>
  );
}
