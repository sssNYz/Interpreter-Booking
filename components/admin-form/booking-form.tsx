"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Star, CheckCircle, XCircle, Hourglass, RefreshCw } from "lucide-react";
import type { BookingManage } from "@/types/booking-types";

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
  const styles: Record<BookingManage["status"], string> = {
    Approve: "text-emerald-700 bg-emerald-100",
    Wait: "text-amber-700 bg-amber-100",
    Cancel: "text-red-700 bg-red-100",
  };
  const Icon = value === "Approve" ? CheckCircle : value === "Wait" ? Hourglass : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[value]}`}>
      <Icon className="h-4 w-4" />
      {value}
    </span>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-12 items-start gap-2">
    <dt className="col-span-4 text-xs font-medium text-gray-600">{label}</dt>
    <dd className="col-span-8 text-sm text-gray-900">{children}</dd>
  </div>
);

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

type PatchStatusResponse = { bookingStatus: ApiStatus };

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
    `/api/booking-data/get-booking-interpreter/${bookingId}?excludeCurrent=true&limit=50&lang=th`,
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

async function patchStatus(bookingId: number | string, bookingStatus: ApiStatus): Promise<PatchStatusResponse> {
  const res = await fetch(`/api/booking-data/patch-booking-by-id/${bookingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingStatus }),
  });
  if (!res.ok) {
    let msg = `Failed (${res.status})`;
    try {
      const p = await res.json();
      if (p?.title || p?.detail) msg = `${p.title ?? "Error"}${p.detail ? `: ${p.detail}` : ""}`;
    } catch {}
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
}> = ({ bookingId, currentDisplayName, disabled, onSelect, onServerVersion }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<{ empCode: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const selectedDisplayName = useMemo(() => {
    const found = options.find((o) => o.empCode === selected);
    return found ? `${found.name} (${found.empCode})` : "";
  }, [options, selected]);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await fetchAvailability(bookingId);
      setOptions(data.interpreters);
      setServerUpdatedAt(data.updatedAt);
      onServerVersion?.(data.updatedAt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [bookingId]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900">Interpreter</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} title="Refresh list" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        <div className="text-sm text-gray-700">
          Current:{" "}
          <span className="font-medium inline-block max-w-full truncate break-words align-bottom" title={currentDisplayName || undefined}>
            {currentDisplayName || "-"}
          </span>
        </div>

        <div className="min-w-0 w-full">
          <Select
            value={selected}
            onValueChange={(v) => {
              setSelected(v);
              onSelect?.(v);
            }}
            disabled={disabled || loading}
            aria-label="Select interpreter"
          >
            <SelectTrigger
              className="w-full h-11 text-base overflow-hidden pr-10"
              title={selectedDisplayName || undefined}
              aria-label="Interpreter selector trigger"
            >
              <SelectValue
                placeholder={loading ? "Loading..." : options.length ? "Select interpreter" : "No available interpreters"}
              />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[min(56rem,calc(100vw-2rem))]">
              {options.map((o) => (
                <SelectItem key={o.empCode} value={o.empCode} className="max-w-full">
                  <span className="block truncate max-w-[52rem]" title={`${o.name} (${o.empCode})`}>
                    {o.name} ({o.empCode})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {err && <p className="text-red-600 text-xs">{err}</p>}
        {!err && options.length === 0 && !loading && (
          <p className="text-xs text-gray-500">No available interpreters in this time window.</p>
        )}
        {serverUpdatedAt && <p className="text-[11px] text-gray-400">version: {serverUpdatedAt}</p>}
      </div>
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
};

const BookingDetailDialog: React.FC<Props> = ({ open, onOpenChange, editData, isEditing = true, onActionComplete }) => {
  const controlled = typeof open === "boolean";
  const [uOpen, setUOpen] = useState(false);
  const actualOpen = controlled ? (open as boolean) : uOpen;
  const setOpen = (v: boolean) => (controlled ? onOpenChange?.(v) : setUOpen(v));

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

  useEffect(() => {
    if (!actualOpen) {
      setPendingEmpCode("");
      setServerVersion("");
    }
  }, [actualOpen]);

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

      const res = await patchInterpreter(bookingIdForApi, pendingEmpCode, serverVersion);
      if ("updatedAt" in res) setServerVersion(res.updatedAt);

      if (isWait) {
        const updated = await patchStatus(bookingIdForApi, "approve");
        setBooking((prev) => (prev ? { ...prev, status: apiToUi(updated.bookingStatus) } : prev));
      }

      setBooking((prev) => (prev ? { ...prev, interpreter: pendingEmpCode } : prev));

      setOpen(false);
      setTimeout(() => onActionComplete?.(), EXIT_MS);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = async () => {
    if (!booking || bookingIdForApi == null) return;
    try {
      if (!confirm("Cancel this booking?")) return;
      setSubmitting("cancel");
      const updated = await patchStatus(bookingIdForApi, "cancel");
      setBooking((prev) => (prev ? { ...prev, status: apiToUi(updated.bookingStatus) } : prev));
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
        className="max-w-4xl w-[min(96vw,64rem)] max-h-[calc(100dvh-6rem)] overflow-hidden p-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-semibold">
            {isEditing ? "Booking Details" : "Create Booking"}
            {booking?.isDR && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold">
                <Star className="h-3.5 w-3.5 fill-current" />
                DR
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!booking ? (
          <div className="px-6 pb-6 text-sm text-gray-600">No booking selected.</div>
        ) : (
          <div className="px-6 pb-0">
            {/* Balanced layout: 6/6 on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left (Schedule) */}
              <section className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-6">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">Schedule</h3>
                <dl className="space-y-2">
                  <Row label="Date">{fmtDate(booking.dateTime)}</Row>
                  <Row label="Time">
                    <span className="font-mono text-sm tracking-tight">
                      {booking.startTime} - {booking.endTime}
                    </span>
                  </Row>
                  <Row label="Room">
                    <span className="px-2 py-0.5 bg-gray-100 rounded-md font-medium text-sm">{booking.room}</span>
                  </Row>
                  <Row label="Requested At">{fmtDateTime(booking.requestedTime)}</Row>
                </dl>
              </section>

              {/* Right (People & Status) */}
              <section className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-6">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">People & Status</h3>
                <dl className="space-y-2">
                  <Row label="Booked By">{booking.bookedBy}</Row>
                  <Row label="Interpreter">
                    <span className="truncate max-w-full inline-block">{booking.interpreter || "-"}</span>
                  </Row>
                  {booking?.group && <Row label="Group">{booking.group.toUpperCase()}</Row>}
                  <Row label="Status">
                    <Status value={booking.status} />
                  </Row>
                </dl>

                <Separator className="my-4" />
                <InterpreterSelector
                  bookingId={bookingIdForApi ?? 0}
                  currentDisplayName={booking.interpreter}
                  disabled={booking.status === "Cancel" || bookingIdForApi == null}
                  onSelect={(code) => setPendingEmpCode(code)}
                  onServerVersion={(v) => setServerVersion(v)}
                />
              </section>
            </div>

            {/* Detail */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 mt-6 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900">Meeting Detail</h3>
                {(booking?.meetingDetail || booking?.topic) && (
                  <Button variant="outline" size="sm" onClick={() => setExpand((v) => !v)}>
                    {expand ? "Show less" : "Show more"}
                  </Button>
                )}
              </div>
              <p className={`mt-3 text-sm leading-relaxed text-gray-800 ${expand ? "" : "line-clamp-4"}`}>
                {booking?.meetingDetail ?? booking?.topic ?? "-"}
              </p>
            </section>

            {/* Sticky Footer Actions */}
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 h-11 text-base bg-emerald-600 hover:bg-emerald-700"
                disabled={!canApprove || submitting === "cancel"}
                aria-busy={submitting === "approve" || submitting === "apply"}
                onClick={handleApproveOrApply}
                title={booking?.status === "Wait" ? "Approve booking with selected interpreter" : "Apply interpreter change"}
              >
                {booking?.status === "Wait"
                  ? submitting === "approve" ? "Approving..." : "Approve"
                  : submitting === "apply" ? "Applying..." : "Apply"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-11 text-base"
                disabled={!bookingIdForApi || submitting !== null}
                aria-busy={submitting === "cancel"}
                onClick={handleCancel}
              >
                {submitting === "cancel" ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
