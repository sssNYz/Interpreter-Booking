import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// Return list of employees who have ADMIN or SUPER_ADMIN role
export async function GET(_req: NextRequest) {
  try {
    const admins = await prisma.employee.findMany({
      where: {
        userRoles: {
          some: { roleCode: { in: ['ADMIN', 'SUPER_ADMIN'] } as any }
        },
        isActive: true,
      },
      select: { empCode: true, firstNameEn: true, lastNameEn: true },
      orderBy: { firstNameEn: 'asc' },
    });
    const data = admins.map(a => ({
      id: a.empCode,
      name: `${a.firstNameEn || ''} ${a.lastNameEn || ''}`.trim()
    }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch admins:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

