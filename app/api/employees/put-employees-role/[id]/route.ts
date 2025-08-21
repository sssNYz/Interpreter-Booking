// app/api/user/put-user-role/[id]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/prisma/prisma';
import { z } from 'zod';
import { RoleCode } from '@prisma/client';

// ----- Types -----
type Ctx = { params: Promise<{ id: string }> };

// validate และทำให้ได้ type ที่ชัดเจน
const BodySchema = z.object({
  roles: z.array(z.nativeEnum(RoleCode)).min(0), // RoleCode[] แบบชัวร์
});

// ----- GET -----
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // <- ต้อง await
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const user = await prisma.employee.findUnique({
    where: { id: userId },
    include: { userRoles: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    empCode: user.empCode,
    name: [user.firstNameEn, user.lastNameEn].filter(Boolean).join(' '),
    email: user.email,
    roles: user.userRoles.map((r) => r.roleCode as RoleCode),
  });
}

// ----- PUT (replace roles) -----
export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // อ่าน body เป็น unknown -> parse ด้วย zod -> ได้ type-safe
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(bodyUnknown);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const roles: RoleCode[] = parsed.data.roles;

  // ดำเนินการแบบ type-safe ทั้งหมด
  try {
    const exists = await prisma.employee.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (roles.length) {
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId, roleCode: r })), // r เป็น RoleCode แล้ว ไม่ต้อง cast
          skipDuplicates: true,
        });
      }
    });

    const after = await prisma.userRole.findMany({
      where: { userId },
      select: { roleCode: true },
    });

    return NextResponse.json(
      { userId, roles: after.map((r) => r.roleCode as RoleCode) },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
