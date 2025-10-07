"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Star, HelpCircle, Info, CheckCircle, XCircle, Hourglass,
  Calendar, ChevronUp, ChevronDown, SquarePen, Users, Circle, AlertTriangle, Clock, Crown,
  RotateCcw, CircleDot, Filter, X, ChevronDown as ChevronDownIcon, Zap, Inbox, List,
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
  getStatusColor,
  getStatusIcon
} from "@/utils/booking";
import {
  getMeetingTypeBadge,
  sortByPriority
} from "@/utils/priority";
import BookingDetailDialog from "@/components/AdminForm/booking-manage-form";
import ForwardBookingDialog from "./ForwardBookingDialog";
import { client as featureFlags } from "@/lib/feature-flags";
import { getCurrentFiscalMonthLabel, years } from "@/utils/admin-dashboard";

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
  const [forwarded, setForwarded] = useState<{
    bookingId: number;
    environmentId: number;
    environmentName: string;
    meetingRoom: string;
    meetingType: string;
    timeStart: string;
    timeEnd: string;
    status: string;
    owner: { empCode: string | null; name: string; deptPath: string | null };
    languageCode?: string | null;
    selectedInterpreterEmpCode?: string | null;
    createdAt?: string;
  }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<BookingFilters>({
    search: "",
    status: "all",
    date: "",
    dateRequest: "",
    time: "all",
  });
  const [dateRangeType, setDateRangeType] = useState<"meeting" | "request">("meeting");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    rowsPerPage: 10,
    total: 0,
    totalPages: 0
  });
  const [isClient, setIsClient] = useState(false);
  const [activeYear, setActiveYear] = useState<number>(years[0]);
  const [agg, setAgg] = useState<"month" | "totalAll">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentFiscalMonthLabel());
  const [sortByDateAsc, setSortByDateAsc] = useState(true);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthWrapperDesktopRef = useRef<HTMLDivElement | null>(null);
  const monthWrapperMobileRef = useRef<HTMLDivElement | null>(null);

  // ETA data map: bookingId -> { etaLabel, category }
  const [etaMap, setEtaMap] = useState<Record<number, { etaLabel: string; category: 'auto-approve'|'in-coming'|'none'; urgentFrom?: string; schedulerFrom?: string }>>({});

  const [showBookingDetailDialog, setShowBookingDetailDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingManage | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Forward dialog state
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingBookingId, setForwardingBookingId] = useState<number | null>(null);

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

  const fetchForwarded = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/forward-requests", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load forwarded (${res.status})`);
      const data = await res.json();
      setForwarded(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.error(e);
      setForwarded([]);
    }
  }, []);

  const fetchEtaList = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bookings/eta-list?take=200`, { cache: 'no-store' });
      if (!res.ok) return setEtaMap({});
      const j = await res.json();
      if (!j?.ok || !Array.isArray(j.data)) return setEtaMap({});
      const m: Record<number, { etaLabel: string; category: 'auto-approve'|'in-coming'|'none'; urgentFrom?: string; schedulerFrom?: string }> = {};
      for (const it of j.data as Array<{ bookingId: number; etaLabel: string; category: 'auto-approve'|'in-coming'|'none'; urgentFrom?: string; schedulerFrom?: string }>) {
        m[it.bookingId] = { etaLabel: it.etaLabel, category: it.category, urgentFrom: it.urgentFrom, schedulerFrom: it.schedulerFrom };
      }
      setEtaMap(m);
    } catch {
      setEtaMap({});
    }
  }, []);

  const mapForwardStatus = useCallback((s: string): "Approve"|"Cancel"|"Wait" => {
    const low = (s || "").toLowerCase();
    if (low === 'approve') return 'Approve';
    if (low === 'cancel') return 'Cancel';
    return 'Wait';
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchBookings();
    fetchEtaList();
    if (featureFlags.enableForwardAdmin) {
      fetchForwarded();
    }
  }, [fetchBookings, fetchForwarded, fetchEtaList]);

  // Month options - show all months
  const monthOptions = useMemo(() => {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }, []);

  // Ensure selectedMonth is valid when data changes
  useEffect(() => {
    if (!monthOptions || monthOptions.length === 0) return;
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) {
      const current = getCurrentFiscalMonthLabel();
      const fallback = monthOptions.includes(current) ? current : monthOptions[0];
      setSelectedMonth(fallback);
    }
  }, [monthOptions, selectedMonth]);

  // Close dropdown when clicking outside the month button group (desktop or mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMonthDropdownOpen) return;
      const targetNode = event.target instanceof Node ? event.target : null;
      const isInsideDesktop = monthWrapperDesktopRef.current?.contains(targetNode as Node);
      const isInsideMobile = monthWrapperMobileRef.current?.contains(targetNode as Node);
      if (!isInsideDesktop && !isInsideMobile) setIsMonthDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthDropdownOpen]);

  // ----- Helpers (pure) -----
  const isInHeaderWindow = useCallback((dateISO: string): boolean => {
    const d = new Date(dateISO);
    if (agg === "totalAll") {
      return d.getFullYear() === activeYear;
    }
    // For month view, check if the booking is in the selected month and year
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const bookingMonth = monthNames[d.getMonth()];
    return d.getFullYear() === activeYear && bookingMonth === selectedMonth;
  }, [agg, activeYear, selectedMonth]);

  const isPastRecord = useCallback((dateISO: string, endTime: string): boolean => {
    return isPastMeeting(dateISO, endTime, 10);
  }, []);

  const passesPastToggle = useCallback((dateISO: string, endTime: string): boolean => {
    if (filters.date) return true;               // explicit date should always be shown
    if (agg === "totalAll") return true;           // totalAll view ignores past toggle
    return showPast ? true : !isPastMeeting(dateISO, endTime, 10);
  }, [filters.date, agg, showPast]);

  const passesFieldFilters = useCallback((b: BookingManage): boolean => {
    const searchLower = filters.search.toLowerCase();
    const searchOk = !filters.search ||
      b.bookedBy.toLowerCase().includes(searchLower) ||
      b.interpreter.toLowerCase().includes(searchLower);
    const statusOk = filters.status === "all" || b.status === filters.status;
    const dateOk = !filters.date || b.dateTime === filters.date;
    const reqOk = !filters.dateRequest || b.requestedTime.startsWith(filters.dateRequest);
    const timeOk = filters.time === "all" || b.startTime === filters.time;
    return searchOk && statusOk && dateOk && reqOk && timeOk;
  }, [filters]);

  // Filter and sort bookings
  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((b) => {
      const fieldsOk = passesFieldFilters(b);
      const pastOk = passesPastToggle(b.dateTime, b.endTime);
      const headerOk = isInHeaderWindow(b.dateTime);
      return fieldsOk && pastOk && headerOk;
    });

    // First sort by priority, then by date
    const prioritySorted = sortByPriority(filtered);
    return sortBookings(prioritySorted, sortByDateAsc);
  }, [bookings, passesFieldFilters, passesPastToggle, isInHeaderWindow, sortByDateAsc]);

  // Category views using ETA map
  const autoApproveBookings = useMemo(() => {
    const filtered = bookings.filter((b) =>
      b.status === 'Wait' &&
      etaMap[b.id]?.category === 'auto-approve' &&
      passesFieldFilters(b) &&
      passesPastToggle(b.dateTime, b.endTime) &&
      isInHeaderWindow(b.dateTime)
    );
    const prioritySorted = sortByPriority(filtered);
    return sortBookings(prioritySorted, sortByDateAsc);
  }, [bookings, etaMap, passesFieldFilters, passesPastToggle, isInHeaderWindow, sortByDateAsc]);

  const incomingBookings = useMemo(() => {
    const filtered = bookings.filter((b) =>
      b.status === 'Wait' &&
      etaMap[b.id]?.category === 'in-coming' &&
      passesFieldFilters(b) &&
      passesPastToggle(b.dateTime, b.endTime) &&
      isInHeaderWindow(b.dateTime)
    );
    const prioritySorted = sortByPriority(filtered);
    return sortBookings(prioritySorted, sortByDateAsc);
  }, [bookings, etaMap, passesFieldFilters, passesPastToggle, isInHeaderWindow, sortByDateAsc]);

  // Calculate statistics
  const stats = useMemo<Stats>(() => {
    // KPIs depend on header (Month/Year). For Month, respect Past toggle so cards match table.
    const base = bookings.filter((b) => isInHeaderWindow(b.dateTime) && passesPastToggle(b.dateTime, b.endTime));
    return {
      wait: base.filter((b) => b.status === "Wait").length,
      approve: base.filter((b) => b.status === "Approve").length,
      cancel: base.filter((b) => b.status === "Cancel").length,
      total: base.length,
    };
  }, [bookings, isInHeaderWindow, passesPastToggle]);

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
      await fetchEtaList();
      await fetchForwarded();
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

  const clearAllFilters = () => {
    setFilters({
      search: "",
      status: "all",
      date: "",
      dateRequest: "",
      time: "all",
    });
    setDateRangeType("meeting");
    setShowPast(false);
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
            <div className="hidden md:flex items-center gap-3">
              <Select value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Custom Button Group with Smooth Transitions */}
              <div className="relative flex bg-gray-100 rounded-md p-0.5 h-8 w-56">
                {/* Highlight Bar */}
                <div
                  className={`absolute inset-y-0 left-0 w-1/2 bg-gray-900 rounded transition-transform duration-300 ease-in-out z-0 pointer-events-none ${agg === "month" ? "translate-x-0" : "translate-x-full"
                    }`}
                />

                {/* Month Dropdown Button */}
                <div ref={monthWrapperDesktopRef} className="relative basis-1/2 grow-0 shrink-0">
                  <button
                    className={`relative z-10 w-full h-full px-3 text-sm font-medium rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis leading-none focus:outline-none focus-visible:outline-none ${agg === "month"
                      ? "text-white bg-transparent"
                      : "text-gray-700 bg-transparent"
                      }`}
                    onClick={() => {
                      if (agg !== "month") {
                        setAgg("month");
                        setIsMonthDropdownOpen(false);
                      } else {
                        setIsMonthDropdownOpen((prev) => !prev);
                      }
                    }}
                  >
                    {agg === "month" ? selectedMonth : "Month"}
                    <ChevronDownIcon className={`ml-1 h-3 w-3 transition-transform duration-200 ${isMonthDropdownOpen ? "rotate-180" : ""
                      }`} />
                  </button>

                  {/* Month Dropdown */}
                  {isMonthDropdownOpen && monthOptions && monthOptions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                      {monthOptions.map((month) => (
                        <button
                          key={month}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 first:rounded-t-md last:rounded-b-md transition-colors ${selectedMonth === month ? "bg-gray-100 font-medium" : ""
                            }`}
                          onClick={() => {
                            setSelectedMonth(month);
                            setAgg("month");
                            setIsMonthDropdownOpen(false);
                          }}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total All Button */}
                <div className="basis-1/2 grow-0 shrink-0">
                  <button
                    className={`relative z-10 w-full h-full px-3 text-sm font-medium rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis leading-none focus:outline-none focus-visible:outline-none ${agg === "totalAll"
                      ? "text-white bg-transparent"
                      : "text-gray-700 bg-transparent"
                      }`}
                    onClick={() => {
                      setAgg("totalAll");
                      setIsMonthDropdownOpen(false);
                    }}
                  >
                    Total All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls — mobile */}
        <div className="md:hidden flex items-center justify-between gap-3 mb-4">
          <Select value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile Button Group */}
          <div className="relative flex bg-gray-100 rounded-md p-0.5 gap-0.5 h-6 w-48">
            {/* Highlight Bar */}
            <div
              className={`absolute top-0.5 bottom-0.5 bg-gray-900 rounded transition-all duration-300 ease-in-out ${agg === "month" ? "left-0.5 right-1/2" : "left-1/2 right-0.5"
                }`}
            />

            {/* Month Dropdown Button */}
            <div ref={monthWrapperMobileRef} className="relative flex-1">
              <button
                className={`w-full h-full px-1.5 text-xs rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap leading-none focus:outline-none focus-visible:outline-none ${agg === "month"
                  ? "text-white bg-transparent"
                  : "text-gray-700 bg-transparent"
                  }`}
                onClick={() => {
                  if (agg !== "month") {
                    setAgg("month");
                    setIsMonthDropdownOpen(false);
                  } else {
                    setIsMonthDropdownOpen((prev) => !prev);
                  }
                }}
              >
                {agg === "month" ? selectedMonth : "Month"}
                <ChevronDownIcon className={`ml-1 h-2 w-2 transition-transform duration-200 ${isMonthDropdownOpen ? "rotate-180" : ""
                  }`} />
              </button>

              {/* Month Dropdown */}
              {isMonthDropdownOpen && monthOptions && monthOptions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                  {monthOptions.map((month) => (
                    <button
                      key={month}
                      className={`w-full text-left px-1.5 py-1 text-xs hover:bg-gray-100 first:rounded-t-md last:rounded-b-md transition-colors ${selectedMonth === month ? "bg-gray-100 font-medium" : ""
                        }`}
                      onClick={() => {
                        setSelectedMonth(month);
                        setAgg("month");
                        setIsMonthDropdownOpen(false);
                      }}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Total All Button */}
            <div className="flex-1">
              <button
                className={`w-full h-full px-1.5 text-xs rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap leading-none focus:outline-none focus-visible:outline-none ${agg === "totalAll"
                  ? "text-white bg-transparent"
                  : "text-gray-700 bg-transparent"
                  }`}
                onClick={() => {
                  setAgg("totalAll");
                  setIsMonthDropdownOpen(false);
                }}
              >
                Total All
              </button>
            </div>
          </div>
        </div>
        <div className="mb-6 flex items-center gap-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-blue-800">Legend:</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-gray-700">President</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-700">VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-red-600" />
              <span className="text-sm text-gray-700">DR (hover for type)</span>
            </div>
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-red-500" />
              <span className="text-sm text-gray-700">DR-PR</span>
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
            {showPast && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200/50 border border-gray-300 rounded"></div>
                <span className="text-sm text-gray-700">Past Records</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Summary Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {([
              { key: "wait", label: "Wait", color: "amber", icon: Hourglass, description: "Bookings awaiting approval" },
              { key: "approve", label: "Approve", color: "emerald", icon: CheckCircle, description: "Confirmed bookings" },
              { key: "cancel", label: "Cancel", color: "red", icon: XCircle, description: "Cancel bookings" },
              { key: "total", label: "Total", color: "blue", icon: Calendar, description: `Total bookings this ${agg}` },
            ] as SummaryCardConfig[]).map(({ key, label, color, icon: Icon, description }) => (
              <Card key={key} className="bg-white border-gray-200 hover:shadow-lg transition-shadow rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base font-semibold text-${color}-800 flex items-center gap-2`}>
                    <Icon className="h-4 w-4" />
                    {label} {isClient && (agg === "totalAll" ? `- Total All ${activeYear}` : `- ${selectedMonth} ${activeYear}`)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${key === 'total' ? 'text-blue-700' : `text-${color}-700`}`}>{stats[key as keyof Stats]}</div>
                  <p className={`text-sm text-${color}-600 mt-1`}>{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-6 bg-white rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 h-10"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2 h-10"
                >
                  Advanced Filters
                  <ChevronDownIcon className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Filters Row */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="space-y-2 flex-1 sm:min-w-[200px]">
                <Label className="text-sm font-semibold text-gray-800">Search User / Interpreter</Label>
                <Input
                  placeholder="Search by name..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="h-10 w-full"
                />
              </div>

              {/* Status */}
              <div className="space-y-2 sm:min-w-[140px]">
                <Label className="text-sm font-semibold text-gray-800">Status</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2 flex-1 sm:min-w-[300px]">
                <Label className="text-sm font-semibold text-gray-800">Date Range</Label>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <Select value={dateRangeType} onValueChange={(v: "meeting" | "request") => setDateRangeType(v)}>
                    <SelectTrigger className="h-10 w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">By Meeting Date</SelectItem>
                      <SelectItem value="request">By Request Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={dateRangeType === "meeting" ? filters.date : filters.dateRequest}
                    onChange={(e) => {
                      if (dateRangeType === "meeting") {
                        updateFilter("date", e.target.value);
                      } else {
                        updateFilter("dateRequest", e.target.value);
                      }
                    }}
                    className="h-10 w-full sm:flex-1 sm:max-w-[260px] px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Filters - Collapsible */}
            {showAdvancedFilters && (
              <div className="border-t pt-4 space-y-4">
                <div className="max-w-[720px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-800">Meeting Time</Label>
                      <Select value={filters.time} onValueChange={(v) => updateFilter("time", v)}>
                        <SelectTrigger className="h-10 w-[180px]">
                          <SelectValue placeholder="All Times" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Times</SelectItem>
                          {TIME_SLOTS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-800">Past Records</Label>
                      <Button
                        variant={showPast ? "default" : "outline"}
                        className="h-10 w-auto px-3 max-w-[220px]"
                        onClick={() => {
                          setShowPast((v) => !v);
                          setPagination((p) => ({ ...p, currentPage: 1 }));
                        }}
                      >
                        {showPast ? "Hide Past Records" : "Show Past Records"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Filters Tags */}
            {(filters.search || filters.status !== "all" || filters.date || filters.dateRequest || filters.time !== "all" || showPast) && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {filters.search && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      Search: {filters.search}
                      <button onClick={() => updateFilter("search", "")} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filters.status !== "all" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      Status: {filters.status}
                      <button onClick={() => updateFilter("status", "all")} className="ml-1 hover:bg-green-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filters.date && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      Meeting Date: {filters.date}
                      <button onClick={() => updateFilter("date", "")} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filters.dateRequest && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      Request Date: {filters.dateRequest}
                      <button onClick={() => updateFilter("dateRequest", "")} className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filters.time !== "all" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                      Time: {filters.time}
                      <button onClick={() => updateFilter("time", "all")} className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {showPast && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                      Past Records: Show
                      <button onClick={() => setShowPast(false)} className="ml-1 hover:bg-gray-200 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Accordion
          type="multiple"
          defaultValue={["auto-approve", "in-coming"]}
          className="space-y-6"
        >
          {featureFlags.enableForwardAdmin && (
            <AccordionItem value="forwarded" className="border-none overflow-visible">
              <div className="rounded-xl shadow-sm overflow-visible">
                <AccordionTrigger className="px-6 border border-gray-200 bg-white rounded-t-xl data-[state=open]:rounded-b-none">
                  Forwarded To Me
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0 border border-gray-200 border-t-0 rounded-b-xl bg-white overflow-visible">
                  {forwarded.length === 0 ? (
                    <div className="p-6 text-gray-500">No forwarded requests</div>
                  ) : (
                    <div className="overflow-visible">
                      <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                        <thead className="bg-white">
                          <tr className="border-b border-gray-200">
                            <th className="w-20 px-4 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Type</th>
                            <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Meeting</th>
                            <th className="w-36 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Time</th>
                            <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">User</th>
                            <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Interpreter</th>
                            <th className="w-24 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Room</th>
                            <th className="w-28 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Status</th>
                            <th className="w-48 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Request</th>
                            <th className="w-32 px-6 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Action</th>
                          </tr>
                        </thead>
                        <tbody className="overflow-visible">
                          {forwarded.map((r, index) => {
                            const forwardedDate = new Date(r.timeStart).toISOString().split('T')[0];
                            const isPast = showPast && isPastRecord(forwardedDate, new Date(r.timeEnd).toISOString().split('T')[1].slice(0, 5));
                            return (
                              <tr
                                key={`${r.bookingId}-${r.environmentId}`}
                                className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${isPast
                                  ? "bg-gray-200/50"
                                  : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                  }`}
                              >
                                <td className="px-4 py-4 text-center">
                                  {getMeetingTypeBadge(r.meetingType, undefined, undefined)}
                                </td>
                                <td className="px-4 py-4 overflow-visible relative">
                                  <div className="flex items-start gap-2">
                                    <div className="group relative flex-1" style={{ transform: 'translateZ(0)' }}>
                                      <span className="font-semibold text-gray-900 text-sm cursor-help break-words">
                                        {formatDate(new Date(r.timeStart).toISOString().split('T')[0])}
                                      </span>
                                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none" style={{ zIndex: 999999, position: 'absolute', isolation: 'isolate' }}>
                                        {new Date(r.timeStart).toLocaleString()}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                                    <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {new Date(r.timeStart).toISOString().split('T')[1].slice(0, 5)} - {new Date(r.timeEnd).toISOString().split('T')[1].slice(0, 5)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="font-semibold text-gray-900 text-sm break-words">{r.owner.name || '-'}</span>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-gray-800 text-sm break-words">-</span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center h-full">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold break-words">
                                      {r.meetingRoom}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {(() => {
                                    const ui = mapForwardStatus(r.status);
                                    return (
                                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(ui)}`}>
                                        {getStatusIcon(ui)}
                                        <span className="truncate">{ui}</span>
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm text-gray-600 whitespace-nowrap">
                                    {formatRequestedTime(
                                      new Date((r.createdAt ?? r.timeStart))
                                        .toISOString()
                                        .replace('T', ' ')
                                        .slice(0, 16) + ':00'
                                    )}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const match = bookings.find((b) => b.id === r.bookingId);
                                        if (match) {
                                          setSelectedBooking(match);
                                          setShowBookingDetailDialog(true);
                                          return;
                                        }
                                        const ymd = new Date(r.timeStart).toISOString().split('T')[0];
                                        const hh = (d: string) => new Date(d).toISOString().split('T')[1].slice(0, 5);
                                        const fallback: BookingManage = {
                                          id: r.bookingId,
                                          dateTime: ymd,
                                          interpreter: "",
                                          room: r.meetingRoom,
                                          group: 'other',
                                          meetingDetail: '',
                                          topic: '',
                                          bookedBy: r.owner.name || '',
                                          status: 'Wait',
                                          startTime: hh(r.timeStart),
                                          endTime: hh(r.timeEnd),
                                          requestedTime: new Date((r.createdAt ?? r.timeStart)).toISOString(),
                                          isDR: false,
                                          meetingType: r.meetingType as BookingManage['meetingType'],
                                        };
                                        setSelectedBooking(fallback);
                                        setShowBookingDetailDialog(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={async () => {
                                        const reason = prompt("Reject reason?");
                                        if (!reason || !reason.trim()) return;
                                        const res = await fetch(`/api/admin/bookings/${r.bookingId}/cancel`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ note: reason.trim() }),
                                        });
                                        if (!res.ok) {
                                          const j = await res.json().catch(() => null);
                                          alert(`Reject failed: ${j?.message || res.status}`);
                                          return;
                                        }
                                        await fetchForwarded();
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AccordionContent>
              </div>
            </AccordionItem>
          )}
          
        
          {/* Auto-approve soon */}
          <AccordionItem value="auto-approve" className="border-none">
            <div className="rounded-xl shadow-sm">
              <AccordionTrigger className="px-6 border border-gray-200 bg-white rounded-t-xl data-[state=open]:rounded-b-none">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-600" />
                  <span>Auto-approve</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0 border border-gray-200 border-t-0 rounded-b-xl bg-white">
                {autoApproveBookings.length === 0 ? (
                  <div className="p-6 text-gray-500">No bookings in this bucket</div>
                ) : (
                  <div className="overflow-visible">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-white">
                        <tr className="border-b border-gray-200">
                          <th className="w-20 px-4 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Type</th>
                          <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Meeting</th>
                          <th className="w-36 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Time</th>
                          <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">User</th>
                          <th className="w-24 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Status</th>
                          <th className="w-20 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Auto-approve in</th>
                          <th className="w-32 px-6 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoApproveBookings.map((booking, index) => (
                          <tr key={booking.id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-4 py-4 text-center">{getMeetingTypeBadge(booking.meetingType, booking.drType, booking.otherType)}</td>
                            <td className="px-4 py-4">
                              <span className="font-semibold text-gray-900 text-sm">{formatDate(booking.dateTime)}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                                <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span className="whitespace-nowrap">{booking.startTime} - {booking.endTime}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4"><span className="font-semibold text-gray-900 text-sm break-words">{booking.bookedBy}</span></td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                                {getStatusIcon(booking.status)}
                                <span className="truncate">{booking.status}</span>
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                {etaMap[booking.id]?.etaLabel || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { setSelectedBooking(booking); setShowBookingDetailDialog(true); }}>
                                <SquarePen className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </div>
          </AccordionItem>

          {/* In-coming bucket */}
          <AccordionItem value="in-coming" className="border-none">
            <div className="rounded-xl shadow-sm">
              <AccordionTrigger className="px-6 border border-gray-200 bg-white rounded-t-xl data-[state=open]:rounded-b-none">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-blue-600" />
                  <span>In Coming</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0 border border-gray-200 border-t-0 rounded-b-xl bg-white">
                {incomingBookings.length === 0 ? (
                  <div className="p-6 text-gray-500">No bookings in this bucket</div>
                ) : (
                  <div className="overflow-visible">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-white">
                        <tr className="border-b border-gray-200">
                          <th className="w-20 px-4 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Type</th>
                          <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Date Meeting</th>
                          <th className="w-36 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Meeting Time</th>
                          <th className="w-32 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">User</th>
                          <th className="w-24 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Status</th>
                          <th className="w-20 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Auto-approve in</th>
                          <th className="w-32 px-6 py-3 text-center font-semibold text-gray-900 bg-gray-50 text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomingBookings.map((booking, index) => (
                          <tr key={booking.id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-4 py-4 text-center">{getMeetingTypeBadge(booking.meetingType, booking.drType, booking.otherType)}</td>
                            <td className="px-4 py-4"><span className="font-semibold text-gray-900 text-sm">{formatDate(booking.dateTime)}</span></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1 text-gray-800 font-mono text-sm">
                                <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span className="whitespace-nowrap">{booking.startTime} - {booking.endTime}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4"><span className="font-semibold text-gray-900 text-sm break-words">{booking.bookedBy}</span></td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                                {getStatusIcon(booking.status)}
                                <span className="truncate">{booking.status}</span>
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {etaMap[booking.id]?.etaLabel || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { setSelectedBooking(booking); setShowBookingDetailDialog(true); }}>
                                <SquarePen className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </div>
          </AccordionItem>

          {/* All bookings */}
          <AccordionItem value="all" className="border-none">
            <div className="rounded-xl shadow-sm">
              <AccordionTrigger className="px-6 border border-gray-200 bg-white rounded-t-xl data-[state=open]:rounded-b-none">
                <div className="flex items-center gap-2">
                  <List className="h-5 w-5 text-gray-700" />
                  <span>All</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0 border border-gray-200 border-t-0 rounded-b-xl bg-white">
                <div className="overflow-visible">
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
                        <th className="w-20 px-4 py-3 text-left font-semibold text-gray-900 bg-gray-50 text-sm">Wait</th>
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
                              <span className="whitespace-nowrap">
                                {booking.startTime} - {booking.endTime}
                              </span>
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
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-semibold break-words">
                                {booking.room}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              <span className="truncate">{booking.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {booking.status === 'Wait' ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                etaMap[booking.id]?.category === 'auto-approve' ? 'bg-amber-100 text-amber-800' :
                                etaMap[booking.id]?.category === 'in-coming' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {etaMap[booking.id]?.etaLabel || '-'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 whitespace-nowrap">
                              {formatRequestedTime(booking.requestedTime)}
                            </span>
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
                            {featureFlags.enableForwardAdmin && booking.status === 'Wait' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 ml-2"
                                onClick={() => {
                                  setForwardingBookingId(booking.id);
                                  setShowForwardDialog(true);
                                }}
                              >
                                Forward
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

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

                <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-gray-800">Rows per page:</span>
                    <Select value={pagination.rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
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

                  <div className="flex items-center gap-2 md:justify-end">
                    <span className="text-base text-gray-800">
                      {paginatedBookings.startIndex + 1}-
                      {Math.min(
                        paginatedBookings.startIndex + pagination.rowsPerPage,
                        filteredBookings.length
                      )}{' '}
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
                </div>
              </AccordionContent>
            </div>
          </AccordionItem>
        </Accordion>

        <BookingDetailDialog
          open={showBookingDetailDialog}
          onOpenChange={(open: boolean) => {
            setShowBookingDetailDialog(open);
            if (!open) setSelectedBooking(null);
          }}
          editData={selectedBooking}
          isEditing
          onActionComplete={refreshData}
        />

        {featureFlags.enableForwardAdmin && (
          <ForwardBookingDialog
            open={showForwardDialog}
            onOpenChange={(open: boolean) => {
              setShowForwardDialog(open);
              if (!open) setForwardingBookingId(null);
            }}
            bookingId={forwardingBookingId || 0}
            onForwardComplete={refreshData}
          />
        )}
      </div>
    </div>
  );
}




