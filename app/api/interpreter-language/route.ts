import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { Prisma } from "@prisma/client";

type AssignBody = {
	empCode?: string;
	languageCode?: string;
};

// Create/assign one language to an interpreter
export async function POST(req: NextRequest) {
	try {
		let body: AssignBody = {};
		try {
			body = (await req.json()) as AssignBody;
		} catch {}
		const url = new URL(req.url);
		const empCode = (body.empCode ?? url.searchParams.get("empCode") ?? "").trim();
		const languageCode = (body.languageCode ?? url.searchParams.get("languageCode") ?? "").trim();
		if (!empCode || !languageCode) {
			return NextResponse.json({ error: "empCode and languageCode are required" }, { status: 400 });
		}

		// Ensure employee and language exist
		const [employee, language] = await Promise.all([
			prisma.employee.findUnique({ where: { empCode } }),
			prisma.language.findUnique({ where: { code: languageCode.toUpperCase() } }),
		]);
		if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
		if (!language) return NextResponse.json({ error: "Language not found" }, { status: 404 });

		const created = await prisma.interpreterLanguage.upsert({
			where: { unique_emp_language: { empCode, languageCode: language.code } },
			create: { empCode, languageCode: language.code },
			update: {},
		});

		return NextResponse.json({
			id: created.id,
			empCode: created.empCode,
			languageCode: created.languageCode,
			createdAt: created.createdAt,
		});
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			return NextResponse.json({ error: "Already assigned" }, { status: 409 });
		}
		console.error("POST /api/interpreter-language error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}

// Remove/unassign one language from an interpreter
export async function DELETE(req: NextRequest) {
	try {
		let empCode = "";
		let languageCode = "";
		// Try JSON body first
		try {
			const body = (await req.json()) as { empCode?: string; languageCode?: string };
			empCode = (body.empCode ?? "").trim();
			languageCode = (body.languageCode ?? "").trim();
		} catch {}
		// Fallback to query params if body empty
		if (!empCode || !languageCode) {
			const url = new URL(req.url);
			empCode = empCode || (url.searchParams.get("empCode") ?? "").trim();
			languageCode = languageCode || (url.searchParams.get("languageCode") ?? "").trim();
		}
		if (!empCode || !languageCode) {
			return NextResponse.json({ error: "empCode and languageCode are required" }, { status: 400 });
		}
		await prisma.interpreterLanguage.delete({
			where: { unique_emp_language: { empCode, languageCode: languageCode.toUpperCase() } },
		});
		return NextResponse.json({ ok: true });
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		console.error("DELETE /api/interpreter-language error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}

// List languages for an interpreter
export async function GET(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const empCode = (url.searchParams.get("empCode") ?? "").trim();
		if (!empCode) {
			return NextResponse.json({ error: "empCode is required" }, { status: 400 });
		}
		const rows = await prisma.interpreterLanguage.findMany({
			where: { empCode },
			include: { language: true },
			orderBy: { languageCode: "asc" },
		});
		return NextResponse.json(
			rows.map((r) => ({ id: r.id, empCode: r.empCode, languageCode: r.languageCode, languageName: r.language?.name ?? null }))
		);
	} catch (err: unknown) {
		console.error("GET /api/interpreter-language error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}


