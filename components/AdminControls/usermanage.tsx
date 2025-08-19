'use client';

import React, { useMemo, useState, useEffect } from "react";
import { Users, Search, Shield, Languages, Edit3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { RoleFilter, AnyFilter, UserRow, FilterTree } from '@/types/user';

// ✅ เพิ่ม import dialog + type Role
import { UserRoleDialog } from "@/components/AdminForm/user-set-role";
import type { Role } from "@/types/user";

/* -------------------------------------------
   Theme tokens
------------------------------------------- */
const THEME = {
  page: "min-h-screen bg-[#f7f7f7] font-sans text-gray-900",
  card: "shadow-sm rounded-xl",
  headerCell: "bg-gray-100 text-gray-700",
  row: "border-b",
  badgeBase: "px-3 py-1 rounded-full text-xs font-medium",
} as const;

/* -------------------------------------------
   Helpers
------------------------------------------- */
type PageSize = 10 | 20 | 50;

type ApiStats = {
  total: number;
  admins: number;
  interpreters: number;
};

type ApiPagination = {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
};

type ApiResponse = {
  users: UserRow[];
  pagination: ApiPagination;
  stats: ApiStats;
  tree?: FilterTree;
};

const query = (params: Record<string, string | number | boolean>) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

/* -------------------------------------------
   Component
------------------------------------------- */
export default function UsersManagement() {
  // Data from API (list)
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tree, setTree] = useState<FilterTree>({});

  // Stats
  const [serverStats, setServerStats] = useState<ApiStats>({ total: 0, admins: 0, interpreters: 0 });
  const [globalStats, setGlobalStats] = useState<ApiStats | null>(null); // ใช้กับการ์ดเสมอ

  // Pagination from server
  const [serverPage, setServerPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [department, setDepartment] = useState<AnyFilter>("ALL");
  const [group, setGroup] = useState<AnyFilter>("ALL");
  const [section, setSection] = useState<AnyFilter>("ALL");

  // Pagination state (client drives)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  // ✅ refresh state ต้องอยู่ก่อน useEffect ที่ใช้งาน (กัน TS เตือน)
  const [refresh, setRefresh] = useState(0);

  // Reset page when filters changed
  useEffect(() => { setPage(1); }, [search, role, department, group, section, pageSize]);

  // Guard: ถ้าเลือก group/section ที่ไม่มีใน tree ให้รีเซ็ตเป็น "ALL"
  useEffect(() => {
    if (department !== "ALL") {
      const groups = Object.keys(tree[department as string] || {});
      if (!groups.length) {
        if (group !== "ALL") setGroup("ALL");
        if (section !== "ALL") setSection("ALL");
        return;
      }
      if (group !== "ALL" && !groups.includes(String(group))) {
        setGroup("ALL");
        setSection("ALL");
        return;
      }
      if (group !== "ALL") {
        const sections = (tree[department as string]?.[group as string] ?? []);
        if (section !== "ALL" && !sections.includes(String(section))) {
          setSection("ALL");
        }
      }
    } else {
      if (group !== "ALL") setGroup("ALL");
      if (section !== "ALL") setSection("ALL");
    }
  }, [department, group, section, tree]);

  // Options from tree
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);
  const groupOptions = useMemo(() => {
    if (department === "ALL") return [];
    const depKey = department as string;
    return Object.keys(tree[depKey] || {}).sort(collator.compare);
  }, [tree, department, collator]);

  const sectionOptions = useMemo(() => {
    if (department === "ALL" || group === "ALL") return [];
    const depKey = department as string;
    const grpKey = group as string;
    return (tree[depKey]?.[grpKey] || []).slice().sort(collator.compare);
  }, [tree, department, group, collator]);

  // Fetch list by filters (ใช้ endpoint เดียวกัน)
  useEffect(() => {
    const params = {
      search,
      role,
      department,
      group,
      section,
      page,
      pageSize,
      includeTree: page === 1, // ขอต้นไม้เฉพาะหน้าแรก เพื่อลด payload
    };
    const url = `/api/user/get-user?${query(params)}`;

    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
      const data: ApiResponse = await res.json();

      setUsers(data.users ?? []);
      setServerStats(data.stats ?? { total: 0, admins: 0, interpreters: 0 });
      setServerPage(data.pagination?.page ?? 1);
      setTotalPages(data.pagination?.totalPages ?? 1);
      if (data.tree) setTree(data.tree);
    })();
    // ✅ เพิ่ม refresh เข้า dependencies เพื่อ refetch หลัง save roles
  }, [search, role, department, group, section, page, pageSize, refresh]);

  // Fetch global stats once (ไม่ขึ้นกับฟิลเตอร์) — ใช้ endpoint เดียวกัน
  useEffect(() => {
    (async () => {
      const url = `/api/user/get-user?${query({
        search: "",
        role: "ALL",
        department: "ALL",
        group: "ALL",
        section: "ALL",
        page: 1,
        pageSize: 1,
        includeTree: false,
      })}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      if (data?.stats) setGlobalStats(data.stats);
    })();
  }, []);

  const displayName = (u: UserRow) =>
    [u.firstNameEn ?? u.firstNameTh, u.lastNameEn ?? u.lastNameTh].filter(Boolean).join(" ") || u.empCode;

  // ✅ ฟังก์ชันบันทึก role แล้วสั่ง refetch
  async function saveUserRoles(userId: number, roles: Role[]) {
    const res = await fetch(`/api/user/put-user-role/${encodeURIComponent(String(userId))}`, {
      method: "PUT", // ⬅️ เปลี่ยนเป็น PUT
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ roles }),
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const msg = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
      throw new Error(`(${res.status}) ${msg.slice(0, 200)}`);
    }
    if (!ct.includes("application/json")) {
      const text = await res.text();
      throw new Error(`Unexpected non-JSON response: ${text.slice(0, 200)}`);
    }
    // ถ้าต้องการ ใช้ค่าที่ API ส่งกลับมาอัปเดต state เพิ่มเติมได้
    setRefresh((r) => r + 1);
  }


  /* -------------------------------------------
     Render
  ------------------------------------------- */
  return (
    <div className={THEME.page}>
      {/* Header */}
      <div className="border-b bg-white border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-900 text-white rounded-full p-2">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Users Management</h1>
                <p className="text-sm text-gray-500">Filter by Department / Group / Section • Manage roles</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Cards — ใช้ globalStats เสมอ เพื่อไม่ผันตามฟิลเตอร์ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className={THEME.card}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-3xl font-bold">{(globalStats ?? serverStats).total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-sky-100 grid place-items-center">
                  <Users className="h-6 w-6 text-sky-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={THEME.card}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Admins</p>
                  <p className="text-3xl font-bold">{(globalStats ?? serverStats).admins}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 grid place-items-center">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={THEME.card}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Interpreters</p>
                  <p className="text-3xl font-bold">{(globalStats ?? serverStats).interpreters}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-yellow-100 grid place-items-center">
                  <Languages className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className={`${THEME.card} mb-6`}>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, email, or employee code…"
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Role */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <Select value={role} onValueChange={(v: RoleFilter) => setRole(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All roles</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="INTERPRETER">INTERPRETER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dept/Group/Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Department</Label>
                <Select
                  value={department}
                  onValueChange={(v: AnyFilter) => {
                    setDepartment(v);
                    setGroup("ALL");
                    setSection("ALL");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All departments</SelectItem>
                    {Object.keys(tree)
                      .sort(collator.compare)
                      .map((dep) => (
                        <SelectItem key={dep} value={dep}>
                          {dep}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Group</Label>
                <Select
                  disabled={department === "ALL"}
                  value={group}
                  onValueChange={(v: AnyFilter) => {
                    setGroup(v);
                    setSection("ALL");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All groups</SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Section</Label>
                <Select
                  disabled={department === "ALL" || group === "ALL"}
                  value={section}
                  onValueChange={(v: AnyFilter) => setSection(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All sections</SelectItem>
                    {sectionOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className={THEME.card}>
          <CardHeader>
            <CardTitle className="text-xl">All Users</CardTitle>
            <p className="text-sm text-gray-500">
              Showing {(serverPage - 1) * pageSize + (users.length ? 1 : 0)}
              -
              {(serverPage - 1) * pageSize + users.length} of {serverStats.total} user(s)
            </p>
          </CardHeader>
          <CardContent>
            <Table className="text-sm">
              <TableHeader className={THEME.headerCell}>
                <TableRow>
                  <TableHead>USER</TableHead>
                  <TableHead>CONTACT</TableHead>
                  <TableHead>DEPARTMENT</TableHead>
                  <TableHead>ROLES</TableHead>
                  <TableHead className="w-[80px]">MANAGE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className={THEME.row}>
                    <TableCell>
                      <div className="flex items-center">
                        <Avatar className="mr-4 h-10 w-10">
                          <AvatarFallback className="bg-gray-200 text-gray-700 font-semibold">
                            {u.empCode?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium text-gray-900">
                          {displayName(u)}
                          <div className="text-xs text-gray-500">{u.empCode}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-800">{u.email || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-700">{u.deptPath || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {u.roles.length ? (
                          u.roles.map((r) => (
                            <Badge
                              key={r}
                              className={`${THEME.badgeBase} ${r === "ADMIN"
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                }`}
                            >
                              {r}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <UserRoleDialog
                          user={{
                            id: u.id,
                            empCode: u.empCode,
                            name: `${u.firstNameEn ?? ""} ${u.lastNameEn ?? ""}`.trim() || u.empCode,
                            email: u.email ?? "",
                            roles: (u.roles ?? []) as Role[],
                          }}
                          onSave={(roles) => saveUserRoles(u.id, roles)}
                          // ✅ ส่ง trigger เป็นปุ่มไอคอนโดยตรง
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Edit roles"
                              aria-label="Edit roles"
                              className="inline-flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                            >
                              <Edit3 className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Edit roles</span>
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Footer */}
            {serverStats.total > pageSize && (
              <div className="flex items-center justify-between pt-4">
                {/* Rows per page */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as PageSize)}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page controls */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span>
                    Page {serverPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={serverPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={serverPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
