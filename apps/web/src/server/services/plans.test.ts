import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { assertBookingQuota, assertMemberQuota, effectivePlan, getWorkspacePlanSummary } from "@/server/services/plans";
import { listPlatformWorkspaces, setWorkspacePlan } from "@/server/services/platform-admin";
import { isPlatformAdmin } from "@/server/platform";

const workspaceIds: string[] = []; const userIds: string[] = [];
async function fixture(label: string) {
  const user = await db.user.create({ data: { email: `${label}-${randomUUID()}@example.com`, name: label, passwordHash: "test", emailVerifiedAt: new Date() } });
  const workspace = await db.workspace.create({ data: { name: `${label} workspace` } });
  await db.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
  const event = await db.eventType.create({ data: { workspaceId: workspace.id, ownerId: user.id, name: "Plan event", slug: `plan-${randomUUID()}`, locationType: "CUSTOM" } });
  workspaceIds.push(workspace.id); userIds.push(user.id);
  return { user, workspace, event };
}
async function addBookings(owner: Awaited<ReturnType<typeof fixture>>, count: number, status = "CONFIRMED") {
  for (let index = 0; index < count; index += 1) {
    const startAt = new Date(Date.UTC(2099, 0, 1, 8) + index * 3_600_000);
    await db.booking.create({ data: { workspaceId: owner.workspace.id, eventTypeId: owner.event.id, hostId: owner.user.id, durationMinutes: 30, inviteeName: "Guest", inviteeEmail: `g${index}@example.com`, inviteeTimeZone: "UTC", startAt, endAt: new Date(startAt.getTime() + 1_800_000), eventTitleSnapshot: "Plan event", capabilityVersion: randomUUID(), manageExpiresAt: new Date("2099-02-01T00:00:00Z"), status } });
  }
}

describe("SaaS plans", () => {
  afterEach(async () => { const owned = workspaceIds.splice(0); await db.booking.deleteMany({ where: { workspaceId: { in: owned } } }); await db.workspace.deleteMany({ where: { id: { in: owned } } }); await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); delete process.env.PLATFORM_ADMIN_EMAILS; });

  it("treats a missing or expired paid plan as FREE", () => {
    expect(effectivePlan(null)).toBe("FREE");
    expect(effectivePlan({ plan: "PROFI", validUntil: null })).toBe("PROFI");
    expect(effectivePlan({ plan: "START", validUntil: new Date("2020-01-01Z") })).toBe("FREE");
    expect(effectivePlan({ plan: "BOGUS", validUntil: null })).toBe("FREE");
  });

  it("stops online bookings at the monthly limit and lifts it with a paid plan", async () => {
    const owner = await fixture("quota"); await addBookings(owner, 50); await addBookings(owner, 3, "CANCELLED");
    await expect(db.$transaction((tx) => assertBookingQuota(tx, owner.workspace.id))).rejects.toMatchObject({ code: "PLAN_LIMIT", status: 409 });
    await setWorkspacePlan(owner.workspace.id, { plan: "START", validUntil: new Date(Date.now() + 86_400_000).toISOString(), note: "faktura 1" });
    await expect(db.$transaction((tx) => assertBookingQuota(tx, owner.workspace.id))).resolves.toBeUndefined();
    const summary = await getWorkspacePlanSummary(owner.workspace.id);
    expect(summary).toMatchObject({ plan: "START", usage: { monthlyBookings: 50, members: 1 } });
  });

  it("limits team size by plan, counting pending invitations", async () => {
    const owner = await fixture("members");
    await expect(db.$transaction((tx) => assertMemberQuota(tx, owner.workspace.id))).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await setWorkspacePlan(owner.workspace.id, { plan: "START", validUntil: null });
    await db.workspaceInvitation.create({ data: { workspaceId: owner.workspace.id, email: `x-${randomUUID()}@example.com`, role: "MEMBER", invitedById: owner.user.id, expiresAt: new Date(Date.now() + 86_400_000), tokenVersion: 1 } });
    await expect(db.$transaction((tx) => assertMemberQuota(tx, owner.workspace.id))).resolves.toBeUndefined();
  });

  it("lists workspaces for the operator and only verified listed e-mails are operators", async () => {
    const owner = await fixture("operator"); await addBookings(owner, 2);
    const row = (await listPlatformWorkspaces()).find((item) => item.id === owner.workspace.id)!;
    expect(row).toMatchObject({ plan: "FREE", monthlyBookings: 2, services: 1, members: 1, owners: [{ email: owner.user.email }] });
    process.env.PLATFORM_ADMIN_EMAILS = `someone@example.com, ${owner.user.email.toUpperCase()}`;
    expect(isPlatformAdmin(owner.user)).toBe(true);
    expect(isPlatformAdmin({ ...owner.user, emailVerifiedAt: null })).toBe(false);
    expect(isPlatformAdmin({ ...owner.user, email: "other@example.com" })).toBe(false);
  });
});
