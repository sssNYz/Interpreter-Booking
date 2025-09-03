import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// Use your shared types
import {
  MonthName,
  HoursRow,
  FooterByInterpreter,
  InterpreterName,
  HoursApiResponse,
  MONTH_LABELS,
} from "@/types/admin-dashboard";
import {
  getUtcMonthIndex,
  getMonthLabel,
  calculateFooterStats,
  parseYearParam,
  createApiResponse,
  createErrorResponse,
} from "@/utils/admin-dashboard";

type Params = { year?: string };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } // params must be awaited in App Router
) {
  try {
    const url = req.nextUrl;

    // Await params before accessing
    const { year: paramYear } = await ctx.params;
    const queryYear = url.searchParams.get("year") ?? undefined;

    let yearNum = parseYearParam(paramYear ?? queryYear ?? new Date().getUTCFullYear().toString());
    if (!yearNum) {
      yearNum = new Date().getUTCFullYear();
    }

    const rangeStart = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0));

    // Fetch minimal fields needed for aggregation
    const records = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: rangeStart, lt: rangeEnd },
        interpreterEmpCode: { not: null },
        // IMPORTANT: Only include bookings where interpreter still exists and is active
        interpreterEmployee: {
          isActive: true
        }
      },
      select: {
        timeStart: true,
        timeEnd: true,
        interpreterEmpCode: true,
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Get all active interpreters for the year (even if they have no bookings)
    const activeInterpreters = await prisma.employee.findMany({
      where: {
        isActive: true,
        // Only include interpreters who have bookings in this year
        bookingsAsInterpreter: {
          some: {
            timeStart: { gte: rangeStart, lt: rangeEnd },
            interpreterEmpCode: { not: null }
          }
        }
      },
      select: {
        empCode: true,
        firstNameEn: true,
        lastNameEn: true,
      },
      orderBy: {
        firstNameEn: 'asc'
      }
    });

    // Build interpreter display names from active interpreters
    const empCodeToName = new Map<string, InterpreterName>();
    for (const interpreter of activeInterpreters) {
      const empCode = interpreter.empCode;
      const first = interpreter.firstNameEn?.trim() ?? "";
      const last = interpreter.lastNameEn?.trim() ?? "";
      const name = (`${first} ${last}`.trim() || empCode) as InterpreterName;
      empCodeToName.set(empCode, name);
    }

    const interpreters: InterpreterName[] = Array.from(new Set(empCodeToName.values()))
      .sort((a, b) => a.localeCompare(b));

    // ✅ Initialize rows AFTER we know interpreters, and pre-fill zeros
    const rows: HoursRow[] = MONTH_LABELS.map((m) => {
      const base: Record<string, number> = {};
      for (const itp of interpreters) base[itp] = 0;
      return { month: m, total: 0, ...base } as HoursRow;
    });

    // Aggregate minutes per month per interpreter
    for (const r of records) {
      const start = new Date(r.timeStart);
      const end = r.timeEnd ? new Date(r.timeEnd) : start; // guard against nulls
      const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

      const m = getMonthLabel(start);
      const rowIndex = MONTH_LABELS.indexOf(m);
      const row = rows[rowIndex] ?? rows[getUtcMonthIndex(start)];

      const dispName = empCodeToName.get(r.interpreterEmpCode as string);
      if (dispName) { // Only process if interpreter is still active
        row[dispName] = Number(row[dispName] ?? 0) + minutes;
        row.total += minutes;
      }
    }

    // Footer (typed)
    const perInterpreter: FooterByInterpreter["perInterpreter"] = interpreters.map((itp) =>
      rows.reduce((sum, r) => sum + (Number(r[itp]) || 0), 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff =
      perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    const result = {
      months: MONTH_LABELS,
      interpreters,
      totalHoursLineMinutes: rows,
      hoursFooter: { perInterpreter, grand, diff } as FooterByInterpreter,
      year: yearNum,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: (e as Error).message ?? "Server error" },
      { status: 500 }
    );
  }
}
