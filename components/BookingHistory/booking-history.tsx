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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { FilterIcon, UserSearchIcon, XIcon, User, Mail, Users, ListCollapse, MapPin, Clock, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "approve" | "waiting" | "cancel";

// monthSpan no longer needed

function formatDateDDMMMYYYY(dateStr: string) {
  // dateStr can be 'YYYY-MM-DD HH:mm:ss' or ISO
  const date = (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]);
  const [y, m, d] = date.split('-').map(Number);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

function extractHHMM(dateTimeStr: string) {
  return extractHHMMFromUtil(dateTimeStr);
}

type BookingHistoryProps = {
  renderEmpty?: () => React.ReactNode;
};

export default function BookingHistory({ renderEmpty }: BookingHistoryProps) {
  const [userEmpCode, setUserEmpCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Removed date picker per requirement
  const [interpreterFilterOpen, setInterpreterFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 7; // show up to 7 cards per page

  useEffect(() => {
    try {
      const raw = localStorage.getItem("booking.user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setUserEmpCode(parsed.empCode || null);
    } catch {}
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
  }, [userEmpCode, page, pageSize, statusFilter, sortOrder]);

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

  const handleOpenDetail = (b: BookingData) => {
    setSelectedBooking(b);
    setDetailOpen(true);
  };

  return (
    <div className="w-full h-full border rounded-3xl p-2 flex flex-col">
      <div className="flex items-center justify-between gap-2 pb-1 border-b">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-5 h-5" />
          <span className="font-medium">My Booking History</span>
        </div>
        <div className="flex items-center gap-2" />
      </div>

      <div className="flex flex-col gap-1 pt-1 flex-1 min-h-0">
        <div className="flex h-10 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 px-2">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="cancel">Cancel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Popover open={interpreterFilterOpen} onOpenChange={setInterpreterFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UserSearchIcon className="w-4 h-4" />
                Interpreter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[280px]">
              <Command>
                <CommandInput placeholder="Search interpreter..." disabled />
                <CommandList>
                  <CommandEmpty>No get interpreter role now</CommandEmpty>
                  <CommandGroup heading="Interpreters">
                    <CommandItem disabled>
                      <XIcon className="w-4 h-4" />
                      No get interpreter role now
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="border rounded-xl overflow-hidden flex flex-col h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="min-w-[160px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 px-2"
                    onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                    aria-label="Sort by date"
                  >
                    Date
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[140px]">Duration</TableHead>
                <TableHead className="min-w-[140px]">Interpreter</TableHead>
                <TableHead className="text-right w-[90px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableRow key={`loading-${i}`} className="border-0">
                      <TableCell colSpan={5} className="p-0">
                        <div className="rounded-lg border my-1 px-6 py-6 bg-transparent">
                          <div className="grid items-center gap-3 grid-cols-[110px_minmax(160px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_90px]">
                            <div><Skeleton className="h-5 w-20 rounded-full" /></div>
                            <div><Skeleton className="h-4 w-28" /></div>
                            <div><Skeleton className="h-4 w-24" /></div>
                            <div><Skeleton className="h-4 w-36" /></div>
                            <div className="justify-self-end"><Skeleton className="h-8 w-16" /></div>
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
                return (
                  <TableRow key={b.bookingId} className="border-0">
                    <TableCell colSpan={5} className="p-0">
                      <div className="rounded-lg border my-1 px-6 py-6 bg-transparent">
                        <div className="grid items-center gap-3 grid-cols-[110px_minmax(160px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_90px]">
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] ${ss.bg} ${ss.text}`}>
                              {ss.icon}
                              {b.bookingStatus}
                            </span>
                          </div>
                          <div>{formatDateDDMMMYYYY(b.timeStart as unknown as string)}</div>
                          <div>{extractHHMM(b.timeStart as unknown as string)} - {extractHHMM(b.timeEnd as unknown as string)}</div>
                          <div>{(b.interpreterName && b.interpreterName.trim()) || b.interpreterId || "-"}</div>
                          <div className="justify-self-end">
                            <Button size="sm" variant="outline" onClick={() => handleOpenDetail(b)}>
                              Detail
                            </Button>
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
        <div className="pt-1" onClick={(e) => e.preventDefault()}>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[520px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Booking Detail</span>
              {selectedBooking && (
                <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${getStatusStyle(selectedBooking.bookingStatus).bg} ${getStatusStyle(selectedBooking.bookingStatus).text}`}>
                  {getStatusStyle(selectedBooking.bookingStatus).icon}
                  {selectedBooking.bookingStatus}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Booking By</span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-sm">
                  {(selectedBooking.ownerPrefix ? selectedBooking.ownerPrefix + " " : "")}
                  {selectedBooking.ownerName} {selectedBooking.ownerSurname}
                  <span className="text-muted-foreground"> ({selectedBooking.ownerEmpCode})</span>
                </div>
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Interpreter</span>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  {(selectedBooking.interpreterName && selectedBooking.interpreterName.trim()) || selectedBooking.interpreterId || "Not assigned"}
                </div>
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <ListCollapse className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Meeting detail</span>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <>
                    <div className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selectedBooking.meetingRoom}
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      {extractHHMM(selectedBooking.timeStart as unknown as string)} - {extractHHMM(selectedBooking.timeEnd as unknown as string)}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{selectedBooking.meetingDetail || "-"}</div>
                  </>
                </div>
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email invite</span>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  {selectedBooking.inviteEmails && selectedBooking.inviteEmails.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedBooking.inviteEmails.map((email) => (
                        <span key={email} className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs border">
                          {email}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


