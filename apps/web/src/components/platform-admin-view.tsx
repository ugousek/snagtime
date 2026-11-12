"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { snagTimeApi, type PlanId, type PlatformWorkspace } from "@/lib/api-client";
import { Icon } from "./icons";
import { Badge, PageHeader } from "./ui";

const planNames: Record<PlanId, string> = { FREE: "Zdarma", START: "Start", PROFI: "Profi" };
const planPrices: Record<PlanId, number> = { FREE: 0, START: 199, PROFI: 399 };
type Draft = { plan: PlanId; validUntil: string; note: string };
const dateInput = (iso: string | null) => iso ? iso.slice(0, 10) : "";

export function PlatformAdminView() {
  const [rows, setRows] = useState<PlatformWorkspace[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const [savingId, setSavingId] = useState("");
  const load = useCallback(() => snagTimeApi.listPlatformWorkspaces().then((items) => {
    setRows(items); setDrafts(Object.fromEntries(items.map((item) => [item.id, { plan: item.storedPlan, validUntil: dateInput(item.validUntil), note: item.note ?? "" }])));
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "Provozovny se nepodařilo načíst.")).finally(() => setLoading(false)), []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.owners.map((owner) => `${owner.name} ${owner.email}`).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const paying = rows.filter((row) => row.plan !== "FREE");
  const mrr = paying.reduce((sum, row) => sum + planPrices[row.plan], 0);
  const save = async (id: string) => {
    const draft = drafts[id]; if (!draft) return; setSavingId(id); setError("");
    try {
      await snagTimeApi.setWorkspacePlan(id, { plan: draft.plan, validUntil: draft.validUntil ? new Date(`${draft.validUntil}T23:59:59Z`).toISOString() : null, note: draft.note || null });
      setSavedId(id); window.setTimeout(() => setSavedId(""), 2000); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tarif se nepodařilo uložit."); } finally { setSavingId(""); }
  };
  const patch = (id: string, value: Partial<Draft>) => setDrafts((items) => ({ ...items, [id]: { ...items[id]!, ...value } }));

  if (loading) return <div className="page-stack"><PageHeader title="Správa provozoven" /><div className="sync-note" role="status"><span className="spinner" />Načítám provozovny…</div></div>;
  if (error && rows.length === 0) return <div className="page-stack"><PageHeader title="Správa provozoven" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Nemáte přístup</h2><p>{error}</p></section></div>;
  return <div className="page-stack">
    <PageHeader eyebrow="Provozovatel" title="Správa provozoven" description={`${rows.length} provozoven, ${paying.length} platících, měsíční příjem ${mrr.toLocaleString("cs-CZ")} Kč bez DPH.`} />
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    <div className="toolbar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat provozovnu nebo e-mail" aria-label="Hledat provozovny" /></div></div>
    <section className="panel admin-scroll"><table className="admin-table"><thead><tr><th>Provozovna</th><th>Vlastník</th><th>Využití</th><th>Tarif</th><th>Platí do</th><th>Poznámka</th><th /></tr></thead><tbody>
      {filtered.map((row) => { const draft = drafts[row.id]!; return <tr key={row.id}>
        <td><strong>{row.name}</strong><small>založeno {new Date(row.createdAt).toLocaleDateString("cs-CZ")}</small></td>
        <td>{row.owners.map((owner) => <span key={owner.email}>{owner.name}<small>{owner.email}</small></span>)}</td>
        <td>{row.monthlyBookings} rezervací tento měsíc<small>{row.services} služeb, {row.members} členů</small></td>
        <td><select value={draft.plan} onChange={(event) => patch(row.id, { plan: event.target.value as PlanId })} aria-label={`Tarif ${row.name}`}>{(Object.keys(planNames) as PlanId[]).map((id) => <option key={id} value={id}>{planNames[id]}</option>)}</select>{row.plan !== row.storedPlan && <small><Badge tone="warning">vypršelo</Badge></small>}</td>
        <td><input type="date" value={draft.validUntil} onChange={(event) => patch(row.id, { validUntil: event.target.value })} aria-label={`Platnost tarifu ${row.name}`} /></td>
        <td><input value={draft.note} maxLength={500} onChange={(event) => patch(row.id, { note: event.target.value })} placeholder="např. faktura 2026-014" aria-label={`Poznámka ${row.name}`} /></td>
        <td><div className="admin-row-actions"><button type="button" className="button button-secondary button-sm" disabled={savingId === row.id} onClick={() => void save(row.id)}>{savingId === row.id ? "Ukládám…" : savedId === row.id ? "Uloženo" : "Uložit"}</button></div></td>
      </tr>; })}
    </tbody></table></section>
  </div>;
}
