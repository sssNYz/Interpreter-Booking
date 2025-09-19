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

export async function GET() {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const envs = await prisma.environment.findMany({
    include: {
      centers: { select: { id: true, center: true } },
      admins: { select: { adminEmpCode: true } },
      interpreters: { select: { interpreterEmpCode: true } },
    },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(envs);
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!requireAdmin(me)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof (body as any)?.name === "string" ? (body as any).name.trim() : "";
  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });

  try {
    const created = await prisma.environment.create({ data: { name } });
    return NextResponse.json({ ok: true, id: created.id, name: created.name });
  } catch (err: any) {
    // Unique constraint on name
    return NextResponse.json({ ok: false, error: "Create failed (maybe name exists)" }, { status: 409 });
  }
}

