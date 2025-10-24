import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import {
  createSessionCookie,
  DEFAULT_TTL_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import type { LoginRequest, LoginResponse } from "@/types/auth";
import crypto from "node:crypto";

const REF_API_URL = process.env.LOGIN_API_URL || "https://bigw.daikinthai.com:8443/api/ditl/auth/sign-in ";
// const REF_API_URL = "http://172.31.150.3/api/login";
//const REF_API_URL = "http://localhost:3030/api/mock-login";

  //process.env.REF_API_URL || "http://172.31.150.22:3030/api/mock-login";
  //process.env.REF_API_URL || "http://192.168.1.184/api/login";
  //process.env.REF_API_URL || "http://172.31.150.3/api/login";

export async function POST(req: NextRequest) {
  let body: LoginRequest;
  try {
    body = await req.json();
    console.log("[/api/login] body received", {
      hasEmpCode: !!body.empCode,
      passwordLength: body.oldPassword?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const empCode = (body.empCode || "").trim();
  const oldPassword = (body.oldPassword || "").trim();
  if (!empCode || !oldPassword) {
    return NextResponse.json(
      { ok: false, message: "Missing credentials" },
      { status: 400 }
    );
  }

  // Helpers for JWT handling (optional verification if secret provided)
  function base64urlToBuffer(b64url: string): Buffer {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
    return Buffer.from(b64, "base64");
  }

  function bufferToBase64url(buf: Buffer): string {
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function verifyHs256Jwt(token: string, secret: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const [headerB64, payloadB64, sigB64] = parts;
      const data = `${headerB64}.${payloadB64}`;
      const expected = crypto.createHmac("sha256", secret).update(data).digest();
      const expectedB64url = bufferToBase64url(expected);
      const given = sigB64;
      // timing-safe compare
      const a = Buffer.from(expectedB64url);
      const b = Buffer.from(given);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  type JwtPayload = {
    iss?: string;
    fullname?: string;
    fname?: string;
    lname?: string;
    email?: string;
    ou?: string;
    posit?: string;
    code?: string;
    sid?: string;
    roles?: string;
    lanePoint_isAdmin?: number;
    consent?: number;
    uuid?: string;
    exp?: number;
    iat?: number;
    [key: string]: unknown;
  };

  function decodeJwtPayload(token: string): JwtPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payloadB64 = parts[1];
      const buf = base64urlToBuffer(payloadB64);
      return JSON.parse(buf.toString("utf8"));
    } catch {
      return null;
    }
  }

  // Call new reference login service that returns JWT
  try {
    if (!REF_API_URL) {
      console.error("[/api/login] LOGIN_API_URL is not configured");
      return NextResponse.json(
        { ok: false, message: "Server misconfiguration: LOGIN_API_URL" },
        { status: 500 }
      );
    }

    // Map old client body to new upstream body
    const forward = { username: empCode, password: oldPassword };
    console.log("[/api/login] forwarding to auth", {
      host: REF_API_URL,
      username: forward.username,
      passwordLength: forward.password.length,
    });
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 5000);
    const refRes = await fetch(REF_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forward),
      signal: controller.signal,
    }).finally(() => clearTimeout(to));

    if (!refRes.ok) {
      const text = await refRes.text().catch(() => "");
      console.error("[/api/login] auth responded non-200", {
        status: refRes.status,
        statusText: refRes.statusText,
        headers: Object.fromEntries(refRes.headers.entries()),
        body: text?.slice(0, 500),
        url: REF_API_URL,
        requestData: { username: forward.username, passwordLength: forward.password.length }
      });
      return NextResponse.json(
        {
          ok: false,
          message: `Authentication failed: ${refRes.status} ${refRes.statusText}`,
          debug: {
            status: refRes.status,
            response: text?.slice(0, 200),
            endpoint: REF_API_URL
          }
        },
        { status: 401 }
      );
    }

    const data = await refRes.json();
    console.log("[/api/login] auth API response received", {
      status: refRes.status,
      dataKeys: Object.keys(data || {}),
    });

    const token: string | undefined = data?.auth_data?.access_token;
    if (!token || typeof token !== "string") {
      console.error("[/api/login] missing access_token in response", { keys: Object.keys(data || {}) });
      return NextResponse.json(
        { ok: false, message: "Authentication service returned invalid token" },
        { status: 500 }
      );
    }

    // Verify if secret provided; otherwise fallback to decode-only
    const verifySecret = process.env.AUTH_JWT_SECRET;
    if (verifySecret) {
      const ok = verifyHs256Jwt(token, verifySecret);
      if (!ok) {
        console.error("[/api/login] token signature verification failed");
        return NextResponse.json(
          { ok: false, message: "Invalid token signature" },
          { status: 401 }
        );
      }
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      return NextResponse.json(
        { ok: false, message: "Invalid token payload" },
        { status: 500 }
      );
    }

    // Check expiry if present
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
      return NextResponse.json(
        { ok: false, message: "Token expired" },
        { status: 401 }
      );
    }

    // Map JWT claims to employee fields
    const empCodeFromRef: string | undefined = payload.code;
    if (!empCodeFromRef) {
      console.error("[/api/login] missing code in token payload", { payloadKeys: Object.keys(payload) });
      return NextResponse.json(
        { ok: false, message: "Authentication service returned invalid user data" },
        { status: 500 }
      );
    }
    const email: string | null = payload.email ?? null;
    const telExt: string | null = null; // not provided by token
    const prefixEn: string | null = null;
    const firstNameEn: string | null = payload.fname ?? null;
    const lastNameEn: string | null = payload.lname ?? null;
    const prefixTh: string | null = null;
    const firstNameTh: string | null = null;
    const lastNameTh: string | null = null;
    const fno: string | null = null;
    const deptPath: string | null = payload.ou ?? null;
    const positionTitle: string | null = payload.posit ?? null;

    // Upsert employee via parameterized SQL
    const now = new Date();
    const nowIso = now.toISOString().slice(0, 19).replace("T", " ");
    console.log("[/api/login] attempting DB upsert for empCode", empCodeFromRef);
    try {
      await prisma.$executeRaw`
                INSERT INTO EMPLOYEE (
                    EMP_CODE, PREFIX_EN, FIRST_NAME_EN, LAST_NAME_EN,
                    PREFIX_TH, FIRST_NAME_TH, LAST_NAME_TH,
                    FNO, DEPT_PATH, POSITION_TITLE,
                    EMAIL, TEL_EXT,
                    IS_ACTIVE, LAST_LOGIN_AT, SYNCED_AT, created_at, updated_at
                ) VALUES (
                    ${empCodeFromRef}, ${prefixEn}, ${firstNameEn}, ${lastNameEn},
                    ${prefixTh}, ${firstNameTh}, ${lastNameTh},
                    ${fno}, ${deptPath}, ${positionTitle},
                    ${email}, ${telExt},
                    1, ${nowIso}, ${nowIso}, ${nowIso}, ${nowIso}
                )
                ON DUPLICATE KEY UPDATE
                    PREFIX_EN=VALUES(PREFIX_EN), FIRST_NAME_EN=VALUES(FIRST_NAME_EN), LAST_NAME_EN=VALUES(LAST_NAME_EN),
                    PREFIX_TH=VALUES(PREFIX_TH), FIRST_NAME_TH=VALUES(FIRST_NAME_TH), LAST_NAME_TH=VALUES(LAST_NAME_TH),
                    FNO=VALUES(FNO), DEPT_PATH=VALUES(DEPT_PATH), POSITION_TITLE=VALUES(POSITION_TITLE),
                    EMAIL=VALUES(EMAIL), TEL_EXT=VALUES(TEL_EXT),
                    LAST_LOGIN_AT=VALUES(LAST_LOGIN_AT), SYNCED_AT=VALUES(SYNCED_AT), updated_at=${nowIso}
            `;
      console.log("[/api/login] DB upsert successful");
    } catch (err) {
      console.error("[/api/login] DB write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { ok: false, message: "Database error" },
        { status: 500 }
      );
    }
    console.log("[/api/login] querying employee record");
    const rows = await prisma.$queryRaw<
      Array<{
        ID: number;
        EMAIL: string | null;
        EMP_CODE: string | null;
        FIRST_NAME_EN: string | null;
        LAST_NAME_EN: string | null;
        TEL_EXT: string | null;
      }>
    >`
            SELECT ID, EMAIL, EMP_CODE, FIRST_NAME_EN, LAST_NAME_EN, TEL_EXT FROM EMPLOYEE WHERE EMP_CODE = ${empCodeFromRef} LIMIT 1
        `;
    console.log("[/api/login] employee record found:", rows.length > 0);
    const row = rows[0];
    // Set HttpOnly session cookie with sliding TTL
    const session = createSessionCookie(empCodeFromRef, DEFAULT_TTL_SECONDS);
    const res = NextResponse.json<LoginResponse>({
      ok: true,
      user: {
        id: String(row?.ID ?? ""),
        empCode: empCodeFromRef,
        name: `${row?.FIRST_NAME_EN ?? ""} ${row?.LAST_NAME_EN ?? ""}`.trim(),
        email: row?.EMAIL ?? null,
        phone: row?.TEL_EXT ?? null,
      },
    });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.value,
      httpOnly: true,
      secure: false, // Set to false for internal HTTP-only deployment
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    });
    console.log("[/api/login] login successful, returning response");
    return res;
  } catch (err) {
    console.error("[/api/login] unexpected error", {
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorStack: err instanceof Error ? err.stack : undefined,
      isAbortError: err instanceof Error && err.name === 'AbortError',
      isFetchError: err instanceof Error && (err.message.includes('fetch') || err.message.includes('network')),
      endpoint: REF_API_URL,
      empCode: empCode
    });

    let errorMessage = "Login error";
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        errorMessage = "Authentication service timeout";
      } else if (err.message.includes('fetch') || err.message.includes('network')) {
        errorMessage = "Cannot connect to authentication service";
      }
    }

    return NextResponse.json<LoginResponse>(
      {
        ok: false,
        message: errorMessage,
        debug: {
          errorType: err instanceof Error ? err.name : 'Unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
          endpoint: REF_API_URL
        }
      },
      { status: 500 }
    );
  }
}
