"use client";
/* eslint-disable @next/next/no-img-element -- workspace logos may be persisted data URLs or legacy external URLs */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { SessionUser, WorkspaceBranding, WorkspaceSummary } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { Icon, type IconName } from "./icons";
import { Avatar, BrandMark } from "./ui";
import { WorkspaceAccessProvider } from "./workspace-access";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Přehled", icon: "dashboard" },
  { href: "/event-types", label: "Služby", icon: "event-types" },
  { href: "/availability", label: "Dostupnost", icon: "availability" },
  { href: "/bookings", label: "Rezervace", icon: "bookings" },
  { href: "/integrations", label: "Integrace", icon: "integrations" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  useEffect(() => { let active = true; frontendApi.session().then(({ user: sessionUser, workspace: activeWorkspace }) => { if (!active) return; setUser(sessionUser); setWorkspace(activeWorkspace); if (sessionUser && activeWorkspace) void frontendApi.getWorkspaceBranding().then((branding) => { if (!active) return; setWorkspace((current) => current ? { ...current, name: branding.workspaceName } : current); setWorkspaceLogoUrl(branding.logoUrl); }).catch(() => undefined); if (sessionUser && activeWorkspace && !activeWorkspace.onboardingCompleted) window.location.replace("/onboarding"); }).catch((reason) => { if (active) { setAuthError(reason instanceof Error ? reason.message : "Nepodařilo se ověřit přihlášení."); setUser(null); } }); return () => { active = false; }; }, []);
  useEffect(() => { const updateWorkspaceBranding = (event: Event) => { const detail = (event as CustomEvent<Pick<WorkspaceBranding, "workspaceName" | "logoUrl">>).detail; if (!detail) return; setWorkspace((current) => current ? { ...current, name: detail.workspaceName || current.name } : current); setWorkspaceLogoUrl(detail.logoUrl); }; const eventNames = ["snagtime:workspace-branding", "tempocove:workspace-branding"]; eventNames.forEach((name) => window.addEventListener(name, updateWorkspaceBranding)); return () => eventNames.forEach((name) => window.removeEventListener(name, updateWorkspaceBranding)); }, []);
  useEffect(() => { const updateProfile = (event: Event) => { const detail = (event as CustomEvent<SessionUser>).detail; if (detail) setUser(detail); }; const eventNames = ["snagtime:profile-image", "tempocove:profile-image"]; eventNames.forEach((name) => window.addEventListener(name, updateProfile)); return () => eventNames.forEach((name) => window.removeEventListener(name, updateProfile)); }, []);
  useEffect(() => { if (open) { opened.current = true; const prior = document.body.style.overflow; document.body.style.overflow = "hidden"; window.requestAnimationFrame(() => closeButtonRef.current?.focus()); return () => { document.body.style.overflow = prior; }; } if (opened.current) { opened.current = false; window.requestAnimationFrame(() => menuButtonRef.current?.focus()); } }, [open]);
  const closeNavigation = () => setOpen(false);
  const trapNavigation = (event: KeyboardEvent<HTMLElement>) => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); closeNavigation(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])") ?? [])];
    const first = focusable[0]; const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const login = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setAuthenticating(true); setAuthError(""); try { await frontendApi.login(email, password); setPassword(""); window.location.replace("/dashboard"); } catch (reason) { setAuthError(reason instanceof Error ? reason.message : "Přihlášení se nezdařilo."); setAuthenticating(false); } };
  const logout = async () => { setAuthError(""); try { await frontendApi.logout(); setUser(null); setWorkspace(null); setOpen(false); } catch (reason) { setAuthError(reason instanceof Error ? reason.message : "Odhlášení se nezdařilo."); } };

  if (user === undefined) return <div className="auth-page"><div className="auth-card" role="status"><BrandMark /><span className="spinner" /><p>Kontroluji přihlášení…</p></div></div>;
  if (!user) return <div className="auth-page"><main className="auth-card"><BrandMark /><div><span className="outcome-eyebrow">Přístup pro provozovatele</span><h1>Vítejte zpět</h1><p>Přihlaste se a spravujte pracovní dobu, rezervační odkazy a rezervace.</p></div><form onSubmit={login}><label>E-mailová adresa<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Heslo<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><Link className="auth-inline-link" href="/forgot-password">Zapomenuté heslo?</Link>{authError && <div className="form-error" role="alert" aria-live="assertive">{authError}</div>}<button className="button button-primary" type="submit" disabled={authenticating}>{authenticating ? "Přihlašuji…" : "Přihlásit se"}</button></form><p className="auth-switch">Jste tu poprvé? <Link href="/signup">Vytvořit provozovnu</Link> · <Link href="/verify-email">Ověřit e-mail</Link></p></main></div>;
  return (
    <WorkspaceAccessProvider workspace={workspace}><div className="app-shell">
      <a className="skip-link" href="#main-content">Přeskočit na obsah</a>
      <aside id="primary-sidebar" ref={sidebarRef} className={`sidebar ${open ? "is-open" : ""}`} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? "Hlavní navigace" : undefined} onKeyDown={trapNavigation}>
        <div className="sidebar-brand"><Link href="/dashboard"><BrandMark /></Link><button ref={closeButtonRef} type="button" className="icon-button sidebar-close" onClick={closeNavigation} aria-label="Zavřít navigaci"><Icon name="x" /></button></div>
        <nav className="sidebar-nav" aria-label="Hlavní navigace">
          <div className="nav-label">Provozovna</div>
          {navigation.filter((item) => workspace?.role !== "MEMBER" || item.href === "/dashboard" || item.href === "/bookings").map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>;
          })}
          <div className="nav-spacer" />
          <div className="nav-label">Účet</div>
          <Link href="/settings" onClick={() => setOpen(false)} className={`nav-item ${pathname.startsWith("/settings") ? "is-active" : ""}`}><Icon name="settings" /><span>Nastavení</span></Link>
        </nav>
        <div className="sidebar-profile">
          <Avatar name={user.name} imageUrl={user.imageUrl} />
          <div><strong>{user.name}</strong><span>{user.email}</span></div>
          <button className="icon-button" onClick={logout} aria-label="Odhlásit se"><Icon name="logout" /></button>
        </div>
      </aside>
      {open && <button type="button" className="sidebar-scrim" aria-label="Zavřít navigaci" onClick={closeNavigation} tabIndex={-1} />}
      <div className="app-frame" inert={open} aria-hidden={open || undefined}>
        <header className="topbar">
          <button ref={menuButtonRef} type="button" className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Otevřít navigaci" aria-expanded={open} aria-controls="primary-sidebar"><Icon name="menu" /></button>
          <div className="workspace-switcher" aria-label="Aktuální provozovna">{workspaceLogoUrl ? <img src={workspaceLogoUrl} alt="" className="workspace-dot workspace-logo" /> : <span className="workspace-dot">{(workspace?.name || user.name).charAt(0).toUpperCase()}</span>}<span>{workspace?.name || "Provozovna"}</span></div>
          <div className="topbar-actions">
            {workspace?.role !== "MEMBER" && <Link className="public-link" href="/event-types"><Icon name="external" size={15} />Spravovat rezervační odkazy</Link>}
            <Avatar name={user.name} imageUrl={user.imageUrl} size="sm" />
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div></WorkspaceAccessProvider>
  );
}
