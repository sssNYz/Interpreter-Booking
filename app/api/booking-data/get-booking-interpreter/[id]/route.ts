// app/api/bookings/[id]/interpreter/availability/route.ts
import { NextResponse } from "next/server"
import prisma from "@/prisma/prisma"
import type { Prisma } from "@prisma/client"
import { RoleCode } from "@prisma/client"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"


type NameParts = {
  firstNameTh: string | null
  lastNameTh: string | null
  firstNameEn: string | null
  lastNameEn: string | null
}

function buildName(p: NameParts): string {
  const th = `${p.firstNameTh ?? ""} ${p.lastNameTh ?? ""}`.trim()
  const en = `${p.firstNameEn ?? ""} ${p.lastNameEn ?? ""}`.trim()
  
  // If English name is too short (likely abbreviated), use Thai name if available
  if (en && en.length > 3) {
    return en
  } else if (th && th.length > 3) {
    return th
  } else {
    // Fallback to whatever is available
    return en || th
  }
}

// exclusive overlap: A.start < B.end && A.end > B.start
function overlapExclusive(start: Date, end: Date): Prisma.BookingPlanWhereInput {
  return { AND: [{ timeStart: { lt: end } }, { timeEnd: { gt: start } }] }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // Discover requester and environment scope (if admin)
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value
    const parsed = verifySessionCookieValue(cookieValue)
    let isSuper = false
    let envIds: number[] = []
    if (parsed) {
      const me = await prisma.employee.findUnique({ where: { empCode: parsed.empCode }, include: { userRoles: true } })
      const roles = new Set((me?.userRoles ?? []).map(r => r.roleCode))
      const isAdmin = roles.has("ADMIN") || roles.has("SUPER_ADMIN")
      isSuper = roles.has("SUPER_ADMIN")
      if (isAdmin && !isSuper) {
        const links = await prisma.environmentAdmin.findMany({ where: { adminEmpCode: parsed.empCode }, select: { environmentId: true } })
        envIds = links.map(l => l.environmentId)
      }
    }
    const { id } = await ctx.params
    const bookingId = Number(id)
    if (!Number.isInteger(bookingId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid booking id" }, { status: 400 })
    }

    const url = new URL(req.url)
    const empCode = url.searchParams.get("empCode") || undefined
    const excludeCurrent = url.searchParams.get("excludeCurrent") === "true"
    const limitRaw = Number(url.searchParams.get("limit") ?? "20")
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20), 100)

    const bk = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      select: { bookingId: true, timeStart: true, timeEnd: true, updatedAt: true, interpreterEmpCode: true, bookingStatus: true },
    })
    if (!bk) {
      console.error(`Booking not found: ${bookingId}`);
      return NextResponse.json({ 
        error: "NOT_FOUND", 
        message: `Booking with ID ${bookingId} not found`,
        bookingId 
      }, { status: 404 })
    }

    // --- เช็กคนเดียว (ต้องมีบทบาทล่ามด้วย) ---
    if (empCode) {
      // If admin (non-super), ensure the interpreter is in their environments
      if (envIds.length > 0) {
        const inEnv = await prisma.environmentInterpreter.findFirst({ where: { interpreterEmpCode: empCode, environmentId: { in: envIds } }, select: { id: true } })
        if (!inEnv) {
          return NextResponse.json({ error: "FORBIDDEN", message: "Interpreter outside environment" }, { status: 403 })
        }
      }
      const isInterpreter = await prisma.employee.findFirst({
        where: {
          empCode,
          isActive: true,
          userRoles: { some: { roleCode: RoleCode.INTERPRETER } },
        },
        select: { id: true },
      })
      if (!isInterpreter) {
        return NextResponse.json(
          { error: "INVALID_INTERPRETER_ROLE", message: "Employee is not an INTERPRETER or inactive" },
          { status: 400 }
        )
      }

      const conflict = await prisma.bookingPlan.findFirst({
        where: {
          bookingId: { not: bk.bookingId },
          interpreterEmpCode: empCode,
          bookingStatus: { not: "cancel" },
          ...overlapExclusive(bk.timeStart, bk.timeEnd),
        },
        select: { bookingId: true, timeStart: true, timeEnd: true },
      })

      if (conflict) {
        return NextResponse.json(
          { error: "INTERPRETER_CONFLICT", message: `Interpreter overlaps booking ${conflict.bookingId}`, conflict },
          { status: 409 }
        )
      }

      return NextResponse.json({
        ok: true,
        conflict: false,
        booking: {
          timeStart: bk.timeStart.toISOString(),
          timeEnd: bk.timeEnd.toISOString(),
          updatedAt: bk.updatedAt.toISOString(),
        },
      })
    }

    // --- ลิสต์เฉพาะ "ผู้มีบทบาทล่าม" ที่ไม่ชนเวลา ---
    const whereEmp: Prisma.EmployeeWhereInput = {
      isActive: true,
      userRoles: { some: { roleCode: RoleCode.INTERPRETER } },   // ← กรองบทบาทล่าม
      ...(excludeCurrent && bk.interpreterEmpCode ? { empCode: { not: bk.interpreterEmpCode } } : undefined),
      bookingsAsInterpreter: {
        none: {
          bookingStatus: { not: "cancel" },
          bookingId: { not: bk.bookingId },
          ...overlapExclusive(bk.timeStart, bk.timeEnd),
        },
      },
      ...(envIds.length > 0 ? { environmentInterpreterLinks: { some: { environmentId: { in: envIds } } } } : undefined),
    }

    const rows = await prisma.employee.findMany({
      where: whereEmp,
      select: { empCode: true, firstNameTh: true, lastNameTh: true, firstNameEn: true, lastNameEn: true },
      orderBy: [{ firstNameEn: "asc" }, { firstNameTh: "asc" }],
      take: limit,
    })

    const interpreters = rows.map(r => {
      const name = buildName(r)
      console.log(`Interpreter ${r.empCode}: EN="${r.firstNameEn} ${r.lastNameEn}", TH="${r.firstNameTh} ${r.lastNameTh}", Final="${name}"`)
      return { empCode: r.empCode, name }
    })

    return NextResponse.json({
      bookingId: bk.bookingId,
      timeStart: bk.timeStart.toISOString(),
      timeEnd: bk.timeEnd.toISOString(),
      updatedAt: bk.updatedAt.toISOString(),
      count: interpreters.length,
      interpreters,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 })
  }
}
