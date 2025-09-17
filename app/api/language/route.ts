import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { Prisma } from "@prisma/client";

type CreateLanguageBody = {
	code?: string;
	name?: string;
	isActive?: boolean;
};

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as CreateLanguageBody;
		const rawCode = (body.code ?? "").trim();
		const rawName = (body.name ?? "").trim();
		const isActive = body.isActive ?? true;

		if (!rawCode || !rawName) {
			return NextResponse.json(
				{ error: "code and name are required" },
				{ status: 400 }
			);
		}

		// Normalize: code uppercase, name title-case-ish (keep as given if you prefer)
		const code = rawCode.toUpperCase();
		const name = rawName;

		const created = await prisma.language.create({
			data: { code, name, isActive },
		});

		return NextResponse.json({
			id: created.id,
			code: created.code,
			name: created.name,
			isActive: created.isActive,
			createdAt: created.createdAt,
			updatedAt: created.updatedAt,
		});
	} catch (err: unknown) {
		// Handle unique violation (P2002)
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			return NextResponse.json(
				{ error: "Language code or name already exists" },
				{ status: 409 }
			);
		}
		console.error("POST /api/language error", err);
		return NextResponse.json(
			{ error: "Internal error" },
			{ status: 500 }
		);
	}
}


