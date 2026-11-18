import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { applyGroupCapacity, createBooking, listPublicSlots } from "@/server/services/bookings";

const slot = (start: string, end: string) => ({ start, end });
const row = (start: string, end: string, startAt: string) => ({ start: new Date(start), end: new Date(end), eventTypeId: "e", startAt: new Date(startAt) });

describe("group capacity slot filter", () => {
  it("leaves one-to-one slots untouched", () => {
    expect(applyGroupCapacity([slot("2099-01-01T10:00:00Z", "2099-01-01T11:00:00Z")], [], 1, 0, 0)).toEqual([{ start: "2099-01-01T10:00:00Z", end: "2099-01-01T11:00:00Z", capacity: 1, seatsLeft: 1 }]);
  });

  it("counts places at the same start, hides full sessions, and blocks overlapping starts", () => {
    const slots = [slot("2099-01-01T10:00:00Z", "2099-01-01T11:00:00Z"), slot("2099-01-01T10:30:00Z", "2099-01-01T11:30:00Z"), slot("2099-01-01T12:00:00Z", "2099-01-01T13:00:00Z"), slot("2099-01-01T14:00:00Z", "2099-01-01T15:00:00Z")];
    const rows = [
      row("2099-01-01T10:00:00Z", "2099-01-01T11:00:00Z", "2099-01-01T10:00:00Z"),
      row("2099-01-01T14:00:00Z", "2099-01-01T15:00:00Z", "2099-01-01T14:00:00Z"),
      row("2099-01-01T14:00:00Z", "2099-01-01T15:00:00Z", "2099-01-01T14:00:00Z"),
    ];
    expect(applyGroupCapacity(slots, rows, 2, 0, 0)).toEqual([
      { ...slots[0], capacity: 2, seatsLeft: 1 },
      { ...slots[2], capacity: 2, seatsLeft: 2 },
    ]);
  });
});

describe("group capacity bookings", () => {
  let eventId = ""; let slug = "";
  beforeEach(async () => {
    process.env.CALENDAR_PROVIDER = "local"; delete process.env.PAYMENTS_PROVIDER;
    process.env.BOOKING_CAPABILITY_KEY_ID = "test-group-capacity"; process.env.BOOKING_CAPABILITY_SECRET = "group-capacity-test-secret-0123456789abcdef";
    const base = await db.eventType.findFirstOrThrow();
    slug = `group-${randomUUID().slice(0, 8)}`;
    const created = await db.eventType.create({ data: {
      workspaceId: base.workspaceId, ownerId: base.ownerId, name: "Skupinová lekce", slug, durationMinutes: 60, color: "#2563eb",
      locationType: "IN_PERSON", isActive: true, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minimumNoticeMinutes: 0, bookingWindowDays: 60, capacity: 2,
      durations: { create: { label: "60 min", durationMinutes: 60, isDefault: true, priceCents: 0, currency: "czk", position: 0 } },
    } });
    eventId = created.id;
  });
  afterEach(async () => {
    delete process.env.CALENDAR_PROVIDER; delete process.env.BOOKING_CAPABILITY_KEY_ID; delete process.env.BOOKING_CAPABILITY_SECRET;
    await db.booking.deleteMany({ where: { eventTypeId: eventId } });
    await db.eventType.delete({ where: { id: eventId } });
  });

  it("fills a session place by place and then rejects it as fully booked", async () => {
    const from = new Date(Date.now() + 24 * 60 * 60_000); const to = new Date(from.getTime() + 14 * 24 * 60 * 60_000);
    const first = (await listPublicSlots(slug, from, to, "UTC"))[0];
    expect(first).toMatchObject({ capacity: 2, seatsLeft: 2 });
    const book = (email: string) => createBooking(slug, { startAt: first!.start, inviteeName: "Účastník", inviteeEmail: email, inviteeTimeZone: "UTC" }, randomUUID());
    await book("a@example.invalid");
    const after = (await listPublicSlots(slug, from, to, "UTC")).find((item) => item.start === first!.start);
    expect(after).toMatchObject({ seatsLeft: 1 });
    await book("b@example.invalid");
    expect((await listPublicSlots(slug, from, to, "UTC")).some((item) => item.start === first!.start)).toBe(false);
    await expect(book("c@example.invalid")).rejects.toThrow(/no longer available/);
    const seats = await db.bookingOccupancy.findMany({ where: { booking: { eventTypeId: eventId } }, select: { seat: true }, distinct: ["seat"] });
    expect(seats.map((item) => item.seat).sort()).toEqual([0, 1]);
  });
});
