import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const languageCode = searchParams.get('language');
    const timeStart = searchParams.get('timeStart'); // ISO string
    const timeEnd = searchParams.get('timeEnd');     // ISO string
    
    // Build where clause for interpreters
    const whereClause = {
      userRoles: {
        some: { roleCode: 'INTERPRETER' as const }
      },
      isActive: true,
      ...(languageCode && {
        interpreterLanguages: {
          some: { languageCode }
        }
      })
    };
    
    // If time range provided, filter out interpreters who have overlapping bookings
    if (timeStart && timeEnd) {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);

      // First, fetch interpreters that match role/language
      const baseInterpreters = await prisma.employee.findMany({
        where: whereClause,
        select: { empCode: true },
      });

      const empCodes = baseInterpreters.map(i => i.empCode);
      if (empCodes.length === 0) {
        return NextResponse.json([]);
      }

      // Find interpreters who are BUSY in that window
      const busy = await prisma.bookingPlan.findMany({
        where: {
          interpreterEmpCode: { in: empCodes },
          bookingStatus: { in: ['approve', 'waiting'] },
          AND: [
            { timeStart: { lt: end } },
            { timeEnd: { gt: start } },
          ],
        },
        select: { interpreterEmpCode: true },
        distinct: ['interpreterEmpCode'],
      });

      const busySet = new Set((busy || []).map(b => b.interpreterEmpCode).filter(Boolean) as string[]);
      const availableEmpCodes = empCodes.filter(c => !busySet.has(c));

      if (availableEmpCodes.length === 0) {
        return NextResponse.json([]);
      }

      // Return available interpreters with languages included
      const interpreters = await prisma.employee.findMany({
        where: { empCode: { in: availableEmpCodes } },
        include: {
          interpreterLanguages: { include: { language: true } },
        },
        orderBy: { firstNameEn: 'asc' },
      });

      return NextResponse.json(interpreters);
    }

    // Fallback: no time window -> return all matching interpreters
    const interpreters = await prisma.employee.findMany({
      where: whereClause,
      include: {
        interpreterLanguages: {
          include: { language: true }
        }
      },
      orderBy: { firstNameEn: 'asc' }
    });
    
    return NextResponse.json(interpreters);
  } catch (error) {
    console.error('Error fetching interpreters:', error);
    return NextResponse.json(
      { error: 'Internal error' }, 
      { status: 500 }
    );
  }
}
