import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        const room = searchParams.get("room");
        const startTime = searchParams.get("startTime");
        const endTime = searchParams.get("endTime");
        const environmentId = searchParams.get("environmentId");
        const excludeBookingId = searchParams.get("excludeBookingId");

        // Validate required parameters
        if (!date || !room) {
            return NextResponse.json(
                { success: false, message: "Date and room are required" },
                { status: 400 }
            );
        }

        // Build time range for conflict checking using raw SQL strings
        // MySQL DATETIME stores values as-is (no timezone conversion)
        let timeStartStr: string | undefined;
        let timeEndStr: string | undefined;

        if (startTime && endTime) {
            // Create datetime strings in MySQL format
            timeStartStr = `${date} ${startTime}:00`;
            timeEndStr = `${date} ${endTime}:00`;

            // Validate time range
            const start = new Date(date + `T${startTime}:00`);
            const end = new Date(date + `T${endTime}:00`);

            if (start >= end) {
                return NextResponse.json(
                    { success: false, message: "End time must be after start time" },
                    { status: 400 }
                );
            }

            console.log("[TIMEZONE] Checking availability (no conversion):", {
                input: { date, startTime, endTime },
                forDb: { start: timeStartStr, end: timeEndStr },
            });
        }

        // Query for conflicting bookings using raw SQL to avoid timezone conversion
        let conflicts: any[] = [];

        if (timeStartStr && timeEndStr) {
            // Check for time conflicts using raw SQL
            if (excludeBookingId) {
                const excludeId = parseInt(excludeBookingId);
                conflicts = await prisma.$queryRaw`
                    SELECT 
                        BOOKING_ID as bookingId,
                        TIME_START as timeStart,
                        TIME_END as timeEnd,
                        MEETING_ROOM as meetingRoom,
                        BOOKING_STATUS as bookingStatus,
                        MEETING_DETAIL as meetingDetail,
                        OWNER_EMP_CODE as ownerEmpCode
                    FROM BOOKING_PLAN
                    WHERE MEETING_ROOM = ${room}
                        AND BOOKING_STATUS IN ('approve', 'waiting')
                        AND TIME_START < ${timeEndStr}
                        AND TIME_END > ${timeStartStr}
                        AND BOOKING_ID != ${excludeId}
                    ORDER BY TIME_START ASC
                `;
            } else {
                conflicts = await prisma.$queryRaw`
                    SELECT 
                        BOOKING_ID as bookingId,
                        TIME_START as timeStart,
                        TIME_END as timeEnd,
                        MEETING_ROOM as meetingRoom,
                        BOOKING_STATUS as bookingStatus,
                        MEETING_DETAIL as meetingDetail,
                        OWNER_EMP_CODE as ownerEmpCode
                    FROM BOOKING_PLAN
                    WHERE MEETING_ROOM = ${room}
                        AND BOOKING_STATUS IN ('approve', 'waiting')
                        AND TIME_START < ${timeEndStr}
                        AND TIME_END > ${timeStartStr}
                    ORDER BY TIME_START ASC
                `;
            }
        } else {
            // Check for any bookings on that date
            const dayStart = `${date} 00:00:00`;
            const dayEnd = `${date} 23:59:59`;

            if (excludeBookingId) {
                const excludeId = parseInt(excludeBookingId);
                conflicts = await prisma.$queryRaw`
                    SELECT 
                        BOOKING_ID as bookingId,
                        TIME_START as timeStart,
                        TIME_END as timeEnd,
                        MEETING_ROOM as meetingRoom,
                        BOOKING_STATUS as bookingStatus,
                        MEETING_DETAIL as meetingDetail,
                        OWNER_EMP_CODE as ownerEmpCode
                    FROM BOOKING_PLAN
                    WHERE MEETING_ROOM = ${room}
                        AND BOOKING_STATUS IN ('approve', 'waiting')
                        AND TIME_START < ${dayEnd}
                        AND TIME_END > ${dayStart}
                        AND BOOKING_ID != ${excludeId}
                    ORDER BY TIME_START ASC
                `;
            } else {
                conflicts = await prisma.$queryRaw`
                    SELECT 
                        BOOKING_ID as bookingId,
                        TIME_START as timeStart,
                        TIME_END as timeEnd,
                        MEETING_ROOM as meetingRoom,
                        BOOKING_STATUS as bookingStatus,
                        MEETING_DETAIL as meetingDetail,
                        OWNER_EMP_CODE as ownerEmpCode
                    FROM BOOKING_PLAN
                    WHERE MEETING_ROOM = ${room}
                        AND BOOKING_STATUS IN ('approve', 'waiting')
                        AND TIME_START < ${dayEnd}
                        AND TIME_END > ${dayStart}
                    ORDER BY TIME_START ASC
                `;
            }
        }

        // Check if the requested time slot is available
        const isAvailable = conflicts.length === 0;

        return NextResponse.json({
            success: true,
            available: isAvailable,
            conflicts: conflicts.map((c: any) => ({
                bookingId: c.bookingId,
                timeStart: c.timeStart instanceof Date ? c.timeStart.toISOString() : c.timeStart,
                timeEnd: c.timeEnd instanceof Date ? c.timeEnd.toISOString() : c.timeEnd,
                room: c.meetingRoom,
                status: c.bookingStatus,
                bookedBy: "Unknown", // Would need to join employee table
                detail: c.meetingDetail,
            })),
            message: isAvailable
                ? "Time slot is available"
                : `Found ${conflicts.length} conflicting booking(s)`,
        });
    } catch (error) {
        console.error("Error checking room availability:", error);
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
