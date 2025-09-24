import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

type Body = {
  note?: string;
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
    const note = typeof body?.note === "string" ? body!.note.trim() : undefined;

    const result = await prisma.$transaction(async (tx) => {
      // Load booking
      const bk = await tx.bookingPlan.findUnique({
        where: { bookingId },
        select: {
          bookingId: true,
          bookingStatus: true,
          forwardActions: true,
        },
      });
      if (!bk) return { status: 404 as const, payload: { error: "NOT_FOUND" } };
      if (bk.bookingStatus === "cancel") {
        return { status: 200 as const, payload: { ok: true, status: "cancel", remainingTargets: 0 } };
      }

      // Determine environments this admin manages
      const envs = await tx.environmentAdmin.findMany({
        where: { adminEmpCode: auth.requester.empCode },
        select: { environmentId: true },
      });
      const envIds = envs.map((e) => e.environmentId);
      // If admin has no environments, treat as no-op scope
      if (envIds.length === 0) {
        return { status: 403 as const, payload: { error: "FORBIDDEN", message: "No environment scope" } };
      }

      // Get targets to delete for logging
      const targets = await tx.bookingForwardTarget.findMany({
        where: { bookingId, environmentId: { in: envIds } },
        select: { environmentId: true },
      });

      // Delete targets
      await tx.bookingForwardTarget.deleteMany({ where: { bookingId, environmentId: { in: envIds } } });

      // Count remaining targets
      const remaining = await tx.bookingForwardTarget.count({ where: { bookingId } });

      // Update booking status if no more targets
      if (remaining === 0) {
        await tx.bookingPlan.update({ where: { bookingId }, data: { bookingStatus: "cancel", isForwarded: false } });
      }

      // Append action logs, one per removed target (or one generic if none matched)
      const fa = Array.isArray(bk.forwardActions) ? (bk.forwardActions as unknown[]) : [];
      if (targets.length > 0) {
        for (const t of targets) {
          fa.push({
            empCode: auth.requester.empCode,
            action: "CANCEL",
            environmentId: t.environmentId,
            at: new Date().toISOString(),
            note: note || null,
          });
        }
      } else {
        fa.push({
          empCode: auth.requester.empCode,
          action: "CANCEL",
          environmentId: null,
          at: new Date().toISOString(),
          note: note || null,
        });
      }
      await tx.bookingPlan.update({ where: { bookingId }, data: { forwardActions: fa as unknown as any } });

      return { status: 200 as const, payload: { ok: true, status: remaining === 0 ? "cancel" : "waiting", remainingTargets: remaining } };
    });

    return NextResponse.json(result.payload as any, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
