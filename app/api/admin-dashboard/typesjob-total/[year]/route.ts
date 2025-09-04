import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// ===== ใช้ centralized admin dashboard types =====
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

// Using centralized utility functions from @/utils/admin-dashboard

// ===== Handler =====
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } // ✅ ต้อง await ตาม App Router
) {
  try {
    const { year: paramYear } = await ctx.params;
    const queryYear = req.nextUrl.searchParams.get("year") ?? undefined;

    let yearNum = parseYearParam(paramYear ?? queryYear ?? new Date().getUTCFullYear().toString());
    if (!yearNum) {
      yearNum = new Date().getUTCFullYear();
    }

    const dateRange = createDateRange(yearNum);

    // ดึงเฉพาะฟิลด์ที่ต้องใช้
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
        meetingType: true,   // <— ใช้สรุป MeetingType
        drType: true,        // <— ใช้สรุป DR แยกย่อย เมื่อ meetingType === 'DR'
        interpreterEmpCode: true,
        interpreterEmployee: {
          select: { firstNameEn: true, lastNameEn: true, empCode: true },
        },
      },
    });

    // Get all active interpreters for the year using consolidated utility
    const activeInterpreters = await fetchActiveInterpreters(prisma, dateRange);
    const { empCodeToName, interpreters } = createInterpreterMapping(activeInterpreters);

    // เตรียม yearData 12 เดือน (type-safe) ใส่ทั้ง typeByInterpreter และ drTypeByInterpreter
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
        drTypeByInterpreter, // <- เพิ่มฟิลด์นี้ให้ฝั่ง UI ใช้อ่านค่า DR1/DR2/DRK/PR
      };
    });

    // รวมข้อมูลลง yearData
    for (const r of records) {
      const monthLabel = getMonthLabel(new Date(r.timeStart));
      const row = yearData[MONTH_LABELS.indexOf(monthLabel)];
      const itp = empCodeToName.get(r.interpreterEmpCode as string);

      if (itp) { // Only process if interpreter is still active
        // นับ MeetingType หลักเสมอ
        const mt = r.meetingType as MeetingType;
        row.typeByInterpreter[itp][mt] += 1;

        // ถ้าเป็น DR และมี drType ให้ลงกลุ่มย่อยด้วย
        if (mt === "DR" && r.drType) {
          const dt = r.drType as DRType;
          row.drTypeByInterpreter[itp][dt] += 1;
        }
      }
    }

    // ===== Footer รวมทั้งปีสำหรับตารางใหญ่ใน TypesTab =====
    // ตาม UI: รวม DR แยกย่อย (DR_I, DR_II, DR_k, PR_PR) + MeetingType ที่ไม่ใช่ DR ทั้งหมด
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

    // ===== ส่งผลลัพธ์ =====
    const result = {
      months: MONTH_LABELS,
      interpreters,
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
