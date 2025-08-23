// NOTE: Protected by middleware via cookie session
// app/api/booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, {OwnerGroup, BookingStatus } from '@/prisma/prisma';
import type { CreateBookingRequest } from '@/types/booking-requests';
import type { ApiResponse } from '@/types/api';

// Interface moved to '@/types/booking-requests'

// Global capacity across all rooms
const GLOBAL_SLOT_CAPACITY = 2;

// Standard API response shape moved to '@/types/api'

// Date validation helper: strict "YYYY-MM-DD HH:mm:ss"
const isValidDateString = (s: string): boolean => {
	return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
};

// Validation function
const validateBookingData = (
	data: CreateBookingRequest
): { isValid: boolean; errors: string[] } => {
	const errors: string[] = [];

	// Required field validations
	if (!data.ownerEmpCode || typeof data.ownerEmpCode !== "string" || data.ownerEmpCode.trim().length === 0) {
		errors.push("ownerEmpCode is required and must be a non-empty string");
	} else if (data.ownerEmpCode.length > 64) {
		errors.push("ownerEmpCode must be 64 characters or less");
	}

	if (!data.ownerGroup || !Object.values(OwnerGroup).includes(data.ownerGroup)) {
		errors.push(`ownerGroup is required and must be one of: ${Object.values(OwnerGroup).join(", ")}`);
	}

	if (!data.meetingRoom || typeof data.meetingRoom !== "string" || data.meetingRoom.trim().length === 0) {
		errors.push("meetingRoom is required and must be a non-empty string");
	} else if (data.meetingRoom.length > 50) {
		errors.push("meetingRoom must be 50 characters or less");
	}

	if (!data.timeStart || !isValidDateString(data.timeStart)) {
		errors.push("timeStart is required and must be 'YYYY-MM-DD HH:mm:ss'");
	}

	if (!data.timeEnd || !isValidDateString(data.timeEnd)) {
		errors.push("timeEnd is required and must be 'YYYY-MM-DD HH:mm:ss'");
	}

	// Validate time range
	if (
		data.timeStart &&
		data.timeEnd &&
		isValidDateString(data.timeStart) &&
		isValidDateString(data.timeEnd)
	) {
		if (data.timeStart >= data.timeEnd) {
			errors.push("timeEnd must be after timeStart");
		}
	}

	if (data.highPriority !== undefined && typeof data.highPriority !== "boolean") {
		errors.push("highPriority must be a boolean");
	}

	if (data.force !== undefined && typeof data.force !== "boolean") {
		errors.push("force must be a boolean");
	}

	if (data.interpreterEmpCode !== undefined && data.interpreterEmpCode !== null) {
		if (typeof data.interpreterEmpCode !== "string" || data.interpreterEmpCode.trim().length === 0) {
			errors.push("interpreterEmpCode must be a non-empty string when provided");
		} else if (data.interpreterEmpCode.length > 64) {
			errors.push("interpreterEmpCode must be 64 characters or less");
		}
	}



	if (data.bookingStatus && !Object.values(BookingStatus).includes(data.bookingStatus)) {
		errors.push(`bookingStatus must be one of: ${Object.values(BookingStatus).join(", ")}`);
	}

	if (data.inviteEmails && (!Array.isArray(data.inviteEmails) || !data.inviteEmails.every((email: string) => typeof email === "string"))) {
		errors.push("inviteEmails must be an array of strings");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};

// No conversion; use provided strings directly
const parseBookingDates = (timeStart: string, timeEnd: string) => {
	return { timeStart, timeEnd };
};

export async function POST(request: NextRequest) {
	try {
		const body: CreateBookingRequest = await request.json();
		const validation = validateBookingData(body);
		if (!validation.isValid) {
			return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 400 });
		}

		const { timeStart, timeEnd } = parseBookingDates(body.timeStart, body.timeEnd);

		// Use an interactive transaction to keep operations atomic (insert + related records)
		const result = await prisma.$transaction(async (tx) => {
			// Acquire a global advisory lock to serialize overlap checks + insert
			const lockKey = 'booking_global_capacity';
			const lockRes = await tx.$queryRaw<Array<{ locked: number | bigint }>>`
				SELECT GET_LOCK(${lockKey}, 5) AS locked
			`;
			const lockedVal = lockRes?.[0]?.locked;
			const lockOk = lockedVal != null ? Number(lockedVal) === 1 : false;
			if (!lockOk) {
				throw new Error('Failed to acquire global booking lock');
			}
			try {
				// 1) Global capacity check (NOT by room)
				const capCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
					SELECT COUNT(*) AS cnt
					FROM BOOKING_PLAN
					WHERE BOOKING_STATUS <> 'cancel'
					AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
					FOR UPDATE
				`;
				const capCntVal = capCounts?.[0]?.cnt;
				const totalOverlap = capCntVal != null ? Number(capCntVal) : 0;
				if (totalOverlap >= GLOBAL_SLOT_CAPACITY) {
					return {
						success: false as const,
						status: 409,
						body: {
							success: false,
							error: 'Time slot full',
							message: 'The selected time slot has reached its capacity',
							code: 'CAPACITY_FULL',
							data: { totalOverlap, capacity: GLOBAL_SLOT_CAPACITY },
						},
					};
				}

				// 2) Same-room overlap warning (informational, requires confirmation)
				const sameRoomCounts = await tx.$queryRaw<Array<{ cnt: number | bigint }>>`
					SELECT COUNT(*) AS cnt
					FROM BOOKING_PLAN
					WHERE MEETING_ROOM = ${body.meetingRoom}
					AND BOOKING_STATUS <> 'cancel'
					AND (TIME_START < ${timeEnd} AND TIME_END > ${timeStart})
				`;
				const sameRoomCntVal = sameRoomCounts?.[0]?.cnt;
				const sameRoomOverlap = sameRoomCntVal != null ? Number(sameRoomCntVal) : 0;
				if (sameRoomOverlap > 0 && !body.force) {
					return {
						success: false as const,
						status: 409,
						body: {
							success: false,
							error: 'Overlap warning',
							message: 'This room already has a booking overlapping this time. Do you want to proceed?',
							code: 'OVERLAP_WARNING',
							data: { meetingRoom: body.meetingRoom.trim(), overlapCount: sameRoomOverlap },
						},
					};
				}

				// 3) Insert booking (capacity still enforced by the global lock + check)
				await tx.$executeRaw`
					INSERT INTO BOOKING_PLAN (
						\`OWNER_EMP_CODE\`, \`OWNER_GROUP\`, \`MEETING_ROOM\`, \`MEETING_DETAIL\`, \`HIGH_PRIORITY\`, \`TIME_START\`, \`TIME_END\`, \`INTERPRETER_EMP_CODE\`, \`BOOKING_STATUS\`, \`created_at\`, \`updated_at\`
					) VALUES (
						${body.ownerEmpCode.trim()}, ${body.ownerGroup}, ${body.meetingRoom.trim()}, ${body.meetingDetail ?? null}, ${body.highPriority ? 1 : 0}, ${timeStart}, ${timeEnd}, ${body.interpreterEmpCode ?? null}, ${body.bookingStatus || BookingStatus.waiting}, NOW(), NOW()
					)
				`;
				const inserted = await tx.$queryRaw<Array<{ id: number | bigint }>>`SELECT LAST_INSERT_ID() as id`;
				const bookingIdValue = inserted?.[0]?.id;
				const bookingId = bookingIdValue != null ? Number(bookingIdValue) : null;

				// Persist invite emails if provided
				if (bookingId && Array.isArray(body.inviteEmails) && body.inviteEmails.length > 0) {
					const emailsToInsert = body.inviteEmails
						.filter((email: string) => typeof email === 'string' && email.trim().length > 0)
						.map((email: string) => ({ bookingId, email: email.trim() }));
					if (emailsToInsert.length > 0) {
						await tx.inviteEmailList.createMany({
							data: emailsToInsert,
							skipDuplicates: true,
						});
					}
				}

				return {
					success: true as const,
					status: 201,
					body: {
						success: true,
						message: 'Booking created successfully',
						data: {
							bookingId,
							meetingRoom: body.meetingRoom.trim(),
							timeStart,
							timeEnd,
							bookingStatus: body.bookingStatus || BookingStatus.waiting,
							inviteEmailsSaved: Array.isArray(body.inviteEmails) ? body.inviteEmails.length : 0,
						},
					},
				};
			} finally {
				await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`;
			}
		}, { timeout: 10000 });

		return NextResponse.json<ApiResponse>(result.body as ApiResponse, { status: result.status });
	} catch (error) {
		console.error("Error creating booking:", error);
		return NextResponse.json({ success: false, error: "Internal server error", message: "An unexpected error occurred while creating the booking" }, { status: 500 });
	} finally {
		await prisma.$disconnect();
	}
}

// Optional: Add a GET method to retrieve bookings
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const limit = parseInt(searchParams.get("limit") || "10");
		const offset = parseInt(searchParams.get("offset") || "0");
		const meetingRoom = searchParams.get("meetingRoom");

		const where: Record<string, unknown> = {};
		if (meetingRoom) where.meetingRoom = meetingRoom;

		const bookings = await prisma.bookingPlan.findMany({
			where,
			orderBy: { timeStart: "asc" },
			take: limit,
			skip: offset,
		});

		return NextResponse.json({ success: true, data: bookings, pagination: { limit, offset, total: await prisma.bookingPlan.count({ where }) } });
	} catch (error) {
		console.error("Error fetching bookings:", error);
		return NextResponse.json({ success: false, error: "Internal server error", message: "An unexpected error occurred while fetching bookings" }, { status: 500 });
	} finally {
		await prisma.$disconnect();
	}
}
