"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ChartContainer, ChartTooltip, ChartLegend, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { BookingManage } from "@/types/admin";
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

const apiToUi = (s: ApiStatus): BookingManage["status"] =>
  (s === "approve" ? "Approve" : s === "cancel" ? "Cancel" : "Wait");

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
    return found ? `${found.name} (${found.empCode})` : "";
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
                      <div className="text-xs text-muted-foreground">{o.empCode}</div>
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
  const isLargeScreen = screenSize === 'xl';

  const [booking, setBooking] = useState<BookingForDialog | null>(null);
  useEffect(() => {
    if (actualOpen && editData) setBooking(editData as BookingForDialog);
  }, [actualOpen, editData]);

  const [expand, setExpand] = useState(false);
  useEffect(() => setExpand(false), [booking?.bookingId, booking?.id, actualOpen]);

  const [submitting, setSubmitting] = useState<null | "approve" | "cancel" | "apply">(null);
  const EXIT_MS = 150;

  const bookingIdForApi = getBookingId(booking);

  const [pendingEmpCode, setPendingEmpCode] = useState<string>("");
  const [serverVersion, setServerVersion] = useState<string>("");
  const [suggestions, setSuggestions] = useState<
    { empCode: string; score: number; reasons: string[]; time: { daysToMeeting: number; hoursToStart: number; lastJobDaysAgo: number } }[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);
  const [interpreterOptions, setInterpreterOptions] = useState<{ empCode: string; name: string }[]>([]);

  const handleOptionsChange = useCallback((opts: { empCode: string; name: string }[]) => {
    setInterpreterOptions(opts);
  }, []);
  const handleServerVersion = useCallback((v: string) => {
    setServerVersion(v);
  }, []);

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
        setSuggestionsLoading(true);
        const envQuery = targetEnvironmentId != null ? `&environmentId=${targetEnvironmentId}` : "";
        const res = await fetch(`/api/bookings/${id}/suggestions?maxCandidates=20${envQuery}` , { cache: "no-store" });
        const j = await res.json().catch(() => ({}) as { ok?: boolean; candidates?: { empCode: string; score: number; reasons: string[]; time: { daysToMeeting: number; hoursToStart: number; lastJobDaysAgo: number } }[] });
        if (res.ok && j?.ok && Array.isArray(j.candidates)) {
          setSuggestions(j.candidates as typeof suggestions);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    };
    void run();
  }, [actualOpen, bookingIdForApi, targetEnvironmentId]);

  const topSuggestion = useMemo(() => suggestions[0] || null, [suggestions]);
  const topSuggestionScore = useMemo(() => {
    if (!topSuggestion || typeof topSuggestion.score !== "number" || Number.isNaN(topSuggestion.score)) {
      return null;
    }
    return Math.round(topSuggestion.score * 100) / 100;
  }, [topSuggestion]);

  // Calculate workload comparison chart (two bars: recommended vs selected/alternate)
  const chartData = useMemo(() => {
    if (!booking) return [] as Array<{ name: string; baseline: number; delta: number; total: number }>;

    const recommended = suggestions[0]?.empCode;
    if (!recommended) return [];

    const startTime = new Date(`${booking.dateTime}T${booking.startTime}:00`);
    const endTime = new Date(`${booking.dateTime}T${booking.endTime}:00`);
    const bookingDurationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const pseudoHours = (empCode: string) => {
      let hash = 0;
      for (let i = 0; i < empCode.length; i++) hash = (hash * 31 + empCode.charCodeAt(i)) >>> 0;
      const base = 5 + (hash % 2000) / 100; // 5.00 - 25.00
      return Math.round(base * 10) / 10;
    };

    const selected = pendingEmpCode || undefined;

    // Determine the comparison pair
    let primary = selected ?? recommended;
    let secondary: string | undefined;

    if (selected) {
      secondary = selected === recommended ? suggestions[1]?.empCode : recommended;
    } else {
      secondary = suggestions[1]?.empCode;
    }

    // Fallback: if there is no secondary, show only the primary
    const pairs = [primary, secondary].filter(Boolean) as string[];

    const assignee = selected ?? recommended; // who receives the new booking

    const rows = pairs.map((code) => {
      const baseline = pseudoHours(code);
      const delta = code === assignee ? bookingDurationHours : 0;
      const total = Math.round((baseline + delta) * 10) / 10;
      return { name: code, baseline, delta, total };
    });

    return rows;
  }, [booking, pendingEmpCode, suggestions]);

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

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
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
        <div className="px-4 overflow-y-auto space-y-3">
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
                    <UserRound className="h-4 w-4" />
                    Current Interpreter
                  </span>
                  <span className="text-sm font-medium">
                    {booking.interpreter || <span className="text-muted-foreground italic">Not assigned</span>}
                  </span>
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
              </div>
              
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
                        <span className="text-sm font-medium">Recommended: {topSuggestion.empCode}</span>
                        <span className="text-xs text-muted-foreground">({topSuggestionScore ?? "--"})</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span>{topSuggestion.time?.daysToMeeting ?? "--"}d</span>
                        <span>{topSuggestion.time?.hoursToStart ?? "--"}h</span>
                      </div>
                    </div>
                  )}

                  {/* Impact Preview - Responsive */}
                  {chartData.length > 0 && (
                    <div className="rounded border bg-card/50 p-2 sm:p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm font-medium">Workload Impact</span>
                      </div>
                      <ChartContainer
                        className="h-[70px] sm:h-[80px] md:h-[90px] lg:h-[100px] w-full"
                        config={{
                          total: { label: "Total hours", color: "var(--foreground)" },
                        }}
                      >
                        <RBarChart 
                          data={chartData} 
                          layout="vertical"
                          margin={{ 
                            top: 5, 
                            right: isMobile ? 10 : isTablet ? 20 : isLargeScreen ? 30 : 25, 
                            left: isMobile ? 30 : isTablet ? 40 : isLargeScreen ? 60 : 50, 
                            bottom: 5 
                          }}
                        >
                          <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
                          <XAxis type="number" dataKey="total" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category"
                            tickLine={false}
                            tickMargin={isMobile ? 4 : isTablet ? 6 : 8}
                            axisLine={false}
                            stroke="var(--muted-foreground)" 
                            tick={{ fontSize: isMobile ? 8 : isTablet ? 9 : isLargeScreen ? 11 : 10 }} 
                            width={isMobile ? 25 : isTablet ? 35 : isLargeScreen ? 55 : 45}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent 
                              hideLabel
                              formatter={(value: any, _name: any, item?: any) => {
                                const p = item?.payload as { delta?: number } | undefined;
                                return [
                                  `${value}h`,
                                  p?.delta && p.delta > 0 ? `Total (+${p.delta}h)` : 'Total',
                                ];
                              }} 
                            />}
                          />
                          <Bar dataKey="total" fill="var(--color-total)" radius={5} />
                        </RBarChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Meeting Notes - Flat */}
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
                    <div className={`text-sm text-foreground/90 ${expand ? "" : "line-clamp-2"}`}>
                      {booking?.meetingDetail ?? booking?.topic}
                    </div>
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
                  <span><strong className="text-foreground">{pendingEmpCode}</strong> selected</span>
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
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
