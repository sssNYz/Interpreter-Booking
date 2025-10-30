import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  roomId: number;
  roomName: string;
  bookingId: number;
  status: string; // BookingStatus as string: waiting/approve/complet/cancel
  startLocal: string; // "YYYY-MM-DD HH:mm:ss" (business local time)
  endLocal: string;   // "YYYY-MM-DD HH:mm:ss" (business local time)
};

function isValidYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// GET /api/rooms/booked?date=YYYY-MM-DD
// Read-only: returns rooms that are busy on the selected day from BookingPlan
// Includes statuses: waiting, approve, complet (excludes cancel)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = (url.searchParams.get("date") || "").trim();

    if (!date || !isValidYMD(date)) {
      return NextResponse.json(
        { success: false, error: "INVALID_DATE", message: "Expected date=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Overlap window: [date 00:00:00, date+1 00:00:00)
    // Interpret database times as local business time (DB stores DATETIME without timezone).
    // We avoid JS Date timezone pitfalls by formatting in MySQL and returning strings.
    const rows: Row[] = await prisma.$queryRaw<Row[]>`
      SELECT r.ID AS roomId,
             r.NAME AS roomName,
             b.BOOKING_ID AS bookingId,
             b.BOOKING_STATUS AS status,
             DATE_FORMAT(b.TIME_START, '%Y-%m-%d %H:%i:%s') AS startLocal,
             DATE_FORMAT(b.TIME_END,   '%Y-%m-%d %H:%i:%s') AS endLocal
      FROM ROOM r
      JOIN BOOKING_PLAN b
        ON b.MEETING_ROOM = r.NAME
      WHERE b.BOOKING_STATUS IN ('waiting', 'approve', 'complet')
        AND r.NAME <> 'N/A'
        AND b.TIME_START < DATE_ADD(STR_TO_DATE(${date}, '%Y-%m-%d'), INTERVAL 1 DAY)
        AND b.TIME_END   > STR_TO_DATE(${date}, '%Y-%m-%d')
      ORDER BY r.NAME ASC, b.TIME_START ASC`;

    // Group by room
    const byRoom = new Map<number, { id: number; name: string; bookings: Array<{ id: number; start: string; end: string; status: string }> }>();
    for (const r of rows) {
      if (!byRoom.has(r.roomId)) {
        byRoom.set(r.roomId, { id: r.roomId, name: r.roomName, bookings: [] });
      }
      byRoom.get(r.roomId)!.bookings.push({ id: r.bookingId, start: r.startLocal, end: r.endLocal, status: r.status });
    }

    return NextResponse.json({
      success: true,
      data: {
        date,
        rooms: Array.from(byRoom.values()),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Allow", "GET, OPTIONS");
  return res;
}
