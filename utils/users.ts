import type { PrismaClient, RoleCode } from "@prisma/client";

export const DELIM = " \\ " as const;
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

export interface FilterTree {
  [department: string]: { [group: string]: string[] };
}

const PAGE_SIZES: ReadonlySet<number> = new Set([10, 20, 50]);

export function parseQuery(url: string): ParsedQuery {
  const sp = new URL(url).searchParams;
  const pageNum = Number(sp.get("page") ?? 1);
  const sizeNum = Number(sp.get("pageSize") ?? 10);

  const roleUp = (sp.get("role") ?? "ALL").toUpperCase();
  const role: RoleFilter =
    roleUp === "ADMIN" || roleUp === "INTERPRETER" ? roleUp : "ALL";

  return {
    search: (sp.get("search") ?? "").trim(),
    role,
    department: sp.get("department") ?? "ALL",
    group: sp.get("group") ?? "ALL",
    section: sp.get("section") ?? "ALL",
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: (PAGE_SIZES.has(sizeNum) ? sizeNum : 10) as PageSize,
    includeTree: (sp.get("includeTree") ?? "true").toLowerCase() !== "false",
  };
}

export function buildDeptPrefix(dep: string, grp: string, sec: string): string {
  const parts: string[] = [];
  if (dep !== "ALL") parts.push(dep);
  if (grp !== "ALL") parts.push(grp);
  if (sec !== "ALL") parts.push(sec);
  return parts.join(DELIM);
}

export function hasPathSegmentPrefix(
  userPath: string | null | undefined,
  prefix: string | null | undefined
): boolean {
  if (!prefix) return true;
  if (!userPath) return false;
  const seg = userPath.split(DELIM).map((s) => s.trim());
  const pre = prefix.split(DELIM).map((s) => s.trim());
  if (pre.length > seg.length) return false;
  return pre.every((p, i) => seg[i] === p);
}
export async function buildFilterTree(prisma: PrismaClient) {
  const rows = await prisma.employee.findMany({
    where: { deptPath: { not: null } },
    select: { deptPath: true },
  });

  const tmp: Record<string, Record<string, Set<string>>> = {};
  for (const r of rows) {
    const [dep, grp, sec] = (r.deptPath ?? "")
      .split(DELIM)
      .map((s) => s.trim());
    if (!dep) continue;
    tmp[dep] ??= {};
    if (!grp) continue;
    tmp[dep][grp] ??= new Set<string>();
    if (sec) tmp[dep][grp].add(sec);
  }

  const result: FilterTree = {};
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  for (const dep of Object.keys(tmp).sort(collator.compare)) {
    result[dep] = {};
    for (const grp of Object.keys(tmp[dep]).sort(collator.compare)) {
      result[dep][grp] = Array.from(tmp[dep][grp]).sort(collator.compare);
    }
  }
  return result;
}
