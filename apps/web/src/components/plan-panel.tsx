"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { snagTimeApi, type WorkspacePlanSummary } from "@/lib/api-client";
import { Badge } from "./ui";

const czk = (value: number) => value === 0 ? "0 Kč" : `${value.toLocaleString("cs-CZ")} Kč`;

export function PlanPanel() {
  const [summary, setSummary] = useState<WorkspacePlanSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { snagTimeApi.getWorkspacePlan().then(setSummary).catch((reason) => setError(reason instanceof Error ? reason.message : "Tarif se nepodařilo načíst.")); }, []);
  if (error) return <section className="panel settings-content"><div className="settings-heading"><div><h2>Tarif</h2><p>{error}</p></div></div></section>;
  if (!summary) return null;
  const current = summary.plans.find((item) => item.id === summary.plan)!;
  const limit = current.monthlyBookings;
  const expired = summary.storedPlan !== "FREE" && summary.plan === "FREE";
  const mail = summary.contactEmail ? `mailto:${summary.contactEmail}?subject=${encodeURIComponent("Změna tarifu")}` : null;
  return <section className="panel settings-content plan-panel">
    <div className="settings-heading"><div><h2>Tarif</h2><p>Váš tarif a čerpání tento měsíc.</p></div><Badge tone="brand">{current.name}</Badge></div>
    {expired && <div className="toast toast-error" role="alert">Placený tarif vypršel. Provozovna teď běží v tarifu Zdarma.</div>}
    <div className="plan-usage">
      <div><small>Online rezervace tento měsíc</small><strong>{summary.usage.monthlyBookings}{limit != null ? ` z ${limit}` : ""}</strong>{limit != null && <span className="plan-meter"><span style={{ width: `${Math.min(100, Math.round(summary.usage.monthlyBookings / limit * 100))}%` }} /></span>}</div>
      <div><small>Členové týmu</small><strong>{summary.usage.members} z {current.members}</strong></div>
      <div><small>Platí do</small><strong>{summary.validUntil && summary.plan !== "FREE" ? new Date(summary.validUntil).toLocaleDateString("cs-CZ", { timeZone: "UTC" }) : "bez omezení"}</strong></div>
    </div>
    <div className="plan-grid">{summary.plans.map((plan) => <div key={plan.id} className={plan.id === summary.plan ? "plan-card is-current" : "plan-card"}>
      <strong>{plan.name}</strong><span className="plan-price">{czk(plan.priceCzk)}<small> / měsíc</small></span>
      <ul><li>{plan.monthlyBookings == null ? "Neomezeně rezervací" : `${plan.monthlyBookings} rezervací měsíčně`}</li><li>{plan.members === 1 ? "1 uživatel" : `až ${plan.members} členů týmu`}</li><li>České e-maily a připomínky</li></ul>
      {plan.id === summary.plan ? <Badge tone="success">Aktuální tarif</Badge> : mail ? <a className="button button-secondary button-sm" href={`${mail}&body=${encodeURIComponent(`Dobrý den, chci přejít na tarif ${plan.name}.`)}`}>Chci tento tarif</a> : null}
    </div>)}</div>
    <p className="plan-note">Ceny jsou bez DPH. Tarif se platí fakturou, po zaplacení ho aktivujeme.{summary.platformAdmin && <> <Link className="text-link" href="/admin">Správa všech provozoven</Link></>}</p>
  </section>;
}
