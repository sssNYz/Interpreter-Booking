import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "booking.session";
export const DEFAULT_TTL_SECONDS =30 * 60; // 30 minutes

export type ParsedSession = {
	empCode: string;
	expiresAt: number; // epoch ms
};

function getSecret(): string {
	const s = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
	return s;
}

function sign(data: string): string {
	const h = crypto.createHmac("sha256", getSecret());
	h.update(data);
	return h.digest("base64url");
}

function serialize(empCode: string, expiresAtMs: number): string {
	const payload = `${empCode}|${expiresAtMs}`;
	const sig = sign(payload);
	return `${payload}|${sig}`;
}

export function createSessionCookie(empCode: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): { name: string; value: string; maxAge: number; expiresAt: number } {
	const expiresAt = Date.now() + ttlSeconds * 1000;
	const value = serialize(empCode, expiresAt);
	return { name: SESSION_COOKIE_NAME, value, maxAge: ttlSeconds, expiresAt };
}

export function verifySessionCookieValue(value: string | undefined | null): ParsedSession | null {
	if (!value) return null;
	const parts = value.split("|");
	if (parts.length !== 3) return null;
	const [empCode, expStr, sig] = parts;
	const expMs = Number(expStr);
	if (!empCode || !Number.isFinite(expMs)) return null;
	const expectedSig = sign(`${empCode}|${expMs}`);
	if (!timingSafeEqual(sig, expectedSig)) return null;
	if (Date.now() > expMs) return null;
	return { empCode, expiresAt: expMs };
}

function timingSafeEqual(a: string, b: string): boolean {
	try {
		const ab = Buffer.from(a);
		const bb = Buffer.from(b);
		if (ab.length !== bb.length) return false;
		return crypto.timingSafeEqual(ab, bb);
	} catch {
		return false;
	}
}


