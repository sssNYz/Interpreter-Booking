"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Search,
  Filter,
} from "lucide-react";

/* ========= Types ========= */
interface LogItem {
  id: number;
  createdAt: string;
  bookingId: number;
  interpreterEmpCode: string | null;
  status: string;
  reason: string | null;
  preHoursSnapshot: unknown;
  postHoursSnapshot: unknown;
  scoreBreakdown: unknown;
  bookingPlan: {
    meetingType: string;
    ownerGroup: string;
    timeStart: string;
    timeEnd: string;
    meetingRoom: string | null;
    drType: string | null;
    otherType: string | null;
  };
  interpreterEmployee: {
    empCode: string;
    firstNameEn: string | null;
    lastNameEn: string | null;
    firstNameTh: string | null;
    lastNameTh: string | null;
  } | null;
}

interface ApiResponse {
  items: LogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    byInterpreter: Record<string, { assigned: number; approved: number; rejected: number }>;
  };
}

/* ========= Utils ========= */
const toLocalDate = (iso: string) =>
  new Date(iso).toLocaleDateString();

const toLocalTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const toLocalDateTime = (iso: string) =>
  new Date(iso).toLocaleString();

const formatDR = (v?: string | null) => {
  switch (v) {
    case "PR_PR":
      return "DR-I";
    case "DR_k":
      return "DR-k";
    case "DR_II":
      return "DR-II";
    case "DR_I":
      return "DR-I";
    case "Other":
      return "Other";
    default:
      return "DR";
  }
};

const MEETING_TYPES = ["all", "DR", "VIP", "Weekly", "General", "Augent", "Other"];
const STATUS_OPTIONS = ["all", "assigned", "approved", "rejected", "pending"];

/* ========= Component ========= */
export function AssignmentLogsTab() {
  // State
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMeetingTypes, setSelectedMeetingTypes] = useState<string[]>(["all"]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [interpreterFilter, setInterpreterFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Summary
  const [summary, setSummary] = useState<Record<string, { assigned: number; approved: number; rejected: number }>>({});

  // Fetch data from API
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      
      // Add filters
      if (selectedStatus !== "all") {
        params.set("status", selectedStatus);
      }
      
      if (interpreterFilter.trim()) {
        params.set("interpreterEmpCode", interpreterFilter.trim());
      }
      
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }
      
      // Add date filter
      if (selectedDate) {
        const date = new Date(selectedDate);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        params.set("from", date.toISOString());
        params.set("to", nextDay.toISOString());
      }
      
      // Add sorting
      params.set("sort", "createdAt:desc");
      
      const response = await fetch(`/api/admin-dashboard/assignment-logs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      setLogs(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSummary(data.summary.byInterpreter);
      
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    setPage(1); // Reset to first page when filters change
  }, [selectedDate, selectedMeetingTypes, selectedStatus, interpreterFilter, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, selectedDate, selectedStatus, interpreterFilter, searchTerm]);

  // Filter logs by meeting type (client-side since API doesn't support it yet)
  const filteredLogs = useMemo(() => {
    if (selectedMeetingTypes.includes("all")) {
      return logs;
    }
    return logs.filter(log => selectedMeetingTypes.includes(log.bookingPlan.meetingType));
  }, [logs, selectedMeetingTypes]);

  // Pagination handlers
  const gotoPrev = () => setPage(p => Math.max(1, p - 1));
  const gotoNext = () => setPage(p => Math.min(totalPages, p + 1));
  const setToday = () => setSelectedDate(new Date().toISOString().slice(0, 10));

  // Filter handlers
  const toggleMeetingType = (type: string) => {
    setSelectedMeetingTypes(prev => {
      if (type === "all") return ["all"];
      const next = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev.filter(t => t !== "all"), type];
      return next.length === 0 ? ["all"] : next;
    });
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  const handleSearch = () => {
    fetchLogs();
  };

  const clearFilters = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
    setSelectedMeetingTypes(["all"]);
    setSelectedStatus("all");
    setInterpreterFilter("");
    setSearchTerm("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <Input
            className="w-[200px]"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <Button variant="outline" onClick={setToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                Meeting Types <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MEETING_TYPES.map((mt) => (
                <DropdownMenuCheckboxItem
                  key={mt}
                  checked={selectedMeetingTypes.includes(mt)}
                  onCheckedChange={() => toggleMeetingType(mt)}
                >
                  {mt}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                Status <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatus === status}
                  onCheckedChange={() => handleStatusChange(status)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-600" />
          <Input
            placeholder="Search by reason or booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <Input
            placeholder="Interpreter EmpCode"
            value={interpreterFilter}
            onChange={(e) => setInterpreterFilter(e.target.value)}
            className="w-[200px]"
          />
        </div>
        
        <Button onClick={handleSearch}>
          Search
        </Button>
      </div>

      {/* Summary Stats */}
      {Object.keys(summary).length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Interpreter Summary</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(summary).map(([empCode, stats]) => (
              <div key={empCode} className="text-sm">
                <span className="font-medium">{empCode}:</span>
                <span className="ml-2 text-green-600">{stats.assigned} assigned</span>
                {stats.approved > 0 && <span className="ml-2 text-blue-600">{stats.approved} approved</span>}
                {stats.rejected > 0 && <span className="ml-2 text-red-600">{stats.rejected} rejected</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700">
          Loading logs...
        </div>
      ) : error ? (
        <Alert className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : filteredLogs.length === 0 ? (
        <Alert className="rounded-2xl">
          <AlertTitle>No Logs</AlertTitle>
          <AlertDescription>
            No logs found for the selected criteria
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Requested At</th>
                <th className="px-6 py-3 text-left">Meeting Time</th>
                <th className="px-6 py-3 text-left">Interpreter</th>
                <th className="px-6 py-3 text-left">Meeting Type</th>
                <th className="px-6 py-3 text-left">Room</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {toLocalDateTime(log.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-800">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-mono">
                        {toLocalTime(log.bookingPlan.timeStart)} -{" "}
                        {toLocalTime(log.bookingPlan.timeEnd)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.interpreterEmployee ? (
                      <div>
                        <div className="font-medium">{log.interpreterEmployee.empCode}</div>
                        <div className="text-sm text-gray-500">
                          {log.interpreterEmployee.firstNameEn || log.interpreterEmployee.firstNameTh || ""} {" "}
                          {log.interpreterEmployee.lastNameEn || log.interpreterEmployee.lastNameTh || ""}
                        </div>
                      </div>
                    ) : (
                      log.interpreterEmpCode || "-"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {log.bookingPlan.meetingType === "DR" && log.bookingPlan.drType
                      ? formatDR(log.bookingPlan.drType)
                      : log.bookingPlan.meetingType}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 rounded-md font-semibold">
                      {log.bookingPlan.meetingRoom || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold ${
                      log.status === "assigned" ? "text-indigo-700 bg-indigo-100" :
                      log.status === "approved" ? "text-green-700 bg-green-100" :
                      log.status === "rejected" ? "text-red-700 bg-red-100" :
                      "text-gray-700 bg-gray-100"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {log.reason || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="border-t bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              Rows per page:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-sm border rounded-md px-2 py-1 bg-white"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-700">
              {total === 0 ? "0-0 of 0" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={gotoPrev}
                disabled={page === 1}
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={gotoNext}
                disabled={page >= totalPages}
                className="h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
