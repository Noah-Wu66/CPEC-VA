import { ObjectId } from "mongodb";

// 单一角色体系：注册即为普通用户；首位注册用户自动成为管理员。
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const AUTH_PROVIDERS = ["password"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface UserDoc {
  _id: ObjectId;
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: "active" | "locked";
  authProviders: AuthProvider[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
}
