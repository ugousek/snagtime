import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

/** SaaS plans. Prices are shown to customers; billing itself is handled by the operator (invoice). */
export const PLANS = {
  FREE: { name: "Zdarma", priceCzk: 0, monthlyBookings: 50, members: 1 },
  START: { name: "Start", priceCzk: 249, monthlyBookings: 500, members: 3 },
  PROFI: { name: "Profi", priceCzk: 549, monthlyBookings: null, members: 15 },
} as const satisfies Record<string, { name: string; priceCzk: number; monthlyBookings: number | null; members: number }>;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export function isPlanId(value: unknown): value is PlanId { return typeof value === "string" && value in PLANS; }

type Reader = Pick<Prisma.TransactionClient, "workspacePlan">;
/** Effective plan: an expired paid plan falls back to FREE. */
export function effectivePlan(row: { plan: string; validUntil: Date | null } | null, now = new Date()): PlanId {
  if (!row || !isPlanId(row.plan)) return "FREE";
  if (row.plan !== "FREE" && row.validUntil && row.validUntil.getTime() <= now.getTime()) return "FREE";
  return row.plan;
}
export async function readWorkspacePlan(client: Reader, workspaceId: string, now = new Date()) {
  const row = await client.workspacePlan.findUnique({ where: { workspaceId } });
  return { plan: effectivePlan(row, now), storedPlan: isPlanId(row?.plan) ? row!.plan as PlanId : "FREE" as PlanId, validUntil: row?.validUntil ?? null };
}

export function monthStartUtc(now = new Date()) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }

/** Non-cancelled bookings created this calendar month. In PostgreSQL production the count goes through a
 * SECURITY DEFINER function bound to the signed workspace context, because public booking context
 * cannot read other people's bookings directly. */
export async function monthlyBookingCount(client: Prisma.TransactionClient, workspaceId: string, now = new Date()) {
  if (process.env.DATABASE_PROVIDER === "postgresql" && process.env.NODE_ENV === "production") {
    const [row] = await client.$queryRaw<Array<{ count: number | null }>>`SELECT tempocove_workspace_month_bookings(${workspaceId}) AS count`;
    return Number(row?.count ?? 0);
  }
  return client.booking.count({ where: { workspaceId, status: { not: "CANCELLED" }, createdAt: { gte: monthStartUtc(now) } } });
}

export async function assertBookingQuota(client: Prisma.TransactionClient, workspaceId: string, now = new Date()) {
  const { plan } = await readWorkspacePlan(client, workspaceId, now); const limit = PLANS[plan].monthlyBookings;
  if (limit == null) return;
  if (await monthlyBookingCount(client, workspaceId, now) >= limit) throw new AppError("PLAN_LIMIT", "This business cannot accept more online bookings this month.", 409);
}

export async function assertMemberQuota(client: Prisma.TransactionClient, workspaceId: string, now = new Date()) {
  const { plan } = await readWorkspacePlan(client, workspaceId, now); const limit = PLANS[plan].members;
  const [members, invitations] = await Promise.all([
    client.membership.count({ where: { workspaceId, status: "ACTIVE" } }),
    client.workspaceInvitation.count({ where: { workspaceId, status: "PENDING", expiresAt: { gt: now } } }),
  ]);
  if (members + invitations >= limit) throw new AppError("PLAN_LIMIT", "Your plan does not allow more team members.", 409);
}

/** Plan and usage for the workspace settings page. */
export async function getWorkspacePlanSummary(workspaceId: string, now = new Date()) {
  const result = await db.$transaction(async (tx) => {
    const plan = await readWorkspacePlan(tx, workspaceId, now);
    const [bookings, members] = await Promise.all([monthlyBookingCount(tx, workspaceId, now), tx.membership.count({ where: { workspaceId, status: "ACTIVE" } })]);
    return { ...plan, usage: { monthlyBookings: bookings, members } };
  });
  return { plan: result.plan, storedPlan: result.storedPlan, validUntil: result.validUntil?.toISOString() ?? null, usage: result.usage, plans: PLAN_IDS.map((id) => ({ id, ...PLANS[id] })), contactEmail: process.env.PLATFORM_CONTACT_EMAIL || process.env.EMAIL_REPLY_TO || null };
}
