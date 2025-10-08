import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/prisma/prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart } from "@/utils/users";

type Body = {
  interpreterEmpCode: string;
  note?: string;
};

async function getRequester() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionCookieValue(cookieValue);
  if (!parsed) return null;
  const requester = await prisma.employee.findUnique({
    where: { empCode: parsed.empCode },
    include: { userRoles: true },
  });
  if (!requester) return null;
  const roles = new Set((requester.userRoles ?? []).map((r) => r.roleCode));
  const isSuper = roles.has("SUPER_ADMIN");
  const isAdmin = isSuper || roles.has("ADMIN");
  return { requester, isAdmin, isSuper };
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
    if (!body || typeof body.interpreterEmpCode !== "string" || body.interpreterEmpCode.trim().length === 0) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "interpreterEmpCode is required" }, { status: 400 });
    }
    const newCode = body.interpreterEmpCode.trim();
    const note = typeof body.note === "string" ? body.note.trim() : undefined;

    const result = await prisma.$transaction(async (tx) => {
      // Load booking with owner dept and current state
      const bk = await tx.bookingPlan.findUnique({
        where: { bookingId },
        select: {
          bookingId: true,
          bookingStatus: true,
          timeStart: true,
          timeEnd: true,
          forwardActions: true,
          employee: { select: { deptPath: true } },
        },
      });
      if (!bk) return { status: 404 as const, payload: { error: "NOT_FOUND" as const } };
      if (bk.bookingStatus === "cancel") {
        return { status: 422 as const, payload: { error: "POLICY_VIOLATION", message: "Booking is canceled" } };
      }
      if (bk.bookingStatus !== "waiting") {
        return { status: 409 as const, payload: { error: "CONFLICT", message: "Booking not in waiting status" } };
      }

      // Scope: non-super admins must manage within their environments.
      if (!auth.isSuper) {
        const myCenter = centerPart(auth.requester.deptPath ?? null);
        const envs = await tx.environmentAdmin.findMany({
          where: { adminEmpCode: auth.requester.empCode },
          select: { environmentId: true, environment: { select: { centers: { select: { center: true } } } } },
        });
        const envIds = envs.map((e) => e.environmentId);
        const allowCenters = new Set(envs.flatMap((e) => e.environment.centers.map((c) => c.center)));
        const bCenter = centerPart(bk.employee?.deptPath ?? null);
        const allowedCenters = allowCenters.size ? allowCenters : (myCenter ? new Set([myCenter]) : new Set<string>());

        // Allow if booking owner's center is within scope OR the booking is forwarded to one of admin's environments
        let allowedByScope = !!(bCenter && allowedCenters.has(bCenter));
        if (!allowedByScope && envIds.length > 0) {
          const forwarded = await tx.bookingForwardTarget.findFirst({
            where: { bookingId: bk.bookingId, environmentId: { in: envIds } },
            select: { bookingId: true },
          });
          allowedByScope = !!forwarded;
        }
        if (!allowedByScope) {
          return { status: 403 as const, payload: { error: "FORBIDDEN", message: "Out of admin scope" } };
        }

        // Interpreter must belong to one of admin's environments
        if (envIds.length > 0) {
          const link = await tx.environmentInterpreter.findFirst({
            where: { interpreterEmpCode: newCode, environmentId: { in: envIds } },
            select: { id: true },
          });
          if (!link) {
            return { status: 403 as const, payload: { error: "FORBIDDEN", message: "Interpreter outside environment" } };
          }
        }
      }

      // Interpreter validity
      const emp = await tx.employee.findFirst({
        where: {
          empCode: newCode,
          isActive: true,
          userRoles: { some: { roleCode: "INTERPRETER" } },
        },
        select: { empCode: true },
      });
      if (!emp) {
        return { status: 400 as const, payload: { error: "INVALID_INTERPRETER", message: "Interpreter not found/active/role" } };
      }

      // Named lock to avoid concurrent double-booking
      const lockKey = `interpreter:${newCode}`;
      const lockRow = await tx.$queryRaw<{ l: number }[]>`SELECT GET_LOCK(${lockKey}, 5) AS l`;
      if (!lockRow?.[0] || Number(lockRow[0].l) !== 1) {
        return { status: 423 as const, payload: { error: "LOCK_TIMEOUT", message: "Interpreter busy, try again" } };
      }

      try {
        // Conflict check: existing non-cancel overlapping booking for interpreter
        const conflict = await tx.bookingPlan.findFirst({
          where: {
            bookingStatus: { not: "cancel" },
            interpreterEmpCode: newCode,
            AND: [{ timeStart: { lt: bk.timeEnd } }, { timeEnd: { gt: bk.timeStart } }],
          },
          select: { bookingId: true, timeStart: true, timeEnd: true },
        });
        if (conflict) {
          return {
            status: 409 as const,
            payload: {
              error: "INTERPRETER_CONFLICT",
              message: `Interpreter overlaps booking ${conflict.bookingId}`,
              conflict,
            },
          };
        }

        // Approve booking: set interpreter and status
        await tx.bookingPlan.update({
          where: { bookingId: bk.bookingId },
          data: { interpreterEmpCode: newCode, bookingStatus: "approve", isForwarded: false },
        });

        // Remove all forward targets for this booking
        await tx.bookingForwardTarget.deleteMany({ where: { bookingId: bk.bookingId } });

        // Append action log
        const fa = Array.isArray(bk.forwardActions) ? (bk.forwardActions as unknown[]) : [];
        fa.push({
          empCode: auth.requester.empCode,
          action: "APPROVE",
          at: new Date().toISOString(),
          note: note || null,
        });
        await tx.bookingPlan.update({
          where: { bookingId: bk.bookingId },
          data: { forwardActions: fa as unknown as any },
        });

        // Return latest state
        const latest = await tx.bookingPlan.findUnique({
          where: { bookingId: bk.bookingId },
          include: { employee: true, interpreterEmployee: true },
        });
        return { status: 200 as const, payload: latest };
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`;
      }
    });

    // Send approval email (fire-and-forget)
    if (result.status === 200) {
      try {
        console.log(`[ADMIN_APPROVE] Triggering approval email for booking ${bookingId}`)
        const { sendApprovalEmailForBooking } = await import('@/lib/mail/sender')
        sendApprovalEmailForBooking(bookingId).catch((err) => {
          console.error(`[ADMIN_APPROVE] Failed to send approval email for booking ${bookingId}:`, err)
        })
      } catch (err) {
        console.error('[ADMIN_APPROVE] Error in email trigger block:', err)
      }
    }

    return NextResponse.json(result.payload as any, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
