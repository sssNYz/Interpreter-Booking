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
  ownerEmpCode?: string | null;
  status: string; // "assigned" when present
  reason?: string | null;
  bookingPlan: {
    meetingType: string;
    drType?: string | null;
    timeStart: string;
    timeEnd: string;
    meetingRoom: string;
  };
}

/* ========= Mock ========= */
function mockLogsPreview(count = 18): LogItem[] {
  const interpreters = ["I001", "I003"];
  const owners = ["John Doe", "Jane Smith"];
  const types = ["DR", "VIP", "Weekly", "General", "Augent", "Other"] as const;
  const rooms = ["Hong Nam", "Room A"];
  const drEnumValues = ["PR_PR", "DR_k", "DR_II", "DR_I", "Other"] as const;
  const rows: LogItem[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const base = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0
    );
    base.setMinutes(base.getMinutes() + i * 60);
    const start = new Date(base);
    const end = new Date(base.getTime() + 60 * 60 * 1000);
    const mt = types[i % types.length];

    rows.push({
      id: i + 1,
      createdAt: new Date(base.getTime() - 30 * 60 * 1000).toISOString(),
      bookingId: 1000 + i + 1,
      interpreterEmpCode: interpreters[i % interpreters.length],
      ownerEmpCode: owners[i % owners.length],
      status: "assigned",
      reason: i % 7 === 0 ? "Auto-assigned by rule" : null,
      bookingPlan: {
        meetingType: mt,
        drType: mt === "DR" ? drEnumValues[i % drEnumValues.length] : null,
        timeStart: start.toISOString(),
        timeEnd: end.toISOString(),
        meetingRoom: rooms[i % rooms.length],
      },
    });
  }
  return rows;
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

/* ========= Component ========= */
export function AssignmentLogsTab() {
  const [allLogs, setAllLogs] = React.useState<LogItem[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMeetingTypes, setSelectedMeetingTypes] = React.useState<string[]>(["all"]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setAllLogs(mockLogsPreview(8)); // ให้เหมือนภาพตัวอย่าง 8 แถว
      setLoading(false);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => setPage(1), [selectedDate, pageSize, selectedMeetingTypes]);

  const filtered = React.useMemo(() => {
    const dayStart = new Date(selectedDate + "T00:00:00");
    const dayEnd = new Date(selectedDate + "T23:59:59");
    return allLogs
      .filter(
        (l) =>
          new Date(l.bookingPlan.timeStart) >= dayStart &&
          new Date(l.bookingPlan.timeStart) <= dayEnd
      )
      .filter(
        (l) =>
          selectedMeetingTypes.includes("all") ||
          selectedMeetingTypes.includes(l.bookingPlan.meetingType)
      )
      .filter((l) => l.status === "assigned")
      .sort(
        (a, b) =>
          new Date(a.bookingPlan.timeStart).getTime() -
          new Date(b.bookingPlan.timeStart).getTime()
      );
  }, [allLogs, selectedDate, selectedMeetingTypes]);

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = filtered.slice(startIdx, endIdx);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const gotoPrev = () => setPage((p) => Math.max(1, p - 1));
  const gotoNext = () => setPage((p) => Math.min(totalPages, p + 1));
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

  return (
    <div className="space-y-4">
      {/* Toolbar (เหมือนภาพ: กล่องใหญ่โค้งมน) */}
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

      {/* Table */}
      {loading ? (
        <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700">
          Loading logs...
        </div>
      ) : total === 0 ? (
        <Alert className="rounded-2xl">
          <AlertTitle>No Logs</AlertTitle>
          <AlertDescription>
            No logs found for {toLocalDate(selectedDate)}
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
                  <td className="px-6 py-4">{l.interpreterEmpCode ?? "-"}</td>
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
                      assigned
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {l.reason ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer (Rows per page + range + pager ปุ่มโค้งมน) */}
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
              {total === 0 ? "0-0 of 0" : `${startIdx + 1}-${endIdx} of ${total}`}
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
                disabled={page === totalPages}
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
