// NOTE: Protected by middleware via cookie session
import prisma from '@/prisma/prisma';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '@/lib/auth/session';
import { centerPart } from '@/utils/users';
import type { BookingData, OwnerGroup as OwnerGroupUI } from '@/types/booking';
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { year: string; month: string } }
) {
  const { year, month } = context.params;

  const yearNum = parseInt(year);
  const monthNum = parseInt(month);

  if (
    isNaN(yearNum) ||
    isNaN(monthNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    yearNum < 2000
  ) {
    return new Response(JSON.stringify({ error: "Invalid year or month" }), {
      status: 400,
    });
  }

  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

  const bookings = await prisma.bookingPlan.findMany({
    where: {
      timeStart: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { timeStart: "asc" },
    select: {
      bookingId: true,
      ownerEmpCode: true,
      ownerGroup: true,
      meetingRoom: true,
      meetingDetail: true,
      meetingType: true,
      timeStart: true,
      timeEnd: true,
      bookingStatus: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: { firstNameEn: true, lastNameEn: true, email: true, telExt: true, deptPath: true },
      },
      interpreterEmployee: {
        select: {
          empCode: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
    },
  });

  // Determine current user roles and allowed centers based on 'view'
  const url = new URL(request.url);
  const viewRaw = (url.searchParams.get('view') || '').toLowerCase();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  let roles: string[] = [];
  let myCenter: string | null = null;
  let adminCenters: string[] = [];
  if (parsed) {
    const me = await prisma.employee.findUnique({
      where: { empCode: parsed.empCode },
    });
    if (me) {
      // Get user roles
      const userRoles = await prisma.userRole.findMany({
        where: { userId: me.id },
      });
      roles = userRoles.map(r => r.roleCode);

      myCenter = centerPart(me.deptPath);

      // Get admin visions
      const adminVisions = await prisma.adminVision.findMany({
        where: { adminEmpCode: me.empCode },
      });
      adminCenters = adminVisions
        .map((v: { deptPath: string }) => centerPart(v.deptPath))
        .filter((x: string | null): x is string => Boolean(x));
    }
  }
  const hasAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  const isSuper = roles.includes('SUPER_ADMIN');
  const view: 'user' | 'admin' | 'all' = viewRaw === 'user' || viewRaw === 'admin' || viewRaw === 'all'
    ? (viewRaw as 'user' | 'admin' | 'all')
    : (hasAdmin ? 'admin' : 'user');

  let filtered = bookings;
  if (isSuper && (view === 'admin' || view === 'all')) {
    // super admin sees all
    filtered = bookings;
  } else if (view === 'admin' && hasAdmin) {
    const allow = new Set((adminCenters.length ? adminCenters : (myCenter ? [myCenter] : [])));
    filtered = bookings.filter(b => {
      const c = centerPart(b.employee?.deptPath ?? null);
      return c ? allow.has(c) : false;
    });
  } else {
    // user view (default)
    const cMy = myCenter;
    filtered = bookings.filter(b => {
      const c = centerPart(b.employee?.deptPath ?? null);
      return cMy && c ? c === cMy : false;
    });
  }

  // Map to the BookingData shape expected by the frontend
  const toIso = (d: Date) => d.toISOString();
  const extractYMD = (iso: string) => iso.split("T")[0];
  const extractHMS = (iso: string) => iso.split("T")[1].slice(0, 8);
  const formatDateTime = (d: Date): string => `${extractYMD(toIso(d))} ${extractHMS(toIso(d))}`;

  const asOwnerGroup = (v: unknown): OwnerGroupUI => {
    const s = String(v || "").toLowerCase();
    if (s === "software" || s === "iot" || s === "hardware" || s === "other") return s as OwnerGroupUI;
    return "other";
  };

  const result: BookingData[] = (filtered as Array<{
    bookingId: number;
    ownerEmpCode: string;
    ownerGroup: string;
    meetingRoom: string;
    meetingType: string;
    meetingDetail: string | null;
    timeStart: Date;
    timeEnd: Date;
    bookingStatus: string;
    createdAt: Date;
    updatedAt: Date;
    employee?: { firstNameEn: string | null; lastNameEn: string | null; email: string | null; telExt: string | null; deptPath?: string | null } | null;
    interpreterEmployee?: { empCode: string | null; firstNameEn: string | null; lastNameEn: string | null } | null;

  }>).map((b) => ({
    bookingId: b.bookingId,
    ownerEmpCode: b.ownerEmpCode,
    ownerName: b.employee?.firstNameEn ?? "",
    ownerSurname: b.employee?.lastNameEn ?? "",
    ownerEmail: b.employee?.email ?? "",
    ownerTel: b.employee?.telExt ?? "",
    ownerGroup: asOwnerGroup(b.ownerGroup),
    meetingRoom: b.meetingRoom,
    meetingDetail: b.meetingDetail ?? "",
    meetingType: b.meetingType,
    // highPriority removed from API response
    timeStart: formatDateTime(b.timeStart),
    timeEnd: formatDateTime(b.timeEnd),
    interpreterId: b.interpreterEmployee?.empCode ?? null,
    interpreterName: b.interpreterEmployee
      ? `${b.interpreterEmployee.firstNameEn ?? ""} ${b.interpreterEmployee.lastNameEn ?? ""}`.trim()
      : "",
    bookingStatus: b.bookingStatus,
    createdAt: formatDateTime(b.createdAt),
    updatedAt: formatDateTime(b.updatedAt),
  }));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}
