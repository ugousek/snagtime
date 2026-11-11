import { createRequire } from "node:module";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client") as { PrismaClient: new () => { $disconnect: () => Promise<void> } & Record<string, unknown> };
const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
async function seedPasswordHash(password: string) {
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new Error("DEMO_HOST_PASSWORD must be strong.");
  const salt = randomBytes(16); const derived = await scrypt(password, salt, 32) as Buffer;
  return `scrypt:v1:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

async function main() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Seed is allowed only with explicit DEMO_MODE=true.");
  const password = process.env.DEMO_HOST_PASSWORD;
  if (!password) throw new Error("DEMO_HOST_PASSWORD is required for the demo seed.");
  const passwordHash = await seedPasswordHash(password);
  const email = (process.env.DEMO_HOST_EMAIL || "nate@example.com").toLowerCase();
  const host = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, emailVerifiedAt: new Date() },
    create: { email, name: "Demo Správce", timeZone: "Europe/Prague", passwordHash, emailVerifiedAt: new Date() },
  });
  const workspace = await prisma.workspace.upsert({
    where: { id: `ws_${host.id}` },
    update: {},
    create: { id: `ws_${host.id}`, name: "Barbershop Demo", timeZone: host.timeZone, onboardingCompletedAt: new Date() },
  });
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: host.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { id: `mem_${host.id}`, workspaceId: workspace.id, userId: host.id, role: "OWNER", status: "ACTIVE" },
  });

  await prisma.availabilitySchedule.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: host.id } },
    update: {},
    create: {
      workspaceId: workspace.id, userId: host.id,
      timeZone: host.timeZone,
      intervals: {
        create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 9 * 60, endMinute: 19 * 60 })),
      },
    },
  });

  const eventType = await prisma.eventType.upsert({
    where: { slug: "strategy-call" },
    update: {},
    create: {
      workspaceId: workspace.id, ownerId: host.id,
      name: "Pánský střih",
      slug: "strategy-call",
      description: "Klasický pánský střih včetně mytí a stylingu.",
      durationMinutes: 30,
      color: "#2563EB",
      locationType: "IN_PERSON",
      locationValue: "Hlavní 1, Praha",
    },
  });
  if (!await prisma.eventDuration.count({ where: { eventTypeId: eventType.id } })) {
    await prisma.eventDuration.createMany({ data: [
      { eventTypeId: eventType.id, label: "30 minut", durationMinutes: 30, isDefault: true, priceCents: 0, currency: "usd", position: 0 },
      { eventTypeId: eventType.id, label: "60 minut", durationMinutes: 60, isDefault: false, priceCents: 0, currency: "usd", position: 1 },
    ] });
  }
  if (!await prisma.customQuestion.count({ where: { eventTypeId: eventType.id } })) {
    await prisma.customQuestion.create({ data: { eventTypeId: eventType.id, label: "Máte nějaké přání ke střihu?", kind: "TEXT", required: false, position: 0 } });
  }

  const paidSession = await prisma.eventType.upsert({
    where: { slug: "paid-strategy-session" },
    update: {
      name: "Střih a úprava vousů",
      description: "Kompletní péče: střih, úprava vousů a hot towel.",
      locationType: "IN_PERSON", locationValue: "Hlavní 1, Praha",
      minimumNoticeMinutes: 120,
      bookingWindowDays: 30,
      isActive: true,
    },
    create: {
      workspaceId: workspace.id,
      ownerId: host.id,
      name: "Střih a úprava vousů",
      slug: "paid-strategy-session",
      description: "Kompletní péče: střih, úprava vousů a hot towel.",
      durationMinutes: 60,
      color: "#2563EB",
      locationType: "IN_PERSON", locationValue: "Hlavní 1, Praha",
      minimumNoticeMinutes: 120,
      bookingWindowDays: 30,
    },
  });
  const paidDuration = await prisma.eventDuration.findFirst({ where: { eventTypeId: paidSession.id, label: "60 minut" } });
  if (paidDuration) {
    await prisma.eventDuration.update({ where: { id: paidDuration.id }, data: { durationMinutes: 60, isDefault: true, priceCents: 14900, currency: "usd", position: 0, isActive: true } });
  } else {
    await prisma.eventDuration.create({ data: { eventTypeId: paidSession.id, label: "60 minut", durationMinutes: 60, isDefault: true, priceCents: 14900, currency: "usd", position: 0 } });
  }
  if (!await prisma.customQuestion.count({ where: { eventTypeId: paidSession.id } })) {
    await prisma.customQuestion.createMany({ data: [
      { eventTypeId: paidSession.id, label: "Popište, jaký střih a úpravu vousů chcete", kind: "TEXTAREA", required: true, position: 0 },
      { eventTypeId: paidSession.id, label: "Telefon", kind: "TEXT", required: false, position: 1 },
    ] });
  }
  await prisma.workspaceBranding.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: { workspaceId: workspace.id, userId: host.id, workspaceName: "Barbershop Demo", accentColor: "#2563EB", description: "Objednejte se online k nám do barbershopu." },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
