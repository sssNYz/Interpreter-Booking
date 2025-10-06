import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { computeETAForBooking } from "@/lib/assignment/scheduler/compute";

function toLabel(seconds: number): string {
  if (seconds <= 0) return "now";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}h`;
  return `${Math.ceil(seconds / 86400)}d`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const takeParam = searchParams.get('take');
    const take = Math.max(1, Math.min(200, Number(takeParam) || 100));

    // Base: waiting bookings without interpreter
    const rows = await prisma.bookingPlan.findMany({
      where: {
        bookingStatus: 'waiting',
        interpreterEmpCode: null
      },
      select: {
        bookingId: true,
        timeStart: true,
        meetingType: true,
        autoAssignAt: true
      },
      orderBy: { timeStart: 'asc' },
      take
    });

    const now = Date.now();
    const items = [] as Array<{
      bookingId: number;
      timeStart: Date;
      category: 'auto-approve' | 'in-coming' | 'none';
      urgentFrom: Date;
      schedulerFrom: Date | null;
      firstAutoAssignAt: Date | null;
      etaSeconds: number;
      etaLabel: string;
      thresholds: { urgent: number; general: number };
    }>;

    for (const r of rows) {
      const meta = await computeETAForBooking(r.bookingId);
      const etaLabel = toLabel(meta.etaSeconds);

      // Categories
      const first = meta.firstAutoAssignAt?.getTime() ?? now;
      const within1d = first <= now + 24 * 3600 * 1000;

      // in-coming = within general window (daysUntilStart <= general) but not auto-approve soon
      const daysUntilStart = Math.floor((meta.timeStart.getTime() - now) / (24 * 3600 * 1000));
      const inGeneral = daysUntilStart <= meta.generalThresholdDays;

      const category = within1d
        ? 'auto-approve'
        : (inGeneral ? 'in-coming' : 'none');

      items.push({
        bookingId: meta.bookingId,
        timeStart: meta.timeStart,
        category,
        urgentFrom: meta.urgentFrom,
        schedulerFrom: meta.schedulerFrom,
        firstAutoAssignAt: meta.firstAutoAssignAt,
        etaSeconds: meta.etaSeconds,
        etaLabel,
        thresholds: { urgent: meta.urgentThresholdDays, general: meta.generalThresholdDays }
      });
    }

    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    console.error("eta-list route error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

