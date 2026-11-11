"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DurationOption, EventType } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { foregroundForBackground } from "./brand-contrast";
import { Icon } from "./icons";
import { ActionButton, Badge, Field, Toggle } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

const defaultEvent: EventType = {
  id: "new", title: "", slug: "", description: "", color: "#2563eb", status: "draft", location: "Google Meet",
  locationType: "GOOGLE_MEET", locationValue: null,
  durations: [{ minutes: 30, label: "30 min", isDefault: true, currency: "USD" }], questions: [],
  bookingWindowDays: 60, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, minimumNoticeMinutes: 240,
  bookingCount: 0, hostName: "",
};

const tabs = ["Základní údaje", "Dostupnost", "Otázky"] as const;

export function EventTypeEditor({ eventId, mode = "edit" }: { eventId?: string; mode?: "edit" | "create" }) {
  const router = useRouter();
  const { canManage } = useWorkspaceAccess();
  const [event, setEvent] = useState(defaultEvent);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Základní údaje");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [loaded, setLoaded] = useState(mode === "create");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [persistedSlug, setPersistedSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const revision = useRef(0);
  const isPaid = event.durations.some((duration) => duration.price);
  const currency = event.durations.find((duration) => duration.price)?.currency ?? event.durations[0]?.currency ?? "USD";
  const publicUrl = `/book/${event.slug || "your-link"}`;
  const locationComplete = event.locationType === "GOOGLE_MEET" || Boolean(event.locationValue?.trim());

  useEffect(() => {
    if (mode !== "edit" || !eventId) return;
    let active = true;
    const startingRevision = revision.current;
    frontendApi.getEventType(eventId).then((item) => {
      if (!active || revision.current !== startingRevision) return;
      setEvent(item);
      setPersistedSlug(item.status === "published" && item.slug ? item.slug : null);
      setLoaded(true);
    }).catch((reason) => { if (active) setSaveError(reason instanceof Error ? reason.message : "Službu se nepodařilo načíst."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId, loadAttempt, mode]);

  const update = <K extends keyof EventType>(key: K, value: EventType[K]) => { if (!loaded) return; revision.current += 1; setSaved(false); setEvent((item) => ({ ...item, [key]: value })); };
  const updateDuration = (index: number, patch: Partial<DurationOption>) => update("durations", event.durations.map((item, i) => i === index ? { ...item, ...patch, label: patch.minutes ? `${patch.minutes} min` : item.label } : patch.isDefault ? { ...item, isDefault: false } : item));
  const addDuration = () => update("durations", [...event.durations, { minutes: 60, label: "60 min", isDefault: false, currency }]);
  const canPublish = Boolean(event.title.trim() && event.slug.trim() && event.durations.length > 0 && locationComplete && (!isPaid || currency));
  const completion = useMemo(() => [Boolean(event.title), Boolean(event.slug), event.durations.length > 0, locationComplete].filter(Boolean).length, [event.title, event.slug, event.durations.length, locationComplete]);
  const moveTab = (tab: (typeof tabs)[number], direction: -1 | 1) => { const index = tabs.indexOf(tab); const next = tabs[(index + direction + tabs.length) % tabs.length]!; setActiveTab(next); window.requestAnimationFrame(() => document.getElementById(`event-tab-${next.toLowerCase()}`)?.focus()); };

  async function save(publish = false) {
    if (!loaded) return;
    setSaving(true); setSaveError("");
    const savingRevision = revision.current;
    const next = { ...event, status: publish ? "published" as const : event.status };
    try {
      const persisted = await frontendApi.saveEventType(next, mode, publish);
      setPersistedSlug(persisted.status === "published" && persisted.slug ? persisted.slug : null);
      if (revision.current === savingRevision) {
        setEvent(persisted);
        revision.current += 1;
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2600);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Službu se nepodařilo uložit.");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (mode !== "edit" || !eventId || deleting) return;
    if (!window.confirm(`Smazat „${event.title || "tuto službu"}“? Stávající rezervace zůstanou v historii, ale veřejná rezervační stránka přestane přijímat rezervace.`)) return;
    setDeleting(true); setSaveError("");
    try { await frontendApi.deleteEventType(eventId); router.replace("/event-types"); }
    catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Službu se nepodařilo smazat."); setDeleting(false); }
  }

  if (!canManage) return <div className="editor-page"><section className="empty-state" role="alert"><span className="empty-icon"><Icon name="x" /></span><h1>Vyžaduje roli poskytovatele</h1><p>Vaše role v provozovně neumožňuje vytvářet nebo měnit služby.</p><Link href="/dashboard" className="button button-secondary">Zpět na přehled</Link></section></div>;
  if (mode === "edit" && loading) return <div className="editor-page"><div className="sync-note" role="status"><span className="spinner" />Načítám službu…</div></div>;
  if (mode === "edit" && !loaded) return <div className="editor-page"><section className="empty-state" role="alert"><span className="empty-icon"><Icon name="x" /></span><h1>Služba není dostupná</h1><p>{saveError || "Tuto službu se nepodařilo načíst."}</p><ActionButton variant="primary" onClick={() => { setLoading(true); setSaveError(""); setLoadAttempt((attempt) => attempt + 1); }}>Zkusit znovu</ActionButton><Link href="/event-types" className="button button-secondary">Zpět na služby</Link></section></div>;

  return <div className="editor-page">
    <header className="editor-topbar">
      <div className="editor-title"><Link href="/event-types" className="icon-button" aria-label="Zpět na služby"><Icon name="arrow-left" /></Link><div><span>{mode === "create" ? "Nová služba" : "Úprava služby"}</span><strong>{event.title || "Služba bez názvu"}</strong></div><Badge tone={event.status === "published" ? "success" : "neutral"} dot>{event.status}</Badge></div>
      <div className="editor-actions">{mode === "edit" && <ActionButton onClick={() => void remove()} variant="danger" disabled={deleting || saving}>{deleting ? "Deleting…" : "Smazat"}</ActionButton>}{persistedSlug ? <Link href={`/book/${persistedSlug}`} className="button button-secondary"><Icon name="external" size={16} />Náhled zveřejněné stránky</Link> : <button type="button" className="button button-secondary" disabled title="Před náhledem službu uložte a zveřejněte"><Icon name="external" size={16} />Náhled není dostupný</button>}{event.status !== "published" && <ActionButton onClick={() => save(false)} variant="secondary" disabled={saving || deleting}>{saving ? "Saving…" : "Uložit koncept"}</ActionButton>}<ActionButton onClick={() => save(true)} variant="primary" disabled={!canPublish || saving || deleting}>{saving ? "Saving…" : event.status === "published" ? "Uložit změny" : "Zveřejnit službu"}</ActionButton></div>
    </header>
    {saved && <div className="toast" role="status"><span><Icon name="check" /></span>Změny uloženy</div>}
    {saveError && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{saveError}</div>}
    <div className="editor-layout">
      <aside className="editor-progress"><div className="progress-ring" style={{ "--progress": `${completion * 25}%` } as React.CSSProperties}><strong>{completion * 25}%</strong></div><div><strong>Nastavení služby</strong><span>{completion === 4 ? "Připraveno ke zveřejnění" : `${4 - completion} items remaining`}</span></div></aside>
      <section className="editor-content">
        <nav className="editor-tabs" aria-label="Nastavení služby" role="tablist">{tabs.map((tab) => <button type="button" role="tab" id={`event-tab-${tab.toLowerCase()}`} aria-controls="event-settings-panel" aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} key={tab} className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(tab, -1); } else if (event.key === "ArrowRight") { event.preventDefault(); moveTab(tab, 1); } else if (event.key === "Home") { event.preventDefault(); setActiveTab(tabs[0]); window.requestAnimationFrame(() => document.getElementById("event-tab-basics")?.focus()); } else if (event.key === "End") { event.preventDefault(); setActiveTab(tabs.at(-1)!); window.requestAnimationFrame(() => document.getElementById("event-tab-questions")?.focus()); } }}>{tab}</button>)}</nav>
        <div id="event-settings-panel" role="tabpanel" aria-labelledby={`event-tab-${activeTab.toLowerCase()}`}>
        {activeTab === "Základní údaje" && <div className="editor-sections">
          <section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Údaje o službě</h2><p>Dejte klientům jasný důvod k rezervaci.</p></div></div><div className="form-grid">
            <Field label="Název služby" required><input value={event.title} onChange={(e) => update("title", e.target.value)} placeholder="např. Pánský střih" /></Field>
            <Field label="Rezervační odkaz" required hint={publicUrl}><div className="input-prefix"><span suppressHydrationWarning>{typeof window === "undefined" ? "/book/" : `${window.location.origin}/book/`}</span><input value={event.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="discovery-call" /></div></Field>
            <Field label="Popis"><textarea rows={4} value={event.description} onChange={(e) => update("description", e.target.value)} placeholder="Popište klientům, o co jde a jak se připravit." /></Field>
            <Field label="Barva služby"><div className="color-options" role="radiogroup" aria-label="Barva služby">{["#2563eb", "#16a394", "#3978d4", "#ed7a5f", "#e2a93b", "#8f5db7"].map((color) => <button type="button" role="radio" aria-checked={event.color === color} key={color} className={event.color === color ? "is-selected" : ""} style={{ background: color, color: foregroundForBackground(color) }} onClick={() => update("color", color)} aria-label={`Použít barvu ${color}`}><Icon name="check" size={14} /></button>)}</div></Field>
          </div></section>
          <section className="form-card"><div className="form-card-title"><span className="number-chip">2</span><div><h2>Možnosti délky</h2><p>Klient si před výběrem termínu zvolí jednu délku.</p></div></div><div className="duration-list" role="radiogroup" aria-label="Výchozí délka">
            {event.durations.map((duration, index) => <div className="duration-row" key={duration.id ?? `new-${index}`}>
              <button type="button" role="radio" aria-checked={duration.isDefault} className={`radio ${duration.isDefault ? "is-selected" : ""}`} aria-label={`Nastavit ${duration.label} jako výchozí`} onClick={() => updateDuration(index, { isDefault: true })}><span /></button>
              <div className="duration-input"><input aria-label={`Délka ${index + 1} v minutách`} type="number" min="15" max="480" value={duration.minutes} onChange={(e) => updateDuration(index, { minutes: Number(e.target.value) })} /><span>minut</span></div>
              <select aria-label={`Typ platby pro ${duration.label}`} value={duration.price ? "paid" : "free"} onChange={(e) => updateDuration(index, { price: e.target.value === "paid" ? 250 : undefined, currency })}><option value="free">Zdarma</option><option value="paid">Placené</option></select>
              {duration.price ? <div className="money-input"><span>$</span><input aria-label={`Cena pro ${duration.label}`} type="number" value={duration.price} onChange={(e) => updateDuration(index, { price: Number(e.target.value) })} /></div> : <span className="muted">Bez platby</span>}
              <button type="button" className="icon-button" onClick={() => event.durations.length > 1 && update("durations", event.durations.filter((_, i) => i !== index))} aria-label={`Remove ${duration.label}`} disabled={event.durations.length === 1}><Icon name="trash" /></button>
              {duration.isDefault && <Badge tone="brand">Výchozí</Badge>}
            </div>)}
            <button type="button" className="add-row" onClick={addDuration}><Icon name="plus" />Přidat další délku</button>
          </div>{isPaid && <div className="inline-fields"><Field label="Měna" required><select value={currency} onChange={(e) => update("durations", event.durations.map((duration) => ({ ...duration, currency: e.target.value })))}><option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option></select></Field><div className="notice notice-info"><Icon name="sparkles" /><div><strong>Platebního poskytovatele spravuje server</strong><span>Zveřejnění a platby závisí na ověřené konfiguraci serveru.</span></div></div></div>}</section>
          <section className="form-card"><div className="form-card-title"><span className="number-chip">3</span><div><h2>Místo</h2><p>Vyberte, kde se služba koná, a doplňte údaje pro klienty.</p></div></div><Field label="Typ místa" required><select value={event.locationType} onChange={(item) => { const locationType = item.target.value as EventType["locationType"]; update("locationType", locationType); update("locationValue", locationType === "GOOGLE_MEET" ? null : event.locationValue); update("location", locationType === "GOOGLE_MEET" ? "Google Meet" : event.locationValue || (locationType === "PHONE" ? "Telefonát" : locationType === "IN_PERSON" ? "Osobně" : "Vlastní místo")); }}><option value="GOOGLE_MEET">Google Meet</option><option value="PHONE">Telefonát</option><option value="IN_PERSON">Osobně</option><option value="CUSTOM">Vlastní</option></select></Field>{event.locationType !== "GOOGLE_MEET" && <Field label={event.locationType === "PHONE" ? "Pokyny k telefonátu" : event.locationType === "IN_PERSON" ? "Adresa" : "Podrobnosti o místě"} required hint="Tyto údaje se uloží k rezervaci a zobrazí se klientům."><input value={event.locationValue ?? ""} onChange={(item) => { update("locationValue", item.target.value); update("location", item.target.value || (event.locationType === "PHONE" ? "Telefonát" : event.locationType === "IN_PERSON" ? "Osobně" : "Vlastní místo")); }} required /></Field>}</section>
        </div>}
        {activeTab === "Dostupnost" && <div className="editor-sections"><section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Kdy si lze rezervovat?</h2><p>Vaše týdenní pracovní doba se kombinuje s těmito pravidly služby.</p></div></div><div className="two-column"><Field label="Rezervovat dopředu"><select value={event.bookingWindowDays} onChange={(e) => update("bookingWindowDays", Number(e.target.value))}>{![30, 60, 90].includes(event.bookingWindowDays) && <option value={event.bookingWindowDays}>{event.bookingWindowDays} dní dopředu</option>}<option value={30}>30 dní dopředu</option><option value={60}>60 dní dopředu</option><option value={90}>90 dní dopředu</option></select></Field><Field label="Minimální předstih"><select value={event.minimumNoticeMinutes} onChange={(e) => update("minimumNoticeMinutes", Number(e.target.value))}>{![0, 240, 1440, 2880].includes(event.minimumNoticeMinutes) && <option value={event.minimumNoticeMinutes}>{event.minimumNoticeMinutes} minutes</option>}<option value={0}>Bez minimálního předstihu</option><option value={240}>4 hodiny</option><option value={1440}>24 hodin</option><option value={2880}>48 hodin</option></select></Field><Field label="Rezerva před"><select value={event.bufferBeforeMinutes} onChange={(e) => update("bufferBeforeMinutes", Number(e.target.value))}>{![0, 15, 30, 60].includes(event.bufferBeforeMinutes) && <option value={event.bufferBeforeMinutes}>{event.bufferBeforeMinutes} minutes</option>}<option value={0}>Bez rezervy</option><option value={15}>15 minut</option><option value={30}>30 minut</option><option value={60}>60 minut</option></select></Field><Field label="Rezerva po"><select value={event.bufferAfterMinutes} onChange={(e) => update("bufferAfterMinutes", Number(e.target.value))}>{![0, 15, 30, 60].includes(event.bufferAfterMinutes) && <option value={event.bufferAfterMinutes}>{event.bufferAfterMinutes} minutes</option>}<option value={0}>Bez rezervy</option><option value={15}>15 minut</option><option value={30}>30 minut</option><option value={60}>60 minut</option></select></Field></div><div className="notice notice-info"><Icon name="availability" /><div><strong>Týdenní pracovní doba a výjimky</strong><span>Základní rozvrh nastavíte na stránce Dostupnost.</span></div></div></section></div>}
        {activeTab === "Otázky" && <div className="editor-sections"><section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Otázky pro klienta</h2><p>Jméno a e-mail se vyžadují vždy. Přidejte, co dalšího potřebujete vědět.</p></div></div><div className="question-list"><div className="question-row"><span className="drag-handle">⋮⋮</span><div><strong>Jméno</strong><span>Krátká odpověď · Povinné</span></div><Badge tone="neutral">Systém</Badge></div><div className="question-row"><span className="drag-handle">⋮⋮</span><div><strong>E-mail</strong><span>E-mail · Povinné</span></div><Badge tone="neutral">Systém</Badge></div>{event.questions.map((question, index) => <div className="question-row" key={question.id ?? `${question.label}-${index}`}><span className="drag-handle">⋮⋮</span><div><input value={question.label} onChange={(item) => update("questions", event.questions.map((current, position) => position === index ? { ...current, label: item.target.value } : current))} aria-label={`Question ${index + 1}`} /><span>{question.kind === "TEXTAREA" ? "Dlouhá odpověď" : "Krátká odpověď"} · {question.required ? "Povinné" : "Nepovinné"}</span></div><Toggle checked={question.required} onChange={(required) => update("questions", event.questions.map((current, position) => position === index ? { ...current, required } : current))} label={`Require ${question.label}`} /><button className="icon-button" onClick={() => update("questions", event.questions.filter((_, position) => position !== index))} aria-label={`Remove ${question.label}`}><Icon name="trash" /></button></div>)}<button className="add-row" onClick={() => update("questions", [...event.questions, { label: "Co bychom měli vědět předem?", kind: "TEXTAREA", required: false, options: [] }])}><Icon name="plus" />Přidat otázku</button></div></section></div>}
        </div>
      </section>
      <aside className="editor-preview"><span className="preview-label">Živý náhled</span><div className="mini-booking-card"><div className="mini-brand"><span className="mini-logo">T</span><strong>Vzhled provozovny</strong></div><span className="mini-host">Poskytovatel</span><h2>{event.title || "Název vaší služby"}</h2><p>{event.description || "Jasný a užitečný popis toho, co klienta čeká."}</p><div className="mini-meta"><span><Icon name="clock" />{event.durations.map((d) => d.label).join(" or ")}</span><span><Icon name="video" />{event.location}</span><span><Icon name="globe" />Časové pásmo klienta</span></div><button type="button" disabled aria-label="Pouze náhled">Vyberte čas <Icon name="arrow-right" /></button></div><small>Změny se tu zobrazují průběžně.</small></aside>
    </div>
  </div>;
}
