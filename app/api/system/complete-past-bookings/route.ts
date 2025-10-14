import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TZ_OFFSET_MINUTES = 7 * 60; // Asia/Bangkok UTC+7
const DEFAULT_GRACE_MINUTES = 10;

function parseIntegerEnv(envValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(envValue ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Compute local time string (YYYY-MM-DD HH:mm:ss) for the configured business timezone.
function formatLocalTimeWithOffset(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function withNamedLock<T>(name: string, timeoutSec: number, fn: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const lockRow = await prisma.$queryRaw<{ l: number }[]>`SELECT GET_LOCK(${name}, ${timeoutSec}) AS l`;
  if (!lockRow?.[0] || Number(lockRow[0].l) !== 1) {
    return { ok: false, error: "LOCK_TIMEOUT" };
  }
  try {
    const result = await fn();
    return { ok: true, result };
  } finally {
    try {
      await prisma.$queryRaw`SELECT RELEASE_LOCK(${name})`;
    } catch {}
  }
}

// POST: Run completion job
export async function POST(req: NextRequest) {
  try {
    // Simple secret header auth
    const providedHeader = req.headers.get("x-cron-token") || req.headers.get("X-CRON-TOKEN");
    const expectedRaw = process.env.CRON_SECRET || process.env.CRON_TOKEN;
    const provided = providedHeader?.trim();
    const expected = expectedRaw?.trim();
    if (!expected || provided !== expected) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const timezoneOffsetMinutes = parseIntegerEnv(process.env.BUSINESS_TZ_OFFSET_MINUTES, DEFAULT_TZ_OFFSET_MINUTES);
    const graceMinutes = parseIntegerEnv(process.env.COMPLETE_BOOKINGS_GRACE_MINUTES, DEFAULT_GRACE_MINUTES);
    const threshold = formatLocalTimeWithOffset(new Date(Date.now() - graceMinutes * 60 * 1000), timezoneOffsetMinutes);

    const job = await withNamedLock("booking:complete-job", 5, async () => {
      // Perform update in one statement; also set updated_at
      const affected: number = await prisma.$executeRaw`UPDATE BOOKING_PLAN
        SET BOOKING_STATUS = 'complet', updated_at = NOW(0)
        WHERE BOOKING_STATUS = 'approve'
          AND INTERPRETER_EMP_CODE IS NOT NULL
          AND TIME_END < DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${timezoneOffsetMinutes} MINUTE), INTERVAL ${graceMinutes} MINUTE)`;

      return { affected };
    });

    if (!job.ok) {
      return NextResponse.json({ error: job.error }, { status: 423 });
    }

    return NextResponse.json({ ok: true, threshold, ...job.result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}

export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Allow", "POST, OPTIONS");
  return res;
}
