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
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await prisma.employee.findUnique({
      where: { empCode: parsed.empCode },
      select: {
        id: true,
        empCode: true,
        email: true,
        firstNameEn: true,
        lastNameEn: true,
        telExt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user.id),
        empCode: user.empCode,
        name: `${user.firstNameEn ?? ""} ${user.lastNameEn ?? ""}`.trim(),
        email: user.email ?? null,
        phone: user.telExt ?? null,
      },
    });
  } catch (e) {
    console.error("[/api/user/profile] error", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}



