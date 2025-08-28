import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// Use your shared types
import {
  MonthName,
  HoursRow,
  FooterByInterpreter,
  InterpreterName,
} from "@/types/overview";

const MONTH_LABELS: MonthName[] = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

function getUtcMonthIndex(date: Date): number { return date.getUTCMonth(); }
function getMonthLabel(date: Date): MonthName { return MONTH_LABELS[getUtcMonthIndex(date)]; }

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

    let yearNum = Number(paramYear ?? queryYear ?? new Date().getUTCFullYear());
    if (!Number.isFinite(yearNum) || yearNum < 1970 || yearNum > 3000) {
      yearNum = new Date().getUTCFullYear();
    }

    const rangeStart = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0));

    // Fetch minimal fields needed for aggregation
    const records = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: rangeStart, lt: rangeEnd },
        interpreterEmpCode: { not: null },
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

    // Build interpreter display names (empCode -> InterpreterName)
    const empCodeToName = new Map<string, InterpreterName>();
    for (const r of records) {
      const empCode = r.interpreterEmpCode as string;
      const first = r.interpreterEmployee?.firstNameEn?.trim() ?? "";
      const last = r.interpreterEmployee?.lastNameEn?.trim() ?? "";
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

      const dispName = empCodeToName.get(r.interpreterEmpCode as string) as InterpreterName;
      row[dispName] = Number(row[dispName] ?? 0) + minutes;
      row.total += minutes;
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
