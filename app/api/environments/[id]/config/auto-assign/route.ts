import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { validateAssignmentPolicy } from "@/lib/assignment/validation/config-validation";
import { getEffectivePolicyForEnvironment, getEnvironmentPolicyOverride, upsertEnvironmentPolicyOverride } from "@/lib/assignment/config/env-policy";
import { loadPolicy } from "@/lib/assignment/config/policy";
import type { AssignmentPolicy } from "@/types/assignment";

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

  const [globalPolicy, envOverride, effective] = await Promise.all([
    loadPolicy(),
    getEnvironmentPolicyOverride(envId),
    getEffectivePolicyForEnvironment(envId)
  ]);

  return NextResponse.json({ ok: true, data: { globalPolicy, envOverride, effectivePolicy: effective } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;
  const envId = Number(params.id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Invalid environment id" }, { status: 400 });

  let body: Partial<AssignmentPolicy> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  // Allow per-environment mode; validate against selected mode
  const globalPolicy = await loadPolicy();
  const selectedMode = body?.mode ?? globalPolicy.mode;
  const toValidate = { ...body, mode: selectedMode };
  const validation = validateAssignmentPolicy(toValidate, { ...globalPolicy, mode: selectedMode });
  if (!validation.isValid) {
    return NextResponse.json({ ok: false, error: "Validation failed", validation }, { status: 400 });
  }

  const saved = await upsertEnvironmentPolicyOverride(envId, body);
  const effective = await getEffectivePolicyForEnvironment(envId);
  return NextResponse.json({ ok: true, data: { override: saved, effectivePolicy: effective } });
}

