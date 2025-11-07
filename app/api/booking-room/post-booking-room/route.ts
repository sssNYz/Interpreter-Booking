import { NextRequest, NextResponse } from "next/server";
import prisma, { OwnerGroup, BookingStatus, MeetingType } from "@/prisma/prisma";
import type { ApiResponse } from "@/types/api";
import { isValidYmdHms } from "@/utils/time";
import type { CreateRoomBookingRequest } from "@/types/room-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Using the shared type from types/room-booking.ts

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const isHttpUrl = (v: string): boolean => /^https?:\/\//i.test(v.trim());

export async function POST(req: NextRequest) {
  try {
    // Basic content-type guard
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "INVALID_CONTENT_TYPE", message: "Expected application/json" },
        { status: 415 }
      );
    }

    const body = (await req.json()) as Partial<CreateRoomBookingRequest>;

    // Forbid interpreter-only fields in room endpoint
    const forbidden: Array<keyof CreateRoomBookingRequest> = [
      "interpreterEmpCode",
      "languageCode",
      // chairmanEmail is allowed optionally for room bookings
      "selectedInterpreterEmpCode",
    ];
    for (const f of forbidden) {
      if (f in body) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "FORBIDDEN_FIELD", message: `Field '${String(f)}' is not allowed for room bookings` },
          { status: 400 }
        );
      }
    }

    // Required validations
    const errors: string[] = [];
    if (!isNonEmptyString(body.ownerEmpCode)) {
      errors.push("ownerEmpCode is required and must be a non-empty string");
    } else if ((body.ownerEmpCode as string).length > 64) {
      errors.push("ownerEmpCode must be 64 characters or less");
    }

    if (!body.ownerGroup || !Object.values(OwnerGroup).includes(body.ownerGroup as any)) {
      errors.push(`ownerGroup is required and must be one of: ${Object.values(OwnerGroup).join(", ")}`);
    }

    if (!isNonEmptyString(body.meetingRoom)) {
      errors.push("meetingRoom is required and must be a non-empty string");
    } else if ((body.meetingRoom as string).length > 50) {
      errors.push("meetingRoom must be 50 characters or less");
    }

    if (!isNonEmptyString(body.timeStart) || !isValidYmdHms(body.timeStart!)) {
      errors.push("timeStart is required and must be 'YYYY-MM-DD HH:mm:ss'");
    }
    if (!isNonEmptyString(body.timeEnd) || !isValidYmdHms(body.timeEnd!)) {
      errors.push("timeEnd is required and must be 'YYYY-MM-DD HH:mm:ss'");
    }
    if (isNonEmptyString(body.timeStart) && isNonEmptyString(body.timeEnd)) {
      if (body.timeStart! >= body.timeEnd!) {
        errors.push("timeEnd must be after timeStart");
      }
    }

    // Optional validations
    if (body.meetingDetail != null && typeof body.meetingDetail !== "string") {
      errors.push("meetingDetail must be a string when provided");
    }
    if (body.applicableModel != null && typeof body.applicableModel !== "string") {
      errors.push("applicableModel must be a string when provided");
    }
    if (body.meetingLink != null) {
      if (!isNonEmptyString(body.meetingLink)) {
        errors.push("meetingLink must be a non-empty string when provided");
      } else if (body.meetingLink.length > 2048) {
        errors.push("meetingLink must be 2048 characters or less");
      } else if (!isHttpUrl(body.meetingLink)) {
        errors.push("meetingLink must start with http:// or https://");
      }
    }
    if (body.inviteEmails != null) {
      if (!Array.isArray(body.inviteEmails) || !body.inviteEmails.every((e) => typeof e === "string")) {
        errors.push("inviteEmails must be an array of strings");
      }
    }
    // Optional chairman email
    if (body.chairmanEmail != null) {
      if (!isNonEmptyString(body.chairmanEmail)) {
        errors.push("chairmanEmail must be a non-empty string when provided");
      } else if (body.chairmanEmail.length > 255) {
        errors.push("chairmanEmail must be 255 characters or less");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.chairmanEmail)) {
        errors.push("chairmanEmail must be a valid email address");
      }
    }
    if (body.bookingStatus != null && !Object.values(BookingStatus).includes(body.bookingStatus as any)) {
      errors.push(`bookingStatus must be one of: ${Object.values(BookingStatus).join(", ")}`);
    }
    // DR/Other meta (optional; allow if present)
    if (body.otherType != null && typeof body.otherType !== "string") {
      errors.push("otherType must be a string when provided");
    } else if (isNonEmptyString(body.otherType) && (body.otherType as string).length > 255) {
      errors.push("otherType must be 255 characters or less");
    }
    if (body.otherTypeScope != null && body.otherTypeScope !== "meeting_type" && body.otherTypeScope !== "dr_type") {
      errors.push("otherTypeScope must be 'meeting_type' or 'dr_type' when provided");
    }
    if (errors.length > 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "VALIDATION_ERROR", message: errors.join("; ") }, { status: 400 });
    }

    // Normalize inputs
    const ownerEmpCode = (body.ownerEmpCode as string).trim();
    const meetingRoom = (body.meetingRoom as string).trim();
    const timeStart = (body.timeStart as string).trim();
    const timeEnd = (body.timeEnd as string).trim();
    const meetingType = (body.meetingType as any) || (MeetingType as any).General || "General";
    // Force auto-approve for room bookings
    const bookingStatus: any = (BookingStatus as any).approve || "approve";
    const meetingDetail = typeof body.meetingDetail === "string" ? body.meetingDetail : null;
    const applicableModel = typeof body.applicableModel === "string" ? body.applicableModel : null;
    const meetingLink = typeof body.meetingLink === "string" ? body.meetingLink.trim() : null;
    const drType = body.drType ?? null; // Accept as-is (validated loosely above)
    const otherType = typeof body.otherType === "string" ? body.otherType : null;
    const otherTypeScope = body.otherTypeScope ?? null;
    const chairmanEmail = typeof body.chairmanEmail === "string" ? body.chairmanEmail.trim() : null;

    // Room conflict check: disallow overlap on same room for non-cancel bookings
    const overlapRows = await prisma.$queryRaw<Array<{ cnt: number | bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM BOOKING_PLAN
      WHERE MEETING_ROOM = ${meetingRoom}
        AND BOOKING_STATUS <> 'cancel'
        AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
    `;
    const overlapVal = overlapRows?.[0]?.cnt;
    const overlapCount = overlapVal != null ? Number(overlapVal) : 0;
    if (overlapCount > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "ROOM_CONFLICT",
          code: "ROOM_CONFLICT",
          message: "This room already has an overlapping booking during the requested time.",
          data: { conflicts: overlapCount },
        },
        { status: 409 }
      );
    }

    // Insert booking row with BOOKING_KIND = 'ROOM'
    await prisma.$executeRaw`
      INSERT INTO BOOKING_PLAN (
        \`OWNER_GROUP\`, \`MEETING_ROOM\`, \`MEETING_DETAIL\`, \`TIME_START\`, \`TIME_END\`, \`BOOKING_STATUS\`, \`created_at\`, \`updated_at\`,
        \`DR_TYPE\`, \`OTHER_TYPE\`, \`OTHER_TYPE_SCOPE\`, \`APPLICABLE_MODEL\`, \`IS_RECURRING\`, \`MEETING_TYPE\`, \`OWNER_EMP_CODE\`, \`CHAIRMAN_EMAIL\`, \`MEETING_LINK\`,
        \`BOOKING_KIND\`, \`FORWARD_ACTIONS\`
      ) VALUES (
        ${body.ownerGroup as any}, ${meetingRoom}, ${meetingDetail}, ${timeStart}, ${timeEnd}, ${bookingStatus}, NOW(), NOW(),
        ${drType}, ${otherType}, ${otherTypeScope}, ${applicableModel}, 0, ${meetingType}, ${ownerEmpCode}, ${chairmanEmail}, ${meetingLink},
        'ROOM', '[]'
      )
    `;
    const inserted = await prisma.$queryRaw<Array<{ id: number | bigint }>>`SELECT LAST_INSERT_ID() as id`;
    const bookingIdVal = inserted?.[0]?.id;
    const bookingId = bookingIdVal != null ? Number(bookingIdVal) : null;

    // Persist invite emails if provided
    if (bookingId && Array.isArray(body.inviteEmails) && body.inviteEmails.length > 0) {
      const emailsToInsert = body.inviteEmails
        .filter((email) => typeof email === "string" && email.trim().length > 0)
        .map((email) => ({ bookingId, email: email.trim() }));
      if (emailsToInsert.length > 0) {
        await prisma.inviteEmailList.createMany({ data: emailsToInsert, skipDuplicates: true });
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: "Room booking created successfully",
        data: {
          bookingId,
          meetingRoom,
          timeStart,
          timeEnd,
          bookingStatus: 'approve',
          inviteEmailsSaved: Array.isArray(body.inviteEmails) ? body.inviteEmails.length : 0,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json<ApiResponse>({ success: false, error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Allow", "POST, OPTIONS");
  return res;
}
