import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

function requireAdmin(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes("ADMIN") || roles?.includes("SUPER_ADMIN"));
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const envId = Number(id);
  if (!Number.isInteger(envId) || envId <= 0) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });
  try {
    const env = await prisma.environment.findUnique({
      where: { id: envId },
      include: { centers: true, admins: true, interpreters: true }
    });
    if (!env) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(env);
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const envId = Number(id);
  if (!Number.isInteger(envId) || envId <= 0) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const me = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } });
    const roles = me?.userRoles?.map(r => r.roleCode);
    if (!requireAdmin(roles)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? String(body.name).trim() : undefined;
    const isActive = typeof body?.isActive === 'boolean' ? Boolean(body.isActive) : undefined;

    const updated = await prisma.environment.update({
      where: { id: envId },
      data: { ...(name ? { name } : {}), ...(typeof isActive === 'boolean' ? { isActive } : {}) }
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

