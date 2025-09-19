import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ ok: false }, { status: 401 });

    const me = await prisma.employee.findUnique({ where: { empCode: parsed.empCode } });
    if (!me) return NextResponse.json({ ok: false }, { status: 404 });
    const myCenter = centerPart(me.deptPath);
    if (!myCenter) return NextResponse.json({ ok: true, environment: null });

    const center = await prisma.environmentCenter.findUnique({ where: { center: myCenter } });
    if (!center) return NextResponse.json({ ok: true, environment: null });
    const env = await prisma.environment.findUnique({
      where: { id: center.environmentId },
      include: { centers: true, admins: true, interpreters: true },
    });
    return NextResponse.json({ ok: true, environment: env });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

