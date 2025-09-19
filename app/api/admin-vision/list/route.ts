import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

type ListBody = { adminEmpCode?: string };

// List scopes assigned to an admin
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        const parsed = verifySessionCookieValue(cookieValue);
        if (!parsed) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const requester = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } });
        const roles = requester?.userRoles?.map(r => r.roleCode) ?? [];

        let body: ListBody = {};
        try {
            body = (await req.json()) as ListBody;
        } catch {}
        const adminEmpCode = (body.adminEmpCode ?? "").trim();
        if (!adminEmpCode) return NextResponse.json({ error: "adminEmpCode is required" }, { status: 400 });

        // Only SUPER_ADMIN or the admin himself can list
        if (!(roles.includes("SUPER_ADMIN") || adminEmpCode === parsed.empCode)) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }
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


