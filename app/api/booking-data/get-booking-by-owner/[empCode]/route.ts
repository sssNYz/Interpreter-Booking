// NOTE: Protected by middleware via cookie session
import prisma from "@/prisma/prisma";
import type {
  Prisma,
  BookingStatus as BookingStatusEnum,
} from "@prisma/client";
import type { BookingApiResponse } from "@/types/api";
import type { BookingData, OwnerGroup as OwnerGroupUI } from "@/types/booking";
import { is } from "date-fns/locale/is";

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

  // Query params: page, pageSize, status, sort, startDate, endDate (YYYY-MM-DD), interpreterId, interpreterIds, statuses
  const url = new URL(_request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || "5", 10))
  );
  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const sort =
    (url.searchParams.get("sort") || "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";
  const startDateStr = url.searchParams.get("startDate");
  const endDateStr = url.searchParams.get("endDate");
  const interpreterId = (url.searchParams.get("interpreterId") || "").trim();
  const interpreterIdsCsv = (
    url.searchParams.get("interpreterIds") || ""
  ).trim();
  const statusesCsv = (url.searchParams.get("statuses") || "").trim();

  const normalizeStatus = (s: string): BookingStatusEnum | null => {
    const v = s.toLowerCase();
    if (v === "approve" || v === "waiting" || v === "cancel")
      return v as BookingStatusEnum;
    if (v === "complete" || v === "complet") return "complet";
    return null;
  };

  const interpreterIds = interpreterIdsCsv
    ? Array.from(
        new Set(
          interpreterIdsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    : [];

  const statuses = statusesCsv
    ? Array.from(
        new Set(
          statusesCsv
            .split(",")
            .map((s) => normalizeStatus(s))
            .filter((s): s is BookingStatusEnum => !!s)
        )
      )
    : [];

  let timeRange: Prisma.BookingPlanWhereInput["timeStart"] | undefined =
    undefined;
  if (startDateStr || endDateStr) {
    const start = startDateStr
      ? new Date(`${startDateStr}T00:00:00.000Z`)
      : undefined;
    const end = endDateStr
      ? new Date(`${endDateStr}T23:59:59.999Z`)
      : undefined;
    timeRange = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    } as Prisma.DateTimeFilter;
  }

  const where: Prisma.BookingPlanWhereInput = {
    ownerEmpCode: empCode,
    ...(status !== "all" && statuses.length === 0
      ? {
          bookingStatus: normalizeStatus(status) as BookingStatusEnum,
        }
      : {}),
    ...(statuses.length > 0
      ? {
          bookingStatus: {
            in: statuses as unknown as BookingStatusEnum[],
          },
        }
      : {}),
    ...(timeRange ? { timeStart: timeRange } : {}),
    ...(interpreterId ? { interpreterEmpCode: interpreterId } : {}),
    ...(interpreterIds.length > 0
      ? { interpreterEmpCode: { in: interpreterIds } }
      : {}),
  };

  // Keep Prisma session in UTC to ensure TIMESTAMPs map to proper UTC instants
  try {
    await prisma.$executeRaw`SET time_zone = '+00:00'`;
  } catch {}

  const [total, rows] = await Promise.all([
    prisma.bookingPlan.count({ where }),
    prisma.bookingPlan.findMany({
      where,
      orderBy: { timeStart: sort },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        bookingId: true,
        ownerEmpCode: true,
        ownerGroup: true,
        meetingRoom: true,
        meetingDetail: true,
        // Ensure we fetch real DB fields used by UI
        applicableModel: true,
        meetingType: true,
        bookingKind: true,
        timeStart: true,
        timeEnd: true,
        bookingStatus: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            prefixEn: true,
            firstNameEn: true,
            lastNameEn: true,
            email: true,
            telExt: true,
          },
        },
        interpreterEmployee: {
          select: { empCode: true, firstNameEn: true, lastNameEn: true },
        },
        inviteEmails: {
          select: { email: true },
        },
      },
    }),
  ]);

  const toIso = (d: Date) => d.toISOString();
  const extractYMD = (iso: string) => iso.split("T")[0];
  const extractHMS = (iso: string) => iso.split("T")[1].slice(0, 8);
  const formatDateTime = (d: Date): string =>
    `${extractYMD(toIso(d))} ${extractHMS(toIso(d))}`;

  const asOwnerGroup = (v: unknown): OwnerGroupUI => {
    const s = String(v || "").toLowerCase();
    if (s === "software" || s === "iot" || s === "hardware" || s === "other")
      return s as OwnerGroupUI;
    return "other";
  };

  const items: BookingData[] = (
    rows as Array<{
      bookingId: number;
      ownerEmpCode: string;
      ownerGroup: string;
      meetingRoom: string;
      meetingDetail: string | null;
      meetingType?: string | null;
      applicableModel?: string | null;
      bookingKind?: string | null;
      timeStart: Date;
      timeEnd: Date;
      bookingStatus: string;
      createdAt: Date;
      updatedAt: Date;
      employee?: {
        prefixEn: string | null;
        firstNameEn: string | null;
        lastNameEn: string | null;
        email: string | null;
        telExt: string | null;
      } | null;
      interpreterEmployee?: {
        empCode: string | null;
        firstNameEn: string | null;
        lastNameEn: string | null;
      } | null;
      inviteEmails?: Array<{ email: string }> | null;
    }>
  ).map((b) => ({
    bookingId: b.bookingId,
    ownerEmpCode: b.ownerEmpCode,
    ownerPrefix: b.employee?.prefixEn ?? "",
    ownerName: b.employee?.firstNameEn ?? "",
    ownerSurname: b.employee?.lastNameEn ?? "",
    ownerEmail: b.employee?.email ?? "",
    ownerTel: b.employee?.telExt ?? "",
    ownerGroup: asOwnerGroup(b.ownerGroup),
    meetingRoom: b.meetingRoom,
    meetingDetail: b.meetingDetail ?? "",
    meetingType: (b as { meetingType?: string | null }).meetingType ?? "",
    applicableModel:
      (b as { applicableModel?: string | null }).applicableModel ?? "",
    bookingKind: (b as { bookingKind?: string | null }).bookingKind ?? "INTERPRETER",
    timeStart: formatDateTime(b.timeStart),
    timeEnd: formatDateTime(b.timeEnd),
    interpreterId: b.interpreterEmployee?.empCode ?? null,
    interpreterName: b.interpreterEmployee
      ? `${b.interpreterEmployee.firstNameEn ?? ""} ${
          b.interpreterEmployee.lastNameEn ?? ""
        }`.trim()
      : "",
    inviteEmails: (b.inviteEmails || []).map((ie) => ie.email),
    bookingStatus: b.bookingStatus,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const responseBody: BookingApiResponse = { items, total, page, pageSize };

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  });
}
