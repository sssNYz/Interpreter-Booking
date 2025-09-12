import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeHistoric = searchParams.get("includeHistoric") === "1";

    // Current interpreters (role = INTERPRETER)
    const current = await prisma.employee.findMany({
      where: {
        userRoles: {
          some: {
            roleCode: 'INTERPRETER'
          }
        }
      },
      select: {
        empCode: true,
        firstNameEn: true,
        lastNameEn: true,
      }
    });

    const currentFormatted = current.map((it) => ({
      id: it.empCode,
      name: `${it.firstNameEn || ''} ${it.lastNameEn || ''}`.trim(),
      type: "current" as const,
    }));

    if (!includeHistoric) {
      // Backward compatible shape (array)
      return NextResponse.json({ success: true, data: currentFormatted });
    }

    // Historic interpreters from bookings in last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 3);

    const historicCodesRaw = await prisma.bookingPlan.findMany({
      where: {
        timeStart: { gte: twelveMonthsAgo },
        interpreterEmpCode: { not: null },
      },
      select: { interpreterEmpCode: true },
      distinct: ["interpreterEmpCode"],
      orderBy: { interpreterEmpCode: "asc" },
    });

    // Normalize and filter
    const currentIds = new Set(current.map((c) => c.empCode));
    const historicIds = Array.from(
      new Set(
        historicCodesRaw
          .map((r) => (r.interpreterEmpCode as string | null) || "")
          .filter((id) => id && !currentIds.has(id))
      )
    );

    let historicFormatted: Array<{ id: string; name: string; type: "historic" }> = [];
    if (historicIds.length > 0) {
      const historicEmployees = await prisma.employee.findMany({
        where: { empCode: { in: historicIds } },
        select: { empCode: true, firstNameEn: true, lastNameEn: true },
      });
      const nameById = new Map(
        historicEmployees.map((e) => [
          e.empCode,
          `${e.firstNameEn || ''} ${e.lastNameEn || ''}`.trim() || "(Unknown)",
        ])
      );
      historicFormatted = historicIds.map((id) => ({
        id,
        name: nameById.get(id) || "(Unknown)",
        type: "historic" as const,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        current: currentFormatted,
        historic: historicFormatted,
      },
    });
  } catch (error) {
    console.error("Failed to fetch interpreters:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
