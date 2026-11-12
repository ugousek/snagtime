"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Booking } from "./demo-data";
import { clientsToCsv, summarizeClients } from "./clients-summary";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { ActionButton, Avatar, EmptyState, PageHeader } from "./ui";

export function ClientsView() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [timeZone, setTimeZone] = useState("UTC");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    frontendApi.getAccount().then(async (account) => { setTimeZone(account.workspace.timeZone); setBookings(await frontendApi.listBookings(account.workspace.timeZone)); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Klienty se nepodařilo načíst."))
      .finally(() => setLoading(false));
  }, []);
  const clients = useMemo(() => summarizeClients(bookings), [bookings]);
  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.email}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("cs-CZ", { timeZone, day: "numeric", month: "numeric", year: "numeric" }).format(new Date(value)) : "–";
  const exportCsv = () => {
    const blob = new Blob(["﻿" + clientsToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "klienti.csv"; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page-stack"><PageHeader title="Klienti" /><div className="sync-note" role="status"><span className="spinner" />Načítám klienty…</div></div>;
  if (error) return <div className="page-stack"><PageHeader title="Klienti" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Klienti se nenačetli</h2><p>{error}</p></section></div>;

  return <div className="page-stack">
    <PageHeader title="Klienti" description="Každý, kdo si u vás rezervoval termín. Seznam se tvoří automaticky z rezervací." actions={<ActionButton variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}><Icon name="copy" size={16} />Export do CSV</ActionButton>} />
    <div className="toolbar bookings-toolbar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat podle jména nebo e-mailu" aria-label="Hledat klienty" /></div></div>
    <section className="panel bookings-panel">
      <div className="booking-table-head clients-table"><span>Klient</span><span>Návštěvy</span><span>Poslední návštěva</span><span>Příští termín</span><span /></div>
      {filtered.length === 0 ? <EmptyState icon="team" title={clients.length ? "Nikdo neodpovídá hledání" : "Zatím žádní klienti"} description={clients.length ? "Zkuste jiné jméno nebo e-mail." : "Klienti se tu objeví po první rezervaci."} /> :
        <div className="booking-table">{filtered.map((client) => <Link className="booking-table-row clients-table" key={client.email} href={`/bookings?q=${encodeURIComponent(client.email)}`}>
          <span className="invitee-cell"><Avatar name={client.name} size="sm" /><span><strong>{client.name}</strong><small>{client.email}</small></span></span>
          <span><strong>{client.visits}</strong><small>{client.cancelled ? `${client.cancelled} zrušeno` : client.services.slice(0, 2).join(", ")}</small></span>
          <span><strong>{formatDate(client.lastVisit)}</strong></span>
          <span><strong>{formatDate(client.nextVisit)}</strong>{client.upcoming > 1 && <small>{client.upcoming} nadcházející</small>}</span>
          <span><Icon name="arrow-right" size={14} /></span>
        </Link>)}</div>}
      <div className="table-footer"><span>{filtered.length} z {clients.length} klientů</span></div>
    </section>
  </div>;
}
