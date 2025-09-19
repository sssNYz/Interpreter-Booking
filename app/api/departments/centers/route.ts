import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { centerPart } from "@/utils/users";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const rows = await prisma.employee.findMany({
      where: { deptPath: { not: null } },
      select: { deptPath: true },
      take: 10000,
    });

    const set = new Set<string>();
    for (const r of rows) {
      const c = centerPart(r.deptPath);
      if (c) set.add(c);
    }
    let centers = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    if (q) centers = centers.filter(c => c.toLowerCase().includes(q));

    return NextResponse.json({ success: true, data: centers });
  } catch (error) {
    console.error('Failed to fetch centers:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

