import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { server as featureFlags } from "@/lib/feature-flags";
import { centerPart } from "@/utils/users";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownerEmpCode: string | undefined = body?.ownerEmpCode;
    const timeStartRaw: string | undefined = body?.timeStart;
    const timeEndRaw: string | undefined = body?.timeEnd;
    const meetingType: string | undefined = body?.meetingType;

    if (!ownerEmpCode || !timeStartRaw || !timeEndRaw || !meetingType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const emp = await prisma.employee.findUnique({
      where: { empCode: ownerEmpCode },
      select: { deptPath: true },
    });

    let environmentId: number | null = null;
    if (emp?.deptPath) {
      const c = centerPart(emp.deptPath);
      if (c) {
        const envC = await prisma.environmentCenter.findUnique({
          where: { center: c },
          select: { environmentId: true },
        });
        environmentId = envC?.environmentId ?? null;
      }
    }

    const timeStart = new Date(timeStartRaw);
    const timeEnd = new Date(timeEndRaw);

    // If forwarding is disabled, always indicate not eligible
    if (!featureFlags.enableForwardUser) {
      return NextResponse.json({
        success: true,
        data: {
          forwardSuggestion: {
            eligible: false,
            capacityFull: false,
            urgent: false,
            environmentId,
          },
        },
      });
    }

    // If we cannot detect environment, play it safe and ask user first
    if (environmentId == null) {
      return NextResponse.json({
        success: true,
        data: {
          forwardSuggestion: {
            eligible: true,
            capacityFull: false,
            urgent: false,
            environmentId: null,
          },
        },
      });
    }

    // Capacity full in user's environment
    let capacityFull = false;
    if (environmentId != null) {
      const rows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
        SELECT COUNT(DISTINCT bp.INTERPRETER_EMP_CODE) AS cnt
        FROM BOOKING_PLAN bp
        JOIN ENVIRONMENT_INTERPRETER ei ON ei.INTERPRETER_EMP_CODE = bp.INTERPRETER_EMP_CODE AND ei.ENVIRONMENT_ID = ${environmentId}
        WHERE bp.INTERPRETER_EMP_CODE IS NOT NULL
          AND bp.BOOKING_STATUS IN ('approve','waiting')
          AND (bp.TIME_START < ${timeEnd} AND bp.TIME_END > ${timeStart})
      `;
      const busy = rows?.[0]?.cnt != null ? Number(rows[0].cnt) : 0;
      const total = await prisma.environmentInterpreter.count({
        where: { environmentId },
      });
      capacityFull = total <= 0 ? true : total - busy <= 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        forwardSuggestion: {
          eligible: capacityFull,
          capacityFull,
          urgent: false,
          environmentId,
        },
      },
    });
  } catch (error) {
    console.error("Preflight failed", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
