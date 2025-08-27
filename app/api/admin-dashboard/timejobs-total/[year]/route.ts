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

    const empCodeToName = new Map<string, string>();
    for (const r of records) {
      const empCode = r.interpreterEmpCode as string;
      const first = r.interpreterEmployee?.firstNameEn?.trim() ?? "";
      const last = r.interpreterEmployee?.lastNameEn?.trim() ?? "";
      const name = `${first} ${last}`.trim() || empCode;
      empCodeToName.set(empCode, name);
    }
    const interpreters = Array.from(new Set(Array.from(empCodeToName.values()))).sort((a, b) => a.localeCompare(b));

    type Row = { month: MonthName; total: number } & Record<string, number | MonthName>;
    const rows: Row[] = MONTH_LABELS.map<Row>((m) => ({ month: m, total: 0 }));

    for (const r of records) {
      const start = new Date(r.timeStart);
      const end = new Date(r.timeEnd);
      const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      const m = getMonthLabel(start);
      const rowIndex = MONTH_LABELS.indexOf(m);
      const row = rows[rowIndex] ?? rows[getUtcMonthIndex(start)];
      const dispName = empCodeToName.get(r.interpreterEmpCode as string) as string;
      row[dispName] = (Number(row[dispName] ?? 0)) + minutes;
      row.total += minutes;
    }

    for (const row of rows) {
      for (const itp of interpreters) {
        if (typeof row[itp] !== "number") row[itp] = 0;
      }
    }

    const perInterpreter = interpreters.map((itp) => rows.reduce((sum, r) => sum + (r[itp] as number), 0));
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    return NextResponse.json({
      months: MONTH_LABELS,
      interpreters,
      totalHoursLineMinutes: rows,
      hoursFooter: { perInterpreter, grand, diff },
      year: yearNum,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}


