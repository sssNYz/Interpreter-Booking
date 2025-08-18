"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, CheckCircle, XCircle, Hourglass } from "lucide-react";
import type { BookingManage } from "@/app/types/booking-types";

// -------- helpers: format --------
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

// -------- helpers: UI status pill --------
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
  <div className="grid grid-cols-12 items-start gap-3">
    <dt className="col-span-4 text-xs font-medium text-gray-600">{label}</dt>
    <dd className="col-span-8 text-sm text-gray-900">{children}</dd>
  </div>
);

// -------- types & helpers (เพิ่ม) --------
type ApiStatus = "approve" | "cancel" | "waiting";
type PatchResponse = { bookingStatus: ApiStatus };

// ขยายจาก BookingManage ให้ฟิลด์ที่อาจเจอเป็น optional
type BookingForDialog = BookingManage & {
  bookingId?: number; // จากฝั่ง DB
  id?: number;        // บางที่ใช้ชื่อ id
  group?: string;
  topic?: string;
};

const apiToUi = (s: ApiStatus): BookingManage["status"] =>
  s === "approve" ? "Approve" : s === "cancel" ? "Cancel" : "Wait";

// ดึง id ที่จะส่งเข้า API แบบ type-safe
function getBookingId(b?: BookingForDialog | null): number | undefined {
  if (!b) return undefined;
  return typeof b.bookingId === "number" ? b.bookingId : b.id;
}

// -------- API helpers --------
async function patchStatus(bookingId: number | string, bookingStatus: ApiStatus): Promise<PatchResponse> {
  const res = await fetch(`/api/booking-data/patch-booking-by-id/${bookingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingStatus }),
  });
  if (!res.ok) {
    // รองรับ problem+json (RFC 7807)
    let msg = `Failed (${res.status})`;
    try {
      const p = await res.json();
      if (p?.title || p?.detail) msg = `${p.title ?? "Error"}${p.detail ? `: ${p.detail}` : ""}`;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// -------- component --------
type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: BookingManage | null;
  isEditing?: boolean;
  onActionComplete?: () => void; // เรียก reload ที่ parent
};

const BookingDetailDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  editData,
  isEditing = true,
  onActionComplete,
}) => {
  const controlled = typeof open === "boolean";
  const [uOpen, setUOpen] = useState(false);
  const actualOpen = controlled ? (open as boolean) : uOpen;
  const setOpen = (v: boolean) => (controlled ? onOpenChange?.(v) : setUOpen(v));

  // ใช้ชนิด BookingForDialog (เลิก any)
  const [booking, setBooking] = useState<BookingForDialog | null>(null);
  useEffect(() => {
    if (actualOpen && editData) setBooking(editData);
  }, [actualOpen, editData]);

  const [expand, setExpand] = useState(false);
  useEffect(() => setExpand(false), [booking?.bookingId, booking?.id, actualOpen]);

  const [submitting, setSubmitting] = useState<null | "approve" | "cancel">(null);
  const EXIT_MS = 150;

  // id ที่ส่งเข้า API แบบปลอดภัย
  const bookingIdForApi = getBookingId(booking);

  const handleAction = async (to: ApiStatus) => {
    if (!booking || bookingIdForApi == null) return;
    try {
      setSubmitting(to === "approve" ? "approve" : "cancel");
      const updated = await patchStatus(bookingIdForApi, to);
      // อัปเดต UI ใน dialog ให้เห็นทันที (รอ parent reload ต่อ)
      setBooking((prev) => (prev ? { ...prev, status: apiToUi(updated.bookingStatus) } : prev));
      setOpen(false);
      setTimeout(() => onActionComplete?.(), EXIT_MS);
    } catch (e) {
      alert((e as Error).message); // ถ้าใช้ toast แทน alert ได้
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-3xl w-[min(96vw,56rem)] max-h-[calc(100dvh-6rem)] overflow-hidden p-0"
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
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">Schedule</h3>
                <dl className="space-y-3">
                  <Row label="Date">{fmtDate(booking.dateTime)}</Row>
                  <Row label="Time">
                    <span className="font-mono">
                      {booking.startTime} - {booking.endTime}
                    </span>
                  </Row>
                  <Row label="Room">
                    <span className="px-2 py-1 bg-gray-100 rounded-md font-medium">{booking.room}</span>
                  </Row>
                  <Row label="Requested At">{fmtDateTime(booking.requestedTime)}</Row>
                </dl>
              </section>

              {/* Right */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">People & Status</h3>
                <dl className="space-y-3">
                  <Row label="Booked By">{booking.bookedBy}</Row>
                  <Row label="Interpreter">{booking.interpreter || "-"}</Row>
                  {booking?.group && <Row label="Group">{booking.group.toUpperCase()}</Row>}
                  <Row label="Status">
                    <Status value={booking.status} />
                  </Row>
                </dl>
              </section>
            </div>

            {/* Detail */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 mt-6">
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!bookingIdForApi || submitting !== null}
                aria-busy={submitting === "approve"}
                onClick={() => handleAction("approve")}
              >
                {submitting === "approve" ? "Approving..." : "Approve"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!bookingIdForApi || submitting !== null}
                aria-busy={submitting === "cancel"}
                onClick={() => handleAction("cancel")}
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
