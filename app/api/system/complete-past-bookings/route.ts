import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Compute Bangkok local time string (YYYY-MM-DD HH:mm:ss) minus given minutes.
function bkkNowMinusMinutes(minutes: number): string {
  const nowUtcMs = Date.now();
  const bkkOffsetMs = 7 * 60 * 60 * 1000; // Asia/Bangkok is UTC+7, no DST
  const graceMs = minutes * 60 * 1000;
  const target = new Date(nowUtcMs + bkkOffsetMs - graceMs);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const hh = String(target.getUTCHours()).padStart(2, "0");
  const mm = String(target.getUTCMinutes()).padStart(2, "0");
  const ss = String(target.getUTCSeconds()).padStart(2, "0");
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
    try { await prisma.$queryRaw`SELECT RELEASE_LOCK(${name})`; } catch {}
  }
}

// POST: Run completion job
export async function POST(req: NextRequest) {
  try {
    // Simple secret header auth
    const provided = req.headers.get("x-cron-token") || req.headers.get("X-CRON-TOKEN");
    const expected = process.env.CRON_SECRET || process.env.CRON_TOKEN;
    if (!expected || provided !== expected) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Business rule
    // Only rows where:
    //  - bookingStatus = 'approve'
    //  - interpreterEmpCode IS NOT NULL
    //  - TIME_END < (Bangkok now - 10 minutes)
    const threshold = bkkNowMinusMinutes(10);

    const job = await withNamedLock("booking:complete-job", 5, async () => {
      // Perform update in one statement; also set updated_at
      const affected: number = await prisma.$executeRaw`UPDATE BOOKING_PLAN
        SET BOOKING_STATUS = 'complet', updated_at = NOW(0)
        WHERE BOOKING_STATUS = 'approve'
          AND INTERPRETER_EMP_CODE IS NOT NULL
          AND TIME_END < ${threshold}`;

      return { affected, threshold };
    });

    if (!job.ok) {
      return NextResponse.json({ error: job.error }, { status: 423 });
    }

    return NextResponse.json({ ok: true, ...job.result });
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

