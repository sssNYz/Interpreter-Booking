import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/booking-data/cancel-booking/[bookingId]
 * Cancel a booking by changing its status to 'cancel'
 * - ROOM bookings: Can be cancelled at any time by the owner
 * - INTERPRETER bookings: Can only be cancelled if status is 'waiting' and by the owner
 */
export async function POST(
  request: NextRequest,
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

    // Get the current user's empCode from the request body
    const body = await request.json().catch(() => ({}));
    const userEmpCode = body.userEmpCode;

    if (!userEmpCode) {
      return NextResponse.json(
        { success: false, message: "User authentication required" },
        { status: 401 }
      );
    }

    // Find the booking
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    // SECURITY: Verify ownership - users can only cancel their own bookings
    if (booking.ownerEmpCode !== userEmpCode) {
      return NextResponse.json(
        {
          success: false,
          message: "You can only cancel your own bookings"
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

    // For INTERPRETER bookings, only allow canceling if status is 'waiting'
    const bookingKind = (booking as any).bookingKind || "INTERPRETER";
    if (bookingKind === "INTERPRETER" && booking.bookingStatus !== "waiting") {
      return NextResponse.json(
        {
          success: false,
          message: "Interpreter bookings can only be cancelled while in 'waiting' status. Please contact admin for approved bookings."
        },
        { status: 403 }
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

    const bookingType = bookingKind === "ROOM" ? "Room" : "Interpreter";
    return NextResponse.json({
      success: true,
      message: `${bookingType} booking cancelled successfully`,
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


