import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/auth/session";
import { centerPart } from "@/utils/users";
import { getEnvMeetingTypePriority } from "@/lib/assignment/config/env-policy";
import type { Prisma } from "@prisma/client";

type PostBody = {
  targets?: number[]; // environment ids to forward to (optional for user flow)
  note?: string;
};

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
  });
  if (!user) return null;
  return user;
}

// Compute if interpreter capacity is full for a given environment/time window
async function isEnvInterpreterCapacityFull(
  envId: number,
  timeStart: Date,
  timeEnd: Date
): Promise<boolean> {
  // Total interpreters in environment
  const total = await prisma.environmentInterpreter.count({
    where: { environmentId: envId },
  });
  if (total <= 0) return true; // treat as full if none configured

  // Busy interpreters (approve or waiting) overlapping window
  const busyRows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
    SELECT COUNT(DISTINCT bp.INTERPRETER_EMP_CODE) AS cnt
    FROM BOOKING_PLAN bp
    JOIN ENVIRONMENT_INTERPRETER ei ON ei.INTERPRETER_EMP_CODE = bp.INTERPRETER_EMP_CODE AND ei.ENVIRONMENT_ID = ${envId}
    WHERE bp.INTERPRETER_EMP_CODE IS NOT NULL
      AND bp.BOOKING_STATUS IN ('approve','waiting')
      AND (bp.TIME_START < ${timeEnd} AND bp.TIME_END > ${timeStart})
  `;
  const busy = busyRows?.[0]?.cnt != null ? Number(busyRows[0].cnt) : 0;
  const available = total - busy;
  return available <= 0;
}

// Check if the booking is within urgent day threshold for the environment
async function isWithinUrgentThreshold(
  envId: number | null,
  meetingType: string,
  timeStart: Date
): Promise<boolean> {
  try {
    const priority =
      envId != null
        ? await getEnvMeetingTypePriority(envId, meetingType)
        : null;
    const urgentDays = priority?.urgentThresholdDays ?? 1;
    const now = new Date();
    const diffDays = Math.floor(
      (timeStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays <= urgentDays;
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me)
    return NextResponse.json(
      { ok: false, error: "Unauthenticated" },
      { status: 401 }
    );

  const { id } = await ctx.params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId))
    return NextResponse.json(
      { ok: false, error: "Invalid booking id" },
      { status: 400 }
    );

  let body: PostBody | null = null;
  try {
    const parsed = await req.json();
    body = parsed as PostBody;
  } catch {}
  let targets = Array.isArray(body?.targets)
    ? body!.targets.filter((n) => Number.isFinite(n))
    : [];
  const note = body?.note?.toString().trim() || undefined;

  // Load booking
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: {
      bookingId: true,
      bookingStatus: true,
      timeStart: true,
      timeEnd: true,
      meetingType: true,
      employee: { select: { deptPath: true, empCode: true } },
      forwardActions: true,
    },
  });
  if (!booking)
    return NextResponse.json(
      { ok: false, error: "Booking not found" },
      { status: 404 }
    );
  if (booking.bookingStatus !== "waiting")
    return NextResponse.json(
      { ok: false, error: "Only waiting bookings can be forwarded" },
      { status: 409 }
    );

  // Determine user's environment via center
  const myCenter = centerPart(me.deptPath ?? null);
  let myEnvId: number | null = null;
  if (myCenter) {
    const envCenter = await prisma.environmentCenter.findUnique({
      where: { center: myCenter },
      select: { environmentId: true },
    });
    myEnvId = envCenter?.environmentId ?? null;
  }

  // Capacity full check (user's environment)
  const timeStart = new Date(booking.timeStart);
  const timeEnd = new Date(booking.timeEnd);
  const capacityFull =
    myEnvId != null
      ? await isEnvInterpreterCapacityFull(myEnvId, timeStart, timeEnd)
      : false;

  // Only forward when no interpreter available in environment
  if (!capacityFull) {
    return NextResponse.json(
      {
        ok: false,
        error: "Not eligible to forward",
        reasons: { capacityFull },
      },
      { status: 400 }
    );
  }

  // If no targets provided, compute defaults: all active environments with admins, excluding user's environment
  if (targets.length === 0) {
    const envs = await prisma.environment.findMany({
      where: {
        isActive: true,
        NOT: myEnvId != null ? { id: myEnvId } : undefined,
      },
      select: { id: true, admins: { select: { id: true } } },
    });
    targets = envs.filter((e) => (e.admins?.length || 0) > 0).map((e) => e.id);
  }
  if (targets.length === 0)
    return NextResponse.json(
      { ok: false, error: "No eligible environments to forward" },
      { status: 400 }
    );

  // Forward: create targets and append action log
  try {
    const saved = await prisma.$transaction(async (tx) => {
      // createMany with skipDuplicates
      await tx.bookingForwardTarget.createMany({
        data: targets.map((envId) => ({
          bookingId,
          environmentId: Number(envId),
        })),
        skipDuplicates: true,
      });

      const fa = Array.isArray(booking.forwardActions)
        ? (booking.forwardActions as unknown[])
        : [];
      fa.push({
        actor: "user",
        empCode: me.empCode,
        action: "FORWARD",
        at: new Date().toISOString(),
        note: note || null,
      });
      await tx.bookingPlan.update({
        where: { bookingId },
        data: {
          isForwarded: true,
          forwardedByEmpCode: me.empCode,
          forwardActions: fa as Prisma.InputJsonValue,
        },
      });

      const targetsRows = await tx.bookingForwardTarget.findMany({
        where: { bookingId },
        select: { environmentId: true },
      });
      return targetsRows.map((r) => r.environmentId);
    });

    return NextResponse.json({
      ok: true,
      data: { bookingId, capacityFull, urgent: false, targets: saved },
    });
  } catch (e) {
    console.error("Forward failed", e);
    return NextResponse.json(
      { ok: false, error: "Forward failed" },
      { status: 500 }
    );
  }
}

// Read-only eligibility check for forwarding
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me)
    return NextResponse.json(
      { ok: false, error: "Unauthenticated" },
      { status: 401 }
    );

  const { id } = await ctx.params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId))
    return NextResponse.json(
      { ok: false, error: "Invalid booking id" },
      { status: 400 }
    );

  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: {
      bookingId: true,
      bookingStatus: true,
      timeStart: true,
      timeEnd: true,
      meetingType: true,
    },
  });
  if (!booking)
    return NextResponse.json(
      { ok: false, error: "Booking not found" },
      { status: 404 }
    );

  // Determine user's environment via center
  const myCenter = centerPart(me.deptPath ?? null);
  let myEnvId: number | null = null;
  if (myCenter) {
    const envCenter = await prisma.environmentCenter.findUnique({
      where: { center: myCenter },
      select: { environmentId: true },
    });
    myEnvId = envCenter?.environmentId ?? null;
  }

  const timeStart = new Date(booking.timeStart);
  const timeEnd = new Date(booking.timeEnd);
  const capacityFull =
    myEnvId != null
      ? await isEnvInterpreterCapacityFull(myEnvId, timeStart, timeEnd)
      : false;
  const urgent = false; // No longer used for forwarding

  return NextResponse.json({
    ok: true,
    data: {
      eligible: capacityFull,
      capacityFull,
      urgent,
      environmentId: myEnvId,
    },
  });
}
