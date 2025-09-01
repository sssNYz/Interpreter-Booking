// app/api/bookings/[id]/interpreter/route.ts
import { NextResponse } from "next/server"
import prisma from "@/prisma/prisma"
import { RoleCode } from "@prisma/client"

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
        },
      })
      if (!bk) return { status: 404 as const, payload: { error: "NOT_FOUND", message: "Booking not found" } }
      if (bk.bookingStatus === "cancel") {
        return { status: 422 as const, payload: { error: "POLICY_VIOLATION", message: "Booking is canceled" } }
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

        return { status: 200 as const, payload: latest }
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`
      }
    })

    return NextResponse.json(result.payload, { status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 })
  }
}
