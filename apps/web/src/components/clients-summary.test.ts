import { describe, expect, it } from "vitest";
import type { Booking } from "./demo-data";
import { clientsToCsv, summarizeClients } from "./clients-summary";

const base = { eventTypeId: "e", dateLabel: "", timeLabel: "", duration: 30, timezone: "UTC", organizerTimeZone: "UTC", hostName: "H", notificationStatus: "PENDING", answers: [] } as const;
const booking = (id: string, email: string, invitee: string, startsAt: string, status: Booking["status"] = "confirmed", eventTitle = "Střih"): Booking => ({ ...base, answers: [], id, email, invitee, startsAt, status, eventTitle });

describe("client list", () => {
  it("groups bookings by e-mail and counts past, upcoming and cancelled visits", () => {
    const now = Date.parse("2026-11-12T12:00:00Z");
    const clients = summarizeClients([
      booking("1", "jan@example.com", "Jan", "2026-10-01T09:00:00Z"),
      booking("2", "JAN@example.com", "Jan Novák", "2026-11-01T09:00:00Z", "confirmed", "Vousy"),
      booking("3", "jan@example.com", "Jan Novák", "2026-12-01T09:00:00Z"),
      booking("4", "jan@example.com", "Jan Novák", "2026-12-05T09:00:00Z", "canceled"),
      booking("5", "eva@example.com", "Eva", "2026-09-01T09:00:00Z"),
    ], now);
    expect(clients).toHaveLength(2);
    expect(clients[0]).toMatchObject({ email: "jan@example.com", name: "Jan Novák", visits: 2, upcoming: 1, cancelled: 1, lastVisit: "2026-11-01T09:00:00Z", nextVisit: "2026-12-01T09:00:00Z", services: ["Střih", "Vousy"] });
    expect(clients[1]).toMatchObject({ email: "eva@example.com", visits: 1, upcoming: 0 });
  });

  it("exports CSV with quoted cells where needed", () => {
    const csv = clientsToCsv([{ email: "a@example.com", name: "Novák; Jan", visits: 1, upcoming: 0, cancelled: 0, lastVisit: "2026-11-01T09:00:00Z", nextVisit: null, services: ["Střih", "Vousy"] }]);
    expect(csv.split("\r\n")[1]).toBe('"Novák; Jan";a@example.com;1;0;0;2026-11-01;;"Střih, Vousy"');
  });
});
