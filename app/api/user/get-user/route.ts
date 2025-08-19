import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import type { Prisma } from "@prisma/client";
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

    const baseWhere: Prisma.EmployeeWhereInput = {
      AND: [
        ...(orSearch.length ? [{ OR: orSearch }] : []),
        ...(segmentReduce.length ? segmentReduce : []),
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
    const pageRows = parts.length
      ? employees.filter((e) => hasSegmentPrefix(e.deptPath, parts))
      : employees;

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
      tree: q.includeTree ? await buildFilterTree(prisma) : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
