import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type ListBody = { empCode?: string };

export async function POST(req: NextRequest) {
	try {
		let body: ListBody = {};
		try {
			body = (await req.json()) as ListBody;
		} catch {}
		const empCode = (body.empCode ?? "").trim();
		if (!empCode) return NextResponse.json({ error: "empCode is required" }, { status: 400 });
		const rows = await prisma.interpreterLanguage.findMany({
			where: { empCode },
			include: { language: true },
			orderBy: { languageCode: "asc" },
		});
		return NextResponse.json(
			rows.map((r) => ({ id: r.id, empCode: r.empCode, languageCode: r.languageCode, languageName: r.language?.name ?? null }))
		);
	} catch (err) {
		console.error("POST /api/interpreter-language/list error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}


