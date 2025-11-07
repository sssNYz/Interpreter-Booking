// app/api/bookings/[id]/interpreter/route.ts
import { NextResponse } from "next/server"
import prisma from "@/prisma/prisma"
import { RoleCode } from "@prisma/client"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session"
import { centerPart } from "@/utils/users"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PatchBody = {
  newInterpreterEmpCode: string
  updatedAt: string // ISO จาก GET availability/booking
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: ADMIN or SUPER_ADMIN only
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value
    const parsedSession = verifySessionCookieValue(cookieValue)
    if (!parsedSession) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }
    const requester = await prisma.employee.findUnique({
      where: { empCode: parsedSession.empCode },
      include: { userRoles: true },
    })
    const roles = requester?.userRoles?.map(r => r.roleCode) ?? []
    const isSuper = roles.includes("SUPER_ADMIN")
    const isAdmin = roles.includes("ADMIN") || isSuper
    if (!isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }
    // Allowed centers: union of admin's environment centers (fallback to user's own center)
    const myCenter = centerPart(requester?.deptPath ?? null)
    const envs = await prisma.environmentAdmin.findMany({
      where: { adminEmpCode: requester!.empCode },
      select: { environment: { select: { centers: { select: { center: true } } } } },
    })
    const envCenters = envs.flatMap(e => e.environment.centers.map(c => c.center))
    const allowCenters = new Set(envCenters)
    const { id } = await ctx.params
    const bookingId = Number.parseInt(id, 10)
    if (!Number.isInteger(bookingId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid booking id" }, { status: 400 })
    }

    const raw = (await req.json().catch(() => null)) as unknown
    const body = raw as PatchBody | null
    if (!body || typeof body.newInterpreterEmpCode !== "string" || typeof body.updatedAt !== "string") {
      return NextResponse.json({ error: "BAD_REQUEST", message: "newInterpreterEmpCode and updatedAt are required" }, { status: 400 })
    }
    const newCode = body.newInterpreterEmpCode.trim()
    if (newCode.length === 0 || newCode.length > 64) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "newInterpreterEmpCode is invalid" }, { status: 400 })
    }
    const clientUpdatedAt = new Date(body.updatedAt)
    if (Number.isNaN(clientUpdatedAt.getTime())) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "updatedAt must be ISO datetime" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) โหลด booking
      const bk = await tx.bookingPlan.findUnique({
        where: { bookingId },
        select: {
          bookingId: true,
          bookingStatus: true,
          timeStart: true,
          timeEnd: true,
          interpreterEmpCode: true,
          updatedAt: true,
          employee: { select: { deptPath: true } },
        },
      })
      if (!bk) return { status: 404 as const, payload: { error: "NOT_FOUND", message: "Booking not found" } }
      if (bk.bookingStatus === "cancel") {
        return { status: 422 as const, payload: { error: "POLICY_VIOLATION", message: "Booking is canceled" } }
      }

      // Environment scope for non-super admins: owner's center OR forwarded to my environment
      if (!isSuper) {
        const bCenter = centerPart(bk.employee?.deptPath ?? null)
        const allow = allowCenters.size ? allowCenters : (myCenter ? new Set([myCenter]) : new Set<string>())
        let allowedByScope = !!(bCenter && allow.has(bCenter))
        if (!allowedByScope) {
          const envLinks = await tx.environmentAdmin.findMany({ where: { adminEmpCode: requester!.empCode }, select: { environmentId: true } })
          const envIds = envLinks.map(e => e.environmentId)
          if (envIds.length > 0) {
            const f = await tx.bookingForwardTarget.findFirst({ where: { bookingId: bk.bookingId, environmentId: { in: envIds } }, select: { bookingId: true } })
            allowedByScope = !!f
          }
        }
        if (!allowedByScope) {
          return { status: 403 as const, payload: { error: "FORBIDDEN", message: "Out of admin vision" } }
        }
      }

      // คนเดิม → ผ่าน (ไม่แก้ DB)
      if (bk.interpreterEmpCode === newCode) {
        return { status: 200 as const, payload: { ok: true, unchanged: true, bookingId: bk.bookingId } }
      }

      // 2) ต้องเป็น "ล่ามจริง" + active
      const emp = await tx.employee.findFirst({
        where: {
          empCode: newCode,
          isActive: true,
          userRoles: { some: { roleCode: RoleCode.INTERPRETER } },
        },
        select: { id: true },
      })
      if (!emp) {
        return {
          status: 400 as const,
          payload: { error: "INVALID_INTERPRETER", message: "Interpreter not found, inactive, or not in INTERPRETER role" },
        }
      }

      // 3) กัน race ด้วย named lock
      const lockKey = `interpreter:${newCode}`
      const lockRow = await tx.$queryRaw<{ l: number }[]>`SELECT GET_LOCK(${lockKey}, 5) AS l`
      if (!lockRow?.[0] || Number(lockRow[0].l) !== 1) {
        return { status: 423 as const, payload: { error: "LOCK_TIMEOUT", message: "Interpreter busy, try again" } }
      }

      try {
        // 4) เช็กชนเวลา (exclusive): start < other.end && end > other.start
        const conflict = await tx.bookingPlan.findFirst({
          where: {
            bookingId: { not: bk.bookingId },
            interpreterEmpCode: newCode,
            bookingStatus: { not: "cancel" },
            AND: [{ timeStart: { lt: bk.timeEnd } }, { timeEnd: { gt: bk.timeStart } }],
          },
          select: { bookingId: true, timeStart: true, timeEnd: true },
        })
        if (conflict) {
          return {
            status: 409 as const,
            payload: {
              error: "INTERPRETER_CONFLICT",
              message: `Interpreter overlaps booking ${conflict.bookingId}`,
              conflict,
            },
          }
        }

        // 5) Optimistic concurrency ด้วย updatedAt เดิม
        const upd = await tx.bookingPlan.updateMany({
          where: { bookingId: bk.bookingId, updatedAt: clientUpdatedAt },
          data: { interpreterEmpCode: newCode },
        })
        if (upd.count !== 1) {
          return { status: 409 as const, payload: { error: "VERSION_CONFLICT", message: "Booking has been updated by someone else" } }
        }

        const latest = await tx.bookingPlan.findUnique({
          where: { bookingId: bk.bookingId },
          select: {
            bookingId: true,
            interpreterEmpCode: true,
            timeStart: true,
            timeEnd: true,
            bookingStatus: true,
            updatedAt: true,
          },
        })

        return {
          status: 200 as const,
          payload: latest,
          // Pass info for email handling
          emailContext: {
            wasApproved: bk.bookingStatus === "approve",
            oldInterpreterEmpCode: bk.interpreterEmpCode,
            newInterpreterEmpCode: newCode
          }
        }
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`
      }
    })

    // ⚠️ EMAIL TRIGGER DISABLED - Moved to unified Apply endpoint
    // This prevents duplicate emails and ensures emails are only sent after "Apply" action
    // See EMAIL_CONSOLIDATION_PLAN.md for details
    //
    // TODO: Implement unified Apply endpoint that:
    // 1. Detects all changes (interpreter, time, room)
    // 2. Sends single combined email
    // 3. Only triggers on "Apply" (not "Save")
    //
    // Old code (DISABLED):
    /*
    if (result.status === 200 && 'emailContext' in result && result.emailContext?.wasApproved) {
      const { oldInterpreterEmpCode, newInterpreterEmpCode } = result.emailContext
      if (oldInterpreterEmpCode && oldInterpreterEmpCode !== newInterpreterEmpCode) {
        // ... email sending code ...
      }
    }
    */
    
    // Log the change for debugging
    if (result.status === 200 && 'emailContext' in result && result.emailContext?.wasApproved) {
      const { oldInterpreterEmpCode, newInterpreterEmpCode } = result.emailContext
      if (oldInterpreterEmpCode && oldInterpreterEmpCode !== newInterpreterEmpCode) {
        console.log(`[EMAIL] Interpreter changed for approved booking ${bookingId}: ${oldInterpreterEmpCode} → ${newInterpreterEmpCode}`)
        console.log(`[EMAIL] Email notification will be sent when user clicks "Apply" button`)
      }
    }

    return NextResponse.json(result.payload, { status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 })
  }
}