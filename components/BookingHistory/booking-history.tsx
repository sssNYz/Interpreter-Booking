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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { FilterIcon, UserSearchIcon, XIcon, User, Mail, Users, ListCollapse, MapPin, Clock } from "lucide-react";
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

export default function BookingHistory() {
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
  const pageSize = 5; // fixed 5 records per page

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
    <div className="w-full h-full border rounded-3xl p-2 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-2 pb-1 border-b">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-5 h-5" />
          <span className="font-medium">My Booking History</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
            className="text-xs"
            title="Toggle sort order"
          >
            {sortOrder === "desc" ? "Newest" : "Oldest"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-1 flex-1 min-h-0">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="border rounded-xl overflow-hidden h-64 flex flex-col min-h-0">
          <Table className="h-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="min-w-[160px]">Date</TableHead>
                <TableHead className="min-w-[140px]">Duration</TableHead>
                <TableHead className="min-w-[140px]">Interpreter</TableHead>
                <TableHead className="text-right w-[90px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="flex-1">
              {loading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`loading-${i}`} className="h-full">
                      <TableCell className="h-full py-1">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="h-full py-1">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="h-full py-1">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="h-full py-1">
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell className="text-right h-full py-1">
                        <div className="flex justify-end">
                          <Skeleton className="h-8 w-16" />
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
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No bookings yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && pageItems.map((b) => {
                const ss = getStatusStyle(b.bookingStatus);
                return (
                  <TableRow key={b.bookingId} className="h-full">
                    <TableCell className="h-full py-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] ${ss.bg} ${ss.text}`}>
                        {ss.icon}
                        {b.bookingStatus}
                      </span>
                    </TableCell>
                    <TableCell className="h-full py-1">{formatDateDDMMMYYYY(b.timeStart as unknown as string)}</TableCell>
                    <TableCell className="h-full py-1">
                      {extractHHMM(b.timeStart as unknown as string)} - {extractHHMM(b.timeEnd as unknown as string)}
                    </TableCell>
                    <TableCell className="h-full py-1">{(b.interpreterName && b.interpreterName.trim()) || b.interpreterId || "-"}</TableCell>
                    <TableCell className="text-right h-full py-1">
                      <Button size="sm" variant="outline" onClick={() => handleOpenDetail(b)}>
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* pad rows to keep 5 fixed rows */}
              {!loading && !error && Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, idx) => (
                <TableRow key={`pad-${idx}`} className="h-full">
                  <TableCell colSpan={5} className="py-1 h-full" />
                </TableRow>
              ))}
            </TableBody>
            <TableCaption className="text-xs">Showing your own bookings only</TableCaption>
          </Table>
        </div>

        <div className="pt-1" onClick={(e) => e.preventDefault()}>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={handlePrev} href="#" />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(i + 1);
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext onClick={handleNext} href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
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


