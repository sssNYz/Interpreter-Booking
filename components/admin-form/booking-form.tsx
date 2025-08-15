"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, CheckCircle, XCircle, Hourglass } from "lucide-react";
import type { BookingManage } from "@/app/types/booking-types";

/* ---------------- Utils ---------------- */
const fromYMD = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
};
const formatDate = (s: string) => {
  const d = fromYMD(s);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
const formatRequestedTime = (s: string) => {
  const d = new Date(s);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
};
const getStatusColor = (status: BookingManage["status"]) =>
  ({ Approve: "text-emerald-700 bg-emerald-100", Wait: "text-amber-700 bg-amber-100", Cancel: "text-red-700 bg-red-100" } as const)[status] ?? "text-gray-700 bg-gray-100";
const getStatusIcon = (status: BookingManage["status"]) =>
  ({ Approve: <CheckCircle className="h-4 w-4" />, Wait: <Hourglass className="h-4 w-4" />, Cancel: <XCircle className="h-4 w-4" /> } as const)[status] ?? null;

/* ---------------- Small UI helpers ---------------- */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-12 items-start gap-3">
    <dt className="col-span-4 text-xs font-medium text-gray-600">{label}</dt>
    <dd className="col-span-8 text-sm text-gray-900">{children}</dd>
  </div>
);

type DialogStep = "details";
type BookingDetailDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: BookingManage | null;
  isEditing?: boolean;
  allBookings?: BookingManage[];
  onActionComplete?: () => void;
};

const BookingDetailDialog: React.FC<BookingDetailDialogProps> = ({
  open,
  onOpenChange,
  editData,
  isEditing = true,
  allBookings = [],
  onActionComplete,
}) => {
  const isControlled = typeof open === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = isControlled ? (open as boolean) : internalOpen;
  const setOpen = (val: boolean) => (isControlled ? onOpenChange?.(val) : setInternalOpen(val));

  // 👉 เก็บ snapshot ของ booking ตอนเปิดไว้ กัน parent เคลียร์เร็วไป
  const [cachedBooking, setCachedBooking] = useState<BookingManage | null>(null);

  // ย่อ/ขยายคำอธิบาย
  const [showFullDetail, setShowFullDetail] = useState(false);

  // ระยะเวลาแอนิเมชันปิด (พอดี ๆ)
  const EXIT_MS = 200;

  useEffect(() => {
    // เปิด dialog เมื่อไหร่ และมี editData → เก็บ snapshot
    if (actualOpen && editData) setCachedBooking(editData);
  }, [actualOpen, editData]);

  useEffect(() => {
    setShowFullDetail(false);
  }, [cachedBooking?.id, actualOpen]);

  const booking = cachedBooking; // ใช้ snapshot เสมอใน Dialog

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {/* ใช้ onOpen/CloseAutoFocus กันโฟกัสเด้งขณะเปิด/ปิด */}
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-3xl w-[min(96vw,56rem)] max-h-[calc(100dvh-6rem)] overflow-hidden p-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold tracking-tight">
            {isEditing ? "Booking Details" : "Create Booking"}
            {booking?.isDR && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold shadow-sm">
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
              {/* ซ้าย: Schedule */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">Schedule</h3>
                <dl className="space-y-3">
                  <Row label="Date">{formatDate(booking.dateTime)}</Row>
                  <Row label="Time">
                    <span className="font-mono">{booking.startTime} - {booking.endTime}</span>
                  </Row>
                  <Row label="Room">
                    <span className="px-2 py-1 bg-gray-100 rounded-md font-medium">{booking.room}</span>
                  </Row>
                  <Row label="Requested At">{formatRequestedTime(booking.requestedTime)}</Row>
                </dl>
              </section>

              {/* ขวา: People & Status */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">People & Status</h3>
                <dl className="space-y-3">
                  <Row label="Booked By">{booking.bookedBy}</Row>
                  <Row label="Interpreter">{booking.interpreter || "-"}</Row>
                  <Row label="Group">{booking.group.toUpperCase()}</Row>
                  <Row label="Status">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                      {getStatusIcon(booking.status)}
                      {booking.status}
                    </span>
                  </Row>
                </dl>
              </section>
            </div>

            {/* Meeting Detail (ย่อ/ขยายได้) */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 mt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-900">Meeting Detail</h3>
                {(booking.meetingDetail || booking.topic) && (
                  <Button variant="outline" size="sm" onClick={() => setShowFullDetail(v => !v)}>
                    {showFullDetail ? "Show less" : "Show more"}
                  </Button>
                )}
              </div>
              <p
                className={[
                  "mt-3 text-sm leading-relaxed text-gray-800",
                  showFullDetail ? "" : "line-clamp-4",
                ].join(" ")}
              >
                {booking.meetingDetail || booking.topic || "-"}
              </p>
            </section>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  // ปิดก่อน → รอ animation จบ → ค่อยให้ parent ทำงานต่อ (refresh/clear)
                  setOpen(false);
                  setTimeout(() => {
                    onActionComplete?.();
                  }, EXIT_MS);
                }}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  setTimeout(() => {
                    onActionComplete?.();
                  }, EXIT_MS);
                }}
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
