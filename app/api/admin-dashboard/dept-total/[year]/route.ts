// app/api/admin-dashboard/dept/[year]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// ใช้ type กลางของคุณ
import type {
  MonthName,
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
  MeetingType,
} from "@/types/overview";

const MONTH_LABELS: MonthName[] = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

const DEPARTMENTS: OwnerGroup[] = ["iot", "hardware", "software", "other"];
const MEETING_TYPES: MeetingType[] = ["DR", "VIP", "Weekly", "General", "Augent", "Other"];

type Params = { year?: string };

const getUtcMonthIndex = (d: Date) => d.getUTCMonth();
const getMonthLabel = (d: Date): MonthName => MONTH_LABELS[getUtcMonthIndex(d)];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } // ต้อง await ตาม App Router
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

    // ดึงเฉพาะ field ที่ต้องใช้
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
        ownerGroup: true,
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

    // สร้าง mapping empCode -> display name จาก active interpreters
    const empCodeToName: Map<string, InterpreterName> = new Map();
    for (const interpreter of activeInterpreters) {
      const empCode = interpreter.empCode;
      const first = (interpreter.firstNameEn ?? "").trim();
      const last  = (interpreter.lastNameEn ?? "").trim();
      const name: InterpreterName = ( `${first} ${last}`.trim() || empCode ) as InterpreterName;
      empCodeToName.set(empCode, name);
    }

    const interpreters: InterpreterName[] = Array.from(new Set(empCodeToName.values()))
      .sort((a, b) => a.localeCompare(b));

    // สร้าง helper สำหรับ zero objects ให้ตรง type
    const zeroOwnerGroup = (): Record<OwnerGroup, number> => ({
      iot: 0, hardware: 0, software: 0, other: 0,
    });

    const zeroMeetingType = (): Record<MeetingType, number> => ({
      DR: 0, VIP: 0, Weekly: 0, General: 0, Augent: 0, Other: 0,
    });

    // เตรียม yearData 12 เดือน ให้ตรง MonthlyDataRow แบบ type-safe
    const yearData: MonthlyDataRow[] = MONTH_LABELS.map((m): MonthlyDataRow => {
      const jobsByInterpreter: Record<InterpreterName, number> = {};
      const hoursByInterpreter: Record<InterpreterName, number> = {};
      const deptByInterpreter: Record<InterpreterName, Record<OwnerGroup, number>> = {};
      const typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>> = {};

      for (const itp of interpreters) {
        jobsByInterpreter[itp] = 0;
        hoursByInterpreter[itp] = 0;
        deptByInterpreter[itp] = zeroOwnerGroup();
        typeByInterpreter[itp] = zeroMeetingType(); // แม้แท็บนี้ยังไม่ใช้ แต่คงโครงสร้างให้ครบ
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

    // รวมค่า: ต่อเดือน × แผนก และ ต่อเดือน × แผนก × ล่าม
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

    // Footer รวมทั้งปีสำหรับตารางใหญ่: perInterpreter / grand / diff
    const perInterpreter: number[] = interpreters.map((itp) =>
      yearData.reduce((sumMonths, r) => {
        let perMonthSum = 0;
        for (const g of DEPARTMENTS) {
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
      departments: DEPARTMENTS,
      year: yearNum,
      yearData,
      deptMGIFooter: footer,
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
