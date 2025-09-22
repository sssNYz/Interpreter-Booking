import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) {
      return NextResponse.json({ ok: false, message: "Unauthenticated" }, { status: 401 });
    }

    const user = await prisma.employee.findUnique({
      where: { empCode: parsed.empCode },
      include: { userRoles: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
    }

    // Environments where this user is an admin
    const adminLinks = await prisma.environmentAdmin.findMany({
      where: { adminEmpCode: user.empCode },
      include: { environment: { include: { centers: true } } },
    });

    const adminEnvIds = adminLinks.map((l) => l.environmentId);
    const centers = Array.from(
      new Set(
        adminLinks.flatMap((l) => (l.environment?.centers ?? []).map((c) => c.center))
      )
    );

    const roles = (user.userRoles ?? []).map((r) => r.roleCode);

    return NextResponse.json({
      ok: true,
      empCode: user.empCode,
      roles,
      centers,
      adminEnvIds,
    });
  } catch (err) {
    console.error("[/api/auth/me] error", err);
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}

