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

import type {RoleCode, RoleFilter, AnyFilter, UserRow, FilterTree  } from '@/types/user';

// -------------------------------------------------------------
// Theme tokens
// -------------------------------------------------------------
const THEME = {
  page: "min-h-screen bg-[#f7f7f7] font-sans text-gray-900",
  card: "shadow-sm rounded-xl",
  headerCell: "bg-gray-100 text-gray-700",
  row: "border-b",
  badgeBase: "px-3 py-1 rounded-full text-xs font-medium",
} as const;

const DELIM = " \\ "; // literal ` \ ` between parts

// -------------------------------------------------------------
// Mock Data (deptPath format: R&D \ DEDE \ DDES)
// -------------------------------------------------------------
const MOCK_TREE: FilterTree = {
  "R&D": {
    DEDE: ["DDES", "DDET"],
    SWE: ["Platform", "Infra"],
  },
  Operations: {
    Support: ["Tier1", "Tier2"],
    Logistics: ["Warehouse", "Transport"],
  },
};

const MOCK_USERS: UserRow[] = [
  { id: 1, empCode: "RD01", firstNameEn: "Alice", lastNameEn: "Smith", email: "alice@corp.local", isActive: true,  deptPath: `R&D${DELIM}DEDE${DELIM}DDES`, roles: ["ADMIN"], updatedAt: new Date().toISOString() },
  { id: 2, empCode: "RD02", firstNameEn: "Bob",   lastNameEn: "Johnson", email: "bob@corp.local",   isActive: true,  deptPath: `R&D${DELIM}SWE${DELIM}Platform`, roles: ["INTERPRETER"], updatedAt: new Date().toISOString() },
  { id: 3, empCode: "OP01", firstNameEn: "Charlie", lastNameEn: "Brown", email: "charlie@corp.local", isActive: false, deptPath: `Operations${DELIM}Support${DELIM}Tier1`, roles: ["INTERPRETER"], updatedAt: new Date().toISOString() },
  { id: 4, empCode: "RD03", firstNameEn: "Dana",  lastNameEn: "Lee", email: "dana@corp.local",  isActive: true,  deptPath: `R&D${DELIM}DEDE${DELIM}DDET`, roles: ["ADMIN", "INTERPRETER"], updatedAt: new Date().toISOString() },
  // add a few more to exercise pagination (>= 6)
  { id: 5, empCode: "RD04", firstNameEn: "Evan", lastNameEn: "Ng", email: "evan@corp.local", isActive: true, deptPath: `R&D${DELIM}SWE${DELIM}Infra`, roles: ["INTERPRETER"], updatedAt: new Date().toISOString() },
  { id: 6, empCode: "OP02", firstNameEn: "Faye", lastNameEn: "Wong", email: "faye@corp.local", isActive: true, deptPath: `Operations${DELIM}Logistics${DELIM}Warehouse`, roles: ["INTERPRETER"], updatedAt: new Date().toISOString() },
  { id: 7, empCode: "RD05", firstNameEn: "Gavin", lastNameEn: "Choi", email: "gavin@corp.local", isActive: true, deptPath: `R&D${DELIM}SWE${DELIM}Platform`, roles: ["ADMIN"], updatedAt: new Date().toISOString() },
];

// -------------------------------------------------------------
// Component
// -------------------------------------------------------------
export default function UsersManagement() {
  // base data (mock)
  const [users] = useState<UserRow[]>(MOCK_USERS);
  const [tree] = useState<FilterTree>(MOCK_TREE);

  // UI state
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [department, setDepartment] = useState<AnyFilter>("ALL");
  const [group, setGroup] = useState<AnyFilter>("ALL");
  const [section, setSection] = useState<AnyFilter>("ALL");

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);

  // Reset to page 1 whenever filters/search/pageSize change
  useEffect(() => {
    setPage(1);
  }, [search, role, department, group, section, pageSize]);

  // derived options (type-safe indexing)
  const groupOptions = useMemo(() => {
    if (department === "ALL") return [];
    const depKey = department as string;
    return Object.keys(tree[depKey] || {}).sort();
  }, [tree, department]);

  const sectionOptions = useMemo(() => {
    if (department === "ALL" || group === "ALL") return [];
    const depKey = department as string;
    const grpKey = group as string;
    return (tree[depKey]?.[grpKey] || []).slice().sort();
  }, [tree, department, group]);

  // helpers
  const joinPath = (...parts: string[]) => parts.filter(Boolean).join(DELIM);

  // filtering (client-side on mock data)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const prefix = joinPath(
      department !== "ALL" ? (department as string) : "",
      group !== "ALL" ? (group as string) : "",
      section !== "ALL" ? (section as string) : ""
    );

    return users.filter((u) => {
      // search
      const s = `${u.firstNameEn ?? ""} ${u.lastNameEn ?? ""} ${u.firstNameTh ?? ""} ${u.lastNameTh ?? ""} ${u.email ?? ""} ${u.empCode}`.toLowerCase();
      const matchesSearch = q ? s.includes(q) : true;

      // role
      const matchesRole = role === "ALL" ? true : u.roles.includes(role);

      // dept prefix (R&D \ DEDE \ ...)
      const matchesDept = prefix ? (u.deptPath?.startsWith(prefix) ?? false) : true;

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, search, role, department, group, section]);

  // stats for current view
  const stats = useMemo(() => {
    const total = filtered.length;
    const admins = filtered.filter((u) => u.roles.includes("ADMIN")).length;
    const interpreters = filtered.filter((u) => u.roles.includes("INTERPRETER")).length;
    return { total, admins, interpreters };
  }, [filtered]);

  // pagination slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(filtered.length, start + pageSize);
  const pageItems = filtered.slice(start, end);

  const displayName = (u: UserRow) =>
    [u.firstNameEn ?? u.firstNameTh, u.lastNameEn ?? u.lastNameTh].filter(Boolean).join(" ") || u.empCode;

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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className={THEME.card}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                {/* color change: blue */}
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
                  <p className="text-3xl font-bold">{stats.admins}</p>
                </div>
                {/* color change: green */}
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
                  <p className="text-3xl font-bold">{stats.interpreters}</p>
                </div>
                {/* color change: yellow */}
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
                      .sort()
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
            <p className="text-sm text-gray-500">Showing {start + 1}-{end} of {filtered.length} user(s)</p>
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
                {pageItems.map((u) => (
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
                              className={`${THEME.badgeBase} ${
                                r === "ADMIN"
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
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit roles"
                          aria-label="Edit roles"
                          onClick={() => console.log("open role dialog")}
                          className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Footer */}
            {filtered.length > 6 && (
              <div className="flex items-center justify-between pt-4">
                {/* Rows per page */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 20 | 50)}>
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
                    Page {safePage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {pageItems.length === 0 && (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
