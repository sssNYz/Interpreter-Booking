import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { computeETAForBooking } from "@/lib/assignment/scheduler/compute";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const bookingId = Number(id);
    if (!Number.isFinite(bookingId)) {
      return NextResponse.json({ ok: false, error: "Invalid booking ID" }, { status: 400 });
    }

    // Ensure booking exists and is visible
    const b = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: { bookingId: true, timeStart: true, meetingType: true, autoAssignAt: true, bookingStatus: true, interpreterEmpCode: true }
    });
    if (!b) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

    const meta = await computeETAForBooking(bookingId);

    // Build small label for UI
    const etaLabel = (() => {
      const s = meta.etaSeconds;
      if (s <= 0) return "now";
      if (s < 3600) return `${Math.ceil(s / 60)}m`;
      if (s < 86400) return `${Math.ceil(s / 3600)}h`;
      return `${Math.ceil(s / 86400)}d`;
    })();

    return NextResponse.json({
      ok: true,
      data: {
        bookingId: meta.bookingId,
        timeStart: meta.timeStart,
        mode: meta.mode,
        urgentThresholdDays: meta.urgentThresholdDays,
        generalThresholdDays: meta.generalThresholdDays,
        urgentFrom: meta.urgentFrom,
        schedulerFrom: meta.schedulerFrom,
        firstAutoAssignAt: meta.firstAutoAssignAt,
        etaSeconds: meta.etaSeconds,
        etaLabel,
        state: {
          bookingStatus: b.bookingStatus,
          hasInterpreter: Boolean(b.interpreterEmpCode)
        }
      }
    });
  } catch (error) {
    console.error("ETA route error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

