"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountSummary } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { ActionButton, Badge, BrandMark } from "./ui";

export function WorkspaceOnboarding() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    frontendApi.getAccount().then((item) => {
      if (!active) return;
      if (item.workspace.onboardingCompleted) { window.location.replace("/dashboard"); return; }
      setAccount(item);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Provozovnu se nepodařilo načíst."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const complete = async () => {
    setCompleting(true); setError("");
    try { await frontendApi.completeOnboarding(); window.location.replace("/dashboard"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Provozovnu se nepodařilo potvrdit."); setCompleting(false); }
  };

  if (loading) return <div className="auth-page"><main className="auth-card" role="status"><BrandMark /><span className="spinner" /><p>Načítám provozovnu…</p></main></div>;
  if (!account) return <div className="auth-page"><main className="auth-card"><BrandMark /><div><span className="outcome-eyebrow">Provozovna není dostupná</span><h1>Nemůžeme pokračovat</h1><p role="alert">{error || "Pro pokračování se přihlaste."}</p></div><Link className="button button-primary" href="/dashboard">Přejít na přihlášení</Link></main></div>;

  return <div className="auth-page onboarding-page"><main className="auth-card onboarding-card"><BrandMark /><div className="onboarding-success"><Icon name="check" size={24} /></div><div><span className="outcome-eyebrow">Vaše provozovna</span><h1>Vše je připraveno</h1><p>Zkontrolujte údaje níže a otevřete přehled rezervací.</p></div><dl className="onboarding-summary"><div><dt>Provozovna</dt><dd>{account.workspace.name}</dd></div><div><dt>Časové pásmo</dt><dd>{account.workspace.timeZone}</dd></div><div><dt>Vaše role</dt><dd><Badge tone="brand">{account.workspace.role.toLowerCase()}</Badge></dd></div><div><dt>Poskytovatel</dt><dd>{account.user.name}<small>{account.user.email}</small></dd></div></dl><div className="onboarding-next"><strong>Další kroky</strong><span>Nastavte pracovní dobu, vytvořte rezervační odkaz a propojte nástroje, které používáte.</span></div>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<ActionButton variant="primary" onClick={complete} disabled={completing}>{completing ? "Opening…" : "Otevřít přehled"}<Icon name="arrow-right" /></ActionButton></main></div>;
}
