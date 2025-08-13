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
		const source = "reference_project";
		const sourceUserId = u.code as string | undefined;
		if (!sourceUserId) {
			return NextResponse.json({ ok: false, message: "Malformed response" }, { status: 500 });
		}
		const name: string = u.fullName || `${u.pren ?? ""} ${u.name ?? ""} ${u.surn ?? ""}`.trim();
		const email: string | null = u.email || null;
		const phone: string | null = u.mobile || u.tel || null;
        const empCodeFromRef: string | null = u.code || null;

    	// Upsert employee via raw SQL (avoids Prisma type dependency before generate)
    	const now = new Date();
    	const nowIso = now.toISOString().slice(0, 19).replace('T', ' ');
    	const src = source;
    	const srcId = sourceUserId;
        try {
            await prisma.$executeRawUnsafe(
    		`INSERT INTO EMPLOYEE (SOURCE, SOURCE_USER_ID, EMAIL, EMP_CODE, NAME, PHONE, IS_ACTIVE, ROLE, LAST_LOGIN_AT, SYNCED_AT, created_at, updated_at)
    		 VALUES (?, ?, ?, ?, ?, ?, 1, 'USER', ?, ?, NOW(), NOW())
    		 ON DUPLICATE KEY UPDATE EMAIL=VALUES(EMAIL), EMP_CODE=VALUES(EMP_CODE), NAME=VALUES(NAME), PHONE=VALUES(PHONE), LAST_LOGIN_AT=VALUES(LAST_LOGIN_AT), SYNCED_AT=VALUES(SYNCED_AT), updated_at=NOW()`,
    		src,
    		srcId,
    		email,
            empCodeFromRef,
    		name,
    		phone,
    		nowIso,
    		nowIso
            );
        } catch (err) {
            console.error("[/api/login] DB write failed", { error: err instanceof Error ? err.message : String(err) });
            return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
        }
        const rows = await prisma.$queryRawUnsafe<Array<{ ID: number; EMAIL: string | null; EMP_CODE: string | null; NAME: string; PHONE: string | null }>>(
    		`SELECT ID, EMAIL, EMP_CODE, NAME, PHONE FROM EMPLOYEE WHERE SOURCE = ? AND SOURCE_USER_ID = ? LIMIT 1`,
    		src,
    		srcId
    	);
    	const row = rows[0];
    	return NextResponse.json({
			ok: true,
			user: {
				id: String(row?.ID ?? ""),
				source,
				sourceUserId,
                empCode: empCodeFromRef,
				name,
				email,
				phone,
			},
		});
    } catch (err) {
        console.error("[/api/login] unexpected error", { error: err instanceof Error ? err.message : String(err) });
        return NextResponse.json({ ok: false, message: "Login error" }, { status: 500 });
	}
}


