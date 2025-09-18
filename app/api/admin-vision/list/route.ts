import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type ListBody = { adminEmpCode?: string };

// List scopes assigned to an admin
export async function POST(req: NextRequest) {
	try {
		let body: ListBody = {};
		try {
			body = (await req.json()) as ListBody;
		} catch {}
		const adminEmpCode = (body.adminEmpCode ?? "").trim();
		if (!adminEmpCode) return NextResponse.json({ error: "adminEmpCode is required" }, { status: 400 });
		const rows = await prisma.adminVision.findMany({
			where: { adminEmpCode },
			orderBy: { deptPath: "asc" },
		});
		return NextResponse.json(rows);
	} catch (err) {
		console.error("POST /api/admin-vision/list error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}


