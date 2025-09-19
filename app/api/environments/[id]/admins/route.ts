import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const user = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
    include: { userRoles: true },
  });
  if (!user) return null;
  const roles = (user.userRoles ?? []).map(r => r.roleCode);
  return { empCode: user.empCode, roles };
}

function requireAdmin(user: { roles: string[] } | null): boolean {
  if (!user) return false;
  const r = new Set(user.roles);
  return r.has("ADMIN") || r.has("SUPER_ADMIN");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const envId = Number(id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Bad environment id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const empCode = typeof body?.empCode === "string" ? body.empCode.trim() : "";
  if (!empCode) return NextResponse.json({ ok: false, error: "Missing empCode" }, { status: 400 });

  // Check target user exists and has ADMIN role
  const target = await prisma.employee.findUnique({ where: { empCode }, include: { userRoles: true } });
  if (!target) return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
  const targetRoles = new Set((target.userRoles ?? []).map(r => r.roleCode));
  if (!targetRoles.has("ADMIN") && !targetRoles.has("SUPER_ADMIN")) {
    return NextResponse.json({ ok: false, error: "Employee is not ADMIN" }, { status: 400 });
  }

  // Rule: one admin can stay in only one environment
  const existing = await prisma.environmentAdmin.findFirst({ where: { adminEmpCode: empCode } });
  if (existing && existing.environmentId !== envId) {
    return NextResponse.json({ ok: false, error: "Admin already in another environment" }, { status: 409 });
  }

  // Upsert for this env
  const link = await prisma.environmentAdmin.upsert({
    where: { unique_env_admin: { environmentId: envId, adminEmpCode: empCode } },
    create: { environmentId: envId, adminEmpCode: empCode },
    update: {},
  });
  return NextResponse.json({ ok: true, id: link.id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const envId = Number(id);
  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: "Bad environment id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const empCode = typeof body?.empCode === "string" ? body.empCode.trim() : "";
  if (!empCode) return NextResponse.json({ ok: false, error: "Missing empCode" }, { status: 400 });

  const link = await prisma.environmentAdmin.findUnique({
    where: { unique_env_admin: { environmentId: envId, adminEmpCode: empCode } },
  });
  if (!link) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  await prisma.environmentAdmin.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}

