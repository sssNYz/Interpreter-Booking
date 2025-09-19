import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

type AssignBody = {
	adminEmpCode?: string;
	deptPath?: string;
};

// Assign one deptPath scope to an admin
export async function POST(req: NextRequest) {
    try {
        // Only SUPER_ADMIN can modify admin scopes
        const cookieStore = await cookies();
        const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        const parsed = verifySessionCookieValue(cookieValue);
        if (!parsed) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const me = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } });
        const roles = me?.userRoles?.map(r => r.roleCode) ?? [];
        if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

        let body: AssignBody = {};
        try {
            body = (await req.json()) as AssignBody;
        } catch {}
		const adminEmpCode = (body.adminEmpCode ?? "").trim();
		const deptPath = (body.deptPath ?? "").trim();
		if (!adminEmpCode || !deptPath) {
			return NextResponse.json(
				{ error: "adminEmpCode and deptPath are required" },
				{ status: 400 }
			);
		}

		// Ensure admin employee exists
		const employee = await prisma.employee.findUnique({ where: { empCode: adminEmpCode } });
		if (!employee) return NextResponse.json({ error: "Admin employee not found" }, { status: 404 });

		const created = await prisma.adminVision.upsert({
			where: { unique_admin_dept: { adminEmpCode, deptPath } },
			create: { adminEmpCode, deptPath },
			update: {},
		});

		return NextResponse.json({
			id: created.id,
			adminEmpCode: created.adminEmpCode,
			deptPath: created.deptPath,
			createdAt: created.createdAt,
		});
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			return NextResponse.json({ error: "Already assigned" }, { status: 409 });
		}
		console.error("POST /api/admin-vision error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}

// Unassign one deptPath scope from an admin
export async function DELETE(req: NextRequest) {
    try {
        // Only SUPER_ADMIN can modify admin scopes
        const cookieStore = await cookies();
        const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        const parsed = verifySessionCookieValue(cookieValue);
        if (!parsed) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        const me = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } });
        const roles = me?.userRoles?.map(r => r.roleCode) ?? [];
        if (!roles.includes("SUPER_ADMIN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

        let adminEmpCode = "";
        let deptPath = "";
        try {
            const body = (await req.json()) as AssignBody;
            adminEmpCode = (body.adminEmpCode ?? "").trim();
			deptPath = (body.deptPath ?? "").trim();
		} catch {}
		if (!adminEmpCode || !deptPath) {
			return NextResponse.json(
				{ error: "adminEmpCode and deptPath are required" },
				{ status: 400 }
			);
		}
		await prisma.adminVision.delete({
			where: { unique_admin_dept: { adminEmpCode, deptPath } },
		});
		return NextResponse.json({ ok: true });
	} catch (err: unknown) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		console.error("DELETE /api/admin-vision error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}


