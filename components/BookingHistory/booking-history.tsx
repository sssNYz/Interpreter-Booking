"use client";

import React, { useEffect, useState, MouseEvent } from "react";
import type { BookingData } from "@/types/booking";
import { extractHHMM as extractHHMMFromUtil } from "@/utils/time";
import { getStatusStyle } from "@/utils/status";
// Date picker removed per requirement

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { FilterIcon, UserSearchIcon, XIcon, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "approve" | "waiting" | "cancel";

// monthSpan no longer needed

// format helper kept for future but not used in the new card layout

function extractHHMM(dateTimeStr: string) {
  return extractHHMMFromUtil(dateTimeStr);
}

type BookingHistoryProps = {
  renderEmpty?: () => React.ReactNode;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
};

export default function BookingHistory({ renderEmpty, startDate, endDate }: BookingHistoryProps) {
  const [userEmpCode, setUserEmpCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Removed date picker per requirement
  const [interpreterFilterOpen, setInterpreterFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // dialog state removed in simplified design

  const [page, setPage] = useState(1);
  const pageSize = 4; // show up to 4 cards per page

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
  }, [userEmpCode, page, pageSize, statusFilter, sortOrder, startDate, endDate]);

  // Data returned is already paginated/sorted by API
  const pageItems = bookings;
  const currentPage = page;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 px-3 min-w-[100px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approve">Approved</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="cancel">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
                <CommandInput placeholder="Search interpreter..." disabled />
                <CommandList>
                  <CommandEmpty>No interpreter available</CommandEmpty>
                  <CommandGroup heading="Interpreters">
                    <CommandItem disabled>
                      <XIcon className="w-4 h-4" />
                      No interpreter available
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="bg-background rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
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
                          <div className="flex items-center justify-between gap-4">
                            {/* Left: Date skeleton */}
                            <div className="flex flex-col items-center text-center gap-1">
                              <Skeleton className="h-8 w-8 rounded" />
                              <Skeleton className="h-4 w-12 rounded" />
                            </div>
                            
                            {/* Left: Status skeleton */}
                            <div className="flex justify-start ml-8">
                              <Skeleton className="h-7 w-20 rounded-full" />
                            </div>
                            
                            {/* Center: Time and room skeleton */}
                            <div className="flex flex-col items-center gap-2 flex-1">
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
                const dateObj = new Date(b.timeStart as unknown as string);
                const dayNumber = dateObj.getDate();
                const monthName = dateObj.toLocaleDateString('en', { month: 'short' }).toUpperCase();
                
                return (
                  <TableRow key={b.bookingId} className="border-0">
                    <TableCell colSpan={5} className="p-0">
                      <div className="rounded-xl border my-2 p-4 bg-card hover:bg-accent/50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1 cursor-pointer">
                        <div className="flex items-center justify-between gap-4">
                          {/* Left: Date */}
                          <div className="flex flex-col items-center text-center">
                            <span className="text-2xl font-bold text-foreground">{dayNumber}</span>
                            <span className="text-sm text-muted-foreground font-medium">{monthName}</span>
                          </div>
                          
                          {/* Left: Status */}
                          <div className="flex justify-start ml-8">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${ss.bg} ${ss.text} shadow-sm`}>
                              {ss.icon}
                              {b.bookingStatus.toUpperCase()}
                            </span>
                          </div>
                          
                          {/* Center: Time duration with room below */}
                          <div className="flex flex-col items-center flex-1">
                            <span className="font-medium text-3xl md:text-4xl text-foreground leading-tight">
                              {extractHHMM(b.timeStart as unknown as string)} - {extractHHMM(b.timeEnd as unknown as string)}
                            </span>
                            <span className="text-sm text-muted-foreground mt-1 text-center">
                              Room : {b.meetingRoom || "No room"}
                            </span>
                          </div>
                          
                          {/* Right: Interpreter name with buttons below */}
                          <div className="flex flex-col gap-2 items-end">
                            <span className="text-xs text-muted-foreground text-right">interpreter</span>
                            <span className="font-medium text-foreground text-right">
                              {(b.interpreterName && b.interpreterName.trim()) || b.interpreterId || "Not assigned"}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="px-3 py-1 text-xs">
                                button1
                              </Button>
                              <Button size="sm" variant="outline" className="px-3 py-1 text-xs">
                                button2
                              </Button>
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

     
    </div>
  );
}


