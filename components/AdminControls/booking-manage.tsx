"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Star, HelpCircle, Info, CheckCircle, XCircle, Hourglass,
  Calendar, ChevronUp, ChevronDown, SquarePen, Users, Circle, AlertTriangle, Clock,
  RotateCcw,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import type { BookingManage, Stats } from "@/types/admin";
import type { 
  BookingFilters, 
  PaginationState, 
  StatusOptionConfig, 
  SummaryCardConfig,
  PaginatedBookings 
} from "@/types/booking-management";
import { generateStandardTimeSlots } from "@/utils/time";
import { 
  isPastMeeting, 
  formatDate, 
  formatRequestedTime, 
  getFullDate, 
  sortBookings, 
  getCurrentMonthBookings, 
  getStatusColor, 
  getStatusIcon 
} from "@/utils/booking";
import { 
  getMeetingTypeBadge,
  sortByPriority 
} from "@/utils/priority";
import BookingDetailDialog from "@/components/AdminForm/booking-form";

const PAGE_WRAPPER = "min-h-screen bg-[#f7f7f7] font-sans text-gray-900";
const TIME_SLOTS = generateStandardTimeSlots();

const STATUS_OPTIONS: StatusOptionConfig[] = [
  { value: "all", label: "All Status" },
  { value: "Wait", label: "Wait" },
  { value: "Approve", label: "Approve" },
  { value: "Cancel", label: "Cancel" },
];
export default function BookingManagement(): React.JSX.Element {
  const [bookings, setBookings] = useState<BookingManage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<BookingFilters>({
    search: "",
    status: "all",
    date: "",
    dateRequest: "",
    time: "all",
  });
  const [pagination, setPagination] = useState<PaginationState>({ 
    currentPage: 1, 
    rowsPerPage: 10, 
    total: 0, 
    totalPages: 0 
  });
  const [isClient, setIsClient] = useState(false);
  const [currentMonth, setCurrentMonth] = useState("");
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [sortByDateAsc, setSortByDateAsc] = useState(true);

  const [showBookingDetailDialog, setShowBookingDetailDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingManage | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Data fetching
  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      
      const res = await fetch("/api/booking-data/get-booking", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
      
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      setError((e as Error).message);
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    setCurrentMonth(months[now.getMonth()]);
    setCurrentYear(now.getFullYear());
    fetchBookings();
  }, [fetchBookings]);

  // Filter and sort bookings
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

      const pastOk = showPast ? true : !isPastMeeting(b.dateTime, b.endTime, 10);

      return searchOk && statusOk && dateOk && reqOk && timeOk && pastOk;
    });

    // First sort by priority, then by date
    const prioritySorted = sortByPriority(filtered);
    return sortBookings(prioritySorted, sortByDateAsc);
  }, [bookings, filters, sortByDateAsc, showPast]);

  // Calculate statistics
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

  // Pagination logic
  const paginatedBookings = useMemo((): PaginatedBookings => {
    const totalPages = Math.ceil(filteredBookings.length / pagination.rowsPerPage);
    const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
    return {
      bookings: filteredBookings.slice(startIndex, startIndex + pagination.rowsPerPage),
      totalPages,
      startIndex,
    };
  }, [filteredBookings, pagination]);

  // Event handlers
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }));
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  const refreshData = async () => {
    try {
      setError(null);
      await fetchBookings();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  
  const handlePageChange = (n: number) => {
    setPagination((p) => ({
      ...p,
      currentPage: Math.max(1, Math.min(n, paginatedBookings.totalPages)),
    }));
  };
  
  const handleRowsPerPageChange = (v: string) => {
    setPagination({ 
      currentPage: 1, 
      rowsPerPage: parseInt(v),
      total: 0,
      totalPages: 0
    });
  };
  const handleDateSortToggle = () => {
    setSortByDateAsc((p) => !p);
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  return (
    <div className={PAGE_WRAPPER}>

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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center gap-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-blue-800">Legend:</span>
          </div>
                  <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-red-600" />
            <span className="text-sm text-gray-700">DR (hover for type)</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-gray-700">VIP</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            <span className="text-sm text-gray-700">Weekly</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">General</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-gray-700">Urgent</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-slate-600" />
            <span className="text-sm text-gray-700">Other</span>
          </div>
        </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          {([
            { key: "wait", label: "Wait", color: "amber", icon: Hourglass, description: "Bookings awaiting approval" },
            { key: "approve", label: "Approve", color: "emerald", icon: CheckCircle, description: "Confirmed bookings" },
            { key: "cancel", label: "Cancel", color: "red", icon: XCircle, description: "Cancel bookings" },
            { key: "total", label: "Total", color: "blue", icon: Calendar, description: "Total bookings this month" },
          ] as SummaryCardConfig[]).map(({ key, label, color, icon: Icon, description }) => (
            <Card key={key} className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className={`text-base font-semibold text-${color}-800 flex items-center gap-2`}>
                  <Icon className="h-4 w-4" />
                  {label} {!Object.values(filters).some(v => v !== "" && v !== "all") && isClient && `- ${currentMonth} ${currentYear}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${key === 'total' ? 'text-blue-700' : `text-${color}-700`}`}>{stats[key as keyof Stats]}</div>
                <p className={`text-sm text-${color}-600 mt-1`}>{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6 bg-white">
          <CardContent className="pt-6">
            <div className="flex flex-nowrap items-end gap-4 overflow-x-auto pb-2">
              <div className="shrink-0 w-[260px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Search User / Interpreter
                </Label>
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="shrink-0 w-[160px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Status
                </Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                  <SelectTrigger className="h-10 min-h-[40px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="shrink-0 w-[170px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Date Meeting
                </Label>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => updateFilter("date", e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="shrink-0 w-[170px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Date Request
                </Label>
                <Input
                  type="date"
                  value={filters.dateRequest}
                  onChange={(e) => updateFilter("dateRequest", e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="shrink-0 w-[150px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Meeting Time
                </Label>
                <Select value={filters.time} onValueChange={(v) => updateFilter("time", v)}>
                  <SelectTrigger className="h-10 min-h-[40px]">
                    <SelectValue placeholder="All Times" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Times</SelectItem>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="shrink-0 w-[100px] flex flex-col gap-2">
                <Label className="text-sm font-semibold text-gray-800 leading-tight h-5 flex items-center">
                  Past Records
                </Label>
                <Button
                  variant={showPast ? "default" : "outline"}
                  className="h-10 w-full"
                  onClick={() => {
                    setShowPast((v) => !v);
                    setPagination((p) => ({ ...p, currentPage: 1 }));
                  }}
                >
                  {showPast ? "Show" : "Hide"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
            Failed to load data: {error}
          </div>
        )}

        <Card className="mb-6 bg-white">
          <CardContent className="p-0">
            <table className="w-full text-sm table-fixed">
                  <thead className="bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="w-20 px-4 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Type</th>
                      <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">
                        <button
                          onClick={handleDateSortToggle}
                          className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded transition-colors w-full justify-start"
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
                      <th className="w-36 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Time</th>
                      <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">User</th>
                      <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Interpreter</th>
                      <th className="w-24 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Room</th>
                      <th className="w-28 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Status</th>
                      <th className="w-48 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Request</th>
                      <th className="w-32 px-6 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.bookings.map((booking, index) => (
                      <tr
                        key={booking.id}
                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      >
                        <td className="px-4 py-4 text-center">
                          {getMeetingTypeBadge(booking.meetingType, booking.drType, booking.otherType)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <div className="group relative flex-1">
                              <span className="font-semibold text-gray-900 text-sm cursor-help break-words">
                                {formatDate(booking.dateTime)}
                              </span>
                              {isClient && (
                                <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  {getFullDate(booking.dateTime, isClient)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                            <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="whitespace-nowrap">{booking.startTime} - {booking.endTime}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 text-sm break-words">{booking.bookedBy}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-gray-800 text-sm break-words">{booking.interpreter}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center h-full">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold break-words">{booking.room}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                            {getStatusIcon(booking.status)}
                            <span className="truncate">{booking.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 whitespace-nowrap">{formatRequestedTime(booking.requestedTime)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
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

                {!error && filteredBookings.length === 0 && (
                  <div className="p-6 text-center text-gray-500">No bookings found</div>
                )}

                <div className="p-4 border-t border-gray-200">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={refreshData}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Refresh Data
                    </Button>
                  </div>
                </div>
          </CardContent>
        </Card>

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
