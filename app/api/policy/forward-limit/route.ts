import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.FORWARD_MONTH_LIMIT;
  let limit = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(limit) || limit < 0) limit = 1; // default 1 (current + next)
  return NextResponse.json({ ok: true, data: { forwardMonthLimit: limit } });
}

