import { platformDb } from "@/server/platform";
import { effectivePlan, isPlanId, monthStartUtc, PLANS, type PlanId } from "@/server/services/plans";
import { AppError } from "@/server/errors";

export type PlatformWorkspace = { id: string; name: string; createdAt: string; owners: { name: string; email: string }[]; members: number; services: number; monthlyBookings: number; plan: PlanId; storedPlan: PlanId; validUntil: string | null; note: string | null };

export async function listPlatformWorkspaces(now = new Date()): Promise<PlatformWorkspace[]> {
  const client = platformDb();
  const [workspaces, bookings] = await Promise.all([
    client.workspace.findMany({ orderBy: { createdAt: "desc" }, take: 1000, select: {
      id: true, name: true, createdAt: true, plan: true,
      memberships: { where: { status: "ACTIVE" }, select: { role: true, user: { select: { name: true, email: true } } } },
      eventTypes: { select: { id: true } },
    } }),
    client.booking.groupBy({ by: ["workspaceId"], where: { status: { not: "CANCELLED" }, createdAt: { gte: monthStartUtc(now) } }, _count: { _all: true } }),
  ]);
  const counts = new Map(bookings.map((row) => [row.workspaceId, row._count._all]));
  return workspaces.map((workspace) => ({
    id: workspace.id, name: workspace.name, createdAt: workspace.createdAt.toISOString(),
    owners: workspace.memberships.filter((item) => item.role === "OWNER").map((item) => ({ name: item.user.name, email: item.user.email })),
    members: workspace.memberships.length, services: workspace.eventTypes.length, monthlyBookings: counts.get(workspace.id) ?? 0,
    plan: effectivePlan(workspace.plan, now), storedPlan: isPlanId(workspace.plan?.plan) ? workspace.plan!.plan as PlanId : "FREE",
    validUntil: workspace.plan?.validUntil?.toISOString() ?? null, note: workspace.plan?.note ?? null,
  }));
}

export async function setWorkspacePlan(workspaceId: string, input: { plan: string; validUntil: string | null; note?: string | null }) {
  if (!isPlanId(input.plan)) throw new AppError("VALIDATION_ERROR", "Check the highlighted fields.", 422, { plan: ["Unknown plan"] });
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new AppError("VALIDATION_ERROR", "Check the highlighted fields.", 422, { validUntil: ["Invalid date"] });
  const note = input.note?.slice(0, 500) || null; const client = platformDb();
  if (!await client.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })) throw new AppError("NOT_FOUND", "Workspace was not found.", 404);
  await client.workspacePlan.upsert({ where: { workspaceId }, update: { plan: input.plan, validUntil, note }, create: { workspaceId, plan: input.plan, validUntil, note } });
  return { workspaceId, plan: input.plan, validUntil: validUntil?.toISOString() ?? null, note, planName: PLANS[input.plan].name };
}
