// app/api/booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import prisma, {OwnerGroup, BookingStatus } from '@/prisma/prisma';

// Interface for the booking creation request
interface CreateBookingRequest {
	ownerEmpCode: string;
	ownerGroup: OwnerGroup;
	meetingRoom: string;
	meetingDetail?: string;
	highPriority?: boolean;
	timeStart: string; // ISO string or date string
	timeEnd: string; // ISO string or date string
	interpreterEmpCode?: string | null;
	interpreterId?: number | null;
	bookingStatus?: BookingStatus;
	timezone?: string; // Optional timezone parameter (not used for conversion, just for reference)
	inviteEmails?: string[]; // Array of email addresses to invite
}

// Date validation helper
const isValidDateString = (dateString: string): boolean => {
	const date = new Date(dateString);
	return !isNaN(date.getTime());
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
		errors.push("timeStart is required and must be a valid ISO date string");
	}

	if (!data.timeEnd || !isValidDateString(data.timeEnd)) {
		errors.push("timeEnd is required and must be a valid ISO date string");
	}

	// Validate time range
	if (
		data.timeStart &&
		data.timeEnd &&
		isValidDateString(data.timeStart) &&
		isValidDateString(data.timeEnd)
	) {
		const startDate = formatInTimeZone(new Date(data.timeStart), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss zzz");
		const endDate = formatInTimeZone(new Date(data.timeEnd), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss zzz");
		if (startDate >= endDate) {
			errors.push("timeEnd must be after timeStart");
		}
	}

	if (data.highPriority !== undefined && typeof data.highPriority !== "boolean") {
		errors.push("highPriority must be a boolean");
	}

	if (data.interpreterEmpCode !== undefined && data.interpreterEmpCode !== null) {
		if (typeof data.interpreterEmpCode !== "string" || data.interpreterEmpCode.trim().length === 0) {
			errors.push("interpreterEmpCode must be a non-empty string when provided");
		} else if (data.interpreterEmpCode.length > 64) {
			errors.push("interpreterEmpCode must be 64 characters or less");
		}
	}

	if (data.interpreterId !== undefined && data.interpreterId !== null) {
		if (typeof data.interpreterId !== "number" || !Number.isInteger(data.interpreterId) || data.interpreterId <= 0) {
			errors.push("interpreterId must be a positive integer when provided");
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

// Simple date parsing without timezone conversion
const parseBookingDates = (timeStart: string, timeEnd: string) => {
	return {
		timeStart: fromZonedTime(new Date(timeStart), ""),
		timeEnd: fromZonedTime(new Date(timeEnd), ""),
	};
};

export async function POST(request: NextRequest) {
	try {
		const body: CreateBookingRequest = await request.json();
		const validation = validateBookingData(body);
		if (!validation.isValid) {
			return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 400 });
		}

		const { timeStart, timeEnd } = parseBookingDates(body.timeStart, body.timeEnd);

		// Resolve interpreter emp code if only interpreterId is provided
		let resolvedInterpreterEmpCode: string | null = body.interpreterEmpCode ?? null;
		if (!resolvedInterpreterEmpCode && body.interpreterId) {
			const emp = await prisma.employee.findUnique({ where: { id: body.interpreterId } });
			resolvedInterpreterEmpCode = emp?.empCode ?? null;
		}

		// conflict check via parameterized SQL to avoid old Prisma client selecting removed columns
		const conflicts = await prisma.$queryRaw<Array<{ x: number }>>`
			SELECT 1 as x FROM BOOKING_PLAN
			WHERE MEETING_ROOM = ${body.meetingRoom}
			AND BOOKING_STATUS <> 'cancel'
			AND (
				(TIME_START <= ${timeStart} AND TIME_END > ${timeStart}) OR
				(TIME_START < ${timeEnd} AND TIME_END >= ${timeEnd}) OR
				(TIME_START >= ${timeStart} AND TIME_END <= ${timeEnd})
			)
			LIMIT 1
		`;
		if (conflicts.length > 0) {
			return NextResponse.json({ success: false, error: "Booking conflict", message: "The selected time slot conflicts with an existing booking" }, { status: 409 });
		}

		// Insert via parameterized SQL; quote reserved identifiers
		await prisma.$executeRaw`
			INSERT INTO BOOKING_PLAN (
				\`OWNER_EMP_CODE\`, \`OWNER_GROUP\`, \`MEETING_ROOM\`, \`MEETING_DETAIL\`, \`HIGH_PRIORITY\`, \`TIME_START\`, \`TIME_END\`, \`INTERPRETER_EMP_CODE\`, \`BOOKING_STATUS\`, \`created_at\`, \`updated_at\`
			) VALUES (
				${body.ownerEmpCode.trim()}, ${body.ownerGroup}, ${body.meetingRoom.trim()}, ${body.meetingDetail ?? null}, ${body.highPriority ? 1 : 0}, ${timeStart}, ${timeEnd}, ${resolvedInterpreterEmpCode ?? null}, ${body.bookingStatus || BookingStatus.waiting}, NOW(), NOW()
			)
		`;
		const inserted = await prisma.$queryRaw<Array<{ id: number | bigint }>>`SELECT LAST_INSERT_ID() as id`;
		const bookingIdValue = inserted?.[0]?.id;
		const bookingId = bookingIdValue != null ? Number(bookingIdValue) : null;

		// Persist invite emails if provided
		if (bookingId && Array.isArray(body.inviteEmails) && body.inviteEmails.length > 0) {
			const emailsToInsert = body.inviteEmails
				.filter((email: string) => typeof email === "string" && email.trim().length > 0)
				.map((email: string) => ({ bookingId, email: email.trim() }));
			if (emailsToInsert.length > 0) {
				await prisma.inviteEmailList.createMany({
					data: emailsToInsert,
					skipDuplicates: true,
				});
			}
		}

		return NextResponse.json(
			{
				success: true,
				message: "Booking created successfully",
				data: {
					bookingId,
					meetingRoom: body.meetingRoom.trim(),
					timeStart,
					timeEnd,
					bookingStatus: body.bookingStatus || BookingStatus.waiting,
					inviteEmailsSaved: Array.isArray(body.inviteEmails) ? body.inviteEmails.length : 0,
				},
			},
			{ status: 201 }
		);
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
