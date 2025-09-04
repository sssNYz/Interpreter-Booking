"use client";

import React from "react";
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
  ChevronUp,
  Clock,
} from "lucide-react";

/* ========= Types ========= */
import type {
  AssignmentLogItem,
  AssignmentLogsApiResponse,
} from "@/types/admin-dashboard";

type LogItem = AssignmentLogItem;
type ApiResponse = AssignmentLogsApiResponse;

/* ========= Utils ========= */
const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString();
const toLocalTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const toLocalDateTime = (iso: string) => new Date(iso).toLocaleString();

const formatDR = (v?: string | null) => {
  switch (v) {
    case "PR_PR":
      return "PDR";
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

const getInterpreterDisplayName = (
  interpreter: LogItem["interpreterEmployee"]
) => {
  if (!interpreter) return "-";

  const firstName = interpreter.firstNameEn || interpreter.firstNameTh;
  const lastName = interpreter.lastNameEn || interpreter.lastNameTh;

  if (firstName && lastName) {
    return `${firstName} ${lastName} (${interpreter.empCode})`;
  } else if (firstName) {
    return `${firstName} (${interpreter.empCode})`;
  } else {
    return interpreter.empCode;
  }
};

const getOwnerDisplayName = (owner: LogItem["bookingPlan"]["employee"]) => {
  if (!owner) return "-";

  const firstName = owner.firstNameEn || owner.firstNameTh;
  const lastName = owner.lastNameEn || owner.lastNameTh;

  if (firstName && lastName) {
    return `${firstName} ${lastName} (${owner.empCode})`;
  } else if (firstName) {
    return `${firstName} (${owner.empCode})`;
  } else {
    return owner.empCode;
  }
};

const MEETING_TYPES = [
  "All",
  "DR",
  "VIP",
  "Weekly",
  "General",
  "Augent",
  "Other",
];

/* ========= Component ========= */
export function AssignmentLogsTab() {
  const [allLogs, setAllLogs] = React.useState<LogItem[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [selectedMeetingTypes, setSelectedMeetingTypes] = React.useState<
    string[]
  >(["all"]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  // Sorting state: true = ascending (oldest first), false = descending (latest first)
  const [sortByDateAsc, setSortByDateAsc] = React.useState(false);

  // Fetch assignment logs from API
  const fetchLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        sort: "createdAt:desc",
      });

      // Add date filter if selected
      if (selectedDate) {
        const fromDate = new Date(selectedDate + "T00:00:00");
        const toDate = new Date(selectedDate + "T23:59:59");
        params.set("from", fromDate.toISOString());
        params.set("to", toDate.toISOString());
      }

      const response = await fetch(
        `/api/admin-dashboard/assignment-logs?${params}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      setAllLogs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => setPage(1), [
    selectedDate,
    pageSize,
    selectedMeetingTypes,
    sortByDateAsc,
  ]);

  const filtered = React.useMemo(() => {
    let filteredLogs = allLogs.filter((l) => {
      const meetingTypeOk =
        selectedMeetingTypes.includes("all") ||
        selectedMeetingTypes.includes(l.bookingPlan.meetingType);
      const statusOk = l.status === "assigned";
      return meetingTypeOk && statusOk;
    });

    // Apply sorting by  Requeste(createdAt)
    filteredLogs = filteredLogs.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortByDateAsc ? timeA - timeB : timeB - timeA;
    });

    return filteredLogs;
  }, [allLogs, selectedMeetingTypes, sortByDateAsc]);

  // Pagination calculations
  const filteredTotal = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredTotal);
  const pageItems = filtered.slice(startIdx, endIdx);

  const gotoPrev = () => setPage((p) => Math.max(1, p - 1));
  const gotoNext = () =>
    setPage((p) => Math.min(Math.ceil(filteredTotal / pageSize), p + 1));
  const setToday = () =>
    setSelectedDate(new Date().toISOString().slice(0, 10));

  const toggleMeetingType = (type: string) => {
    setSelectedMeetingTypes((prev) => {
      if (type === "all") return ["all"];
      const next = prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev.filter((t) => t !== "all"), type];
      return next.length === 0 ? ["all"] : next;
    });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  // Sorting toggle
  const handleDateSortToggle = () => {
    setSortByDateAsc((prev) => !prev);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-gray-600" />
                <Input
                  className="w-full sm:w-[200px]"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={setToday} className="w-full sm:w-auto">
                Today
              </Button>
            </div>
          </div>

          <div className="w-full xl:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 w-full xl:w-auto">
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
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="rounded-2xl border-red-200 bg-red-50">
          <AlertTitle className="text-red-800">Error</AlertTitle>
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {loading ? (
        <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700">
          Loading logs...
        </div>
      ) : filteredTotal === 0 ? (
        <Alert className="rounded-2xl">
          <AlertTitle>No Logs</AlertTitle>
          <AlertDescription>
            {selectedDate
              ? `No logs found for ${toLocalDate(selectedDate)}`
              : "No logs found"}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden xl:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={handleDateSortToggle}
                      className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                      title={`Sort by ${sortByDateAsc ? "oldest" : "newest"} first`}
                    >
                      <span>Request</span>
                      {sortByDateAsc ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Meeting Time</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Interpreter</th>
                  <th className="px-4 py-3 text-left">Meeting Type</th>
                  <th className="px-4 py-3 text-center">Room</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {toLocalDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-800">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-mono">
                          {toLocalTime(l.bookingPlan.timeStart)} -{" "}
                          {toLocalTime(l.bookingPlan.timeEnd)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getOwnerDisplayName(l.bookingPlan.employee)}
                    </td>
                    <td className="px-4 py-4">
                      {getInterpreterDisplayName(l.interpreterEmployee)}
                    </td>
                    <td className="px-4 py-4">
                      {l.bookingPlan.meetingType === "DR" && l.bookingPlan.drType
                        ? formatDR(l.bookingPlan.drType)
                        : l.bookingPlan.meetingType}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center">
                        <span className="px-3 py-1 bg-gray-100 rounded-md font-semibold">
                          {l.bookingPlan.meetingRoom}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-indigo-700 bg-indigo-100">
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => {
                          //coming soon: Show popup dialog with reason details
                        }}
                        title="View reason details"
                      >
                        View Reason
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MobTablet Card View */}
          <div className="xl:hidden">
            <div className="divide-y border-t">
              {pageItems.map((l) => (
                <div key={l.id} className="p-4 hover:bg-gray-50 border-b border-gray-200 last:border-b-0">
                  <div className="space-y-2">
                    {/* Request */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Request</span>
                      <span className="text-sm text-gray-900">{toLocalDateTime(l.createdAt)}</span>
                    </div>

                    {/* Meeting Time */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Meeting Time</span>
                      <div className="flex items-center gap-2 text-gray-800">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-sm">
                          {toLocalTime(l.bookingPlan.timeStart)} - {toLocalTime(l.bookingPlan.timeEnd)}
                        </span>
                      </div>
                    </div>

                    {/* Owner */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">User</span>
                      <span className="text-sm text-gray-900">{getOwnerDisplayName(l.bookingPlan.employee)}</span>
                    </div>

                    {/* Interpreter */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Interpreter</span>
                      <span className="text-sm text-gray-900">{getInterpreterDisplayName(l.interpreterEmployee)}</span>
                    </div>

                    {/* Meeting Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Meeting Type</span>
                      <span className="text-sm text-gray-900">
                        {l.bookingPlan.meetingType === "DR" && l.bookingPlan.drType
                          ? formatDR(l.bookingPlan.drType)
                          : l.bookingPlan.meetingType}
                      </span>
                    </div>

                    {/* Room */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Room</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-md font-semibold text-sm">
                        {l.bookingPlan.meetingRoom}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Status</span>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-indigo-700 bg-indigo-100 text-sm">
                        {l.status}
                      </span>
                    </div>

                    {/* Reason Button */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Reason</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => {
                          //coming soon: Show popup dialog with reason details
                        }}
                        title="View reason details"
                      >
                        View Reason
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-white p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="hidden sm:inline">Rows per page:</span>
                <span className="sm:hidden">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="text-sm border rounded-md px-2 py-1 bg-white min-w-[60px]"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-700 text-center">
                {filteredTotal === 0
                  ? "0-0 of 0"
                  : `${startIdx + 1}-${endIdx} of ${filteredTotal}`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={gotoPrev}
                  disabled={page === 1}
                  className="h-8 w-8 sm:h-8 sm:w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={gotoNext}
                  disabled={page === Math.ceil(filteredTotal / pageSize)}
                  className="h-8 w-8 sm:h-8 sm:w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
