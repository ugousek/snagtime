"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Booking, BookingStatus } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { Avatar, Badge, EmptyState, PageHeader } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

const tones: Record<BookingStatus, "success" | "warning" | "danger"> = { confirmed: "success", pending: "warning", canceled: "danger" };

function notificationCopy(status: Booking["notificationStatus"]) {
  switch (status) {
    case "GOOGLE_UPDATE_ACCEPTED": return "Google Kalendář přijal poslední změnu rezervace.";
    case "LOCAL_NO_EMAIL": return "Uloženo lokálně. Žádný e-mail nebyl odeslán.";
    case "RETRY_PENDING": return "Změna se automaticky zopakuje.";
    case "PENDING": return "Čeká na synchronizaci změny rezervace.";
  }
}

function answerText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value == null) return "Bez odpovědi";
  try { return JSON.stringify(value); } catch { return "Zaznamenaná odpověď"; }
}

export function BookingsView() {
  const { canManage } = useWorkspaceAccess();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BookingStatus>("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [workspaceTimeZone, setWorkspaceTimeZone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const load = useCallback(() => { frontendApi.getAccount().then(async (account) => { const [bookingItems, eventItems] = await Promise.all([frontendApi.listBookings(account.workspace.timeZone), frontendApi.listEventTypes()]); const events = new Map(eventItems.map((event) => [event.id, event])); const resolved = bookingItems.map((booking) => { const event = events.get(booking.eventTypeId); return { ...booking, ...(event ? { eventSlug: event.slug } : {}) }; }); setWorkspaceTimeZone(account.workspace.timeZone); setBookings(resolved); const requested = new URLSearchParams(window.location.search).get("selected"); if (requested) setSelected(resolved.find((booking) => booking.id === requested) ?? null); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Rezervace se nepodařilo načíst.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!selected) return; const prior = document.body.style.overflow; document.body.style.overflow = "hidden"; window.requestAnimationFrame(() => closeRef.current?.focus()); return () => { document.body.style.overflow = prior; }; }, [selected]);
  const closeDrawer = () => { setSelected(null); const url = new URL(window.location.href); if (url.searchParams.has("selected")) { url.searchParams.delete("selected"); window.history.replaceState(null, "", `${url.pathname}${url.search}`); } window.requestAnimationFrame(() => returnFocusRef.current?.focus()); };
  const trapDrawer = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; } if (event.key !== "Tab") return; const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])") ?? [])]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
  const filtered = useMemo(() => bookings.filter((booking) => (status === "all" || booking.status === status) && `${booking.invitee} ${booking.email} ${booking.eventTitle}`.toLowerCase().includes(query.toLowerCase())), [bookings, query, status]);

  if (loading) return <div className="page-stack"><PageHeader title="Rezervace" /><div className="sync-note" role="status"><span className="spinner" />Načítám rezervace…</div></div>;
  if (error && bookings.length === 0) return <div className="page-stack"><PageHeader title="Rezervace" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Rezervace se nenačetly</h2><p>{error}</p><button type="button" className="button button-primary" onClick={() => { setLoading(true); setError(""); void load(); }}>Zkusit znovu</button></section></div>;

  return <div className="page-stack">
    <PageHeader title="Rezervace" description={`Data a časy jsou zobrazeny v pásmu ${workspaceTimeZone}.`} />
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    <div className="toolbar bookings-toolbar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat podle jména, e-mailu nebo služby" aria-label="Hledat rezervace" /></div><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrovat podle stavu"><option value="all">Všechny stavy</option><option value="confirmed">Potvrzeno</option><option value="pending">Čeká na platbu</option><option value="canceled">Zrušeno</option></select></div>
    <section className="panel bookings-panel">
      <div className="booking-table-head"><span>Klient</span><span>Služba</span><span>Datum a čas</span><span>Stav</span><span /></div>
      <div className="booking-table">{filtered.map((booking) => <button type="button" className="booking-table-row" key={booking.id} onClick={(event) => { returnFocusRef.current = event.currentTarget; const url = new URL(window.location.href); url.searchParams.set("selected", booking.id); window.history.replaceState(null, "", `${url.pathname}${url.search}`); setSelected(booking); }} aria-haspopup="dialog"><span className="invitee-cell"><Avatar name={booking.invitee} /><span><strong>{booking.invitee}</strong><small>{booking.email}</small></span></span><span><strong>{booking.eventTitle}</strong><small>{booking.duration} min</small></span><span><strong>{booking.dateLabel}</strong><small>{booking.timeLabel}</small></span><span><Badge tone={tones[booking.status]} dot>{booking.status}</Badge></span><span><Icon name="arrow-right" /></span></button>)}</div>
      {filtered.length === 0 && <EmptyState icon="search" title="Žádné rezervace" description="Zkuste změnit hledání nebo filtry." />}
      <footer className="table-footer"><span>Zobrazeno {filtered.length} z {bookings.length} rezervací</span></footer>
    </section>
    {selected && <div className="drawer-layer"><button type="button" className="drawer-scrim" onClick={closeDrawer} aria-label="Zavřít detail rezervace" tabIndex={-1} /><aside ref={drawerRef} className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title" onKeyDown={trapDrawer}><header><div><Badge tone={tones[selected.status]} dot>{selected.status === "pending" ? "pending payment" : selected.status}</Badge><h2 id="booking-drawer-title">{selected.eventTitle}</h2><span>{selected.id}</span></div><button ref={closeRef} type="button" className="icon-button" onClick={closeDrawer} aria-label="Zavřít detail rezervace"><Icon name="x" /></button></header><div className="drawer-invitee"><Avatar name={selected.invitee} size="lg" /><div><strong>{selected.invitee}</strong><span>{selected.email}</span></div></div><div className="detail-list"><div><Icon name="calendar" /><span><small>Datum (provozovna)</small><strong>{new Intl.DateTimeFormat("cs-CZ", { timeZone: workspaceTimeZone, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(selected.startsAt))}</strong></span></div><div><Icon name="clock" /><span><small>Čas (provozovna)</small><strong>{selected.timeLabel}</strong><em>{workspaceTimeZone}</em>{selected.timezone !== workspaceTimeZone && <em>Invitee timezone: {selected.timezone}</em>}</span></div>{selected.location && <div><Icon name="video" /><span><small>Místo</small><strong>{selected.location}</strong></span></div>}<div><Icon name="video" /><span><small>Synchronizace kalendáře</small><strong>{selected.notificationStatus.replaceAll("_", " ").toLowerCase()}</strong><em>{notificationCopy(selected.notificationStatus)}</em></span></div><div><Icon name="team" /><span><small>Poskytovatel</small><strong>{selected.hostName}</strong></span></div></div>{selected.answers.length > 0 && <section className="drawer-answer"><h3>Vlastní odpovědi</h3>{selected.answers.map((answer, index) => <p key={answer.questionId ?? `${answer.questionLabel}-${index}`}><strong>{answer.questionLabel}</strong><br />{answerText(answer.value)}</p>)}</section>}{selected.cancellationReason && <section className="drawer-answer"><h3>Důvod zrušení</h3><p>{selected.cancellationReason}</p></section>}{selected.notes && <section className="drawer-answer"><h3>Poznámka klienta</h3><p>{selected.notes}</p></section>}{canManage && selected.status !== "canceled" && selected.eventSlug && <div className="manage-row"><span>Akce poskytovatele</span>{selected.status === "confirmed" && <Link href={`/manage/${selected.id}/reschedule?slug=${encodeURIComponent(selected.eventSlug)}`}>Přesunout</Link>}<Link href={`/manage/${selected.id}/cancel?slug=${encodeURIComponent(selected.eventSlug)}`}>Zrušit</Link></div>}</aside></div>}
  </div>;
}
