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
        status: mapStatus(b.bookingStatus as "approve" | "cancel" | "waiting"),       // 'Approve' | 'Wait' | 'Cancel'
        startTime: extractHHMM(b.timeStart.toISOString()),          // "HH:mm"
        endTime: extractHHMM(b.timeEnd.toISOString()),              // "HH:mm"
        requestedTime: `${extractYMD(b.createdAt.toISOString())} ${extractHHMM(b.createdAt.toISOString())}:00`,
        isDR: b.meetingType === "DR",                              // boolean - based on meetingType
        drType: b.drType,                                          // DR type from schema
        meetingType: b.meetingType,                                // Meeting type from schema (DR/PDR/VIP/...)
        otherType: b.otherType,                                    // Other type from schema
      };
    });

    return NextResponse.json(result);
  }
