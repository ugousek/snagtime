"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { frontendApi } from "./api-adapter";
import { BrandMark } from "./ui";

const fallbackTimeZones = ["UTC", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London"];
const supportedTimeZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimeZones;
const timeZones = ["UTC", ...supportedTimeZones.filter((zone) => zone !== "UTC")];

function strongPassword(value: string) {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function AccountSignup() {
  const detectedZone = useMemo(() => { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; return timeZones.includes(detected) ? detected : "UTC"; }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timeZone, setTimeZone] = useState(detectedZone);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    frontendApi.session().then(({ user, workspace }) => {
      if (!active || !user) return;
      window.location.replace(workspace?.onboardingCompleted ? "/dashboard" : "/onboarding");
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const valid = name.trim().length >= 2 && workspaceName.trim().length >= 2 && email.includes("@") && strongPassword(password) && Boolean(timeZone);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) { setError("Vyplňte všechna pole a použijte heslo splňující všechny požadavky."); return; }
    setSubmitting(true); setError("");
    try {
      await frontendApi.signup({ name: name.trim(), email: email.trim(), password, workspaceName: workspaceName.trim(), timeZone });
      setPassword("");
      setAccepted(true);
      setSubmitting(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registraci se nepodařilo dokončit.");
      setSubmitting(false);
    }
  };

  if (accepted) return <div className="auth-page"><main className="auth-card signup-card"><BrandMark /><div className="onboarding-success" aria-hidden="true">✓</div><div role="status" aria-live="polite"><span className="outcome-eyebrow">Požadavek přijat</span><h1>Zkontrolujte pokyny k ověření</h1><p>Registrace byla přijata a u nově vytvořeného účtu čeká na ověření e-mailu. Z důvodu soukromí nepotvrzujeme, zda byl účet vytvořen, nebo už existoval.</p></div><p>Pokyny posíláme jen přes nastaveného e-mailového poskytovatele. Tato stránka doručení nepotvrzuje.</p><div className="auth-actions"><Link className="button button-primary" href="/dashboard">Přejít na přihlášení</Link><Link className="button button-secondary" href="/verify-email">Vyžádat ověření znovu</Link></div></main></div>;

  return <div className="auth-page"><main className="auth-card signup-card"><BrandMark /><div><span className="outcome-eyebrow">Vytvořte si provozovnu</span><h1>Začněte přijímat rezervace</h1><p>Nastavte provozovnu a za pár minut posílejte klientům rezervační odkazy.</p></div><form onSubmit={submit}><div className="signup-grid"><label>Vaše jméno<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required /></label><label>E-mailová adresa<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Název provozovny<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} autoComplete="organization" minLength={2} maxLength={100} required /></label><label>Časové pásmo provozovny<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required>{timeZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></label></div><label>Heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} aria-describedby="signup-password-rules" required /></label><p className="password-rules" id="signup-password-rules">Použijte alespoň 12 znaků, velké i malé písmeno, číslici a symbol.</p>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={submitting || !valid}>{submitting ? "Vytvářím provozovnu…" : "Vytvořit provozovnu"}</button></form><p className="auth-switch">Už máte účet? <Link href="/dashboard">Přihlásit se</Link></p></main></div>;
}
