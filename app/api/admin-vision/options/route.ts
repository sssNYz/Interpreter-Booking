import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// Get distinct department paths from employees (for selecting scopes)
export async function GET() {
	try {
		const rows = await prisma.employee.findMany({
			where: { deptPath: { not: null } },
			select: { deptPath: true },
		});
		const set = new Set<string>();
		for (const r of rows) {
			if (r.deptPath) set.add(r.deptPath);
		}
		return NextResponse.json(Array.from(set).sort());
	} catch (err) {
		console.error("GET /api/admin-vision/options error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}


