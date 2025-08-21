// NOTE: Protected by middleware via cookie session
import prisma from "@/prisma/prisma";
import type { Prisma, BookingStatus as BookingStatusEnum } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ empCode: string }> }
) {
  const { empCode: empCodeRaw } = await context.params;
  const empCode = (empCodeRaw || "").trim();
  if (!empCode) {
    return new Response(JSON.stringify({ error: "Missing empCode" }), {
      status: 400,
    });
  }

  // Query params: page, pageSize, status, sort
  const url = new URL(_request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "5", 10)));
  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const sort = (url.searchParams.get("sort") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  const where: Prisma.BookingPlanWhereInput = {
    ownerEmpCode: empCode,
    ...(status !== "all"
      ? {
          bookingStatus: status as BookingStatusEnum,
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.bookingPlan.count({ where }),
    prisma.bookingPlan.findMany({
      where,
      orderBy: { timeStart: sort },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: {
          select: { prefixEn: true, firstNameEn: true, lastNameEn: true, email: true, telExt: true },
        },
        interpreterEmployee: {
          select: { empCode: true, firstNameEn: true, lastNameEn: true },
        },
        inviteEmails: true,
      },
    } as Parameters<typeof prisma.bookingPlan.findMany>[0]),
  ]);

  const items = (rows as Array<{
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
    employee?: { prefixEn: string | null; firstNameEn: string | null; lastNameEn: string | null; email: string | null; telExt: string | null } | null;
    interpreterEmployee?: { empCode: string | null; firstNameEn: string | null; lastNameEn: string | null } | null;
    inviteEmails?: Array<{ email: string }> | null;
  }>).map((b) => ({
    bookingId: b.bookingId,
    ownerEmpCode: b.ownerEmpCode,
    ownerPrefix: b.employee?.prefixEn ?? "",
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
    interpreterName: b.interpreterEmployee ? `${b.interpreterEmployee.firstNameEn ?? ""} ${b.interpreterEmployee.lastNameEn ?? ""}`.trim() : "",
    inviteEmails: (b.inviteEmails || []).map((ie) => ie.email),
    bookingStatus: b.bookingStatus,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return new Response(
    JSON.stringify({ items, total, page, pageSize }),
    { headers: { "Content-Type": "application/json" } }
  );
}


