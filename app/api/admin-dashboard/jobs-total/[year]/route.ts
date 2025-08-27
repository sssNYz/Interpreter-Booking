import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type MonthName = "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec";

const MONTH_LABELS: MonthName[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getUtcMonthIndex(date: Date): number { return date.getUTCMonth(); }
function getMonthLabel(date: Date): MonthName { return MONTH_LABELS[getUtcMonthIndex(date)]; }

export async function GET(req: Request, ctx: { params: { year?: string } }) {
  try {
    const url = new URL(req.url);
    const paramYear = ctx.params?.year ?? undefined;
    const queryYear = url.searchParams.get("year") ?? undefined;
    let yearNum = Number(paramYear ?? queryYear ?? new Date().getUTCFullYear());
    if (!Number.isFinite(yearNum) || yearNum < 1970 || yearNum > 3000) yearNum = new Date().getUTCFullYear();

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
        interpreterEmpCode: true,
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Build interpreter display names
    const empCodeToName = new Map<string, string>();
    for (const r of records) {
      const empCode = r.interpreterEmpCode as string;
      const first = r.interpreterEmployee?.firstNameEn?.trim() ?? "";
      const last = r.interpreterEmployee?.lastNameEn?.trim() ?? "";
      const name = `${first} ${last}`.trim() || empCode;
      empCodeToName.set(empCode, name);
    }

    const interpreters = Array.from(new Set(Array.from(empCodeToName.values()))).sort((a, b) => a.localeCompare(b));

    // Initialize month rows
    type Row = { month: MonthName; total: number } & Record<string, number | MonthName>;
    const rows: Row[] = MONTH_LABELS.map<Row>((m) => ({ month: m, total: 0 }));

    // Aggregate counts per month per interpreter
    for (const r of records) {
      const d = new Date(r.timeStart);
      const m = getMonthLabel(d);
      const rowIndex = MONTH_LABELS.indexOf(m);
      const row = rows[rowIndex] ?? rows[getUtcMonthIndex(d)];
      const dispName = empCodeToName.get(r.interpreterEmpCode as string) as string;
      row[dispName] = (Number(row[dispName] ?? 0)) + 1;
      row.total += 1;
    }

    // Ensure all interpreter keys exist on each row (fill zeros)
    for (const row of rows) {
      for (const itp of interpreters) {
        if (typeof row[itp] !== "number") row[itp] = 0;
      }
    }

    // Footer
    const perInterpreter = interpreters.map((itp) => rows.reduce((sum, r) => sum + (r[itp] as number), 0));
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    return NextResponse.json({
      months: MONTH_LABELS,
      interpreters,
      totalJobsStack: rows,
      jobsFooter: { perInterpreter, grand, diff },
      year: yearNum,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}


