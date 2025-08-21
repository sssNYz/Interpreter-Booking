// NOTE: Protected by middleware via cookie session
// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";

// YYYY-MM-DD (เลี่ยง timezone shift)
const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// HH:mm (เลี่ยง timezone shift)
const fmtTime = (d: Date) => {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

// 'approve'|'cancel'|'waiting' -> 'Approve'|'Cancel'|'Wait'
const mapStatus = (s: "approve" | "cancel" | "waiting"): "Approve" | "Cancel" | "Wait" => {
  if (s === "approve") return "Approve";
  if (s === "cancel") return "Cancel";
  return "Wait";
};

export async function GET() {
  const rows = await prisma.bookingPlan.findMany({
    orderBy: { timeStart: "asc" },
    include: {
      employee: { select: { firstNameEn: true, lastNameEn: true } },             // เจ้าของ
      interpreterEmployee: { select: { firstNameEn: true, lastNameEn: true } },  // ล่าม (nullable)
    },
  });

  const result = rows.map((b) => {
    const bookedBy = `${b.employee?.firstNameEn ?? ""} ${b.employee?.lastNameEn ?? ""}`.trim();
    const interpreter = b.interpreterEmployee
      ? `${b.interpreterEmployee.firstNameEn ?? ""} ${b.interpreterEmployee.lastNameEn ?? ""}`.trim()
      : "";

    return {
      id: b.bookingId,                          // number
      dateTime: fmtDate(b.timeStart),           // "YYYY-MM-DD"
      interpreter,                              // ชื่อ-นามสกุลล่าม
      room: b.meetingRoom,                      // string

      group: b.ownerGroup,                      // NEW: 'iot' | 'hardware' | 'software' | 'other'
      meetingDetail: b.meetingDetail ?? "",     // NEW: string (รายละเอียดเต็ม)

      // คงไว้เพื่อ compatibility กับโค้ดเดิม
      topic: b.meetingDetail ?? "",

      bookedBy,                                 // ชื่อผู้จอง
      status: mapStatus(b.bookingStatus),       // 'Approve' | 'Wait' | 'Cancel'
      startTime: fmtTime(b.timeStart),          // "HH:mm"
      endTime: fmtTime(b.timeEnd),              // "HH:mm"
      requestedTime: b.createdAt.toISOString(), // ISO string
      isDR: b.highPriority,                     // boolean
    };
  });

  return NextResponse.json(result);
}
