<<<<<<< HEAD
// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";

// YYYY-MM-DD (ตัดจาก UTC เพื่อกัน timezone shift)
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

// HH:mm (ตัดจาก UTC เพื่อกัน timezone shift)
const fmtTime = (d: Date) => d.toISOString().slice(11, 16);

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
      dateTime: fmtDate(b.timeStart),           // "YYYY-MM-DD" (UTC-based)
      interpreter,                              // ชื่อ-นามสกุลล่าม
      room: b.meetingRoom,                      // string

      group: b.ownerGroup,                      // 'iot' | 'hardware' | 'software' | 'other'
      meetingDetail: b.meetingDetail ?? "",     // รายละเอียดเต็ม

      // คงไว้เพื่อ compatibility กับโค้ดเดิม
      topic: b.meetingDetail ?? "",

      bookedBy,                                 // ชื่อผู้จอง
      status: mapStatus(b.bookingStatus),       // 'Approve' | 'Wait' | 'Cancel'
      startTime: fmtTime(b.timeStart),          // "HH:mm" (UTC-based)
      endTime: fmtTime(b.timeEnd),              // "HH:mm" (UTC-based)
      requestedTime: b.createdAt.toISOString(), // ISO string (UTC)
      isDR: b.highPriority,                     // boolean
    };
  });

  return NextResponse.json(result);
}
=======
  // NOTE: Protected by middleware via cookie session
  // app/api/bookings/route.ts
  import { NextResponse } from "next/server";
  import prisma from "@/prisma/prisma";

  export const dynamic = "force-dynamic";

  // Pure string extraction using ISO; avoid timezone math entirely
  const extractYMD = (iso: string) => iso.split("T")[0];
  const extractHHMM = (iso: string) => iso.split("T")[1].slice(0, 5);

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
        dateTime: extractYMD(b.timeStart.toISOString()),           // "YYYY-MM-DD"
        interpreter,                              // ชื่อ-นามสกุลล่าม
        room: b.meetingRoom,                      // string

        group: b.ownerGroup,                      // NEW: 'iot' | 'hardware' | 'software' | 'other'
        meetingDetail: b.meetingDetail ?? "",     // NEW: string (รายละเอียดเต็ม)

        // คงไว้เพื่อ compatibility กับโค้ดเดิม
        topic: b.meetingDetail ?? "",

        bookedBy,                                 // ชื่อผู้จอง
        status: mapStatus(b.bookingStatus),       // 'Approve' | 'Wait' | 'Cancel'
        startTime: extractHHMM(b.timeStart.toISOString()),          // "HH:mm"
        endTime: extractHHMM(b.timeEnd.toISOString()),              // "HH:mm"
        requestedTime: `${extractYMD(b.createdAt.toISOString())} ${extractHHMM(b.createdAt.toISOString())}:00`,
        isDR: b.highPriority,                     // boolean
      };
    });

    return NextResponse.json(result);
  }
>>>>>>> e15a440777f38b85ad53bf346fcd597952b74edc
