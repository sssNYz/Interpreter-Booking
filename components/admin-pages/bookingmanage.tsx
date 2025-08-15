"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Star, Clock, Info, CheckCircle, XCircle, Hourglass,
  Calendar, ChevronUp, ChevronDown, SquarePen,
} from "lucide-react";

import type { BookingManage as BookingMange, Stats } from "@/app/types/booking-types";

import BookingDetailDialog from "../admin-form/booking-form";

/* ========= THEME ========= */
const PAGE_WRAPPER = "min-h-screen bg-[#f7f7f7] font-sans text-gray-900";

/* ========= Constants ========= */
const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00",
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "Wait", label: "Wait" },
  { value: "Approve", label: "Approve" },
  { value: "Cancel", label: "Cancel" },
];

/* ========= Utils ========= */
const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const formatDate = (s: string) => {
  const d = new Date(s);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatRequestedTime = (s: string) => {
  const d = new Date(s);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
};

const getFullDate = (s: string, isClient: boolean) => {
  if (!isClient) return s;
  const d = new Date(s);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const sortBookings = (arr: BookingMange[], asc: boolean) =>
  [...arr].sort((a, b) => {
    const dc = asc ? a.dateTime.localeCompare(b.dateTime) : b.dateTime.localeCompare(a.dateTime);
    if (dc !== 0) return dc;
    return parseTime(a.startTime) - parseTime(b.startTime);
  });

const getCurrentMonthBookings = (arr: BookingMange[]) => {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return arr.filter((b) => {
    const d = new Date(b.dateTime);
    return d.getMonth() === m && d.getFullYear() === y;
  });
};

const getStatusColor = (status: string) =>
  ({
    Approve: "text-emerald-700 bg-emerald-100",
    Wait: "text-amber-700 bg-amber-100",
    Cancel: "text-red-700 bg-red-100",
  } as const)[status as "Approve" | "Wait" | "Cancel"] || "text-gray-700 bg-gray-100";

const getStatusIcon = (status: string) =>
  ({
    Approve: <CheckCircle className="h-4 w-4" />,
    Wait: <Hourglass className="h-4 w-4" />,
    Cancel: <XCircle className="h-4 w-4" />,
  } as const)[status as "Approve" | "Wait" | "Cancel"] || null;

/* ========= Component ========= */
export default function BookingManagement(): React.JSX.Element {
  const [bookings, setBookings] = useState<BookingMange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    date: "",
    dateRequest: "",
    time: "all",
  });
  const [pagination, setPagination] = useState({ currentPage: 1, rowsPerPage: 10 });
  const [isClient, setIsClient] = useState(false);
  const [currentMonth, setCurrentMonth] = useState("");
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [sortByDateAsc, setSortByDateAsc] = useState(true);

  const [showBookingDetailDialog, setShowBookingDetailDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingMange | null>(null);

// fetch bookings from API
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/booking-data/get-booking", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
      const data = (await res.json()) as BookingMange[];
      setBookings(data);
    } catch (e) {
      setError((e as Error).message);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    setCurrentMonth(months[now.getMonth()]);
    setCurrentYear(now.getFullYear());
    fetchBookings(); 
  }, [fetchBookings]);


  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((b) => {
      const searchOk =
        !filters.search ||
        b.bookedBy.toLowerCase().includes(filters.search.toLowerCase()) ||
        b.interpreter.toLowerCase().includes(filters.search.toLowerCase());
      const statusOk = filters.status === "all" || b.status === filters.status;
      const dateOk = !filters.date || b.dateTime === filters.date;
      const reqOk = !filters.dateRequest || b.requestedTime.startsWith(filters.dateRequest);
      const timeOk = filters.time === "all" || b.startTime === filters.time;
      return searchOk && statusOk && dateOk && reqOk && timeOk;
    });
    return sortBookings(filtered, sortByDateAsc);
  }, [bookings, filters, sortByDateAsc]);

  const stats = useMemo<Stats>(() => {
    const hasActive = Object.values(filters).some((v) => v !== "" && v !== "all");
    const base = hasActive ? filteredBookings : getCurrentMonthBookings(bookings);
    return {
      wait: base.filter((b) => b.status === "Wait").length,
      approve: base.filter((b) => b.status === "Approve").length,
      cancel: base.filter((b) => b.status === "Cancel").length,
      total: base.length,
    };
  }, [bookings, filteredBookings, filters]);

  const paginatedBookings = useMemo(() => {
    const totalPages = Math.ceil(filteredBookings.length / pagination.rowsPerPage);
    const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
    return {
      bookings: filteredBookings.slice(startIndex, startIndex + pagination.rowsPerPage),
      totalPages,
      startIndex,
    };
  }, [filteredBookings, pagination]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }));
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };
  const handlePageChange = (n: number) =>
    setPagination((p) => ({
      ...p,
      currentPage: Math.max(1, Math.min(n, paginatedBookings.totalPages)),
    }));
  const handleRowsPerPageChange = (v: string) =>
    setPagination({ currentPage: 1, rowsPerPage: parseInt(v) });
  const handleDateSortToggle = () => {
    setSortByDateAsc((p) => !p);
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  return (
    <div className={PAGE_WRAPPER}>
      {/* Header */}
      <div className="border-b bg-white border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-900 text-white rounded-full p-2">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Booking Management</h1>
                <p className="text-sm text-gray-500">Manage & review meeting bookings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* reserved for future */}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Legend */}
        <div className="mb-6 flex items-center gap-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-blue-800">Legend:</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            <span className="text-blue-700">= DR (High Priority Meeting)</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          {[
            { key: "wait", label: "Wait", color: "amber", icon: Hourglass, description: "Bookings awaiting approval" },
            { key: "approve", label: "Approve", color: "emerald", icon: CheckCircle, description: "Confirmed bookings" },
            { key: "cancel", label: "Cancel", color: "red", icon: XCircle, description: "Cancel bookings" },
            { key: "total", label: "Total", color: "blue", icon: Calendar, description: "Total bookings this month" },
          ].map(({ key, label, color, icon: Icon, description }) => (
            <Card key={key} className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className={`text-base font-semibold text-${color}-800 flex items-center gap-2`}>
                  <Icon className="h-4 w-4" />
                  {label} {!Object.values(filters).some(v => v !== "" && v !== "all") && isClient && `- ${currentMonth} ${currentYear}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold text-${color}-700`}>{stats[key as keyof Stats]}</div>
                <p className={`text-sm text-${color}-600 mt-1`}>{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-base font-semibold text-gray-800 mb-2">Search User / Interpreter</label>
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex-1 min-w-[120px]">
                <label className="block text-base font-semibold text-gray-800 mb-2">Status</label>
                <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-base font-semibold text-gray-800 mb-2">Date Meeting</label>
                <Input type="date" value={filters.date} onChange={(e) => updateFilter("date", e.target.value)} className="h-10" />
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-base font-semibold text-gray-800 mb-2">Date Requested</label>
                <Input type="date" value={filters.dateRequest} onChange={(e) => updateFilter("dateRequest", e.target.value)} className="h-10" />
              </div>

              <div className="flex-1 min-w-[130px]">
                <label className="block text-base font-semibold text-gray-800 mb-2">Start Time</label>
                <Select value={filters.time} onValueChange={(v) => updateFilter("time", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All Times" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading / Error */}
        {loading && (
          <div className="mb-6 p-4 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
            กำลังโหลดข้อมูล...
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
            โหลดข้อมูลล้มเหลว: {error}
          </div>
        )}

        {/* Table */}
        <Card className="mb-6 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">
                        <button
                          onClick={handleDateSortToggle}
                          className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                          title={`Sort by ${sortByDateAsc ? "newest" : "oldest"} first`}
                        >
                          <span>Date Meeting</span>
                          {sortByDateAsc ? (
                            <ChevronUp className="h-4 w-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </th>
                      {["Time", "User", "Interpreter", "Room", "Status", "Request", "Action"].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm ${h === "Action" ? "text-center" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.bookings.map((booking, index) => (
                      <tr
                        key={booking.id}
                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="group relative">
                              <span className="font-semibold text-gray-900 text-sm cursor-help">
                                {formatDate(booking.dateTime)}
                              </span>
                              {isClient && (
                                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  {getFullDate(booking.dateTime, isClient)}
                                </div>
                              )}
                            </div>
                            {booking.isDR && (
                              <div className="group relative">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500 cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  High Priority Meeting (DR)
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                            <Clock className="h-4 w-4 text-gray-500" />
                            {booking.startTime} - {booking.endTime}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 text-sm">{booking.bookedBy}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-800 text-sm">{booking.interpreter}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold">{booking.room}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                            {getStatusIcon(booking.status)}
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600 font-mono">{formatRequestedTime(booking.requestedTime)}</span>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowBookingDetailDialog(true);
                            }}
                          >
                            <SquarePen className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ว่างเปล่า */}
                {!loading && !error && filteredBookings.length === 0 && (
                  <div className="p-6 text-center text-gray-500">No bookings found</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Booking Detail Dialog */}
        <BookingDetailDialog
          open={showBookingDetailDialog}
          onOpenChange={(open: boolean) => {
            setShowBookingDetailDialog(open);
            if (!open) setSelectedBooking(null);
          }}
          editData={selectedBooking}
          isEditing
          onActionComplete={fetchBookings}
        />

        {/* Pagination */}
        <Card className="bg-white">
          <CardContent className="flex items-center justify-between pt-6">
            <div className="flex items-center space-x-2">
              <span className="text-base text-gray-800">Rows per page:</span>
              <Select
                value={pagination.rowsPerPage.toString()}
                onValueChange={handleRowsPerPageChange}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((v) => (
                    <SelectItem key={v} value={v.toString()}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-base text-gray-800">
                {paginatedBookings.startIndex + 1}-
                {Math.min(
                  paginatedBookings.startIndex + pagination.rowsPerPage,
                  filteredBookings.length
                )}{" "}
                of {filteredBookings.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === paginatedBookings.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}