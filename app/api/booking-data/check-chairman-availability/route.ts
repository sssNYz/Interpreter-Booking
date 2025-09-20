import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function POST(req: NextRequest) {
  try {
    const { chairmanEmail, timeStart, timeEnd } = await req.json();
    
    // Validate input
    if (!chairmanEmail || !timeStart || !timeEnd) {
      return NextResponse.json(
        { error: 'chairmanEmail, timeStart, and timeEnd are required' },
        { status: 400 }
      );
    }
    
    // Check for conflicting bookings with the same chairman email
    const conflictBooking = await prisma.bookingPlan.findFirst({
      where: {
        chairmanEmail,
        bookingStatus: 'approve', // Only check approved bookings
        OR: [
          {
            AND: [
              { timeStart: { lte: new Date(timeStart) } },
              { timeEnd: { gt: new Date(timeStart) } }
            ]
          },
          {
            AND: [
              { timeStart: { lt: new Date(timeEnd) } },
              { timeEnd: { gte: new Date(timeEnd) } }
            ]
          },
          {
            AND: [
              { timeStart: { gte: new Date(timeStart) } },
              { timeEnd: { lte: new Date(timeEnd) } }
            ]
          }
        ]
      },
      include: {
        employee: {
          select: {
            firstNameEn: true,
            lastNameEn: true,
            empCode: true
          }
        }
      }
    });
    
    return NextResponse.json({
      available: !conflictBooking,
      conflictBooking: conflictBooking ? {
        bookingId: conflictBooking.bookingId,
        timeStart: conflictBooking.timeStart,
        timeEnd: conflictBooking.timeEnd,
        meetingRoom: conflictBooking.meetingRoom,
        ownerName: `${conflictBooking.employee.firstNameEn} ${conflictBooking.employee.lastNameEn}`,
        ownerEmpCode: conflictBooking.employee.empCode
      } : null
    });
  } catch (error) {
    console.error('Error checking chairman availability:', error);
    return NextResponse.json(
      { error: 'Internal error' }, 
      { status: 500 }
    );
  }
}
