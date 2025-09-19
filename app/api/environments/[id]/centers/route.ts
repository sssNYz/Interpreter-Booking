import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

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

async function centerExistsInDB(center: string): Promise<boolean> {
  // Try a light search, then verify centerPart in memory for accuracy
  const rows = await prisma.employee.findMany({
    where: { deptPath: { contains: center } },
    select: { deptPath: true },
    take: 250, // limit scan
  });
  return rows.some(r => centerPart(r.deptPath) === center);
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
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  if (!center) return NextResponse.json({ ok: false, error: "Missing center" }, { status: 400 });

  // Optional: verify this center appears in DB dept paths
  const exists = await centerExistsInDB(center);
  if (!exists) return NextResponse.json({ ok: false, error: "Center not found in DB" }, { status: 400 });

  try {
    const created = await prisma.environmentCenter.create({ data: { environmentId: envId, center } });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err: any) {
    // Unique center constraint (center unique globally)
    return NextResponse.json({ ok: false, error: "Center already assigned to an environment" }, { status: 409 });
  }
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
  const center = typeof body?.center === "string" ? body.center.trim() : "";
  if (!center) return NextResponse.json({ ok: false, error: "Missing center" }, { status: 400 });

  const existing = await prisma.environmentCenter.findUnique({ where: { center } });
  if (!existing || existing.environmentId !== envId) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await prisma.environmentCenter.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}

