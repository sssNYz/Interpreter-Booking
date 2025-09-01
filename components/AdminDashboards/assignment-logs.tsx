// "@/components/AdminDashboards/assignment-logs.tsx"
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
  Clock,
} from "lucide-react";

/* ========= Types ========= */
interface LogItem {
  id: number;
  createdAt: string; // requested time
  bookingId: number;
  interpreterEmpCode?: string | null;
  status: string; // "assigned" when present
  reason?: string | null;
  preHoursSnapshot: Record<string, unknown>;
  postHoursSnapshot?: Record<string, unknown>;
  scoreBreakdown?: Record<string, unknown>;
  bookingPlan: {
    meetingType: string;
    drType?: string | null;
    timeStart: string;
    timeEnd: string;
    meetingRoom: string;
    ownerGroup: string;
    otherType?: string | null;
    ownerEmpCode: string;
    employee?: {
      empCode: string;
      firstNameEn?: string | null;
      lastNameEn?: string | null;
      firstNameTh?: string | null;
      lastNameTh?: string | null;
    } | null;
  };
  interpreterEmployee?: {
    empCode: string;
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  } | null;
}

interface ApiResponse {
  items: LogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    byInterpreter: Record<
      string,
      { assigned: number; approved: number; rejected: number }
    >;
  };
}

/* ========= Utils ========= */
const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString();
const toLocalTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const toLocalDateTime = (iso: string) => new Date(iso).toLocaleString();

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
  "all",
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
  // 🔹 default เป็น "" (ทั้งหมด)
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [selectedMeetingTypes, setSelectedMeetingTypes] = React.useState<
    string[]
  >(["all"]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Fetch assignment logs from API
  const fetchLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        sort: "createdAt:desc",
      });

      // 🔹 ส่ง from/to เฉพาะเมื่อมีวันที่เลือก
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

      // 🔹 ใช้ length จริง แทนการพึ่ง total จาก server
      setTotal(data.items.length);
      setTotalPages(Math.max(1, Math.ceil(data.items.length / pageSize)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, pageSize]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => setPage(1), [
    selectedDate,
    pageSize,
    selectedMeetingTypes,
  ]);

  const filtered = React.useMemo(() => {
    return allLogs
      .filter((l) => {
        const meetingTypeOk =
          selectedMeetingTypes.includes("all") ||
          selectedMeetingTypes.includes(l.bookingPlan.meetingType);
        const statusOk = l.status === "assigned";
        return meetingTypeOk && statusOk;
      })
      .sort(
        (a, b) =>
          new Date(a.bookingPlan.timeStart).getTime() -
          new Date(b.bookingPlan.timeStart).getTime()
      );
  }, [allLogs, selectedMeetingTypes]);

  // 🔹 paginate ฝั่ง client
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Requested At</th>
                <th className="px-6 py-3 text-left">Meeting Time</th>
                <th className="px-6 py-3 text-left">Owner</th>
                <th className="px-6 py-3 text-left">Interpreter</th>
                <th className="px-6 py-3 text-left">Meeting Type</th>
                <th className="px-6 py-3 text-left">Room</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l) => (
                <tr key={l.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {toLocalDateTime(l.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-800">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-mono">
                        {toLocalTime(l.bookingPlan.timeStart)} -{" "}
                        {toLocalTime(l.bookingPlan.timeEnd)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getOwnerDisplayName(l.bookingPlan.employee)}
                  </td>
                  <td className="px-6 py-4">
                    {getInterpreterDisplayName(l.interpreterEmployee)}
                  </td>
                  <td className="px-6 py-4">
                    {l.bookingPlan.meetingType === "DR" && l.bookingPlan.drType
                      ? formatDR(l.bookingPlan.drType)
                      : l.bookingPlan.meetingType}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 rounded-md font-semibold">
                      {l.bookingPlan.meetingRoom}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-indigo-700 bg-indigo-100">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700 max-w-xs">
                    <div className="truncate" title={l.reason || undefined}>
                      {l.reason || "-"}
                    </div>
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
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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
                className="h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={gotoNext}
                disabled={page === Math.ceil(filteredTotal / pageSize)}
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
