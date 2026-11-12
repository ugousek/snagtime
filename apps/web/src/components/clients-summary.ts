import type { Booking } from "./demo-data";

export type ClientSummary = { email: string; name: string; visits: number; upcoming: number; cancelled: number; lastVisit: string | null; nextVisit: string | null; services: string[] };

/** Groups bookings by invitee e-mail into a simple client list (no separate client table needed). */
export function summarizeClients(bookings: Booking[], now = Date.now()): ClientSummary[] {
  const byEmail = new Map<string, ClientSummary & { latestStart: number }>();
  for (const booking of bookings) {
    const key = booking.email.trim().toLowerCase(); const start = new Date(booking.startsAt).getTime();
    const item = byEmail.get(key) ?? { email: key, name: booking.invitee, visits: 0, upcoming: 0, cancelled: 0, lastVisit: null, nextVisit: null, services: [], latestStart: -Infinity };
    if (start > item.latestStart) { item.latestStart = start; item.name = booking.invitee; }
    if (!item.services.includes(booking.eventTitle)) item.services.push(booking.eventTitle);
    if (booking.status === "canceled") item.cancelled += 1;
    else if (start < now) { item.visits += 1; if (!item.lastVisit || start > new Date(item.lastVisit).getTime()) item.lastVisit = booking.startsAt; }
    else { item.upcoming += 1; if (!item.nextVisit || start < new Date(item.nextVisit).getTime()) item.nextVisit = booking.startsAt; }
    byEmail.set(key, item);
  }
  return [...byEmail.values()].map(({ latestStart, ...client }) => { void latestStart; return client; }).sort((a, b) => (b.lastVisit ?? b.nextVisit ?? "").localeCompare(a.lastVisit ?? a.nextVisit ?? ""));
}

function csvCell(value: string | number) { const text = String(value); return /[";,\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function clientsToCsv(clients: ClientSummary[]) {
  const header = ["Jméno", "E-mail", "Návštěvy", "Nadcházející", "Zrušené", "Poslední návštěva", "Příští návštěva", "Služby"];
  const rows = clients.map((client) => [client.name, client.email, client.visits, client.upcoming, client.cancelled, client.lastVisit?.slice(0, 10) ?? "", client.nextVisit?.slice(0, 10) ?? "", client.services.join(", ")]);
  return [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

