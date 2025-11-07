import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { listEnvMeetingTypePriorities, upsertEnvMeetingTypePriority, getEnvMeetingTypePriority } from "@/lib/assignment/config/env-policy";
import { validateMeetingTypePriority } from "@/lib/assignment/validation/config-validation";
import { loadPolicy } from "@/lib/assignment/config/policy";
import type { MeetingTypePriority } from "@/types/assignment";
import type { ValidationResult } from "@/lib/assignment/validation/config-validation";
import { scheduleAutoAssignForBooking, getEnvironmentIdForBooking, computeETAForBooking } from "@/lib/assignment/scheduler/compute";
import { runSchedulerPass } from "@/lib/assignment/scheduler/db-polling-scheduler";

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

  const rows = await listEnvMeetingTypePriorities(envId);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;
  const envId = Number(params.id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Invalid environment id" }, { status: 400 });

  let body: { items?: Array<{ meetingType: string; priorityValue?: number; urgentThresholdDays?: number; generalThresholdDays?: number; }> } | Array<{ meetingType: string; priorityValue?: number; urgentThresholdDays?: number; generalThresholdDays?: number; }>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const items: Array<{ meetingType: string; priorityValue?: number; urgentThresholdDays?: number; generalThresholdDays?: number; }> = Array.isArray(body) ? body : (body?.items || []);
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "No items" }, { status: 400 });
  }

  const policy = await loadPolicy();
  const results: Array<{ meetingType: string; ok: boolean; error?: string; validation?: ValidationResult; override?: MeetingTypePriority; effective?: MeetingTypePriority | null }> = [];
  for (const it of items) {
    if (!it.meetingType) {
      results.push({ meetingType: it.meetingType, ok: false, error: 'Missing meetingType' });
      continue;
    }
    const validation = validateMeetingTypePriority({
      meetingType: it.meetingType,
      priorityValue: it.priorityValue ?? 1,
      urgentThresholdDays: it.urgentThresholdDays ?? 3,
      generalThresholdDays: it.generalThresholdDays ?? 30
    }, policy.mode);
    if (!validation.isValid) {
      results.push({ meetingType: it.meetingType, ok: false, error: 'Validation failed', validation });
      continue;
    }
    const saved = await upsertEnvMeetingTypePriority(envId, it.meetingType, it);
    const effective = await getEnvMeetingTypePriority(envId, it.meetingType);
    results.push({ meetingType: it.meetingType, ok: true, override: saved, effective });
  }

  // Reschedule impacted bookings for this environment and run a manual pass
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const candidates = await prisma.bookingPlan.findMany({
      where: { bookingStatus: 'waiting', interpreterEmpCode: null, timeStart: { lte: horizon }, bookingKind: 'INTERPRETER' as any },
      select: { bookingId: true },
      orderBy: { timeStart: 'asc' },
      take: 300
    });
    for (const c of candidates) {
      const bEnv = await getEnvironmentIdForBooking(c.bookingId);
      if (bEnv === envId) {
        await scheduleAutoAssignForBooking(c.bookingId);
        try {
          const eta = await computeETAForBooking(c.bookingId);
          if (eta.etaSeconds === 0) {
            await prisma.bookingPlan.update({ where: { bookingId: c.bookingId }, data: { autoAssignAt: new Date(), autoAssignStatus: 'pending' } });
          }
        } catch {}
      }
    }
    await runSchedulerPass('manual');
  } catch (e) {
    console.warn('Reschedule after env meeting-type update failed (non-fatal):', e);
  }

  return NextResponse.json({ ok: true, results });
}
