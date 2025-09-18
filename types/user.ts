export type RoleCode = "ADMIN" | "INTERPRETER";
export type RoleFilter = "ALL" | RoleCode;
export type AnyFilter = "ALL" | string; // Department / Group / Section

export type UserRow = {
  id: number;
  empCode: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  email?: string | null;
  isActive: boolean;
  deptPath?: string | null; // e.g. "R&D \\ DEDE \\ DDES"
  roles: RoleCode[];
  updatedAt?: string | null;
};

export type FilterTree = Record<string, Record<string, string[]>>; // Department → Group → Section

export type Role = "ADMIN" | "INTERPRETER";


export interface UserSummary {
  id: number;
  empCode: string;
  name: string;
  email?: string;
  roles: Role[];
  languages?: InterpreterLanguage[];
  adminScopes?: AdminScope[];
}

export interface AdminScope {
  id: number;
  adminEmpCode: string;
  deptPath: string;
  createdAt: string;
}

export interface InterpreterLanguage {
  id: number;
  empCode: string;
  languageCode: string;
  languageName: string;
}

export interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

// --- เพิ่มลงไปใน '@/types/user.ts' ---

export type PageSize = 10 | 20 | 50;

export type ApiStats = {
  total: number;
  admins: number;
  interpreters: number;
};

export type ApiPagination = {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
};

export type ApiResponse = {
  users: UserRow[];
  pagination: ApiPagination;
  stats: ApiStats;
  tree?: FilterTree;
};
