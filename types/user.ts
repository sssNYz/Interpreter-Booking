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
}