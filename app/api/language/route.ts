import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { Prisma } from "@prisma/client";

type CreateLanguageBody = {
	code?: string;
	name?: string;
	isActive?: boolean;
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const activeParam = searchParams.get("active");
        const onlyActive = activeParam === "true";

        const languages = await prisma.language.findMany({
            where: onlyActive ? { isActive: true } : undefined,
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(languages);
    } catch (err: unknown) {
        console.error("GET /api/language error", err);
        return NextResponse.json(
            { error: "Internal error" },
            { status: 500 }
        );
    }
}

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

type UpdateLanguageBody = {
	id: number;
	code?: string;
	name?: string;
	isActive?: boolean;
};

export async function PUT(req: NextRequest) {
	try {
		const body = (await req.json()) as UpdateLanguageBody;
		const { id, code, name, isActive } = body;

		if (!id) {
			return NextResponse.json(
				{ error: "id is required" },
				{ status: 400 }
			);
		}

		const updateData: Partial<{ code: string; name: string; isActive: boolean }> = {};
		if (code !== undefined) updateData.code = code.trim().toUpperCase();
		if (name !== undefined) updateData.name = name.trim();
		if (isActive !== undefined) updateData.isActive = isActive;

		const updated = await prisma.language.update({
			where: { id },
			data: updateData,
		});

		return NextResponse.json({
			id: updated.id,
			code: updated.code,
			name: updated.name,
			isActive: updated.isActive,
			createdAt: updated.createdAt,
			updatedAt: updated.updatedAt,
		});
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			return NextResponse.json(
				{ error: "Language code or name already exists" },
				{ status: 409 }
			);
		}
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
			return NextResponse.json(
				{ error: "Language not found" },
				{ status: 404 }
			);
		}
		console.error("PUT /api/language error", err);
		return NextResponse.json(
			{ error: "Internal error" },
			{ status: 500 }
		);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json(
				{ error: "id is required" },
				{ status: 400 }
			);
		}

		await prisma.language.delete({
			where: { id: parseInt(id) },
		});

		return NextResponse.json({ success: true });
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
			return NextResponse.json(
				{ error: "Language not found" },
				{ status: 404 }
			);
		}
		console.error("DELETE /api/language error", err);
		return NextResponse.json(
			{ error: "Internal error" },
			{ status: 500 }
		);
	}
}


