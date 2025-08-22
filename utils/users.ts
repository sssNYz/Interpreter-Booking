import type { PrismaClient, RoleCode } from "@prisma/client";

export type PageSize = 10 | 20 | 50;
export type RoleFilter = "ALL" | Extract<RoleCode, "ADMIN" | "INTERPRETER">;

export interface ParsedQuery {
  search: string;
  role: RoleFilter;
  department: string;
  group: string;
  section: string;
  page: number;
  pageSize: PageSize;
  includeTree: boolean;
}

// ---------- New: split/normalize ----------
const SPLIT_RE = /\s*\\\s*/; // แยกด้วย backslash โดยไม่แคร์ช่องว่าง

export function splitPath(path?: string | null): string[] {
  if (!path) return [];
  return String(path)
    .split(SPLIT_RE)
    .map(s => s.trim())
    .filter(Boolean);
}

export function buildParts(dep: string, grp: string, sec: string): string[] {
  const parts: string[] = [];
  if (dep !== "ALL") parts.push(dep);
  if (grp !== "ALL") parts.push(grp);
  if (sec !== "ALL") parts.push(sec);
  return parts;
}

/** เทียบแบบ segment-prefix: [dep, grp, sec] ต้องตรงตามลำดับ */
export function hasSegmentPrefix(userPath: string | null | undefined, parts: string[]): boolean {
  if (!parts.length) return true;
  const seg = splitPath(userPath);
  if (parts.length > seg.length) return false;
  for (let i = 0; i < parts.length; i++) {
    if (seg[i] !== parts[i]) return false;
  }
  return true;
}

export function parseQuery(url: string): ParsedQuery {
  const sp = new URL(url).searchParams;
  const pageNum = Number(sp.get("page") ?? 1);
  const sizeNum = Number(sp.get("pageSize") ?? 10);

  const roleUp = (sp.get("role") ?? "ALL").toUpperCase();
  const role: RoleFilter = roleUp === "ADMIN" || roleUp === "INTERPRETER" ? roleUp : "ALL";

  return {
    search: (sp.get("search") ?? "").trim(),
    role,
    department: sp.get("department") ?? "ALL",
    group: sp.get("group") ?? "ALL",
    section: sp.get("section") ?? "ALL",
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: (new Set([10, 20, 50]).has(sizeNum) ? sizeNum : 10) as PageSize,
    includeTree: (sp.get("includeTree") ?? "true").toLowerCase() !== "false",
  };
}

// ---------- ใช้ split แบบเดียวกันในการสร้าง tree ----------
export async function buildFilterTree(prisma: PrismaClient) {
  const rows = await prisma.employee.findMany({
    where: { deptPath: { not: null } },
    select: { deptPath: true },
  });

  const tmp: Record<string, Record<string, Set<string>>> = {};
  for (const r of rows) {
    const [dep, grp, sec] = splitPath(r.deptPath);
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
}
