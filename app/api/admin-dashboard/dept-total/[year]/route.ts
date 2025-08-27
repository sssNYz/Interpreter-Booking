import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// ✅ Use your shared types
import type {
  MonthName,
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
} from "@/types/overview";

const MONTH_LABELS: MonthName[] = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

const DEPARTMENTS: OwnerGroup[] = ["iot", "hardware", "software", "other"];

const getUtcMonthIndex = (d: Date) => d.getUTCMonth();
const getMonthLabel = (d: Date): MonthName => MONTH_LABELS[getUtcMonthIndex(d)];

type Params = { year?: string };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } // App Router: params may be a Promise -> must await
) {
  try {
    const { year: paramYear } = await ctx.params;
    const queryYear = req.nextUrl.searchParams.get("year") ?? undefined;

    let yearNum = Number(paramYear ?? queryYear ?? new Date().getUTCFullYear());
    if (!Number.isFinite(yearNum) || yearNum < 1970 || yearNum > 3000) {
      yearNum = new Date().getUTCFullYear();
    }

    const rangeStart = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0));
    const rangeEnd   = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0));

    // Pull only what we need for department aggregations
    const records = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: rangeStart, lt: rangeEnd },
        interpreterEmpCode: { not: null }, // only bookings with an interpreter
      },
      select: {
        timeStart: true,
        ownerGroup: true,
        interpreterEmpCode: true,
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Map empCode -> display name (first last OR empCode)
    const empCodeToName = new Map<string, InterpreterName>();
    for (const r of records) {
      const empCode = r.interpreterEmpCode as string;
      const first = r.interpreterEmployee?.firstNameEn?.trim() ?? "";
      const last  = r.interpreterEmployee?.lastNameEn?.trim() ?? "";
      const name  = (`${first} ${last}`.trim() || empCode) as InterpreterName;
      empCodeToName.set(empCode, name);
    }

    const interpreters: InterpreterName[] = Array.from(new Set(empCodeToName.values()))
      .sort((a, b) => a.localeCompare(b));

    // Build 12 month rows conforming to MonthlyDataRow
    const yearData: MonthlyDataRow[] = MONTH_LABELS.map((m) => {
      // Initialize zeros for every interpreter and group
      const jobsByInterpreter: Record<InterpreterName, number> = {} as any;
      const hoursByInterpreter: Record<InterpreterName, number> = {} as any;
      const deptByInterpreter: Record<InterpreterName, Record<OwnerGroup, number>> = {} as any;
      const typeByInterpreter: Record<InterpreterName, Record<any, number>> = {} as any;

      for (const itp of interpreters) {
        jobsByInterpreter[itp] = 0;
        hoursByInterpreter[itp] = 0;
        deptByInterpreter[itp] = { iot: 0, hardware: 0, software: 0, other: 0 };
        // You’re not using meeting types in this tab, but the shape requires it
        typeByInterpreter[itp] = {} as Record<any, number>;
      }

      return {
        year: yearNum,
        month: m,
        jobsByInterpreter,
        hoursByInterpreter,
        deptMeetings: { iot: 0, hardware: 0, software: 0, other: 0 },
        deptByInterpreter,
        typeByInterpreter,
      };
    });

    // Aggregate: per-month department totals + per-interpreter per-department
    for (const r of records) {
      const start = new Date(r.timeStart);
      const monthLabel = getMonthLabel(start);
      const row = yearData[MONTH_LABELS.indexOf(monthLabel)];

      const dept = r.ownerGroup as OwnerGroup; // Prisma enum aligns with your union
      row.deptMeetings[dept] += 1;

      const itp = empCodeToName.get(r.interpreterEmpCode as string) as InterpreterName;
      row.deptByInterpreter[itp][dept] += 1;
    }

    // Footer: per-interpreter totals across ALL months & ALL groups
    const perInterpreter: FooterByInterpreter["perInterpreter"] = interpreters.map((itp) =>
      yearData.reduce((sumMonths, r) => {
        const perMonthSum = DEPARTMENTS.reduce(
          (s, g) => s + (r.deptByInterpreter[itp]?.[g] ?? 0),
          0
        );
        return sumMonths + perMonthSum;
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff  = perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    return NextResponse.json({
      months: MONTH_LABELS,
      interpreters,
      departments: DEPARTMENTS,
      year: yearNum,
      yearData,
      // “Month × Group × Interpreter” footer for your big table
      deptMGIFooter: { perInterpreter, grand, diff } as FooterByInterpreter,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: (e as Error).message ?? "Server error" },
      { status: 500 }
    );
  }
}
