"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingSlot, CreateBookingInput, WorkspaceBranding } from "@/lib/contracts";
import type { DurationOption, EventType } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { clearTerminalBookingAttempt, getBookingAttempt, rememberBookingAttempt } from "./booking-attempt";
import { foregroundForBackground } from "./brand-contrast";
import { loadBookingWindowSlots } from "./slot-window";
import { Icon } from "./icons";
import { ActionButton, BrandMark, Field } from "./ui";

type Step = "schedule" | "details" | "review";
type SlotDay = { key: string; weekday: string; day: string; month: string; label: string };
type SlotView = { slot: BookingSlot; day: SlotDay; time: string };
type SlotFormatters = { key: Intl.DateTimeFormat; day: Intl.DateTimeFormat; time: Intl.DateTimeFormat };
const steps: Step[] = ["schedule", "details", "review"];
const fallbackTimeZones = ["UTC", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London"];
const supportedTimeZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimeZones;
const timeZones = ["UTC", ...supportedTimeZones.filter((zone) => zone !== "UTC")];
const publicEventRequests = new Map<string, Promise<EventType>>();

function loadPublicEvent(slug: string) {
  const existing = publicEventRequests.get(slug);
  if (existing) return existing;
  const request = frontendApi.getPublicEvent(slug).finally(() => {
    if (publicEventRequests.get(slug) === request) publicEventRequests.delete(slug);
  });
  publicEventRequests.set(slug, request);
  return request;
}

function dateKey(value: string, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function slotView(slot: BookingSlot, formatters: SlotFormatters): SlotView {
  const date = new Date(slot.start);
  const parts = formatters.day.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const month = get("month");
  const day = get("day");
  return { slot, day: { key: dateKey(slot.start, formatters.key), weekday, day, month, label: `${weekday} ${day}. ${month} ${get("year")}` }, time: formatters.time.format(date) };
}

function timeZoneLabel(zone: string) {
  const city = zone === "UTC" ? "UTC" : zone.split("/").at(-1)!.replaceAll("_", " ");
  if (zone === "UTC") return city;
  try { const offset = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value; return offset ? `${city} · ${offset}` : city; }
  catch { return city; }
}

function validInviteeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function currencyLabel(value?: string) {
  return (value || "USD").toUpperCase();
}

function requiredAnswerComplete(question: EventType["questions"][number], answers: Record<string, string | boolean>) {
  if (!question.required) return true;
  if (!question.id) return false;
  const answer = answers[question.id];
  return typeof answer === "boolean" ? answer : typeof answer === "string" && answer.trim().length > 0;
}

function PublicBrandLogo({ branding }: { branding: WorkspaceBranding | null | undefined }) {
  const initial = branding?.workspaceName.charAt(0).toUpperCase() || "T";
  return <span className="public-logo" style={{ background: branding?.accentColor, color: foregroundForBackground(branding?.accentColor) }}>{branding?.logoUrl ? <span role="img" aria-label={`${branding.workspaceName} logo`} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", background: `#fff center / contain no-repeat url(${JSON.stringify(branding.logoUrl)})` }} /> : initial}</span>;
}

export function PublicBookingFlow({ slug }: { slug: string }) {
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const flowMounted = useRef(false);
  const router = useRouter();
  const [event, setEvent] = useState<EventType | null>(null);
  const [duration, setDuration] = useState<DurationOption | null>(null);
  const [step, setStep] = useState<Step>("schedule");
  const [furthestStep, setFurthestStep] = useState<Step>("schedule");
  const [timezone, setTimezone] = useState(() => { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; const normalized = detected === "Etc/UTC" ? "UTC" : detected; return timeZones.includes(normalized) ? normalized : "UTC"; });
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotRefreshVersion, setSlotRefreshVersion] = useState(0);
  const [availabilityNotice, setAvailabilityNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const slotFormatters = useMemo<SlotFormatters>(() => ({
    key: new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }),
    day: new Intl.DateTimeFormat("cs-CZ", { timeZone: timezone, weekday: "short", month: "long", day: "numeric", year: "numeric" }),
    time: new Intl.DateTimeFormat("cs-CZ", { timeZone: timezone, hour: "numeric", minute: "2-digit" }),
  }), [timezone]);
  useEffect(() => { if (!flowMounted.current) { flowMounted.current = true; return; } window.requestAnimationFrame(() => stepHeadingRef.current?.focus()); }, [step]);

  useEffect(() => {
    let active = true;
    loadPublicEvent(slug).then((item) => {
      if (!active) return;
      setEvent(item);
      setLoadingSlots(true);
      setDuration(item.durations.find((option) => option.isDefault) ?? item.durations[0] ?? null);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Tato rezervační stránka není dostupná."); }).finally(() => { if (active) setLoadingEvent(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!event || !duration) return;
    let active = true;
    const controller = new AbortController();
    loadBookingWindowSlots(slug, event.bookingWindowDays, timezone, duration.id, controller.signal)
      .then((items) => { if (!active) return; setError(""); setSlots(items); const first = items.find((slot) => !duration.id || slot.durationId === duration.id); setSelectedDate(first ? dateKey(first.start, slotFormatters.key) : ""); setSelectedStart(""); setDayOffset(0); })
      .catch((reason) => { if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return; setSlots([]); setError(reason instanceof Error ? reason.message : "Volné termíny se nepodařilo načíst."); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; controller.abort(); };
  }, [duration, event, slug, slotFormatters, slotRefreshVersion, timezone]);

  const slotViews = useMemo(() => slots.map((slot) => slotView(slot, slotFormatters)), [slotFormatters, slots]);
  const days = useMemo(() => {
    const unique = new Map<string, SlotDay>();
    slotViews.forEach(({ day }) => { if (!unique.has(day.key)) unique.set(day.key, day); });
    return [...unique.values()];
  }, [slotViews]);
  const selectedDay = days.find((day) => day.key === selectedDate);
  const visibleDays = days.slice(dayOffset, dayOffset + 7);
  const selectedDurationId = duration?.id;
  const daySlots = useMemo(() => slotViews.filter(({ slot, day }) => day.key === selectedDate && (!selectedDurationId || slot.durationId === selectedDurationId)), [selectedDate, selectedDurationId, slotViews]);
  const selectedSlotView = useMemo(() => slotViews.find(({ slot }) => slot.start === selectedStart && (!selectedDurationId || slot.durationId === selectedDurationId)), [selectedDurationId, selectedStart, slotViews]);
  const selectedSlot = selectedSlotView?.slot;
  const paid = Boolean(duration?.price);
  const scheduleComplete = Boolean(selectedSlot && duration);
  const detailsComplete = Boolean(event && name.trim().length >= 2 && name.trim().length <= 120 && validInviteeEmail(email) && event.questions.every((question) => requiredAnswerComplete(question, answers)));

  function resetScheduleProgress() {
    setSelectedStart("");
    setStep("schedule");
    setFurthestStep("schedule");
    setError("");
    setAvailabilityNotice("");
  }

  function goToStep(target: Step) {
    if (target !== "schedule" && !scheduleComplete) {
      setStep("schedule");
      setError("Než budete pokračovat, vyberte volný termín.");
      return;
    }
    if (target === "review" && !detailsComplete) {
      setStep("details");
      setError("Zadejte platné jméno a e-mail a vyplňte všechny povinné otázky.");
      setFurthestStep((current) => steps.indexOf(current) < steps.indexOf("details") ? "details" : current);
      return;
    }
    setError("");
    setStep(target);
    setFurthestStep((current) => steps.indexOf(current) < steps.indexOf(target) ? target : current);
  }

  function stepClass(target: Step) {
    if (step === target) return "is-active";
    return steps.indexOf(target) < steps.indexOf(furthestStep) ? "is-complete" : "";
  }

  async function confirm() {
    if (!selectedSlot || !duration || !event) return;
    setSubmitting(true);
    setError("");
    try {
      const input: CreateBookingInput = { startAt: selectedSlot.start, inviteeName: name.trim(), inviteeEmail: email.trim(), inviteeTimeZone: timezone, notes: notes.trim(), durationId: duration.id, answers: event.questions.flatMap((question) => question.id ? [{ questionId: question.id, value: answers[question.id] ?? "" }] : []) };
      const attempt = await getBookingAttempt(slug, input);
      const result = await frontendApi.createBooking(slug, input, attempt.key);
      rememberBookingAttempt(slug, result.bookingId);
      let verified;
      try {
        verified = await frontendApi.getBookingForManage(result.bookingId);
        await frontendApi.acknowledgeBookingManageSession(result.bookingId);
      } catch (reason) {
        throw reason instanceof Error ? reason : new Error("Zabezpečenou správu rezervace se nepodařilo ověřit.");
      }
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (paid || verified.status === "PENDING_PAYMENT") {
        router.push(`/book/${slug}/confirmation?booking=${encodeURIComponent(result.bookingId)}&payment=cancelled`);
        return;
      }
      if (verified.status !== "CONFIRMED") {
        setError(`Server vrátil stav ${verified.status.toLowerCase().replaceAll("_", " ")} místo potvrzené rezervace.`);
        return;
      }
      clearTerminalBookingAttempt(slug);
      router.push(`/book/${slug}/confirmation?booking=${encodeURIComponent(result.bookingId)}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Tento termín už není volný. Vyberte prosím jiný.";
      if (/no longer available|just booked|slot.*unavailable/i.test(message)) {
        setSelectedStart("");
        setStep("schedule");
        setFurthestStep("schedule");
        setError("");
        setAvailabilityNotice("Tento termín byl právě zarezervován. Dostupnost jsme obnovili, vyberte jiný termín.");
        setLoadingSlots(true);
        setSlotRefreshVersion((current) => current + 1);
      } else {
        setError(message);
      }
    } finally { setSubmitting(false); }
  }

  if (loadingEvent) return <div className="public-page"><header className="public-header"><BrandMark /></header><main className="outcome-shell" role="status"><span className="spinner" /><p>Načítám rezervační stránku…</p></main></div>;
  if (!event || !duration) return <div className="public-page"><header className="public-header"><BrandMark /></header><main className="outcome-shell"><h1>Rezervační stránka není dostupná</h1><p>{error || "Tato služba nemá žádnou rezervovatelnou délku."}</p></main></div>;
  const branding = event.branding;

  return <div className="public-page">
    <header className="public-header"><div className="public-workspace-brand"><PublicBrandLogo branding={branding} /><strong>{branding?.workspaceName || "Rezervace"}</strong></div><div><Icon name="globe" /><select value={timezone} onChange={(item) => { setLoadingSlots(true); resetScheduleProgress(); setTimezone(item.target.value); }} aria-label="Časové pásmo rezervace">{timeZones.map((zone) => <option value={zone} key={zone}>{timeZoneLabel(zone)}</option>)}</select></div></header>
    <main className="booking-shell">
      <aside className="booking-info"><span className="host-label">Poskytovatel: {branding?.workspaceName || "provozovna"}</span><h1>{event.title}</h1><p>{event.description}</p>{branding?.description && <p className="workspace-description">{branding.description}</p>}<div className="public-meta"><span><Icon name="clock" />{duration.label}</span><span><Icon name="video" />{event.location}</span><span><Icon name="globe" />{timeZoneLabel(timezone)}</span>{paid && <span><Icon name="sparkles" />${duration.price?.toFixed(2)} {currencyLabel(duration.currency)} · card</span>}</div><div className="booking-safe-note"><Icon name="check" /><span>Termín je potvrzen po dokončení rezervace. Účet není potřeba.</span></div></aside>
      <section className="booking-flow" aria-busy={step === "schedule" && loadingSlots} aria-label="Kroky rezervace">
        <nav className="stepper" aria-label="Průběh rezervace">
          <button type="button" className={`stepper-step ${stepClass("schedule")}`} aria-current={step === "schedule" ? "step" : undefined} aria-controls="booking-step-panel" aria-label="Krok Termín" onClick={() => goToStep("schedule")}><i>{steps.indexOf(furthestStep) > 0 && step !== "schedule" ? <Icon name="check" size={12} /> : "1"}</i><span>Termín</span></button>
          <b className="stepper-connector" aria-hidden="true" />
          <button type="button" className={`stepper-step ${stepClass("details")}`} aria-current={step === "details" ? "step" : undefined} aria-controls="booking-step-panel" aria-disabled={!scheduleComplete} aria-label={scheduleComplete ? "Krok Údaje" : "Krok Údaje. Nejdřív vyberte termín"} onClick={() => goToStep("details")}><i>{steps.indexOf(furthestStep) > 1 && step !== "details" ? <Icon name="check" size={12} /> : "2"}</i><span>Údaje</span></button>
          <b className="stepper-connector" aria-hidden="true" />
          <button type="button" className={`stepper-step ${stepClass("review")}`} aria-current={step === "review" ? "step" : undefined} aria-controls="booking-step-panel" aria-disabled={!scheduleComplete || !detailsComplete} aria-label={scheduleComplete && detailsComplete ? "Krok Shrnutí" : "Krok Shrnutí. Nejdřív vyplňte termín a údaje"} onClick={() => goToStep("review")}><i>3</i><span>Shrnutí</span></button>
        </nav>
        {error && <div className="form-error" role="alert">{error}</div>}
        {availabilityNotice && <div className="notice notice-warning" role="status"><Icon name="calendar" /><div><strong>Vybrat jiný termín</strong><span>{availabilityNotice}</span></div></div>}
        {step === "schedule" && <div className="flow-panel" id="booking-step-panel">
          <div className="flow-heading"><h2 ref={stepHeadingRef} tabIndex={-1}>Vyberte délku</h2><p>Zvolte délku, která vám vyhovuje.</p></div>
          <div className="duration-options">{event.durations.map((item) => <button type="button" key={item.id ?? `${item.minutes}-${item.currency ?? "free"}`} className={duration.id === item.id ? "is-selected" : ""} aria-pressed={duration.id === item.id} onClick={() => { setLoadingSlots(true); resetScheduleProgress(); setDuration(item); }}><span><strong>{item.label}</strong>{item.isDefault && <small>Nejoblíbenější</small>}</span><span>{item.price ? `$${item.price} ${currencyLabel(item.currency)}` : "Zdarma"}</span><i><Icon name="check" size={14} /></i></button>)}</div>
          <div className="flow-heading calendar-heading"><div><h2>Vyberte den a čas</h2><p>{timeZoneLabel(timezone)}</p></div><div><button type="button" className="icon-button" aria-label="Předchozí volné dny" disabled={dayOffset === 0} onClick={() => { const next = Math.max(0, dayOffset - 7); setDayOffset(next); setSelectedDate(days[next]?.key ?? ""); resetScheduleProgress(); }}><Icon name="arrow-left" /></button><button type="button" className="icon-button" aria-label="Další volné dny" disabled={dayOffset + 7 >= days.length} onClick={() => { const next = Math.min(dayOffset + 7, Math.max(0, days.length - 1)); setDayOffset(next); setSelectedDate(days[next]?.key ?? ""); resetScheduleProgress(); }}><Icon name="arrow-right" /></button></div></div>
          {loadingSlots ? <div className="sync-note" role="status"><span className="spinner" />Načítám volné termíny…</div> : days.length ? <div className="booking-calendar"><div className="calendar-week">{visibleDays.map((day) => <button type="button" className={selectedDate === day.key ? "is-selected" : ""} aria-pressed={selectedDate === day.key} onClick={() => { setSelectedDate(day.key); resetScheduleProgress(); }} key={day.key}><span>{day.weekday}</span><strong>{day.day}</strong><i>{day.month}</i></button>)}</div><div className="time-grid-scroll" role="region" aria-label={`Volné časy pro ${selectedDay?.label ?? "vybraný den"}`} tabIndex={0}><div className="time-grid">{daySlots.map(({ slot, time }) => <button type="button" className={selectedStart === slot.start ? "is-selected" : ""} aria-pressed={selectedStart === slot.start} onClick={() => { setSelectedStart(slot.start); setFurthestStep("schedule"); setError(""); setAvailabilityNotice(""); }} key={slot.start}>{time}{selectedStart === slot.start && <Icon name="check" size={15} />}</button>)}</div></div></div> : <div className="empty-state"><span className="empty-icon"><Icon name="calendar" /></span><h3>Žádné volné termíny</h3><p>Zkuste jiné časové pásmo nebo kontaktujte poskytovatele.</p></div>}
          <ActionButton variant="primary" className="flow-next" disabled={!scheduleComplete} onClick={() => goToStep("details")}>Pokračovat <Icon name="arrow-right" /></ActionButton>
        </div>}
        {step === "details" && <div className="flow-panel" id="booking-step-panel"><button type="button" className="back-link" onClick={() => goToStep("schedule")}><Icon name="arrow-left" />Zpět na termíny</button><div className="flow-heading"><h2 ref={stepHeadingRef} tabIndex={-1}>Řekněte nám něco o sobě</h2><p>Vaše údaje použijeme jen pro domluvu této rezervace.</p></div><div className="details-form"><Field label="Jméno" required><input value={name} onChange={(item) => setName(item.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></Field><Field label="E-mailová adresa" required><input value={email} onChange={(item) => setEmail(item.target.value)} autoComplete="email" type="email" required /></Field>{event.questions.map((question) => <Field key={question.id ?? question.label} label={question.label} required={question.required}>{question.kind === "CHECKBOX" ? <input type="checkbox" checked={Boolean(question.id && answers[question.id])} onChange={(item) => question.id && setAnswers((current) => ({ ...current, [question.id!]: item.target.checked }))} required={question.required} /> : question.kind === "SELECT" ? <select value={question.id ? String(answers[question.id] ?? "") : ""} onChange={(item) => question.id && setAnswers((current) => ({ ...current, [question.id!]: item.target.value }))} required={question.required}><option value="">Vyberte možnost</option>{question.options.map((option) => <option key={option}>{option}</option>)}</select> : <textarea rows={question.kind === "TEXTAREA" ? 4 : 2} value={question.id ? String(answers[question.id] ?? "") : ""} onChange={(item) => question.id && setAnswers((current) => ({ ...current, [question.id!]: item.target.value }))} required={question.required} />}</Field>)}<Field label="Poznámka"><textarea rows={3} value={notes} onChange={(item) => setNotes(item.target.value)} maxLength={2000} /></Field></div><ActionButton variant="primary" className="flow-next" disabled={!detailsComplete} onClick={() => goToStep("review")}>Zkontrolovat rezervaci <Icon name="arrow-right" /></ActionButton></div>}
        {step === "review" && <div className="flow-panel" id="booking-step-panel"><button type="button" className="back-link" onClick={() => goToStep("details")}><Icon name="arrow-left" />Upravit údaje</button><div className="flow-heading"><h2 ref={stepHeadingRef} tabIndex={-1}>Zkontrolujte rezervaci</h2><p>Před odesláním zkontrolujte údaje níže.</p></div><div className="review-card"><div className="review-event"><span style={{ background: event.color }} /><div><strong>{event.title}</strong><small>{event.location}</small></div></div><dl><div><dt><Icon name="calendar" />Datum</dt><dd>{selectedDay?.label}</dd></div><div><dt><Icon name="clock" />Termín</dt><dd>{selectedSlotView?.time ?? ""} · {duration.label}</dd></div><div><dt><Icon name="globe" />Časové pásmo</dt><dd>{timeZoneLabel(timezone)}</dd></div><div><dt><Icon name="team" />Klient</dt><dd>{name}<small>{email}</small></dd></div>{paid && <div><dt><Icon name="sparkles" />K úhradě nyní</dt><dd>${duration.price?.toFixed(2)} {currencyLabel(duration.currency)}<small>Zabezpečená platba kartou</small></dd></div>}</dl></div>{paid && <div className="refund-note"><strong>Storno a vrácení peněz</strong><p>Rezervaci můžete zrušit nebo přesunout přes zabezpečený odkaz pro správu. Vrácení peněz za oprávněná storna zpracuje platební poskytovatel, nemusí být okamžité.</p></div>}<ActionButton variant="primary" className="flow-next" disabled={submitting} onClick={confirm}>{submitting ? "Potvrzuji…" : paid ? `Pokračovat k zabezpečené platbě · ${duration.price} ${currencyLabel(duration.currency)}` : "Potvrdit rezervaci"}<Icon name="arrow-right" /></ActionButton></div>}
      </section>
    </main>
    <footer className="public-footer"><span>{branding?.footerText || "Běží na systému Rezervace"}</span><span>Bezpečná rezervace</span></footer>
  </div>;
}
