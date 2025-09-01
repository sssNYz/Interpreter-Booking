import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Assignment Logs API
 *
 * - Shows logs only when interpreter still exists & is active
 * - Deduplicates by bookingId (keep most recent createdAt)
 * - Optional filters: status, interpreterEmpCode, search, from/to
 * - Supports mode=all (or no page/pageSize) => return all after dedupe
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ===== Parse query params =====
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100); // cap 100
    const status = searchParams.get("status");
    const interpreterEmpCode = searchParams.get("interpreterEmpCode");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const sort = searchParams.get("sort") || "createdAt:desc";
    const mode = (searchParams.get("mode") || "").toLowerCase();

    const hasExplicitPaging = searchParams.has("page") || searchParams.has("pageSize");

    // ===== Build where conditions =====
    const whereConditions: Prisma.AssignmentLogWhereInput = {};

    if (status && status !== "all" && status.trim()) {
      whereConditions.status = status.trim();
    }

    if (interpreterEmpCode && interpreterEmpCode.trim()) {
      whereConditions.interpreterEmpCode = interpreterEmpCode.trim();
    }

    // Only show logs where interpreter still exists and is active
    // (matches previous behavior)
    whereConditions.interpreterEmployee = {
      isActive: true,
    };

    // Date filtering — apply only when both valid
    if (from && to && from.trim() && to.trim()) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        whereConditions.createdAt = {
          gte: fromDate,
          lte: toDate,
        };
      }
    }

    // Search: bookingId (number) or reason contains (text)
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim();
      const bookingId = parseInt(searchTerm);
      if (!isNaN(bookingId)) {
        whereConditions.bookingId = bookingId;
      } else {
        whereConditions.reason = { contains: searchTerm };
      }
    }

    // ===== Sort parse/validation =====
    const [sortField, sortOrder] = sort.split(":");
    const orderBy: Prisma.AssignmentLogOrderByWithRelationInput = {};
    if (sortField === "createdAt") {
      orderBy.createdAt = sortOrder === "asc" ? "asc" : "desc";
    } else if (sortField === "bookingId") {
      orderBy.bookingId = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    // ===== Query DB =====
    // Fetch full set (without pagination) -> dedupe -> (optionally) slice
    const [logs, totalDb] = await Promise.all([
      prisma.assignmentLog.findMany({
        where: whereConditions,
        select: {
          id: true,
          bookingId: true,
          interpreterEmpCode: true,
          status: true,
          reason: true,
          createdAt: true,
          preHoursSnapshot: true,
          postHoursSnapshot: true,
          scoreBreakdown: true,
          bookingPlan: {
            select: {
              meetingType: true,
              ownerGroup: true,
              timeStart: true,
              timeEnd: true,
              meetingRoom: true,
              drType: true,
              otherType: true,
              ownerEmpCode: true,
              employee: {
                select: {
                  empCode: true,
                  firstNameEn: true,
                  lastNameEn: true,
                  firstNameTh: true,
                  lastNameTh: true,
                },
              },
            },
          },
          interpreterEmployee: {
            select: {
              empCode: true,
              firstNameEn: true,
              lastNameEn: true,
              firstNameTh: true,
              lastNameTh: true,
            },
          },
        },
        orderBy,
      }),

      prisma.assignmentLog.count({ where: whereConditions }),
    ]);

    // ===== Summary for all active interpreters (unchanged) =====
    const summaryByInterpreter: Record<
      string,
      { assigned: number; approved: number; rejected: number }
    > = {};

    const summary = await prisma.assignmentLog.groupBy({
      by: ["interpreterEmpCode", "status"],
      where: {
        interpreterEmployee: { isActive: true },
      },
      _count: { status: true },
    });

    summary.forEach((item: { interpreterEmpCode: string | null; status: string; _count: { status: number } }) => {
      if (item.interpreterEmpCode) {
        if (!summaryByInterpreter[item.interpreterEmpCode]) {
          summaryByInterpreter[item.interpreterEmpCode] = { assigned: 0, approved: 0, rejected: 0 };
        }
        if (item.status === "assigned") {
          summaryByInterpreter[item.interpreterEmpCode].assigned = item._count.status;
        } else if (item.status === "approved") {
          summaryByInterpreter[item.interpreterEmpCode].approved = item._count.status;
        } else if (item.status === "rejected") {
          summaryByInterpreter[item.interpreterEmpCode].rejected = item._count.status;
        }
      }
    });

    // ===== Transform to plain JSON (dates -> ISO) =====
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      bookingId: log.bookingId,
      interpreterEmpCode: log.interpreterEmpCode,
      status: log.status,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
      preHoursSnapshot: log.preHoursSnapshot,
      postHoursSnapshot: log.postHoursSnapshot,
      scoreBreakdown: log.scoreBreakdown,
      bookingPlan: {
        meetingType: log.bookingPlan.meetingType,
        ownerGroup: log.bookingPlan.ownerGroup,
        timeStart: log.bookingPlan.timeStart.toISOString(),
        timeEnd: log.bookingPlan.timeEnd.toISOString(),
        meetingRoom: log.bookingPlan.meetingRoom,
        drType: log.bookingPlan.drType,
        otherType: log.bookingPlan.otherType,
        ownerEmpCode: log.bookingPlan.ownerEmpCode,
        employee: log.bookingPlan.employee
          ? {
              empCode: log.bookingPlan.employee.empCode,
              firstNameEn: log.bookingPlan.employee.firstNameEn,
              lastNameEn: log.bookingPlan.employee.lastNameEn,
              firstNameTh: log.bookingPlan.employee.firstNameTh,
              lastNameTh: log.bookingPlan.employee.lastNameTh,
            }
          : null,
      },
      interpreterEmployee: log.interpreterEmployee
        ? {
            empCode: log.interpreterEmployee.empCode,
            firstNameEn: log.interpreterEmployee.firstNameEn,
            lastNameEn: log.interpreterEmployee.lastNameEn,
            firstNameTh: log.interpreterEmployee.firstNameTh,
            lastNameTh: log.interpreterEmployee.lastNameTh,
          }
        : null,
    }));

    // ===== Dedupe by bookingId (keep most recent createdAt) =====
    const uniqueBookings = new Map<number, (typeof transformedLogs)[number]>();
    transformedLogs.forEach((log) => {
      const existing = uniqueBookings.get(log.bookingId);
      if (!existing || new Date(log.createdAt) > new Date(existing.createdAt)) {
        uniqueBookings.set(log.bookingId, log);
      }
    });
    const finalLogs = Array.from(uniqueBookings.values());

    // ===== Pagination behavior =====
    const shouldPaginate = mode !== "all" && hasExplicitPaging; // paginate only when explicitly requested & not all-mode

    let items = finalLogs;
    let pageOut = 1;
    let pageSizeOut = finalLogs.length || 1;
    let totalPagesOut = 1;

    if (shouldPaginate) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      items = finalLogs.slice(startIndex, endIndex);
      pageOut = page;
      pageSizeOut = pageSize;
      totalPagesOut = Math.max(1, Math.ceil(finalLogs.length / pageSize));
    }

    // ===== Response =====
    const jsonResponse = NextResponse.json({
      items,
      total: finalLogs.length,     // count AFTER dedupe (client expects this)
      page: pageOut,
      pageSize: pageSizeOut,
      totalPages: totalPagesOut,
      summary: { byInterpreter: summaryByInterpreter },
    });

    // Align headers with response (AFTER dedupe)
    jsonResponse.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    jsonResponse.headers.set("X-Total-Count", String(finalLogs.length));
    jsonResponse.headers.set("X-Page-Count", String(totalPagesOut));

    return jsonResponse;
  } catch (error) {
    console.error("Error fetching assignment logs:", error);
    return NextResponse.json({ error: "Failed to fetch assignment logs" }, { status: 500 });
  }
}
