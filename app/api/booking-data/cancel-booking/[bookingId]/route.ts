import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/booking-data/cancel-booking/[bookingId]
 * Cancel a room booking by changing its status to 'cancel'
 * Only allows canceling ROOM bookings
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId: bookingIdRaw } = await context.params;
    const bookingId = parseInt(bookingIdRaw, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { success: false, message: "Invalid booking ID" },
        { status: 400 }
      );
    }

    // Find the booking
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        bookingKind: true,
        bookingStatus: true,
        ownerEmpCode: true,
        meetingRoom: true,
        timeStart: true,
        timeEnd: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    // Only allow canceling ROOM bookings
    if (booking.bookingKind !== "ROOM") {
      return NextResponse.json(
        { 
          success: false, 
          message: "Only room bookings can be cancelled. Interpreter bookings must be handled by admin." 
        },
        { status: 403 }
      );
    }

    // Check if already cancelled
    if (booking.bookingStatus === "cancel") {
      return NextResponse.json(
        { success: false, message: "Booking is already cancelled" },
        { status: 400 }
      );
    }

    // Update booking status to cancel
    await prisma.bookingPlan.update({
      where: { bookingId },
      data: {
        bookingStatus: "cancel",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Room booking cancelled successfully",
      bookingId,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to cancel booking" 
      },
      { status: 500 }
    );
  }
}


