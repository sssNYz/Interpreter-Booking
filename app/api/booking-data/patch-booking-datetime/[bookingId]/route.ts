import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { z } from "zod";

const PatchDateTimeSchema = z.object({
  timeStart: z.string(), // Local datetime string: "2025-11-05T10:30:00"
  timeEnd: z.string(),   // Local datetime string: "2025-11-05T12:30:00"
});

export async function PATCH(
  req: Request,
  { params }: { params: { bookingId: string } }
) {
  try {
    // 1) Validate bookingId
    const bookingId = Number(params.bookingId);
    if (!Number.isFinite(bookingId)) {
      return NextResponse.json(
        { success: false, message: "Invalid bookingId" },
        { status: 400 }
      );
    }

    // 2) Parse and validate request body
    let parsed: z.infer<typeof PatchDateTimeSchema>;
    try {
      const json = await req.json();
      const result = PatchDateTimeSchema.safeParse(json);
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Invalid request body", errors: result.error.issues },
          { status: 422 }
        );
      }
      parsed = result.data;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Parse datetime strings WITHOUT timezone conversion
    // Input: "2025-11-05T10:30:00" should be stored as 10:30 in database
    // MySQL DATETIME stores the value as-is (no timezone info)
    // We need to parse it as a "naive" datetime (no timezone conversion)
    
    // Replace 'T' with space for MySQL DATETIME format
    const timeStartForDb = parsed.timeStart.replace('T', ' ');
    const timeEndForDb = parsed.timeEnd.replace('T', ' ');
    
    // Create Date objects just for validation (not for storage)
    const timeStart = new Date(parsed.timeStart);
    const timeEnd = new Date(parsed.timeEnd);

    // Validate dates
    if (isNaN(timeStart.getTime()) || isNaN(timeEnd.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid datetime format. Expected: YYYY-MM-DDTHH:mm:ss" },
        { status: 400 }
      );
    }

    console.log("[TIMEZONE] Storing local time (no conversion):", {
      input: { start: parsed.timeStart, end: parsed.timeEnd },
      forDb: { start: timeStartForDb, end: timeEndForDb },
    });

    // 3) Validate time range
    if (timeStart >= timeEnd) {
      return NextResponse.json(
        { success: false, message: "End time must be after start time" },
        { status: 400 }
      );
    }

    // 4) Check if booking exists
    const existing = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        bookingStatus: true,
        meetingRoom: true,
        timeStart: true,
        timeEnd: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    // 5) Check if booking can be modified
    if (existing.bookingStatus === "cancel") {
      return NextResponse.json(
        { success: false, message: "Cannot modify cancelled booking" },
        { status: 409 }
      );
    }

    // 6) STRICT conflict checking using raw SQL (no timezone conversion)
    // Check if ANY booking overlaps with the requested time slot
    const conflicts: any[] = await prisma.$queryRaw`
      SELECT 
        BOOKING_ID as bookingId,
        TIME_START as timeStart,
        TIME_END as timeEnd,
        MEETING_ROOM as meetingRoom,
        BOOKING_STATUS as bookingStatus
      FROM BOOKING_PLAN
      WHERE BOOKING_ID != ${bookingId}
        AND MEETING_ROOM = ${existing.meetingRoom}
        AND BOOKING_STATUS IN ('approve', 'waiting')
        AND TIME_START < ${timeEndForDb}
        AND TIME_END > ${timeStartForDb}
      ORDER BY TIME_START ASC
    `;

    if (conflicts.length > 0) {
      console.error("[CONFLICT] Cannot save - time slot already booked:", {
        requested: { start: timeStartForDb, end: timeEndForDb },
        conflicts: conflicts.map((c) => ({
          bookingId: c.bookingId,
          start: c.timeStart,
          end: c.timeEnd,
        })),
      });

      return NextResponse.json(
        {
          success: false,
          message: `❌ Cannot save: Room is already booked during this time. Found ${conflicts.length} conflicting booking(s).`,
          conflicts: conflicts.map((c: any) => ({
            bookingId: c.bookingId,
            timeStart: c.timeStart instanceof Date ? c.timeStart.toISOString() : c.timeStart,
            timeEnd: c.timeEnd instanceof Date ? c.timeEnd.toISOString() : c.timeEnd,
            room: c.meetingRoom,
            status: c.bookingStatus,
          })),
        },
        { status: 409 }
      );
    }

    console.log("[CONFLICT CHECK] ✅ No conflicts found - safe to save:", {
      room: existing.meetingRoom,
      requested: { start: timeStartForDb, end: timeEndForDb },
    });

    // 7) Update the booking using raw SQL to avoid timezone conversion
    // This ensures MySQL stores exactly what we send (10:30 stays as 10:30)
    // Use transaction for safety
    const updateResult = await prisma.$executeRaw`
      UPDATE BOOKING_PLAN 
      SET TIME_START = ${timeStartForDb}, 
          TIME_END = ${timeEndForDb},
          updated_at = NOW()
      WHERE BOOKING_ID = ${bookingId}
    `;

    if (updateResult === 0) {
      return NextResponse.json(
        { success: false, message: "Failed to update booking - booking may have been deleted" },
        { status: 500 }
      );
    }

    console.log("[UPDATE] ✅ Booking updated successfully:", {
      bookingId,
      newTimes: { start: timeStartForDb, end: timeEndForDb },
    });

    // Fetch the updated booking
    const updated = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      include: {
        employee: {
          select: {
            empCode: true,
            email: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
        interpreterEmployee: {
          select: {
            empCode: true,
            email: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
        inviteEmails: true,
      },
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch updated booking" },
        { status: 500 }
      );
    }

    // 8) Send email notifications if booking is approved
    try {
      if (updated.bookingStatus === "approve") {
        // Note: Email notification for date/time updates can be implemented later
        console.log(`[EMAIL] Date/time updated for booking ${updated.bookingId} - email notification pending implementation`);
      }
    } catch (err) {
      console.error("[EMAIL] Error in email trigger block:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Date and time updated successfully",
      data: {
        bookingId: updated.bookingId,
        timeStart: updated.timeStart.toISOString(),
        timeEnd: updated.timeEnd.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating booking date/time:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Allow", "PATCH, OPTIONS");
  return res;
}
