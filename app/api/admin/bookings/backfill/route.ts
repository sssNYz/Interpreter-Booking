import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/auth/session";
import type {
  BookingStatus,
  MeetingType,
  DRType,
  OtherTypeScope,
  OwnerGroup,
} from "@/prisma/prisma";

type AdminBackfillRequest = {
  ownerEmpCode: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingType: MeetingType;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss" local
  timeEnd: string; // "YYYY-MM-DD HH:mm:ss" local
  interpreterEmpCode: string;
  meetingDetail?: string | null;
  applicableModel?: string | null;
  // DR
  drType?: DRType | null;
  chairmanEmail?: string | null;
  // Other
  otherType?: string | null;
  otherTypeScope?: OtherTypeScope | null;
  // Optional
  languageCode?: string | null;
  meetingLink?: string | null;
  // Backfill
  note: string; // required
};

const isValidDateString = (s: string): boolean => {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
};

const toLocalDate = (ymdHms: string): Date => {
  const [d, t] = ymdHms.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm, ss] = t.split(":").map(Number);
  return new Date(y, m - 1, day, hh, mm, ss, 0);
};

async function getCurrentUserWithRoles() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
    include: { userRoles: true },
  });
  if (!user) return null;
  const roles = (user.userRoles ?? []).map((r) => r.roleCode);
  return { user, roles } as const;
}

function validateBody(body: AdminBackfillRequest) {
  const errors: string[] = [];
  const ensure = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

  ensure(!!body.ownerEmpCode && typeof body.ownerEmpCode === "string" && body.ownerEmpCode.trim().length > 0, "ownerEmpCode is required");
  ensure(!!body.ownerGroup, "ownerGroup is required");
  ensure(!!body.meetingRoom && body.meetingRoom.trim().length > 0, "meetingRoom is required");
  ensure(!!body.meetingType, "meetingType is required");
  ensure(!!body.interpreterEmpCode && body.interpreterEmpCode.trim().length > 0, "interpreterEmpCode is required");
  ensure(!!body.timeStart && isValidDateString(body.timeStart), "timeStart must be 'YYYY-MM-DD HH:mm:ss'");
  ensure(!!body.timeEnd && isValidDateString(body.timeEnd), "timeEnd must be 'YYYY-MM-DD HH:mm:ss'");
  ensure(!!body.note && body.note.trim().length > 0, "note is required");

  if (body.timeStart && body.timeEnd && isValidDateString(body.timeStart) && isValidDateString(body.timeEnd)) {
    if (body.timeStart >= body.timeEnd) errors.push("timeEnd must be after timeStart");
  }

  // Meeting-specific validation mirrored from user route
  if (body.meetingType === "DR") {
    const validDrTypes = [
      "DR_PR","DR_k","DR_II","DR_I","Other",
      "DR-PR","DR-k","DR-II","DR-I",
    ];
    ensure(!!body.drType && validDrTypes.includes(String(body.drType)), "drType is required for DR");
    ensure(!!body.chairmanEmail && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(String(body.chairmanEmail)), "chairmanEmail is required and must be valid for DR");
    if (body.otherType) {
      errors.push("otherType should not be provided when meetingType is DR unless drType is Other");
    }
  } else if (body.meetingType === "Other") {
    ensure(!!body.otherType && String(body.otherType).trim().length > 0, "otherType is required for Other");
    if (body.otherTypeScope && body.otherTypeScope !== "meeting_type") {
      errors.push("otherTypeScope must be 'meeting_type' when meetingType is Other");
    }
    if (body.drType) errors.push("drType should not be provided when meetingType is Other");
  } else {
    if (body.drType) errors.push(`drType should not be provided when meetingType is ${body.meetingType}`);
    if (body.otherType) errors.push(`otherType should not be provided when meetingType is ${body.meetingType}`);
    if (body.otherTypeScope) errors.push(`otherTypeScope should not be provided when meetingType is ${body.meetingType}`);
  }

  return { isValid: errors.length === 0, errors };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentUserWithRoles();
    if (!auth) return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    const { user, roles } = auth;
    const isSuper = roles.includes("SUPER_ADMIN");
    const isAdmin = roles.includes("ADMIN") || isSuper;
    if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    let body: AdminBackfillRequest;
    try {
      body = (await req.json()) as AdminBackfillRequest;
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const validation = validateBody(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Ensure owner exists
    const ownerEmpCode = body.ownerEmpCode.trim();
    const ownerExists = await prisma.employee.findUnique({ where: { empCode: ownerEmpCode } });
    if (!ownerExists) {
      return NextResponse.json(
        { success: false, error: `Owner employee not found: ${ownerEmpCode}`, code: "OWNER_NOT_FOUND" },
        { status: 400 }
      );
    }

    // Optional environment scoping: if admin has envs, ensure interpreter is in one of them
    const adminLinks = await prisma.environmentAdmin.findMany({
      where: { adminEmpCode: user.empCode },
      select: { environmentId: true },
    });
    const adminEnvIds = adminLinks.map((l) => l.environmentId);
    if (!isSuper && adminEnvIds.length > 0) {
      const link = await prisma.environmentInterpreter.findFirst({
        where: {
          interpreterEmpCode: body.interpreterEmpCode.trim(),
          environmentId: { in: adminEnvIds },
        },
      });
      if (!link) {
        return NextResponse.json(
          { success: false, error: "Interpreter not in your environment", code: "INTERPRETER_OUT_OF_SCOPE" },
          { status: 403 }
        );
      }
    }

    // Normalize
    const timeStartStr = body.timeStart;
    const timeEndStr = body.timeEnd;
    const timeStartDate = toLocalDate(timeStartStr);
    const timeEndDate = toLocalDate(timeEndStr);
    const normalizedChairman = body.chairmanEmail ? String(body.chairmanEmail).trim().toLowerCase() : null;
    const normalizedMeetingLink = typeof body.meetingLink === "string" && body.meetingLink.trim().length > 0
      ? body.meetingLink.trim()
      : null;

    // Transaction with advisory lock and conflict checks
    const result = await prisma.$transaction(async (tx) => {
      const lockKey = "booking_global_capacity";
      const lockRes = await tx.$queryRaw<Array<{ locked: number | bigint }>>`
        SELECT GET_LOCK(${lockKey}, 5) AS locked
      `;
      const lockedVal = lockRes?.[0]?.locked;
      const lockOk = lockedVal != null ? Number(lockedVal) === 1 : false;
      if (!lockOk) throw new Error("Failed to acquire global booking lock");

      try {
        // Same-room overlap (hard block)
        const sameRoomCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
          SELECT COUNT(*) AS cnt
          FROM BOOKING_PLAN
          WHERE MEETING_ROOM = ${body.meetingRoom}
            AND BOOKING_STATUS <> 'cancel'
            AND (TIME_START < ${timeEndDate} AND TIME_END > ${timeStartDate})
        `;
        const sameRoomOverlap = sameRoomCounts?.[0]?.cnt != null ? Number(sameRoomCounts[0].cnt) : 0;
        if (sameRoomOverlap > 0) {
          const conflictRows = await tx.$queryRaw<Array<{ bookingId: number | bigint; timeStart: Date; timeEnd: Date; bookingStatus: string }>>`
            SELECT BOOKING_ID as bookingId, TIME_START as timeStart, TIME_END as timeEnd, BOOKING_STATUS as bookingStatus
            FROM BOOKING_PLAN
            WHERE MEETING_ROOM = ${body.meetingRoom}
              AND BOOKING_STATUS <> 'cancel'
              AND (TIME_START < ${timeEndDate} AND TIME_END > ${timeStartDate})
            ORDER BY TIME_START
          `;
          return {
            ok: false as const,
            status: 409,
            body: {
              success: false,
              error: "Room conflict",
              code: "ROOM_CONFLICT",
              data: conflictRows.map((r) => ({ bookingId: Number(r.bookingId), timeStart: r.timeStart, timeEnd: r.timeEnd, bookingStatus: r.bookingStatus })),
            },
          };
        }

        // DR chairman conflict (hard block)
        if (body.meetingType === "DR" && normalizedChairman) {
          const chCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
            SELECT COUNT(*) AS cnt
            FROM BOOKING_PLAN
            WHERE CHAIRMAN_EMAIL = ${normalizedChairman}
              AND BOOKING_STATUS <> 'cancel'
              AND (TIME_START < ${timeEndDate} AND TIME_END > ${timeStartDate})
            FOR UPDATE
          `;
          const chCnt = chCounts?.[0]?.cnt != null ? Number(chCounts[0].cnt) : 0;
          if (chCnt > 0) {
            return {
              ok: false as const,
              status: 409,
              body: { success: false, error: "Chairman conflict detected", code: "CHAIRMAN_CONFLICT" },
            };
          }
        }

        // Interpreter overlap (hard block)
        const busyCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
          SELECT COUNT(*) AS cnt
          FROM BOOKING_PLAN
          WHERE INTERPRETER_EMP_CODE = ${body.interpreterEmpCode.trim()}
            AND BOOKING_STATUS <> 'cancel'
            AND (TIME_START < ${timeEndDate} AND TIME_END > ${timeStartDate})
          FOR UPDATE
        `;
        const busyCnt = busyCounts?.[0]?.cnt != null ? Number(busyCounts[0].cnt) : 0;
        if (busyCnt > 0) {
          return {
            ok: false as const,
            status: 409,
            body: { success: false, error: "Interpreter conflict", code: "INTERPRETER_CONFLICT" },
          };
        }

        // Create booking: approved with explicit interpreter; no recurrence
        const created = await tx.bookingPlan.create({
          data: {
            ownerGroup: body.ownerGroup,
            meetingRoom: body.meetingRoom.trim(),
            meetingDetail: body.meetingDetail ?? null,
            timeStart: timeStartDate,
            timeEnd: timeEndDate,
            bookingStatus: "approve" as BookingStatus,
            drType: (body.meetingType === "DR" ? (body.drType as DRType | null) : null) ?? null,
            otherType: (body.meetingType === "Other" ? (body.otherType ?? null) : null),
            otherTypeScope: (body.meetingType === "Other" ? (body.otherTypeScope ?? null) : null) as OtherTypeScope | null,
            applicableModel: body.applicableModel ?? null,
            interpreterEmpCode: body.interpreterEmpCode.trim(),
            isRecurring: false,
            meetingType: body.meetingType,
            ownerEmpCode: ownerEmpCode,
            recurrenceEndDate: null,
            recurrenceEndOccurrences: null,
            recurrenceEndType: null,
            recurrenceInterval: null,
            recurrenceMonthday: null,
            recurrenceType: null,
            recurrenceWeekdays: null,
            recurrenceWeekOrder: null,
            languageCode: body.languageCode ?? null,
            chairmanEmail: normalizedChairman,
            selectedInterpreterEmpCode: null,
            meetingLink: normalizedMeetingLink,
            forwardActions: [
              {
                action: "BACKFILL",
                actor: "admin",
                empCode: user.empCode,
                at: new Date().toISOString(),
                note: body.note.trim(),
              },
            ],
          },
          select: { bookingId: true, timeStart: true, timeEnd: true, interpreterEmpCode: true },
        });

        return { ok: true as const, status: 201, body: created };
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`;
      }
    }, { timeout: 10000 });

    if (!result.ok) {
      return NextResponse.json(result.body as any, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.body }, { status: 201 });
  } catch (err) {
    console.error("[admin/backfill] error", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
