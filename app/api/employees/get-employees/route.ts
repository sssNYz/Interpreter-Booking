import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
import { centerPart, splitPath } from "@/utils/users";
import {
  parseQuery,
  buildParts,
  hasSegmentPrefix,
  buildFilterTree,
  type ParsedQuery,
} from "@/utils/users";

export async function GET(req: NextRequest) {
  try {
    const q: ParsedQuery = parseQuery(req.url);
    const parts = buildParts(q.department, q.group, q.section); // ['R&D', 'DEDE', 'DDES'] หรือ []

    // --------- Search block (ตัด mode ออก ถ้า prisma เก่า) ----------
    const orSearch: Prisma.EmployeeWhereInput[] = q.search
      ? [
          { firstNameEn: { contains: q.search } },
          { lastNameEn:  { contains: q.search } },
          { firstNameTh: { contains: q.search } },
          { lastNameTh:  { contains: q.search } },
          { email:       { contains: q.search } },
          { empCode:     { contains: q.search } },
        ]
      : [];

    // --------- ลดชุดใน DB ด้วย contains ทีละ segment ----------
    const segmentReduce: Prisma.EmployeeWhereInput[] = parts.map((p) => ({
      deptPath: { contains: p },
    }));

    // ----- Vision scope: NOW disabled for admin (can see all users) -----
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    // Keep variables for future use, but do not restrict admins
    let visionOr: Prisma.EmployeeWhereInput[] = [];

    const baseWhere: Prisma.EmployeeWhereInput = {
      AND: [
        ...(orSearch.length ? [{ OR: orSearch }] : []),
        ...(segmentReduce.length ? segmentReduce : []),
        ...(visionOr.length ? [{ OR: visionOr }] : []),
      ],
    };

    const where: Prisma.EmployeeWhereInput =
      q.role === "ALL"
        ? baseWhere
        : { ...baseWhere, userRoles: { some: { roleCode: q.role } } };

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: { userRoles: true },
        orderBy: [{ updatedAt: "desc" }, { empCode: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    // --------- กรองซ้ำแบบ segment เพื่อความแม่นยำ ----------
    let pageRows = parts.length
      ? employees.filter((e) => hasSegmentPrefix(e.deptPath, parts))
      : employees;

    // Precise vision filter (center match) for admins (non-super)
    // No extra admin vision filter here (admins can view all users)

    const users = pageRows.map((e) => ({
      id: e.id,
      empCode: e.empCode,
      firstNameEn: e.firstNameEn,
      lastNameEn: e.lastNameEn,
      firstNameTh: e.firstNameTh,
      lastNameTh: e.lastNameTh,
      email: e.email,
      isActive: e.isActive,
      deptPath: e.deptPath,
      roles: e.userRoles.map((r) => r.roleCode),
      updatedAt: e.updatedAt.toISOString(),
    }));

    // สถิติตาม baseWhere (ไม่ผูกกับ role เฉพาะ)
    const [admins, interpreters] = await Promise.all([
      prisma.employee.count({
        where: { ...baseWhere, userRoles: { some: { roleCode: "ADMIN" } } },
      }),
      prisma.employee.count({
        where: { ...baseWhere, userRoles: { some: { roleCode: "INTERPRETER" } } },
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      },
      stats: { total, admins, interpreters },
      // Build tree from currently visible rows to reflect vision scope
      tree: q.includeTree
        ? (() => {
            const tmp: Record<string, Record<string, Set<string>>> = {};
            for (const e of pageRows) {
              const [dep, grp, sec] = splitPath(e.deptPath);
              if (!dep) continue;
              tmp[dep] ??= {};
              if (!grp) continue;
              tmp[dep][grp] ??= new Set<string>();
              if (sec) tmp[dep][grp].add(sec);
            }
            const result: Record<string, Record<string, string[]>> = {};
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
            for (const dep of Object.keys(tmp).sort(collator.compare)) {
              result[dep] = {};
              for (const grp of Object.keys(tmp[dep]).sort(collator.compare)) {
                result[dep][grp] = Array.from(tmp[dep][grp]).sort(collator.compare);
              }
            }
            return result;
          })()
        : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
