import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const telExtRaw = String(body?.telExt ?? "").trim();
    if (!/^\d{4}$/.test(telExtRaw)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TEL_EXT", message: "Extension must be exactly 4 digits" },
        { status: 400 }
      );
    }

    const updated = await prisma.employee.update({
      where: { empCode: parsed.empCode },
      data: { telExt: telExtRaw, updatedAt: new Date() },
      select: { id: true, empCode: true, email: true, telExt: true },
    });

    return NextResponse.json({ ok: true, user: { id: String(updated.id), empCode: updated.empCode, email: updated.email, phone: updated.telExt } });
  } catch (e) {
    console.error("[/api/user/phone] error", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}



