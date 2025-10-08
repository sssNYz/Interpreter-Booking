import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utiv6789ls/users";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ ok: false }, { status: 401 });

    const empCode = parsed.empCode;
    const user = await prisma.employee.findUnique({
      where: { empCode },
      include: { userRoles: true },
    });
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    const roles = (user.userRoles ?? []).map((r) => r.roleCode);
    const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const deptPath = user.deptPath || null;
    const center = centerPart(deptPath);
    // Environment info for user's center
    let environment: { id: number; name: string; centers: string[]; admins: string[]; interpreters: string[] } | null = null;
    if (center) {
      const envCenter = await prisma.environmentCenter.findUnique({ where: { center } });
      if (envCenter) {
        const env = await prisma.environment.findUnique({
          where: { id: envCenter.environmentId },
          include: {
            centers: { select: { center: true } },
            admins: { select: { adminEmpCode: true } },
            interpreters: { select: { interpreterEmpCode: true } },
          },
        });
        if (env) {
          environment = {
            id: env.id,
            name: env.name,
            centers: env.centers.map(c => c.center),
            admins: env.admins.map(a => a.adminEmpCode),
            interpreters: env.interpreters.map(i => i.interpreterEmpCode),
          };
        }
      }
    }

    // For admins: union of centers across environments they manage
    let adminEnvCenters: string[] = [];
    if (isAdmin) {
      const envs = await prisma.environmentAdmin.findMany({
        where: { adminEmpCode: user.empCode },
        select: { environment: { select: { centers: { select: { center: true } } } } },
      });
      adminEnvCenters = envs.flatMap(e => e.environment.centers.map(c => c.center));
    }
    const adminCenters = adminEnvCenters; // backward compatible field

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
        environment,
        adminEnvCenters,
        adminCenters,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
