  // NOTE: Protected by middleware via cookie session
  // app/api/bookings/route.ts
  import { NextResponse } from "next/server";
  import prisma from "@/prisma/prisma";

  export const dynamic = "force-dynamic";

  // Return ISO8601 timestamps consistently; UI derives local display

  // 'approve'|'cancel'|'waiting'|'complet' -> 'Approve'|'Cancel'|'Wait'|'Complete'
  const mapStatus = (
    s: "approve" | "cancel" | "waiting" | "complet"
  ): "Approve" | "Cancel" | "Wait" | "Complete" => {
    if (s === "approve") return "Approve";
    if (s === "cancel") return "Cancel";
    if (s === "waiting") return "Wait";
    return "Complete";
  };

  export async function GET() {
    // Ensure Prisma session works in UTC
    try { await prisma.$executeRaw`SET time_zone = '+00:00'`; } catch {}

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
        id: b.bookingId,
        interpreter,
        room: b.meetingRoom,
        group: b.ownerGroup,
        meetingDetail: b.meetingDetail ?? "",
        // legacy compatibility
        topic: b.meetingDetail ?? "",
        bookedBy,
        status: mapStatus(b.bookingStatus),
        timeStart: b.timeStart.toISOString(),
        timeEnd: b.timeEnd.toISOString(),
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  }
