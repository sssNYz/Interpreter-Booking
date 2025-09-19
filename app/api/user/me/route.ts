import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ ok: false }, { status: 401 });

    const empCode = parsed.empCode;
    const user = await prisma.employee.findUnique({
      where: { empCode },
      include: { userRoles: true, adminVisions: true },
    });
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    const roles = (user.userRoles ?? []).map((r) => r.roleCode);
    const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const deptPath = user.deptPath || null;
    const center = centerPart(deptPath);
    const adminCenters = (user.adminVisions ?? [])
      .map((v) => centerPart(v.deptPath))
      .filter((x): x is string => Boolean(x));

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        empCode: user.empCode,
        name: [user.firstNameEn, user.lastNameEn].filter(Boolean).join(" "),
        email: user.email,
        deptPath,
        center,
        roles,
        isAdmin,
        isSuperAdmin,
        adminCenters,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
