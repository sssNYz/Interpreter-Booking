import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

import type {
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
  MeetingType,
} from "@/types/admin-dashboard";
import {
  MONTH_LABELS,
  OWNER_GROUPS,
} from "@/types/admin-dashboard";
import {
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
  try {
    const { year: paramYear } = await ctx.params;
    const queryYear = req.nextUrl.searchParams.get("year") ?? undefined;

    let yearNum = parseYearParam(paramYear ?? queryYear ?? new Date().getUTCFullYear().toString());
    if (!yearNum) {
      yearNum = new Date().getUTCFullYear();
    }

    const dateRange = createDateRange(yearNum);

    // Fetch minimal fields needed for aggregation
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
        ownerGroup: true,
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


    const zeroOwnerGroup = (): Record<OwnerGroup, number> => ({
      iot: 0, hardware: 0, software: 0, other: 0,
    });

    const zeroMeetingType = (): Record<MeetingType, number> => ({
      DR: 0, VIP: 0, Weekly: 0, General: 0, Augent: 0, PDR: 0, Other: 0,
    });


    const yearData: MonthlyDataRow[] = MONTH_LABELS.map((m): MonthlyDataRow => {
      const jobsByInterpreter: Record<InterpreterName, number> = {};
      const hoursByInterpreter: Record<InterpreterName, number> = {};
      const deptByInterpreter: Record<InterpreterName, Record<OwnerGroup, number>> = {};
      const typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>> = {};

      for (const itp of interpreters) {
        jobsByInterpreter[itp] = 0;
        hoursByInterpreter[itp] = 0;
        deptByInterpreter[itp] = zeroOwnerGroup();
        typeByInterpreter[itp] = zeroMeetingType();
      }

      return {
        year: yearNum,
        month: m,
        jobsByInterpreter,
        hoursByInterpreter,
        deptMeetings: zeroOwnerGroup(),
        deptByInterpreter,
        typeByInterpreter,
      };
    });

    // Aggregate counts per month per interpreter
    for (const r of records) {
      const monthLabel = getMonthLabel(new Date(r.timeStart));
      const row = yearData[MONTH_LABELS.indexOf(monthLabel)];

      const dept = r.ownerGroup as OwnerGroup;
      row.deptMeetings[dept] += 1;

      const itp = empCodeToName.get(r.interpreterEmpCode as string);
      if (itp) { // Only process if interpreter is still active
        row.deptByInterpreter[itp][dept] += 1;
      }
    }

    
    const perInterpreter: number[] = interpreters.map((itp) =>
      yearData.reduce((sumMonths, r) => {
        let perMonthSum = 0;
        for (const g of OWNER_GROUPS) {
          perMonthSum += r.deptByInterpreter[itp][g] ?? 0;
        }
        return sumMonths + perMonthSum;
      }, 0)
    );

    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff  = perInterpreter.length ? Math.max(...perInterpreter) - Math.min(...perInterpreter) : 0;

    const footer: FooterByInterpreter = { perInterpreter, grand, diff };

    const result = {
      months: MONTH_LABELS,
      interpreters,
      departments: OWNER_GROUPS,
      year: yearNum,
      yearData,
      deptMGIFooter: footer,
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
