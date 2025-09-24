import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { listEnvModeThresholds, upsertEnvModeThreshold } from "@/lib/assignment/config/env-policy";
import type { MeetingTypeModeThreshold } from "@/types/assignment";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } });
  if (!user) return null;
  const roles = (user.userRoles ?? []).map(r => r.roleCode);
  return { empCode: user.empCode, roles };
}

function requireAdmin(user: { roles: string[] } | null): boolean {
  if (!user) return false;
  const r = new Set(user.roles);
  return r.has("ADMIN") || r.has("SUPER_ADMIN");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;
  const envId = Number(params.id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Invalid environment id" }, { status: 400 });

  const rows = await listEnvModeThresholds(envId);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;
  const envId = Number(params.id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Invalid environment id" }, { status: 400 });

  let body: { items?: Array<{ meetingType: string; assignmentMode: string; urgentThresholdDays: number; generalThresholdDays: number; }> } | Array<{ meetingType: string; assignmentMode: string; urgentThresholdDays: number; generalThresholdDays: number; }>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const items: Array<{ meetingType: string; assignmentMode: string; urgentThresholdDays: number; generalThresholdDays: number; }> = Array.isArray(body) ? body : (body?.items || []);
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "No items" }, { status: 400 });
  }

  const results: Array<{ meetingType?: string; assignmentMode?: string; ok: boolean; error?: string; saved?: MeetingTypeModeThreshold }> = [];
  for (const it of items) {
    if (!it.meetingType || !it.assignmentMode) {
      results.push({ meetingType: it.meetingType, assignmentMode: it.assignmentMode, ok: false, error: 'Missing meetingType/assignmentMode' });
      continue;
    }
    const saved = await upsertEnvModeThreshold(envId, it.meetingType, it.assignmentMode, it.urgentThresholdDays, it.generalThresholdDays);
    results.push({ ok: true, saved: saved as MeetingTypeModeThreshold });
  }

  return NextResponse.json({ ok: true, results });
}

