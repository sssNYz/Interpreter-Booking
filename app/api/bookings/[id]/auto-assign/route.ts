import { NextRequest, NextResponse } from "next/server";
import { runAssignment } from "@/lib/assignment/core/run";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import prisma from "@/prisma/prisma";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({ where: { empCode: parsed.empCode } });
  if (!user) return null;
  return user;
}

export async function POST(
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

    // Run auto-assignment
    const result = await runAssignment(bookingId);

    if (result.status === "assigned") {
      return NextResponse.json({
        success: true,
        message: `Booking assigned to ${result.interpreterId}`,
        interpreterId: result.interpreterId,
        note: result.note
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.reason,
        status: result.status
      }, { status: 400 });
    }

  } catch (error) {
    console.error("Error in auto-assign:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred during auto-assignment",
      },
      { status: 500 }
    );
  }
}
