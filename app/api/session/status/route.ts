import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TTL_SECONDS, SESSION_COOKIE_NAME, verifySessionCookieValue, createSessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const wantRefresh = url.searchParams.get("refresh") === "1";

    const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ ok: false }, { status: 401 });

    if (wantRefresh) {
        const refreshed = createSessionCookie(parsed.empCode, DEFAULT_TTL_SECONDS);
        const res = NextResponse.json({ ok: true, user: { empCode: parsed.empCode }, expiresAt: refreshed.expiresAt });
        res.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: refreshed.value,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: refreshed.maxAge,
        });
        return res;
    }

    return NextResponse.json({ ok: true, user: { empCode: parsed.empCode }, expiresAt: parsed.expiresAt });
}


