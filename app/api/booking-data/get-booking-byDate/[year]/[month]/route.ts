// NOTE: Protected by middleware via cookie session
import prisma from '@/prisma/prisma';
import type { BookingData, OwnerGroup as OwnerGroupUI } from '@/types/booking';
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { year: string; month: string } }
) {
  const { year, month } = await context.params;

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
    include: {
      employee: {
        select: { firstNameEn: true, lastNameEn: true, email: true, telExt: true },
      },
      interpreterEmployee: {
        select: { empCode: true,
                firstNameEn: true,
                lastNameEn: true,
         },
      },
    },
  } as Parameters<typeof prisma.bookingPlan.findMany>[0]);

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

  const result: BookingData[] = (bookings as Array<{
    bookingId: number;
    ownerEmpCode: string;
    ownerGroup: string;
    meetingRoom: string;
    meetingDetail: string | null;
    timeStart: Date;
    timeEnd: Date;
    bookingStatus: string;
    createdAt: Date;
    updatedAt: Date;
    employee?: { firstNameEn: string | null; lastNameEn: string | null; email: string | null; telExt: string | null } | null;
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
    // highPriority removed from API response
    timeStart: formatDateTime(b.timeStart),
    timeEnd: formatDateTime(b.timeEnd),
    interpreterId: b.interpreterEmployee?.empCode ?? null,
    interpreterName: b.interpreterEmployee
    ?`${b.interpreterEmployee.firstNameEn ?? ""} ${b.interpreterEmployee.lastNameEn ?? ""}`.trim()  
    : "",
    bookingStatus: b.bookingStatus,
    createdAt: formatDateTime(b.createdAt),
    updatedAt: formatDateTime(b.updatedAt),
  }));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}
