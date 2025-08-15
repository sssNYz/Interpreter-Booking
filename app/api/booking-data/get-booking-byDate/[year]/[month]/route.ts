import prisma from '@/prisma/prisma';
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
        select: { empCode: true },
      },
    },
  } as Parameters<typeof prisma.bookingPlan.findMany>[0]);

  // Map to the BookingData shape expected by the frontend
  type IncludedEmployee = { firstNameEn: string | null; lastNameEn: string | null; email: string | null; telExt: string | null } | null;
  type IncludedInterpreter = { empCode: string | null } | null;
  const result = (bookings as Array<{
    bookingId: number;
    ownerEmpCode: string;
    ownerGroup: string;
    meetingRoom: string;
    meetingDetail: string | null;
    highPriority: boolean;
    timeStart: Date;
    timeEnd: Date;
    bookingStatus: string;
    createdAt: Date;
    updatedAt: Date;
    employee?: IncludedEmployee;
    interpreterEmployee?: IncludedInterpreter;
  }>).map((b) => ({
    bookingId: b.bookingId,
    ownerEmpCode: b.ownerEmpCode,
    ownerName: b.employee?.firstNameEn ?? "",
    ownerSurname: b.employee?.lastNameEn ?? "",
    ownerEmail: b.employee?.email ?? "",
    ownerTel: b.employee?.telExt ?? "",
    ownerGroup: b.ownerGroup,
    meetingRoom: b.meetingRoom,
    meetingDetail: b.meetingDetail ?? "",
    highPriority: b.highPriority,
    timeStart: b.timeStart,
    timeEnd: b.timeEnd,
    interpreterId: b.interpreterEmployee?.empCode ?? null,
    bookingStatus: b.bookingStatus,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}
