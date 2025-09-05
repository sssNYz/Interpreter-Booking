import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

import {
  JobsRow,
  FooterByInterpreter,
  MONTH_LABELS,
} from "@/types/admin-dashboard";
import {
  getUtcMonthIndex,
  getMonthLabel,
  parseYearParam,
  createDateRange,
  fetchActiveInterpreters,
  createInterpreterMapping,
  createApiResponseHeaders,
} from "@/utils/admin-dashboard";

type Params = { year?: string };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } 
) {
  // Add caching headers for better performance
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  try {
    const url = req.nextUrl;

    const { year: paramYear } = await ctx.params;
    const queryYear = url.searchParams.get("year") ?? undefined;

    let yearNum = parseYearParam(paramYear ?? queryYear ?? new Date().getUTCFullYear().toString());
    if (!yearNum) {
      yearNum = new Date().getUTCFullYear();
    }

    const dateRange = createDateRange(yearNum);

    // Fetch minimal fields needed for aggregation
    const records = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: dateRange.start, lt: dateRange.end },
        interpreterEmpCode: { not: null },
        // IMPORTANT: Only include bookings where interpreter still exists and is active
        interpreterEmployee: {
          isActive: true
        }
      },
      select: {
        timeStart: true,
        interpreterEmpCode: true,
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Get all active interpreters for the year using consolidated utility
    const activeInterpreters = await fetchActiveInterpreters(prisma, dateRange);
    const { empCodeToName, interpreters } = createInterpreterMapping(activeInterpreters);

    // Initialize month rows
    const rows = MONTH_LABELS.map<JobsRow>((m) => ({ month: m, total: 0 } as JobsRow));

    // Aggregate counts per month per interpreter
    for (const r of records) {
      const d = new Date(r.timeStart);
      const m = getMonthLabel(d);
      const rowIndex = MONTH_LABELS.indexOf(m);
      const row = rows[rowIndex] ?? rows[getUtcMonthIndex(d)];

      const dispName = empCodeToName.get(r.interpreterEmpCode as string);
      if (dispName) { // Only process if interpreter is still active
        row[dispName] = Number(row[dispName] ?? 0) + 1;
        row.total += 1;
      }
    }

    // Ensure all interpreter keys exist on each row (fill zeros)
    for (const row of rows) {
      for (const itp of interpreters) {
        if (typeof row[itp] !== "number") row[itp] = 0;
      }
    }


    const perInterpreter: FooterByInterpreter["perInterpreter"] = interpreters.map((itp) =>
      rows.reduce((sum, r) => sum + (Number(r[itp]) || 0), 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff =
      perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    const result = {
      months: MONTH_LABELS,
      interpreters,
      totalJobsStack: rows,
      jobsFooter: { perInterpreter, grand, diff } as FooterByInterpreter,
      year: yearNum,
    };

    return NextResponse.json(result, {
      headers: createApiResponseHeaders(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: (e as Error).message ?? "Server error" }, { status: 500 });
  }
}
