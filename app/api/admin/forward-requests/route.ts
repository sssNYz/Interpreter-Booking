import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
export const runtime = "nodejs";

async function getRequester() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const requester = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
    include: { userRoles: true },
  });
  if (!requester) return null;
  const roles = new Set((requester.userRoles ?? []).map((r) => r.roleCode));
  const isSuper = roles.has("SUPER_ADMIN");
  const isAdmin = isSuper || roles.has("ADMIN");
  return { requester, isAdmin, isSuper };
}

export async function GET() {
  try {
    const auth = await getRequester();
    if (!auth?.isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Admin sees bookings forwarded to any of their environments
    const envLinks = await prisma.environmentAdmin.findMany({
      where: { adminEmpCode: auth.requester.empCode },
      select: { environmentId: true },
    });
    const envIds = envLinks.map((e) => e.environmentId);
    if (envIds.length === 0) return NextResponse.json({ ok: true, data: [] });

    const rows = await prisma.bookingForwardTarget.findMany({
      where: { environmentId: { in: envIds } },
      select: {
        bookingId: true,
        environment: { select: { id: true, name: true } },
        booking: {
          select: {
            bookingId: true,
            meetingRoom: true,
            meetingType: true,
            timeStart: true,
            timeEnd: true,
            bookingStatus: true,
            languageCode: true,
            selectedInterpreterEmpCode: true,
            createdAt: true,
            employee: { select: { empCode: true, firstNameEn: true, lastNameEn: true, deptPath: true } },
          },
        },
      },
      orderBy: [{ bookingId: "asc" }],
    });

    // Filter only waiting bookings
    const data = rows
      .filter((r) => r.booking.bookingStatus === "waiting")
      .map((r) => ({
        bookingId: r.bookingId,
        environmentId: r.environment.id,
        environmentName: r.environment.name,
        meetingRoom: r.booking.meetingRoom,
        meetingType: r.booking.meetingType,
        timeStart: r.booking.timeStart,
        timeEnd: r.booking.timeEnd,
        status: r.booking.bookingStatus,
        owner: {
          empCode: r.booking.employee?.empCode ?? null,
          name: `${r.booking.employee?.firstNameEn ?? ''} ${r.booking.employee?.lastNameEn ?? ''}`.trim(),
          deptPath: r.booking.employee?.deptPath ?? null,
        },
        languageCode: r.booking.languageCode,
        selectedInterpreterEmpCode: r.booking.selectedInterpreterEmpCode,
        createdAt: r.booking.createdAt,
      }));

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
