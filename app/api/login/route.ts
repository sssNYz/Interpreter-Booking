import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import {
  createSessionCookie,
  DEFAULT_TTL_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import type { LoginRequest, LoginResponse } from "@/types/auth";

//const REF_API_URL = "http://172.31.150.3/api/login";
const REF_API_URL = "http://localhost:3030/api/mock-login";
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

  // Call reference login service
  try {
    const forward = { empCode, oldPassword };
    console.log("[/api/login] forwarding to reference", {
      host: REF_API_URL,
      empCode: forward.empCode,
      passwordLength: forward.oldPassword.length,
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
      console.error("[/api/login] reference responded non-200", {
        status: refRes.status,
        statusText: refRes.statusText,
        headers: Object.fromEntries(refRes.headers.entries()),
        body: text?.slice(0, 500),
        url: REF_API_URL,
        requestData: { empCode: forward.empCode, passwordLength: forward.oldPassword.length }
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
    console.log("[/api/login] reference API response received", {
      status: refRes.status,
      hasUserData: !!data?.user_data,
      dataKeys: Object.keys(data || {}),
      userDataKeys: data?.user_data ? Object.keys(data.user_data) : [],
      empCodeInResponse: data?.user_data?.code
    });

    // const token: string | undefined = data?.token;
    const u = data?.user_data || {};

    // Map to employee fields
    const empCodeFromRef: string | undefined = u.code;
    if (!empCodeFromRef) {
      console.error("[/api/login] missing empCode in response", {
        responseData: data,
        userData: u,
        allKeys: Object.keys(data || {})
      });
      return NextResponse.json(
        {
          ok: false,
          message: "Authentication service returned invalid user data",
          debug: {
            hasData: !!data,
            hasUserData: !!data?.user_data,
            userDataKeys: data?.user_data ? Object.keys(data.user_data) : [],
            responseKeys: Object.keys(data || {})
          }
        },
        { status: 500 }
      );
    }
    const email: string | null = u.email || null;
    const telExt: string | null = u.tel || null;
    const prefixEn: string | null = u.pren || null;
    const firstNameEn: string | null = u.name || null;
    const lastNameEn: string | null = u.surn || null;
    const prefixTh: string | null = u.prenTh || null;
    const firstNameTh: string | null = u.nameTh || null;
    const lastNameTh: string | null = u.surnTh || null;
    const fno: string | null = u.fno || null;
    const deptPath: string | null = u.divDeptSect || null;
    const positionTitle: string | null = u.positionDescription || null;

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
