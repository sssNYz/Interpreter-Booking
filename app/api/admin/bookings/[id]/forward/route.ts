import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

type Body = {
  environmentIds: number[]; // target environments
  note: string;
};

async function getRequester() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null as const;
  const requester = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
    include: { userRoles: true },
  });
  if (!requester) return null as const;
  const roles = new Set((requester.userRoles ?? []).map((r) => r.roleCode));
  const isSuper = roles.has("SUPER_ADMIN");
  const isAdmin = isSuper || roles.has("ADMIN");
  return { requester, isAdmin, isSuper } as const;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRequester();
    if (!auth?.isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const bookingId = Number.parseInt(id, 10);
    if (!Number.isInteger(bookingId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid booking id" }, { status: 400 });
    }

    const raw = (await req.json().catch(() => null)) as unknown;
    const body = raw as Body | null;
    const envIds = Array.isArray(body?.environmentIds) ? body!.environmentIds.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [];
    const note = typeof body?.note === "string" ? body!.note.trim() : "";
    if (envIds.length === 0 || note.length === 0) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "environmentIds[] and note are required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Load booking
      const bk = await tx.bookingPlan.findUnique({
        where: { bookingId },
        select: { bookingId: true, bookingStatus: true, forwardActions: true },
      });
      if (!bk) return { status: 404 as const, payload: { error: "NOT_FOUND" } };
      if (bk.bookingStatus !== "waiting") {
        return { status: 409 as const, payload: { error: "CONFLICT", message: "Only waiting bookings can be forwarded" } };
      }

      // Validate target environments exist
      const envs = await tx.environment.findMany({
        where: { id: { in: envIds } },
        select: { id: true },
      });
      const valid = new Set(envs.map((e) => e.id));
      const invalid = envIds.filter((t) => !valid.has(t));
      if (invalid.length > 0) {
        return { status: 400 as const, payload: { error: "INVALID_TARGETS", environmentIds: invalid } };
      }

      // Insert targets idempotently
      for (const t of valid) {
        await tx.bookingForwardTarget.upsert({
          where: { bookingId_environmentId: { bookingId, environmentId: t } },
          create: { bookingId, environmentId: t },
          update: {},
        });
      }

      // Mark as forwarded and set forwardedBy
      await tx.bookingPlan.update({
        where: { bookingId },
        data: { isForwarded: true, forwardedByEmpCode: auth.requester.empCode },
      });

      // Append action logs
      const fa = Array.isArray(bk.forwardActions) ? (bk.forwardActions as unknown[]) : [];
      for (const t of valid) {
        fa.push({
          empCode: auth.requester.empCode,
          action: "FORWARD",
          environmentId: t,
          at: new Date().toISOString(),
          note,
        });
      }
      await tx.bookingPlan.update({ where: { bookingId }, data: { forwardActions: fa as unknown as any } });

      return { status: 200 as const, payload: { ok: true } };
    });

    return NextResponse.json(result.payload as any, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
