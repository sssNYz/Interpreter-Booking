"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Hourglass,
  Star,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  UserRound,
  FileText,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as RBarChart, Bar, XAxis, YAxis } from "recharts";
import type { BookingManage } from "@/types/admin";
import type { BookingData } from "@/types/booking";
import { getMeetingTypeBadge } from "@/utils/priority";

/* ================= helpers: format ================= */
const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
};
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/* ================= helpers: UI status pill ================= */
const Status: React.FC<{ value: BookingManage["status"] }> = ({ value }) => {
  const iconClass = value === "Approve"
    ? "text-emerald-600"
    : value === "Wait"
    ? "text-amber-600"
    : "text-red-600";
  const Icon = value === "Approve" ? CheckCircle : value === "Wait" ? Hourglass : XCircle;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80">
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
      {value}
    </span>
  );
};

/* ================= types ================= */
type ApiStatus = "approve" | "cancel" | "waiting";

type AvailabilityListResponse = {
  bookingId: number;
  timeStart: string; // ISO
  timeEnd: string;   // ISO
  updatedAt: string; // ISO
  count: number;
  interpreters: { empCode: string; name: string }[];
};

type PatchInterpreterResponse =
  | {
      bookingId: number;
      interpreterEmpCode: string | null;
      timeStart: string; // ISO
      timeEnd: string;   // ISO
      bookingStatus: ApiStatus;
      updatedAt: string; // ISO
    }
  | { ok: true; unchanged: true; bookingId: number };

export type BookingForDialog = BookingManage & {
  bookingId?: number;
  id?: number;
  group?: string;
  topic?: string;
};

function getBookingId(b?: BookingForDialog | null): number | undefined {
  if (!b) return undefined;
  return typeof b.bookingId === "number" ? b.bookingId : b.id;
}

/* ================= API ================= */
async function fetchAvailability(bookingId: number): Promise<AvailabilityListResponse> {
  const res = await fetch(
    `/api/booking-data/get-booking-interpreter/${bookingId}?excludeCurrent=true&limit=50&lang=en`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Availability failed (${res.status})`);
  return res.json();
}

async function patchInterpreter(bookingId: number, newInterpreterEmpCode: string, updatedAt: string) {
  const res = await fetch(`/api/booking-data/patch-booking-interpreter/${bookingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newInterpreterEmpCode, updatedAt }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    const detail = typeof msg?.message === "string" ? msg.message : `PATCH failed (${res.status})`;
    throw new Error(detail);
  }
  return res.json() as Promise<PatchInterpreterResponse>;
}

async function adminApprove(bookingId: number, interpreterEmpCode: string, note?: string) {
  const res = await fetch(`/api/admin/bookings/${bookingId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interpreterEmpCode, note }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    const msg = typeof j?.message === "string" ? j.message : `Approve failed (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

/* ================= Interpreter Selector ================= */
const InterpreterSelector: React.FC<{
  bookingId: number;
  currentDisplayName?: string;
  disabled?: boolean;
  onSelect?: (empCode: string | "") => void;
  onServerVersion?: (ver: string) => void;
  suggestedEmpCodes?: string[];
  onOptionsChange?: (options: { empCode: string; name: string }[]) => void;
}> = ({ bookingId, currentDisplayName, disabled, onSelect, onServerVersion, suggestedEmpCodes, onOptionsChange }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<{ empCode: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const selectedDisplayName = useMemo(() => {
    const found = options.find((o) => o.empCode === selected);
    return found ? found.name : "";
  }, [options, selected]);

  const load = React.useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await fetchAvailability(bookingId);
      setOptions(data.interpreters);
      onOptionsChange?.(data.interpreters);
      onServerVersion?.(data.updatedAt);
    } catch (e) {
      const error = e as Error;
      if (error.message.includes("404") || error.message.includes("NOT_FOUND")) {
        setErr(`Booking ${bookingId} not found. It may have been deleted.`);
      } else {
        setErr(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId, onServerVersion, onOptionsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      {/* Current interpreter info - more compact */}
      <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Current:</span>
          <span className="text-sm font-medium text-foreground">
            {currentDisplayName || (
              <span className="text-muted-foreground italic">Not assigned</span>
            )}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0" 
          onClick={load} 
          title="Refresh list" 
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""} text-muted-foreground`} />
        </Button>
      </div>

      {/* Selector - more compact */}
      <div>
        <Select
          value={selected}
          onValueChange={(v) => {
            setSelected(v);
            onSelect?.(v);
          }}
          disabled={disabled || loading}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder={loading ? "Loading..." : "Choose interpreter"}>
              {selectedDisplayName && (
                <div className="text-sm font-medium truncate">
                  {selectedDisplayName}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {options.map((o) => {
              const topEmpCode = suggestedEmpCodes && suggestedEmpCodes.length > 0 ? suggestedEmpCodes[0] : undefined;
              const isTopSuggestion = !!topEmpCode && topEmpCode === o.empCode;
              return (
                <SelectItem key={o.empCode} value={o.empCode}>
                  <div className="flex items-center gap-2 w-full">
                    {isTopSuggestion ? (
                      <Star className="h-3 w-3 text-primary" />
                    ) : (
                      <div className="w-3 h-3" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.name}</div>
                    </div>
                    {isTopSuggestion && (
                      <span className="text-xs text-primary font-medium">★</span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {err && <p className="text-destructive text-xs">{err}</p>}
    </div>
  );
};

/* ================= main component ================= */
type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: BookingManage | null;
  isEditing?: boolean;
  onActionComplete?: () => void;
  // If provided, suggestions will be filtered to this environment (e.g. forwarding target Admin C)
  targetEnvironmentId?: number;
};

const BookingDetailDialog: React.FC<Props> = ({ open, onOpenChange, editData, isEditing = true, onActionComplete, targetEnvironmentId }) => {
  const controlled = typeof open === "boolean";
  const [uOpen, setUOpen] = useState(false);
  const actualOpen = controlled ? (open as boolean) : uOpen;
  const setOpen = (v: boolean) => (controlled ? onOpenChange?.(v) : setUOpen(v));
  
  // Responsive design
  const { isMobile, screenSize } = useMobile();
  const isTablet = screenSize === 'md' || screenSize === 'lg';

  const [booking, setBooking] = useState<BookingForDialog | null>(null);
  useEffect(() => {
    if (actualOpen && editData) setBooking(editData as BookingForDialog);
  }, [actualOpen, editData]);

  // Extra rich detail for admin (applicableModel, language, chairman, invites)
  const [bookingDetail, setBookingDetail] = useState<BookingData | null>(null);
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false);
  const [bookingDetailError, setBookingDetailError] = useState<string | null>(null);
  useEffect(() => {
    const run = async () => {
      setBookingDetail(null);
      setBookingDetailError(null);
      if (!actualOpen) return;
      const id = booking?.id ?? booking?.bookingId;
      if (!id) return;
      try {
        setBookingDetailLoading(true);
        const res = await fetch(`/api/booking-data/${id}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.success && j?.data) {
          setBookingDetail(j.data as BookingData);
        } else {
          setBookingDetailError(typeof j?.error === 'string' ? j.error : 'Failed to load booking detail');
        }
      } catch (e) {
        setBookingDetailError((e as Error).message);
      } finally {
        setBookingDetailLoading(false);
      }
    };
    void run();
  }, [actualOpen, booking?.id, booking?.bookingId]);

  const [expand, setExpand] = useState(false);
  useEffect(() => setExpand(false), [booking?.bookingId, booking?.id, actualOpen]);

  const [submitting, setSubmitting] = useState<null | "approve" | "cancel" | "apply">(null);
  const EXIT_MS = 150;

  const bookingIdForApi = getBookingId(booking);

  const [pendingEmpCode, setPendingEmpCode] = useState<string>("");
  const [serverVersion, setServerVersion] = useState<string>("");
  const [suggestions, setSuggestions] = useState<
    { empCode: string; score: number; reasons: string[]; time: { daysToMeeting: number; hoursToStart: number; lastJobDaysAgo: number }; currentHours?: number; afterAssignHours?: number; groupHours?: { iot: number; hardware: number; software: number; other: number } }[]
  >([]);
  const [interpreterOptions, setInterpreterOptions] = useState<{ empCode: string; name: string }[]>([]);

  const handleOptionsChange = useCallback((opts: { empCode: string; name: string }[]) => {
    setInterpreterOptions(opts);
  }, []);
  const handleServerVersion = useCallback((v: string) => {
    setServerVersion(v);
  }, []);

  const getDisplayName = useCallback((code?: string | null) => {
    if (!code) return "";
    const f = interpreterOptions.find(o => o.empCode === code);
    return f?.name || code;
  }, [interpreterOptions]);

  useEffect(() => {
    if (!actualOpen) {
      setPendingEmpCode("");
      setServerVersion("");
    }
  }, [actualOpen]);

  // Fetch system suggestions when dialog opens
  useEffect(() => {
    const run = async () => {
      if (!actualOpen) return;
      const id = bookingIdForApi;
      if (id == null) return;
      try {
        const envQuery = targetEnvironmentId != null ? `&environmentId=${targetEnvironmentId}` : "";
        const res = await fetch(`/api/bookings/${id}/suggestions?maxCandidates=20${envQuery}` , { cache: "no-store" });
        const j = await res.json().catch(() => ({}) as { ok?: boolean; candidates?: { empCode: string; score: number; reasons: string[]; time: { daysToMeeting: number; hoursToStart: number; lastJobDaysAgo: number }; currentHours?: number; afterAssignHours?: number; groupHours?: { iot: number; hardware: number; software: number; other: number } }[] });
        if (res.ok && j?.ok && Array.isArray(j.candidates)) {
          setSuggestions(j.candidates as typeof suggestions);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      }
    };
    void run();
  }, [actualOpen, bookingIdForApi, targetEnvironmentId]);

  const topSuggestion = useMemo(() => suggestions[0] || null, [suggestions]);

  // Build stacked data per interpreter with group split (iot/hardware/software/other)
  const stackedData = useMemo(() => {
    if (!booking) return [] as Array<{ name: string; iot: number; hardware: number; software: number; other: number; total: number }>;

    const recommended = suggestions[0]?.empCode;
    if (!recommended) return [];

    const startTime = new Date(`${booking.dateTime}T${booking.startTime}:00`);
    const endTime = new Date(`${booking.dateTime}T${booking.endTime}:00`);
    const bookingDurationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const selected = pendingEmpCode || undefined;
    const second = selected && selected !== recommended ? selected : suggestions[1]?.empCode;
    // Keep stable ordering: recommended always first, then second candidate (selected or next suggestion)
    const pairs = [recommended, second].filter(Boolean) as string[];
    // Deduplicate if selected equals recommended
    const uniquePairs = pairs.filter((v, i, a) => a.indexOf(v) === i);

    const safeGroup = String(booking.group || "other").toLowerCase() as "iot" | "hardware" | "software" | "other";

    const rows = uniquePairs.map((code) => {
      const found = suggestions.find((s) => s.empCode === code);
      const gh = found?.groupHours || { iot: 0, hardware: 0, software: 0, other: 0 };
      const base = { ...gh };
      // Preview impact for selected interpreter; if none selected, preview for recommended
      if ((selected && code === selected) || (!selected && code === recommended)) {
        base[safeGroup] = Math.round((base[safeGroup] + bookingDurationHours) * 10) / 10;
      }
      const total = Math.round((base.iot + base.hardware + base.software + base.other) * 10) / 10;
      return { name: getDisplayName(code) || code, ...base, total };
    });

    return rows;
  }, [booking, pendingEmpCode, suggestions, getDisplayName]);

  const canApprove = useMemo(() => {
    if (!booking || bookingIdForApi == null) return false;
    return !!pendingEmpCode;
  }, [booking, bookingIdForApi, pendingEmpCode]);

  const handleApproveOrApply = async () => {
    if (!booking || bookingIdForApi == null) return;
    try {
      const isWait = booking.status === "Wait";
      setSubmitting(isWait ? "approve" : "apply");

      if (!pendingEmpCode) throw new Error("Please select an interpreter first.");

      if (isWait) {
        await adminApprove(bookingIdForApi, pendingEmpCode);
        setBooking((prev) => (prev ? { ...prev, status: "Approve", interpreter: pendingEmpCode } : prev));
      } else {
        const res = await patchInterpreter(bookingIdForApi, pendingEmpCode, serverVersion);
        if ("updatedAt" in res) setServerVersion(res.updatedAt);
        setBooking((prev) => (prev ? { ...prev, interpreter: pendingEmpCode } : prev));
      }

      setOpen(false);
      setTimeout(() => onActionComplete?.(), EXIT_MS);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const openCancelDialog = () => {
    if (!booking || bookingIdForApi == null || booking.status === "Cancel") return;
    setCancelReason("");
    setCancelError(null);
    setShowCancelDialog(true);
  };

  const performCancel = async () => {
    if (!booking || bookingIdForApi == null) return;
    const reason = (cancelReason || "").trim();
    if (!reason) {
      setCancelError("Reason is required");
      return;
    }
    try {
      setSubmitting("cancel");
      setCancelError(null);
      const res = await fetch(`/api/admin/bookings/${bookingIdForApi}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg = (j?.message as string) || `Cancel failed (${res.status})`;
        throw new Error(msg);
      }
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; remainingTargets?: number };
      if (j?.status === "cancel") {
        setBooking((prev) => (prev ? { ...prev, status: "Cancel", interpreter: "" } : prev));
      }
      setShowCancelDialog(false);
      setOpen(false);
      setTimeout(() => onActionComplete?.(), EXIT_MS);
    } catch (e) {
      setCancelError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        showCloseButton={false}
        className={`grid overflow-hidden border-none p-0 bg-background grid-rows-[auto,1fr,auto] ${
          isMobile 
            ? "w-[95vw] max-w-sm h-[90vh]" 
            : isTablet 
            ? "w-[90vw] max-w-2xl" 
            : "w-[min(85vw,900px)] max-w-4xl"
        }`}
      >
        {/* Minimal Header */}
        <DialogHeader className="px-4 pt-2 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">
                {booking ? `Booking #${getBookingId(booking)}` : isEditing ? "Booking Details" : "Create Booking"}
              </span>
              {booking && <Status value={booking.status} />}
            </div>
            {booking && getMeetingTypeBadge(booking.meetingType, booking.drType, booking.otherType)}
          </DialogTitle>
        </DialogHeader>

        {/* Content Body - Flat Layout */}
        <div className="px-4 py-3 overflow-y-auto space-y-3 max-h-[calc(90vh-140px)]">
          {!booking ? (
            <div className="flex min-h-[150px] items-center justify-center">
              <div className="text-center">
                <Hourglass className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a booking to inspect</p>
              </div>
            </div>
          ) : (
            <>
              {/* Basic Info - Flat rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Date & Time
                  </span>
                  <span className="text-sm font-medium">{fmtDate(booking.dateTime)} • {booking.startTime} - {booking.endTime}</span>
                </div>
                
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Room
                  </span>
                  <span className="text-sm font-medium">{booking.room}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Requested by
                  </span>
                  <span className="text-sm font-medium truncate max-w-[200px]" title={booking.bookedBy}>{booking.bookedBy}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Requested at
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(booking.requestedTime)}</span>
                </div>

                {booking?.group && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">Group</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded uppercase font-semibold">{booking.group}</span>
                  </div>
                )}

                {bookingDetail?.applicableModel && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Model
                    </span>
                    <span className="text-sm font-medium truncate max-w-[240px]" title={bookingDetail.applicableModel}>
                      {bookingDetail.applicableModel}
                    </span>
                  </div>
                )}

                {(bookingDetail?.languageCode || bookingDetail?.chairmanEmail) && (
                  <>
                    {bookingDetail.languageCode && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">Language</span>
                        <span className="text-sm font-medium">{bookingDetail.languageCode}</span>
                      </div>
                    )}
                    {bookingDetail.chairmanEmail && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">Chairman</span>
                        <span className="text-sm font-medium truncate max-w-[240px]" title={bookingDetail.chairmanEmail}>
                          {bookingDetail.chairmanEmail}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Meeting Notes - Show early so admin knows what meeting is about */}
              {(booking?.meetingDetail || booking?.topic) && (
                <>
                  <hr className="border-border" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Meeting Notes</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setExpand((v) => !v)}>
                        {expand ? "Less" : "More"}
                      </Button>
                    </div>
                    <div className={`text-sm text-foreground/90 ${expand ? "" : "line-clamp-3"}`}>
                      {booking?.meetingDetail ?? booking?.topic}
                    </div>
                  </div>
                </>
              )}
              
              <hr className="border-border" />

              {/* Interpreter Assignment - Flat */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Assign Interpreter</span>
                </div>

                <div className="space-y-3">
                  <InterpreterSelector
                    bookingId={bookingIdForApi ?? 0}
                    currentDisplayName={booking.interpreter}
                    disabled={booking.status === "Cancel" || bookingIdForApi == null}
                    onSelect={(code) => setPendingEmpCode(code)}
                    onServerVersion={handleServerVersion}
                    suggestedEmpCodes={suggestions.map((s) => s.empCode)}
                    onOptionsChange={handleOptionsChange}
                  />

                  {/* Top Suggestion - Flat inline */}
                  {topSuggestion && (
                    <div className="flex items-center justify-between p-2 rounded border bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-primary" />
                        <span className="text-sm font-medium">Best choice: {getDisplayName(topSuggestion.empCode)}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span>Meeting in: {topSuggestion.time?.daysToMeeting ?? "--"}d {topSuggestion.time?.hoursToStart ?? "--"}h</span>
                      </div>
                    </div>
                  )}

                  {/* Workload Comparison Chart */}
                  {stackedData.length > 0 && (
                    <div className="rounded border bg-card/50 p-2 sm:p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm font-medium">Compare Workload</span>
                      </div>
                      <ChartContainer
                        className="h-[100px] sm:h-[120px] md:h-[140px] w-full"
                        config={{
                          iot: { label: "IoT", color: "hsl(210, 70%, 55%)" },
                          hardware: { label: "HW", color: "hsl(140, 45%, 60%)" },
                          software: { label: "SW", color: "hsl(0, 55%, 60%)" },
                          other: { label: "Other", color: "hsl(40, 60%, 65%)" },
                        }}
                      >
                        <RBarChart 
                          data={stackedData} 
                          layout="vertical"
                          margin={{ 
                            top: 5, 
                            right: 10, 
                            left: isMobile ? 35 : isTablet ? 45 : 55, 
                            bottom: 5 
                          }}
                          barSize={isMobile ? 28 : isTablet ? 36 : 44}
                        >
                          <XAxis type="number" dataKey="total" hide domain={[0, 'dataMax']} />
                          <YAxis 
                            dataKey="name" 
                            type="category"
                            tickLine={false}
                            tickMargin={8}
                            axisLine={false}
                            stroke="var(--muted-foreground)" 
                            tick={{ fontSize: isMobile ? 9 : isTablet ? 10 : 11, fontWeight: 500 }} 
                            width={isMobile ? 30 : isTablet ? 40 : 50}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Bar dataKey="iot" stackId="hrs" fill="var(--color-iot)" radius={0} />
                          <Bar dataKey="hardware" stackId="hrs" fill="var(--color-hardware)" radius={0} />
                          <Bar dataKey="software" stackId="hrs" fill="var(--color-software)" radius={0} />
                          <Bar dataKey="other" stackId="hrs" fill="var(--color-other)" radius={0} />
                        </RBarChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Invites */}
              {(bookingDetailLoading || bookingDetail?.inviteEmails) && (
                <>
                  <hr className="border-border" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Email Invites</span>
                        {bookingDetail?.inviteEmails && bookingDetail.inviteEmails.length > 0 && (
                          <span className="text-xs text-primary">
                            {bookingDetail.inviteEmails.length} {bookingDetail.inviteEmails.length === 1 ? 'recipient' : 'recipients'}
                          </span>
                        )}
                      </div>
                    </div>
                    {bookingDetailLoading ? (
                      <div className="text-xs text-muted-foreground">Loading...</div>
                    ) : bookingDetail?.inviteEmails && bookingDetail.inviteEmails.length > 0 ? (
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {bookingDetail.inviteEmails.map((email, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/40">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                            <span className="text-sm leading-relaxed break-all">{email}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No email invites</div>
                    )}
                    {bookingDetailError && (
                      <div className="text-xs text-destructive mt-1">{bookingDetailError}</div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="border-t px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {pendingEmpCode ? (
                <>
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span><strong className="text-foreground">{getDisplayName(pendingEmpCode)}</strong> selected</span>
                  {topSuggestion && pendingEmpCode === topSuggestion.empCode && (
                    <Star className="w-3 h-3 text-primary" />
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>No selection</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {booking && booking.status !== "Cancel" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="px-4 h-8"
                  disabled={submitting === "approve" || submitting === "apply" || submitting === "cancel"}
                  onClick={openCancelDialog}
                >
                  <>
                    <XCircle className="w-3 h-3 mr-1" />
                    Cancel booking
                  </>
                </Button>
              )}

            <Button
              size="sm"
              className="px-4 h-8"
              disabled={!canApprove || submitting === "cancel"}
              onClick={handleApproveOrApply}
            >
              {submitting === "approve" || submitting === "apply" ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  {booking?.status === "Wait" ? "Approving..." : "Applying..."}
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {booking?.status === "Wait" ? "Approve" : "Apply"}
                </>
              )}
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* Cancel reason dialog */}
    <Dialog open={showCancelDialog} onOpenChange={(v) => { if (!submitting) setShowCancelDialog(v); }}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Please provide a reason for cancellation.</p>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason..."
            rows={4}
          />
          {cancelError && <div className="text-xs text-destructive">{cancelError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(false)} disabled={submitting === "cancel"}>
              Close
            </Button>
            <Button variant="destructive" size="sm" onClick={performCancel} disabled={submitting === "cancel"}>
              {submitting === "cancel" ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Canceling...
                </>
              ) : (
                <>Confirm Cancel</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default BookingDetailDialog;
