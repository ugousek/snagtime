"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SnagTimeApiError } from "@/lib/api-client";
import { frontendApi } from "./api-adapter";
import { claimOneUseLinkAuthority, shareOneUseAction } from "./one-use-link-authority";
import { BrandMark } from "./ui";

const strongPassword = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

function AccessFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="auth-page"><main className="auth-card recovery-card"><BrandMark /><div><span className="outcome-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</main></div>;
}

function GenericRequestForm({ kind }: { kind: "password" | "verification" }) {
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setWorking(true); setError("");
    try {
      if (kind === "password") await frontendApi.requestPasswordReset(email.trim());
      else await frontendApi.requestEmailVerification(email.trim());
      setAccepted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Požadavek nebylo možné přijmout."); }
    finally { setWorking(false); }
  };
  if (accepted) return <div className="recovery-result" role="status" aria-live="polite"><strong>Požadavek přijat</strong><p>Pokud je adresa oprávněná, pošleme pokyny přes nastaveného e-mailového poskytovatele. Tato stránka nepotvrzuje existenci účtu ani doručení.</p><Link className="button button-primary" href="/dashboard">Zpět na přihlášení</Link></div>;
  return <form onSubmit={submit}><label>E-mailová adresa<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={working || !email.includes("@")}>{working ? "Submitting…" : kind === "password" ? "Vyžádat pokyny k obnovení" : "Vyžádat pokyny k ověření"}</button></form>;
}

export function ForgotPasswordView() {
  return <AccessFrame eyebrow="Obnovení účtu" title="Obnovte si heslo" description="Zadejte e-mailovou adresu. Odpověď je stejná bez ohledu na to, zda účet existuje."><GenericRequestForm kind="password" /><p className="auth-switch"><Link href="/dashboard">Zpět na přihlášení</Link></p></AccessFrame>;
}

export function ResetPasswordView() {
  const [authority, setAuthority] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    const claim = () => {
      const claimed = claimOneUseLinkAuthority("token");
      setAuthority(claimed);
      setError(claimed ? "" : "Odkaz pro obnovení hesla je neúplný.");
      setPassword(""); setReset(false); setReady(true);
    };
    if (!started.current) { started.current = true; claim(); }
    window.addEventListener("hashchange", claim);
    return () => window.removeEventListener("hashchange", claim);
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authority || !strongPassword(password)) { setError("Použijte úplný odkaz pro obnovení a heslo splňující všechny požadavky."); return; }
    setWorking(true); setError("");
    try { await shareOneUseAction("password-reset", authority, () => frontendApi.resetPassword(authority, password)); setPassword(""); setReset(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Odkaz je neplatný nebo vypršel."); }
    finally { setWorking(false); }
  };
  if (!ready) return <AccessFrame eyebrow="Obnovení účtu" title="Připravuji obnovení hesla" description="Odstraňuji jednorázový klíč z adresy v prohlížeči."><div className="sync-note" role="status"><span className="spinner" />Připravuji…</div></AccessFrame>;
  if (reset) return <AccessFrame eyebrow="Obnovení hesla" title="Heslo změněno" description="Heslo bylo obnoveno a předchozí relace zrušeny. Přihlaste se novým heslem."><Link className="button button-primary" href="/dashboard">Přihlásit se</Link></AccessFrame>;
  return <AccessFrame eyebrow="Obnovení účtu" title="Zvolte nové heslo" description="Jednorázový klíč byl před zobrazením formuláře odstraněn z adresy v prohlížeči."><form onSubmit={submit}><label>Nové heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} aria-describedby="reset-password-rules" required /></label><p className="password-rules" id="reset-password-rules">Použijte alespoň 12 znaků, velké i malé písmeno, číslici a symbol.</p>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={working || !authority || !strongPassword(password)}>{working ? "Resetting…" : "Obnovit heslo"}</button></form><p className="auth-switch"><Link href="/forgot-password">Vyžádat nový odkaz</Link></p></AccessFrame>;
}

export function VerifyEmailView() {
  const started = useRef(false);
  const [status, setStatus] = useState<"booting" | "idle" | "working" | "verified" | "error">("booting");
  const [error, setError] = useState("");
  useEffect(() => {
    const verify = () => {
      const authority = claimOneUseLinkAuthority("token");
      if (!authority) { queueMicrotask(() => setStatus("idle")); return; }
      queueMicrotask(() => { setError(""); setStatus("working"); });
      void shareOneUseAction("email-verification", authority, () => frontendApi.verifyEmail(authority)).then(() => setStatus("verified")).catch((reason) => { setError(reason instanceof Error ? reason.message : "Odkaz je neplatný nebo vypršel."); setStatus("error"); });
    };
    if (!started.current) { started.current = true; verify(); }
    window.addEventListener("hashchange", verify);
    return () => window.removeEventListener("hashchange", verify);
  }, []);
  if (status === "booting" || status === "working") return <AccessFrame eyebrow="Ověření e-mailu" title="Ověřuji váš e-mail" description="Jednorázový klíč se před ověřením odstraní z adresy v prohlížeči."><div className="sync-note" role="status"><span className="spinner" />Ověřuji…</div></AccessFrame>;
  if (status === "idle") return <AccessFrame eyebrow="Ověření e-mailu" title="Vyžádat pokyny k ověření" description="Zadejte adresu. Odpověď neprozrazuje, zda účet existuje nebo vyžaduje ověření."><GenericRequestForm kind="verification" /><p className="auth-switch"><Link href="/dashboard">Zpět na přihlášení</Link></p></AccessFrame>;
  if (status === "verified") return <AccessFrame eyebrow="E-mail ověřen" title="Váš e-mail je ověřený" description="Nyní se můžete přihlásit do provozovny vytvořené pro tuto adresu."><Link className="button button-primary" href="/dashboard">Přihlásit se</Link></AccessFrame>;
  return <AccessFrame eyebrow="Nelze ověřit" title="Tento odkaz nelze použít" description="Ověřovací odkazy jsou jednorázové a mají omezenou platnost."><div className="form-error" role="alert">{error}</div><Link className="button button-secondary" href="/verify-email">Vyžádat nový odkaz</Link></AccessFrame>;
}

export function AcceptInvitationView() {
  const authority = useRef("");
  const [status, setStatus] = useState<"working" | "login" | "accepted" | "error">("working");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const started = useRef(false);
  const accept = useCallback(async () => {
    if (!authority.current) return;
    setStatus("working"); setError("");
    try { await shareOneUseAction("workspace-invitation", authority.current, () => frontendApi.acceptWorkspaceInvitation(authority.current)); setStatus("accepted"); }
    catch (reason) {
      if (reason instanceof SnagTimeApiError && reason.status === 401) { setStatus("login"); return; }
      setError(reason instanceof Error ? reason.message : "Tato pozvánka je neplatná nebo vypršela."); setStatus("error");
    }
  }, []);
  useEffect(() => {
    const claim = () => {
      authority.current = claimOneUseLinkAuthority("token");
      if (!authority.current) { setError("Odkaz s pozvánkou je neúplný."); setStatus("error"); return; }
      void accept();
    };
    if (!started.current) { started.current = true; claim(); }
    window.addEventListener("hashchange", claim);
    return () => window.removeEventListener("hashchange", claim);
  }, [accept]);
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { await frontendApi.login(email, password); setPassword(""); await accept(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Přihlášení se nezdařilo."); setStatus("login"); }
  };
  if (status === "working") return <AccessFrame eyebrow="Pozvánka do provozovny" title="Kontroluji pozvánku" description="Jednorázový klíč byl odstraněn z adresy v prohlížeči."><div className="sync-note" role="status"><span className="spinner" />Kontroluji…</div></AccessFrame>;
  if (status === "accepted") return <AccessFrame eyebrow="Pozvánka přijata" title="Jste tam" description="Tato provozovna je teď dostupná z vašeho účtu."><Link className="button button-primary" href="/dashboard">Otevřít aplikaci</Link></AccessFrame>;
  if (status === "login") return <AccessFrame eyebrow="Pozvánka do provozovny" title="Pro pokračování se přihlaste" description="Použijte ověřený účet, pro který je pozvánka určená. Klíč zůstává jen v paměti této stránky."><form onSubmit={login}><label>E-mailová adresa<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary" type="submit">Přihlásit a přijmout</button></form></AccessFrame>;
  return <AccessFrame eyebrow="Nelze přijmout" title="Tuto pozvánku nelze použít" description="Pozvánky jsou vázané na ověřený účet, jednorázové a mají omezenou platnost."><div className="form-error" role="alert">{error}</div><Link className="button button-secondary" href="/dashboard">Přejít na přihlášení</Link></AccessFrame>;
}
