import { createRequire } from "node:module";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type { WorkspaceAccess } from "@/server/auth/session";

/** E-mail addresses (comma separated, PLATFORM_ADMIN_EMAILS) of the people who operate the SaaS. */
export function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}
export function isPlatformAdmin(user: { email: string; emailVerifiedAt?: Date | null }) {
  return Boolean(user.emailVerifiedAt) && platformAdminEmails().includes(user.email.toLowerCase());
}
export function assertPlatformAdmin(access: WorkspaceAccess) {
  if (!isPlatformAdmin(access.user)) throw new AppError("FORBIDDEN", "You do not have access to this workspace action.", 403);
}

const globalForPlatform = globalThis as unknown as { platformPrisma?: PrismaClient };
/** In PostgreSQL production the operator console uses its own login (tempocove_platform), which may read
 * every workspace but change only plans. Elsewhere (SQLite development, tests) the normal client is used. */
export function platformDb(): PrismaClient {
  if (process.env.DATABASE_PROVIDER !== "postgresql" || process.env.NODE_ENV !== "production") return db;
  if (globalForPlatform.platformPrisma) return globalForPlatform.platformPrisma;
  const url = process.env.PLATFORM_DATABASE_URL || "";
  if (!/^postgres(?:ql)?:\/\//.test(url) || !/[?&]sslmode=verify-full(?:&|$)/.test(url)) throw new AppError("PLATFORM_UNAVAILABLE", "The operator console is not configured.", 503);
  const require = createRequire(import.meta.url); const generated = require("@tempocove/postgresql-client") as { PrismaClient: new (options: { datasourceUrl: string }) => PrismaClient };
  globalForPlatform.platformPrisma = new generated.PrismaClient({ datasourceUrl: url });
  return globalForPlatform.platformPrisma;
}
