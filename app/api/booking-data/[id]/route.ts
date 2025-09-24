import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({ where: { empCode: parsed.empCode } });
  if (!user) return null;
  return user;
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { id } = await ctx.params;
    const bookingId = Number(id);
    
    if (!Number.isFinite(bookingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    // Check if booking exists and belongs to user
    const booking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: { 
        bookingId: true, 
        ownerEmpCode: true, 
        bookingStatus: true,
        isForwarded: true 
      }
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    // Check if user owns the booking
    if (booking.ownerEmpCode !== me.empCode) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own bookings" },
        { status: 403 }
      );
    }

    // Check if booking can be deleted (not already assigned or forwarded)
    if (booking.bookingStatus === "approve") {
      return NextResponse.json(
        { success: false, error: "Cannot delete approved booking" },
        { status: 400 }
      );
    }

    if (booking.isForwarded) {
      return NextResponse.json(
        { success: false, error: "Cannot delete forwarded booking" },
        { status: 400 }
      );
    }

    // Delete the booking and related data
    await prisma.$transaction(async (tx) => {
      // Delete forward targets if any
      await tx.bookingForwardTarget.deleteMany({
        where: { bookingId }
      });

      // Delete the booking
      await tx.bookingPlan.delete({
        where: { bookingId }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Booking deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred while deleting the booking",
      },
      { status: 500 }
    );
  }
}
