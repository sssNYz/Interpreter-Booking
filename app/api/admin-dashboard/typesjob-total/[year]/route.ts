import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

import type {
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  MeetingType,
  DRType,
  MonthlyDataRowWithDR,
} from "@/types/admin-dashboard";
import {
  MONTH_LABELS,
} from "@/types/admin-dashboard";
import {
  getMonthLabel,
  parseYearParam,
  createZeroMeetingTypes,
  createZeroDRTypes,
  NON_DR_TYPES,
  DR_SUBTYPES,
  createDateRange,
  fetchActiveInterpreters,
  createInterpreterMapping,
  createApiResponseHeaders,
} from "@/utils/admin-dashboard";

// ===== Helpers =====
type Params = { year?: string };


// ===== Handler =====
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } 
) {
  try {
    const { year: paramYear } = await ctx.params;
    const queryYear = req.nextUrl.searchParams.get("year") ?? undefined;

    let yearNum = parseYearParam(paramYear ?? queryYear ?? new Date().getUTCFullYear().toString());
    if (!yearNum) {
      yearNum = new Date().getUTCFullYear();
    }

    const dateRange = createDateRange(yearNum);

    const recordsRaw = await prisma.bookingPlan.findMany({
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
        meetingType: true,
        drType: true,     
        interpreterEmpCode: true,
        employee: { select: { deptPath: true } },
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Vision filter (admin)
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    let records = recordsRaw;
    if (parsed) {
      const me = await prisma.employee.findUnique({
        where: { empCode: parsed.empCode },
        include: { userRoles: true },
      });
      const roles = me?.userRoles?.map(r => r.roleCode) ?? [];
      const isSuper = roles.includes("SUPER_ADMIN");
      const isAdmin = roles.includes("ADMIN") || isSuper;
      if (isAdmin && !isSuper) {
        const myCenter = centerPart(me?.deptPath ?? null);
        const envs = await prisma.environmentAdmin.findMany({
          where: { adminEmpCode: me!.empCode },
          select: { environment: { select: { centers: { select: { center: true } } } } },
        });
        const adminEnvCenters = envs.flatMap(e => e.environment.centers.map(c => c.center));
        const allow = new Set(adminEnvCenters.length ? adminEnvCenters : (myCenter ? [myCenter] : []));
        records = recordsRaw.filter(r => {
          const c = centerPart(r.employee?.deptPath ?? null);
          return c && allow.has(c);
        });
      }
    }

    // Get all active interpreters for the year using consolidated utility
    const activeInterpreters = await fetchActiveInterpreters(prisma, dateRange);
    const { empCodeToName, interpreters } = createInterpreterMapping(activeInterpreters);
    
    // Create interpreter ID mapping for consistent colors
    const interpreterIdMapping: Record<string, string> = {};
    for (const interpreter of activeInterpreters) {
      const name = empCodeToName.get(interpreter.empCode);
      if (name) {
        interpreterIdMapping[name] = interpreter.empCode;
      }
    }

    // prepare yearData 12 months with full MonthlyDataRowWithDR structure
    const yearData: MonthlyDataRowWithDR[] = MONTH_LABELS.map((m): MonthlyDataRowWithDR => {
      const typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>> = {};
      const drTypeByInterpreter: Record<InterpreterName, Record<DRType, number>> = {};

      for (const itp of interpreters) {
        typeByInterpreter[itp] = createZeroMeetingTypes();
        drTypeByInterpreter[itp] = createZeroDRTypes();
      }

      return {
        year: yearNum,
        month: m,
        // Initialize unused fields to satisfy MonthlyDataRow interface
        jobsByInterpreter: {},
        hoursByInterpreter: {},
        deptMeetings: { iot: 0, hardware: 0, software: 0, other: 0 },
        deptByInterpreter: {} as MonthlyDataRow["deptByInterpreter"],
        typeByInterpreter,
        drTypeByInterpreter, 
      };
    });

    // Aggregate counts per month per interpreter
    for (const r of records) {
      const monthLabel = getMonthLabel(new Date(r.timeStart));
      const row = yearData[MONTH_LABELS.indexOf(monthLabel)];
      const itp = empCodeToName.get(r.interpreterEmpCode as string);

      if (itp) { // Only process if interpreter is still active
        const mt = r.meetingType as MeetingType;
        row.typeByInterpreter[itp][mt] += 1;

        // If meeting type is DR, also count the drType subtype
        if (mt === "DR" && r.drType) {
          const dt = r.drType as DRType;
          row.drTypeByInterpreter[itp][dt] += 1;
        }
      }
    }

    const perInterpreter: number[] = interpreters.map((itp) =>
      yearData.reduce((sumMonths, r) => {
        let s = 0;
        // non-DR meeting types
        for (const mt of NON_DR_TYPES) {
          s += r.typeByInterpreter[itp][mt];
        }
        // DR subtypes
        for (const dt of DR_SUBTYPES) {
          s += r.drTypeByInterpreter[itp][dt];
        }
        return sumMonths + s;
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff  = perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    const typesMGIFooter: FooterByInterpreter = { perInterpreter, grand, diff };


    const result = {
      months: MONTH_LABELS,
      interpreters,
      interpreterIdMapping,
      year: yearNum,
      yearData,
      typesMGIFooter,
    };

    return NextResponse.json(result, {
      headers: createApiResponseHeaders(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: (e as Error).message ?? "Server error" },
      { status: 500 }
    );
  }
}
