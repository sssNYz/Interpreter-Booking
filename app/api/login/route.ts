import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type LoginRequest = {
	empCode: string;
	oldPassword: string;
};

export async function POST(req: NextRequest) {
	let body: LoginRequest;
	try {
    	body = await req.json();
    	console.log("[/api/login] body received", { hasEmpCode: !!body.empCode, passwordLength: body.oldPassword?.length ?? 0 });
	} catch {
		return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
	}

    const empCode = (body.empCode || "").trim();
    const oldPassword = (body.oldPassword || "").trim();
    if (!empCode || !oldPassword) {
		return NextResponse.json({ ok: false, message: "Missing credentials" }, { status: 400 });
	}

    // Call reference login service
    try {
        const forward = { empCode, oldPassword };
        console.log("[/api/login] forwarding to reference", { host: "http://192.168.1.184/api/login", empCode: forward.empCode, passwordLength: forward.oldPassword.length });
        const refRes = await fetch("http://192.168.1.184/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(forward),
        });

        if (!refRes.ok) {
            const text = await refRes.text().catch(() => "");
            console.error("[/api/login] reference responded non-200", { status: refRes.status, body: text?.slice(0, 300) });
            return NextResponse.json({ ok: false, message: "Invalid credentials" }, { status: 401 });
        }

        const data = await refRes.json();
		// const token: string | undefined = data?.token;
        const u = data?.user_data || {};

		// Map to employee fields
        const empCodeFromRef: string | undefined = u.code;
        if (!empCodeFromRef) {
			return NextResponse.json({ ok: false, message: "Malformed response" }, { status: 500 });
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

    	// Upsert employee via raw SQL (avoids Prisma type dependency before generate)
        const now = new Date();
        const nowIso = now.toISOString().slice(0, 19).replace('T', ' ');
        try {
            await prisma.$executeRawUnsafe(
            `INSERT INTO EMPLOYEE (
                EMP_CODE, PREFIX_EN, FIRST_NAME_EN, LAST_NAME_EN,
                PREFIX_TH, FIRST_NAME_TH, LAST_NAME_TH,
                FNO, DEPT_PATH, POSITION_TITLE,
                EMAIL, TEL_EXT,
                IS_ACTIVE, ROLE, LAST_LOGIN_AT, SYNCED_AT, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'USER', ?, ?, NOW(), NOW()
            )
            ON DUPLICATE KEY UPDATE 
                PREFIX_EN=VALUES(PREFIX_EN), FIRST_NAME_EN=VALUES(FIRST_NAME_EN), LAST_NAME_EN=VALUES(LAST_NAME_EN),
                PREFIX_TH=VALUES(PREFIX_TH), FIRST_NAME_TH=VALUES(FIRST_NAME_TH), LAST_NAME_TH=VALUES(LAST_NAME_TH),
                FNO=VALUES(FNO), DEPT_PATH=VALUES(DEPT_PATH), POSITION_TITLE=VALUES(POSITION_TITLE),
                EMAIL=VALUES(EMAIL), TEL_EXT=VALUES(TEL_EXT),
                LAST_LOGIN_AT=VALUES(LAST_LOGIN_AT), SYNCED_AT=VALUES(SYNCED_AT), updated_at=NOW()`,
                empCodeFromRef,
                prefixEn, firstNameEn, lastNameEn,
                prefixTh, firstNameTh, lastNameTh,
                fno, deptPath, positionTitle,
                email, telExt,
                nowIso, nowIso
            );
        } catch (err) {
            console.error("[/api/login] DB write failed", { error: err instanceof Error ? err.message : String(err) });
            return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
        }
        const rows = await prisma.$queryRawUnsafe<Array<{ ID: number; EMAIL: string | null; EMP_CODE: string | null; FIRST_NAME_EN: string | null; LAST_NAME_EN: string | null; TEL_EXT: string | null }>>(
            `SELECT ID, EMAIL, EMP_CODE, FIRST_NAME_EN, LAST_NAME_EN, TEL_EXT FROM EMPLOYEE WHERE EMP_CODE = ? LIMIT 1`,
            empCodeFromRef
    	);
    	const row = rows[0];
    	return NextResponse.json({
			ok: true,
			user: {
				id: String(row?.ID ?? ""),
                empCode: empCodeFromRef,
                name: `${row?.FIRST_NAME_EN ?? ""} ${row?.LAST_NAME_EN ?? ""}`.trim(),
                email: row?.EMAIL ?? null,
                phone: row?.TEL_EXT ?? null,
			},
		});
    } catch (err) {
        console.error("[/api/login] unexpected error", { error: err instanceof Error ? err.message : String(err) });
        return NextResponse.json({ ok: false, message: "Login error" }, { status: 500 });
	}
}


