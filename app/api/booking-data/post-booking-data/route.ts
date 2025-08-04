// app/api/booking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, OwnerGroup, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for the booking creation request
interface CreateBookingRequest {
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: OwnerGroup;
  meetingRoom: string;
  meetingDetail?: string;
  highPriority?: boolean;
  timeStart: string; // ISO string or date string
  timeEnd: string; // ISO string or date string
  interpreterId?: number;
  bookingStatus?: BookingStatus;
  timezone?: string; // Optional timezone parameter (not used for conversion, just for reference)
  inviteEmails?: string[]; // Array of email addresses to invite
}

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Date validation helper
const isValidDateString = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

// Validation function
const validateBookingData = (data: CreateBookingRequest): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required field validations
  if (!data.ownerName || typeof data.ownerName !== 'string' || data.ownerName.trim().length === 0) {
    errors.push('ownerName is required and must be a non-empty string');
  } else if (data.ownerName.length > 255) {
    errors.push('ownerName must be 255 characters or less');
  }

  if (!data.ownerSurname || typeof data.ownerSurname !== 'string' || data.ownerSurname.trim().length === 0) {
    errors.push('ownerSurname is required and must be a non-empty string');
  } else if (data.ownerSurname.length > 255) {
    errors.push('ownerSurname must be 255 characters or less');
  }

  if (!data.ownerEmail || typeof data.ownerEmail !== 'string' || !isValidEmail(data.ownerEmail)) {
    errors.push('ownerEmail is required and must be a valid email address');
  } else if (data.ownerEmail.length > 255) {
    errors.push('ownerEmail must be 255 characters or less');
  }

  if (!data.ownerTel || typeof data.ownerTel !== 'string' || data.ownerTel.trim().length === 0) {
    errors.push('ownerTel is required and must be a non-empty string');
  } else if (data.ownerTel.length > 15) {
    errors.push('ownerTel must be 15 characters or less');
  }

  if (!data.ownerGroup || !Object.values(OwnerGroup).includes(data.ownerGroup)) {
    errors.push(`ownerGroup is required and must be one of: ${Object.values(OwnerGroup).join(', ')}`);
  }

  if (!data.meetingRoom || typeof data.meetingRoom !== 'string' || data.meetingRoom.trim().length === 0) {
    errors.push('meetingRoom is required and must be a non-empty string');
  } else if (data.meetingRoom.length > 50) {
    errors.push('meetingRoom must be 50 characters or less');
  }

  if (!data.timeStart || !isValidDateString(data.timeStart)) {
    errors.push('timeStart is required and must be a valid ISO date string');
  }

  if (!data.timeEnd || !isValidDateString(data.timeEnd)) {
    errors.push('timeEnd is required and must be a valid ISO date string');
  }

  // Validate time range
  if (data.timeStart && data.timeEnd && isValidDateString(data.timeStart) && isValidDateString(data.timeEnd)) {
    const startDate = new Date(data.timeStart);
    const endDate = new Date(data.timeEnd);
    
    if (startDate >= endDate) {
      errors.push('timeEnd must be after timeStart');
    }

    // Optional: Check if booking is in the past (you can remove this if not needed)
    // const now = new Date();
    // if (startDate < now) {
    //   errors.push('timeStart cannot be in the past');
    // }
  }

  // Optional field validations
  if (data.meetingDetail !== undefined && data.meetingDetail !== null && typeof data.meetingDetail !== 'string') {
    errors.push('meetingDetail must be a string');
  }

  if (data.highPriority !== undefined && typeof data.highPriority !== 'boolean') {
    errors.push('highPriority must be a boolean');
  }

  // Fix interpreterId validation - allow null values
  if (data.interpreterId !== undefined) {
    if (data.interpreterId !== null && (!Number.isInteger(data.interpreterId) || data.interpreterId <= 0)) {
      errors.push('interpreterId must be a positive integer or null');
    }
  }

  if (data.bookingStatus && !Object.values(BookingStatus).includes(data.bookingStatus)) {
    errors.push(`bookingStatus must be one of: ${Object.values(BookingStatus).join(', ')}`);
  }

  if (data.timezone && typeof data.timezone !== 'string') {
    errors.push('timezone must be a string');
  }

  if (data.inviteEmails && (!Array.isArray(data.inviteEmails) || !data.inviteEmails.every((email: string) => typeof email === 'string' && isValidEmail(email)))) {
    errors.push('inviteEmails must be an array of valid email addresses');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Simple date parsing without timezone conversion
const parseBookingDates = (timeStart: string, timeEnd: string) => {
  return {
    timeStart: new Date(timeStart),
    timeEnd: new Date(timeEnd)
  };
};

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: CreateBookingRequest = await request.json();

    // Validate the request data
    const validation = validateBookingData(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Parse dates without timezone conversion
    const { timeStart, timeEnd } = parseBookingDates(
      body.timeStart,
      body.timeEnd
    );

    // Check for booking conflicts (optional - you may want to implement this)
    const conflictingBooking = await prisma.bookingPlan.findFirst({
      where: {
        meetingRoom: body.meetingRoom,
        bookingStatus: {
          not: BookingStatus.cancel // Using 'cancel' instead of 'cancelled'
        },
        OR: [
          {
            AND: [
              { timeStart: { lte: timeStart } },
              { timeEnd: { gt: timeStart } }
            ]
          },
          {
            AND: [
              { timeStart: { lt: timeEnd } },
              { timeEnd: { gte: timeEnd } }
            ]
          },
          {
            AND: [
              { timeStart: { gte: timeStart } },
              { timeEnd: { lte: timeEnd } }
            ]
          }
        ]
      }
    });

    if (conflictingBooking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking conflict',
          message: 'The selected time slot conflicts with an existing booking'
        },
        { status: 409 }
      );
    }

    // Create the booking record
    const newBooking = await prisma.bookingPlan.create({
      data: {
        ownerName: body.ownerName.trim(),
        ownerSurname: body.ownerSurname.trim(),
        ownerEmail: body.ownerEmail.trim().toLowerCase(),
        ownerTel: body.ownerTel.trim(),
        ownerGroup: body.ownerGroup,
        meetingRoom: body.meetingRoom.trim(),
        meetingDetail: body.meetingDetail?.trim() || null,
        highPriority: body.highPriority || false,
        timeStart,
        timeEnd,
        interpreterId: body.interpreterId || null,
        bookingStatus: body.bookingStatus || BookingStatus.waiting,
        // createdAt and updatedAt are handled automatically by Prisma
        ...(body.inviteEmails && body.inviteEmails.length > 0 && {
          inviteEmails: {
            create: body.inviteEmails.map((email) => ({
              email: email.trim().toLowerCase()
            }))
          }
        })
      },
      include: {
        inviteEmails: true,
        interpreter: true
      }
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Booking created successfully',
        data: {
          bookingId: newBooking.bookingId,
          ownerName: newBooking.ownerName,
          ownerSurname: newBooking.ownerSurname,
          ownerEmail: newBooking.ownerEmail,
          meetingRoom: newBooking.meetingRoom,
          timeStart: newBooking.timeStart,
          timeEnd: newBooking.timeEnd,
          bookingStatus: newBooking.bookingStatus,
          createdAt: newBooking.createdAt,
          inviteEmails: newBooking.inviteEmails,
          interpreter: newBooking.interpreter
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating booking:', error);

    // Handle Prisma-specific errors
    if (error instanceof Error) {
      // Handle foreign key constraint errors (e.g., invalid interpreterId)
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid reference',
            message: 'The provided interpreterId does not exist'
          },
          { status: 400 }
        );
      }

      // Handle unique constraint violations
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Constraint violation',
            message: 'A booking with similar details already exists'
          },
          { status: 409 }
        );
      }
    }

    // Generic server error
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the booking'
      },
      { status: 500 }
    );
  } finally {
    // Ensure Prisma client is disconnected
    await prisma.$disconnect();
  }
}

// Optional: Add a GET method to retrieve bookings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const meetingRoom = searchParams.get('meetingRoom');
    const ownerEmail = searchParams.get('ownerEmail');

    const where: Record<string, unknown> = {};
    if (meetingRoom) where.meetingRoom = meetingRoom;
    if (ownerEmail) where.ownerEmail = ownerEmail;

    const bookings = await prisma.bookingPlan.findMany({
      where,
      include: {
        inviteEmails: true,
        interpreter: true
      },
      orderBy: {
        timeStart: 'asc'
      },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        limit,
        offset,
        total: await prisma.bookingPlan.count({ where })
      }
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching bookings'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}