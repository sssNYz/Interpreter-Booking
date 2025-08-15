"use client";

import React, { useEffect, useState, MouseEvent } from "react";
import type { BookingData } from "@/types/booking";
import { getStatusStyle } from "@/utils/status";
// Date picker removed per requirement

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { FilterIcon, UserSearchIcon, XIcon } from "lucide-react";

type StatusFilter = "all" | "approve" | "waiting" | "cancel";

// monthSpan no longer needed

function formatDateDDMMMYYYY_UTC(d: Date) {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function formatTimeHHMM_UTC(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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
  // const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);

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

  const handleOpenDetail = () => {
    setDetailOpen(true);
  };

  return (
    <div className="w-full border rounded-3xl p-4 bg-background">
      <div className="flex items-center justify-between gap-2 pb-3 border-b">
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

      <div className="flex flex-col gap-3 pt-3">
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

        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="min-w-[160px]">Date</TableHead>
                <TableHead className="min-w-[140px]">Duration</TableHead>
                <TableHead className="min-w-[140px]">Interpreter</TableHead>
                <TableHead className="text-right w-[90px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
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
                const start = new Date(b.timeStart);
                const end = new Date(b.timeEnd);
                const ss = getStatusStyle(b.bookingStatus);
                return (
                  <TableRow key={b.bookingId}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] ${ss.bg} ${ss.text}`}>
                        {ss.icon}
                        {b.bookingStatus}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateDDMMMYYYY_UTC(start)}</TableCell>
                    <TableCell>
                      {formatTimeHHMM_UTC(start)} - {formatTimeHHMM_UTC(end)}
                    </TableCell>
                    <TableCell>{b.interpreterId ?? "null"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={handleOpenDetail}>
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* pad rows to keep 5 fixed rows */}
              {!loading && !error && Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, idx) => (
                <TableRow key={`pad-${idx}`}>
                  <TableCell colSpan={5} className="py-3" />
                </TableRow>
              ))}
            </TableBody>
            <TableCaption className="text-xs">Showing your own bookings only</TableCaption>
          </Table>
        </div>

        <div className="pt-2" onClick={(e) => e.preventDefault()}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Detail</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {/* Placeholder content per requirement */}
            Booking detail component will be built next time.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


