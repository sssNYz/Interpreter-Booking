  // NOTE: Protected by middleware via cookie session
  // app/api/bookings/route.ts
import { NextResponse } from "next/server";
  import prisma from "@/prisma/prisma";
  import { cookies } from "next/headers";
  import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";
  import { centerPart } from "@/utils/users";
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

  // Pure string extraction using ISO; avoid timezone math entirely
  const extractYMD = (iso: string) => iso.split("T")[0];
  const extractHHMM = (iso: string) => iso.split("T")[1].slice(0, 5);

// 'approve'|'cancel'|'waiting'|'complet' -> 'Approve'|'Cancel'|'Wait'|'Complete'
const mapStatus = (
  s: "approve" | "cancel" | "waiting" | "complet"
): "Approve" | "Cancel" | "Wait" | "Complete" => {
  if (s === "approve") return "Approve";
  if (s === "cancel") return "Cancel";
  if (s === "waiting") return "Wait";
  return "Complete";
};

  export async function GET(req: Request) {
    // Auth: only ADMIN or SUPER_ADMIN can access
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionCookieValue(cookieValue);
    if (!parsed) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const me = await prisma.employee.findUnique({
      where: { empCode: parsed.empCode },
      include: { userRoles: true },
    });
    const roles = me?.userRoles?.map(r => r.roleCode) ?? [];
    const isSuper = roles.includes("SUPER_ADMIN");
    const isAdmin = roles.includes("ADMIN") || isSuper;
    if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const myCenter = centerPart(me?.deptPath ?? null);
    // Admin env centers (union)
    let adminEnvCenters: string[] = [];
    let adminEnvInterpreterCodes: string[] = [];
    if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) {
      const envs = await prisma.environmentAdmin.findMany({
        where: { adminEmpCode: me!.empCode },
        select: { environmentId: true, environment: { select: { centers: { select: { center: true } } } } },
      });
      adminEnvCenters = envs.flatMap(e => e.environment.centers.map(c => c.center));
      const envIds = envs.map(e => e.environmentId);
      if (envIds.length) {
        const links = await prisma.environmentInterpreter.findMany({ where: { environmentId: { in: envIds } }, select: { interpreterEmpCode: true } });
        adminEnvInterpreterCodes = links.map(l => l.interpreterEmpCode);
      }
    }
    // User env centers
    let userEnvCenters: string[] = [];
    let userEnvInterpreterCodes: string[] = [];
    if (myCenter) {
      const envCenter = await prisma.environmentCenter.findUnique({ where: { center: myCenter } });
      if (envCenter) {
        const env = await prisma.environment.findUnique({ where: { id: envCenter.environmentId }, select: { centers: { select: { center: true } } } });
        userEnvCenters = env?.centers.map(c => c.center) ?? [];
        const links = await prisma.environmentInterpreter.findMany({ where: { environmentId: envCenter.environmentId }, select: { interpreterEmpCode: true } });
        userEnvInterpreterCodes = links.map(l => l.interpreterEmpCode);
      }
    }

    const url = new URL(req.url);
    const viewRaw = (url.searchParams.get("view") || "").toLowerCase();
    const view: "user"|"admin"|"all" = viewRaw === "user" || viewRaw === "admin" || viewRaw === "all" ? (viewRaw as "user"|"admin"|"all") : "admin";

    const rows = await prisma.bookingPlan.findMany({
      orderBy: { timeStart: "asc" },
      include: {
        employee: { select: { firstNameEn: true, lastNameEn: true, deptPath: true } },
        interpreterEmployee: { select: { empCode: true, firstNameEn: true, lastNameEn: true } },
      },
    });

    // Filter by vision
    let filtered = rows;
    if (isSuper && (view === "admin" || view === "all")) {
      // all
    } else if (view === "admin") {
      const allowCenters = new Set((adminEnvCenters.length ? adminEnvCenters : (myCenter ? [myCenter] : [])));
      const allowInterpreters = new Set(adminEnvInterpreterCodes);
      filtered = rows.filter(b => {
        const c = centerPart(b.employee?.deptPath ?? null);
        // Split out forwarded bookings from admin environment view
        if (b.isForwarded) return false;
        const inCenters = c ? allowCenters.has(c) : false;
        const byInterpreter = b.interpreterEmployee?.empCode ? allowInterpreters.has(b.interpreterEmployee.empCode) : false;
        return inCenters || byInterpreter;
      });
    } else {
      const allowCenters = new Set((userEnvCenters.length ? userEnvCenters : (myCenter ? [myCenter] : [])));
      const allowInterpreters = new Set(userEnvInterpreterCodes);
      filtered = rows.filter(b => {
        const c = centerPart(b.employee?.deptPath ?? null);
        const inCenters = c ? allowCenters.has(c) : false;
        const byInterpreter = b.interpreterEmployee?.empCode ? allowInterpreters.has(b.interpreterEmployee.empCode) : false;
        return inCenters || byInterpreter;
      });
    }

    const result = filtered.map((b) => {
      const bookedBy = `${b.employee?.firstNameEn ?? ""} ${b.employee?.lastNameEn ?? ""}`.trim();
      const interpreter = b.interpreterEmployee
        ? `${b.interpreterEmployee.firstNameEn ?? ""} ${b.interpreterEmployee.lastNameEn ?? ""}`.trim()
        : "";

      return {
        id: b.bookingId,                          // number
        dateTime: extractYMD(b.timeStart.toISOString()),           // "YYYY-MM-DD"
        interpreter,                              // ชื่อ-นามสกุลล่าม
        room: b.meetingRoom,                      // string

        group: b.ownerGroup,                      // NEW: 'iot' | 'hardware' | 'software' | 'other'
        meetingDetail: b.meetingDetail ?? "",     // NEW: string (รายละเอียดเต็ม)

        // คงไว้เพื่อ compatibility กับโค้ดเดิม
        topic: b.meetingDetail ?? "",

        // Meeting type fields for correct badge rendering in UI
        meetingType: b.meetingType,
        drType: b.drType ?? undefined,
        otherType: b.otherType ?? undefined,
        isDR: b.meetingType === "DR",

      bookedBy, // ชื่อผู้จอง
      status: mapStatus(b.bookingStatus), // 'Approve' | 'Wait' | 'Cancel'
      startTime: extractHHMM(b.timeStart.toISOString()), // "HH:mm"
      endTime: extractHHMM(b.timeEnd.toISOString()), // "HH:mm"
      requestedTime: `${extractYMD(b.createdAt.toISOString())} ${extractHHMM(
        b.createdAt.toISOString()
      )}:00`,
    };
  });

  return NextResponse.json(result);
}
