import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({ where: { empCode: parsed.empCode } });
  if (!user) return null;
  return user;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Only ADMIN / SUPER_ADMIN (or owner) can view detail
    const me = await prisma.employee.findUnique({
      where: { empCode: parsed.empCode },
      include: { userRoles: true },
    });
    const roles = me?.userRoles?.map((r) => r.roleCode) ?? [];
    const isSuper = roles.includes("SUPER_ADMIN");
    const isAdmin = roles.includes("ADMIN") || isSuper;

    const { id } = await ctx.params;
    const bookingId = Number(id);
    if (!Number.isFinite(bookingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    const b = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      include: {
        employee: {
          select: {
            empCode: true,
            prefixEn: true,
            firstNameEn: true,
            lastNameEn: true,
            deptPath: true,
            email: true,
            telExt: true,
          },
        },
        interpreterEmployee: {
          select: { empCode: true, firstNameEn: true, lastNameEn: true },
        },
        selectedInterpreter: {
          select: { empCode: true, firstNameEn: true, lastNameEn: true },
        },
        inviteEmails: true,
      },
    });

    if (!b) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    // Authorization: SUPER ADMIN -> allow; ADMIN -> restrict by env centers/interpreters; otherwise only owner
    if (!isSuper) {
      if (isAdmin) {
        // Build admin vision
        const myCenter = centerPart(me?.deptPath ?? null);
        let adminEnvCenters: string[] = [];
        let adminEnvInterpreterCodes: string[] = [];
        const envs = await prisma.environmentAdmin.findMany({
          where: { adminEmpCode: me!.empCode },
          select: { environmentId: true, environment: { select: { centers: { select: { center: true } } } } },
        });
        adminEnvCenters = envs.flatMap((e) => e.environment.centers.map((c) => c.center));
        const envIds = envs.map((e) => e.environmentId);
        if (envIds.length) {
          const links = await prisma.environmentInterpreter.findMany({
            where: { environmentId: { in: envIds } },
            select: { interpreterEmpCode: true },
          });
          adminEnvInterpreterCodes = links.map((l) => l.interpreterEmpCode);
        }

        const allowCenters = new Set(adminEnvCenters.length ? adminEnvCenters : (myCenter ? [myCenter] : []));
        const allowInterpreters = new Set(adminEnvInterpreterCodes);
        const c = centerPart(b.employee?.deptPath ?? null);
        const inCenters = c ? allowCenters.has(c) : false;
        const byInterpreter = b.interpreterEmployee?.empCode ? allowInterpreters.has(b.interpreterEmployee.empCode) : false;
        if (!inCenters && !byInterpreter) {
          return NextResponse.json({ error: "FORBIDDEN_AREA" }, { status: 403 });
        }
      } else {
        // Not admin: only owner can view
        if (b.ownerEmpCode !== me?.empCode) {
          return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }
      }
    }

    const ownerFirst = b.employee?.firstNameEn ?? "";
    const ownerLast = b.employee?.lastNameEn ?? "";
    const interpreterFirst = b.interpreterEmployee?.firstNameEn ?? "";
    const interpreterLast = b.interpreterEmployee?.lastNameEn ?? "";
    const selectedFirst = b.selectedInterpreter?.firstNameEn ?? "";
    const selectedLast = b.selectedInterpreter?.lastNameEn ?? "";

    const detail = {
      bookingId: b.bookingId,
      ownerEmpCode: b.ownerEmpCode,
      ownerPrefix: b.employee?.prefixEn ?? undefined,
      ownerName: ownerFirst,
      ownerSurname: ownerLast,
      ownerEmail: b.employee?.email ?? "",
      ownerTel: b.employee?.telExt ?? "",
      ownerGroup: b.ownerGroup,
      meetingRoom: b.meetingRoom,
      meetingDetail: b.meetingDetail ?? "",
      meetingType: b.meetingType,
      applicableModel: b.applicableModel ?? undefined,
      timeStart: b.timeStart.toISOString(),
      timeEnd: b.timeEnd.toISOString(),
      interpreterId: b.interpreterEmployee?.empCode ?? null,
      interpreterName: `${interpreterFirst} ${interpreterLast}`.trim() || undefined,
      inviteEmails: (b.inviteEmails ?? []).map((x) => x.email),
      bookingStatus: b.bookingStatus,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      languageCode: b.languageCode ?? null,
      chairmanEmail: b.chairmanEmail ?? null,
      selectedInterpreterEmpCode: b.selectedInterpreterEmpCode ?? null,
      selectedInterpreterName: `${selectedFirst} ${selectedLast}`.trim() || undefined,
    };

    return NextResponse.json({ success: true, data: detail });
  } catch (e) {
    console.error("GET /api/booking-data/[id] error", e);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
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
