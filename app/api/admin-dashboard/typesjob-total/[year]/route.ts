import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// ===== ใช้ type กลางของคุณ =====
import type {
  MonthName,
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  MeetingType,
} from "@/types/overview";
import type { DRType } from "@/types/overview";

// ===== ค่าคงที่ =====
const MONTH_LABELS: MonthName[] = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

// หมวด MeetingType ที่ไม่ใช่ DR (ใช้ในผลรวม/ตาราง)
const NON_DR_TYPES: ReadonlyArray<MeetingType> = [
  "VIP", "Weekly", "General", "Augent", "Other",
];

// DR ย่อยที่ต้องการนับ (สอดคล้องกับ UI)
const DR_SUBTYPES: ReadonlyArray<DRType> = ["DR_I", "DR_II", "DR_k", "PR_PR"];

// ===== Helpers =====
type Params = { year?: string };

const getUtcMonthIndex = (d: Date) => d.getUTCMonth();
const getMonthLabel = (d: Date): MonthName => MONTH_LABELS[getUtcMonthIndex(d)];

// เพิ่มฟิลด์ drTypeByInterpreter ให้กับ MonthlyDataRow เดิมของคุณ (แบบ type-safe)
type MonthlyDataRowWithDR = MonthlyDataRow & {
  drTypeByInterpreter: Record<InterpreterName, Record<DRType, number>>;
};

// สร้าง object 0 สำหรับ MeetingType ทั้งหมด
function zeroMeetingTypes(): Record<MeetingType, number> {
  return {
    DR: 0,
    VIP: 0,
    Weekly: 0,
    General: 0,
    Augent: 0,
    Other: 0,
  };
}

// สร้าง object 0 สำหรับ DRType ทั้งหมด (รวม Other เผื่อในอนาคต/ข้อมูล)
function zeroDRTypes(): Record<DRType, number> {
  return {
    PR_PR: 0,
    DR_k: 0,
    DR_II: 0,
    DR_I: 0,
    Other: 0,
  };
}

// ===== Handler =====
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<Params> } // ✅ ต้อง await ตาม App Router
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

    // ดึงเฉพาะฟิลด์ที่ต้องใช้
    const records = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: rangeStart, lt: rangeEnd },
        interpreterEmpCode: { not: null },
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

    // สร้าง display name ของล่ามจาก empCode
    const empCodeToName = new Map<string, InterpreterName>();
    for (const r of records) {
      const empCode = r.interpreterEmpCode as string;
      const first = (r.interpreterEmployee?.firstNameEn ?? "").trim();
      const last  = (r.interpreterEmployee?.lastNameEn ?? "").trim();
      const name: InterpreterName = ( `${first} ${last}`.trim() || empCode ) as InterpreterName;
      empCodeToName.set(empCode, name);
    }

    const interpreters: InterpreterName[] = Array.from(new Set(empCodeToName.values()))
      .sort((a, b) => a.localeCompare(b));

    // เตรียม yearData 12 เดือน (type-safe) ใส่ทั้ง typeByInterpreter และ drTypeByInterpreter
    const yearData: MonthlyDataRowWithDR[] = MONTH_LABELS.map((m): MonthlyDataRowWithDR => {
      const jobsByInterpreter: Record<InterpreterName, number> = {};
      const hoursByInterpreter: Record<InterpreterName, number> = {};
      const typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>> = {};
      const drTypeByInterpreter: Record<InterpreterName, Record<DRType, number>> = {};

      // คีย์อื่น ๆ ของ MonthlyDataRow ที่ไม่ใช้ในแท็บนี้ ให้ init เป็น 0/ว่างไว้
      const deptMeetings = { iot: 0, hardware: 0, software: 0, other: 0 };
      const deptByInterpreter = {} as MonthlyDataRow["deptByInterpreter"];

      for (const itp of interpreters) {
        jobsByInterpreter[itp] = 0;
        hoursByInterpreter[itp] = 0;
        typeByInterpreter[itp] = zeroMeetingTypes();
        drTypeByInterpreter[itp] = zeroDRTypes();
        // ให้ตรง type MonthlyDataRow
        deptByInterpreter[itp] = { iot: 0, hardware: 0, software: 0, other: 0 };
      }

      return {
        year: yearNum,
        month: m,
        jobsByInterpreter,
        hoursByInterpreter,
        // ไม่ได้ใช้ฝั่ง Dept ในแท็บนี้ แต่คงโครงสร้างตาม type ของคุณ
        deptMeetings,
        deptByInterpreter,
        typeByInterpreter,
        drTypeByInterpreter, // <- เพิ่มฟิลด์นี้ให้ฝั่ง UI ใช้อ่านค่า DR1/DR2/DRK/PR
      };
    });

    // รวมข้อมูลลง yearData
    for (const r of records) {
      const monthLabel = getMonthLabel(new Date(r.timeStart));
      const row = yearData[MONTH_LABELS.indexOf(monthLabel)];
      const itp = empCodeToName.get(r.interpreterEmpCode as string) as InterpreterName;

      // นับ MeetingType หลักเสมอ
      const mt = r.meetingType as MeetingType;
      row.typeByInterpreter[itp][mt] += 1;

      // ถ้าเป็น DR และมี drType ให้ลงกลุ่มย่อยด้วย
      if (mt === "DR" && r.drType) {
        const dt = r.drType as DRType;
        row.drTypeByInterpreter[itp][dt] += 1;
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
    return NextResponse.json({
      months: MONTH_LABELS,
      interpreters,
      year: yearNum,
      yearData,
      typesMGIFooter,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: (e as Error).message ?? "Server error" },
      { status: 500 }
    );
  }
}
