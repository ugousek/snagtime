"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvailabilityOverride } from "@/lib/contracts";
import type { AvailabilityDay, AvailabilityWindow } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { availabilitySaveResultIsCurrent, canMutateAvailability, type AvailabilityLoadState } from "./availability-editor-state";
import { Icon } from "./icons";
import { ActionButton, Badge, Field, PageHeader, SectionHeader, Toggle } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

const HOURS = Array.from({ length: 33 }, (_, index) => `${Math.floor(index / 2) + 6}:${index % 2 ? "30" : "00"}`);
const timeHour = (time: string) => Number(time.split(":")[0]);

const clockValue = (minutes: number | null | undefined, fallback: number) => { const value = minutes ?? fallback; return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`; };
const clockMinutes = (value: string) => { const [hours = 0, minutes = 0] = value.split(":").map(Number); return hours * 60 + minutes; };

export function AvailabilityEditor() {
  const { canManage } = useWorkspaceAccess();
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadState, setLoadState] = useState<AvailabilityLoadState>("loading");
  const [error, setError] = useState("");
  const editRevision = useRef(0);
  const loadRevision = useRef(0);

  const markEdited = () => { editRevision.current += 1; setDirty(true); setSaved(false); };
  const patchDay = (index: number, patch: Partial<AvailabilityDay>) => { markEdited(); setDays((items) => items.map((day, i) => i === index ? { ...day, ...patch } : day)); };
  const patchWindow = (dayIndex: number, windowIndex: number, patch: Partial<AvailabilityWindow>) => { markEdited(); setDays((items) => items.map((day, index) => index === dayIndex ? { ...day, windows: day.windows.map((window, i) => i === windowIndex ? { ...window, ...patch } : window) } : day)); };
  const patchOverrides = (update: (items: AvailabilityOverride[]) => AvailabilityOverride[]) => { markEdited(); setOverrides(update); };
  const patchTimeZone = (value: string) => { markEdited(); setTimeZone(value); };
  const loadAvailability = useCallback(() => {
    const requestRevision = ++loadRevision.current;
    return frontendApi.getAvailability().then((schedule) => {
      if (loadRevision.current !== requestRevision) return;
      setDays(schedule.days); setTimeZone(schedule.timeZone); setOverrides(schedule.overrides);
      editRevision.current = 0; setDirty(false); setLoadState("loaded");
    }).catch((reason) => {
      if (loadRevision.current !== requestRevision) return;
      setError(reason instanceof Error ? reason.message : "Dostupnost se nepodařilo načíst."); setLoadState("error");
    });
  }, []);
  useEffect(() => { void loadAvailability(); return () => { loadRevision.current += 1; }; }, [loadAvailability]);
  const retryLoad = () => { setLoadState("loading"); setError(""); setSaved(false); void loadAvailability(); };
  const save = async () => {
    if (!canMutateAvailability(loadState) || !dirty || saving || conflictingDates.size > 0) return;
    const submittedRevision = editRevision.current;
    const submittedDays = days; const submittedTimeZone = timeZone; const submittedOverrides = overrides;
    setSaving(true); setError("");
    try {
      const schedule = await frontendApi.saveAvailability(submittedDays, submittedTimeZone, submittedOverrides);
      if (availabilitySaveResultIsCurrent(submittedRevision, editRevision.current)) {
        setDays(schedule.days); setTimeZone(schedule.timeZone); setOverrides(schedule.overrides); setDirty(false); setSaved(true);
        window.setTimeout(() => setSaved(false), 2400);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Dostupnost se nepodařilo uložit."); }
    finally { setSaving(false); }
  };
  const nextDate = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().slice(0, 10);
  };
  const dateCounts = overrides.reduce((counts, item) => counts.set(item.dateKey, (counts.get(item.dateKey) ?? 0) + 1), new Map<string, number>());
  const conflictingDates = new Set([...dateCounts].filter(([, count]) => count > 1).map(([date]) => date));
  const nextUnusedDate = () => { const date = new Date(`${nextDate()}T12:00:00Z`); while (overrides.some((item) => item.dateKey === date.toISOString().slice(0, 10))) date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };

  if (!canManage) return <div className="page-stack"><PageHeader title="Dostupnost" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Vyžaduje roli poskytovatele</h2><p>Vaše role v provozovně neumožňuje měnit dostupnost.</p></section></div>;
  if (loadState === "loading") return <div className="page-stack"><PageHeader eyebrow="Rozvrh · Pracovní doba" title="Dostupnost" description="Nastavte, kdy si vás klienti mohou rezervovat. Pravidla služeb a kolize v kalendáři se uplatní navíc." /><div className="sync-note" role="status"><span className="spinner" />Načítám dostupnost…</div></div>;
  if (loadState === "error") return <div className="page-stack"><PageHeader eyebrow="Rozvrh · Pracovní doba" title="Dostupnost" description="Nastavte, kdy si vás klienti mohou rezervovat. Pravidla služeb a kolize v kalendáři se uplatní navíc." /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Dostupnost se nenačetla</h2><p>{error || "Dostupnost se nepodařilo načíst."}</p><ActionButton variant="primary" onClick={retryLoad}>Zkusit znovu</ActionButton></section></div>;

  return <div className="page-stack">
    <PageHeader eyebrow="Rozvrh · Pracovní doba" title="Dostupnost" description="Nastavte, kdy si vás klienti mohou rezervovat. Pravidla služeb a kolize v kalendáři se uplatní navíc." actions={<ActionButton variant="primary" onClick={save} disabled={saving || !dirty || conflictingDates.size > 0}><Icon name="check" size={16} />{saving ? "Saving…" : dirty ? "Uložit změny" : "Uloženo"}</ActionButton>} />
    {saved && <div className="toast" role="status"><span><Icon name="check" /></span>Dostupnost uložena</div>}
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    {conflictingDates.size > 0 && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>Každé datum použijte jen jednou. Před uložením odeberte nebo změňte zvýrazněné duplicitní datum.</div>}
    <div className="availability-layout">
      <section className="panel availability-main">
        <SectionHeader title="Týdenní pracovní doba" description="Váš opakovaně použitelný výchozí rozvrh" action={<div className="timezone-pill"><Icon name="globe" size={15} />{timeZone}</div>} />
        <div className="schedule-list">
          {days.map((day, dayIndex) => <div className={`schedule-day ${!day.enabled ? "is-off" : ""}`} key={day.day}>
            <div className="day-toggle"><Toggle checked={day.enabled} onChange={(enabled) => patchDay(dayIndex, { enabled, windows: enabled && day.windows.length === 0 ? [{ id: crypto.randomUUID(), start: "9:00", end: "17:00" }] : day.windows })} label={`${day.day} – dostupnost`} /><strong>{day.short}</strong></div>
            <div className="day-windows">{day.enabled ? day.windows.map((window, windowIndex) => <div className="time-window" role="group" aria-label={`${day.day} časové okno ${windowIndex + 1}`} key={window.id}><select aria-label={`Začátek pro ${day.day}, okno ${windowIndex + 1}`} value={window.start} onChange={(e) => patchWindow(dayIndex, windowIndex, { start: e.target.value })}>{HOURS.filter((time) => timeHour(time) <= 20).map((time) => <option key={time}>{time}</option>)}</select><span aria-hidden="true">–</span><select aria-label={`Konec pro ${day.day}, okno ${windowIndex + 1}`} value={window.end} onChange={(e) => patchWindow(dayIndex, windowIndex, { end: e.target.value })}>{HOURS.filter((time) => timeHour(time) >= 8).map((time) => <option key={time}>{time}</option>)}</select><button type="button" className="icon-button" aria-label={`Odebrat časové okno (${day.day})`} onClick={() => patchDay(dayIndex, { windows: day.windows.filter((_, i) => i !== windowIndex) })}><Icon name="trash" size={16} /></button></div>) : <span className="unavailable-label">Nedostupné</span>}</div>
            <button type="button" className="icon-button add-window" aria-label={`Přidat časové okno (${day.day})`} disabled={!day.enabled} onClick={() => patchDay(dayIndex, { windows: [...day.windows, { id: crypto.randomUUID(), start: "13:00", end: "17:00" }] })}><Icon name="plus" /></button>
          </div>)}
        </div>
      </section>
      <aside className="availability-aside">
        <section className="panel compact-panel"><SectionHeader title="Náhled kalendáře" /><div className="mini-week"><div className="mini-week-head">{days.map((day) => <span key={day.short}>{day.short[0]}</span>)}</div><div className="mini-week-grid">{days.map((day) => <div key={day.short} className={day.enabled ? "has-hours" : ""}>{day.enabled && <span style={{ height: `${Math.max(28, day.windows.length * 24)}px` }} />}</div>)}</div></div><p className="aside-note"><span className="legend-dot" />Vaše rezervovatelné hodiny před uplatněním pravidel služeb a kolizí v kalendáři.</p></section>
        <section className="panel compact-panel"><SectionHeader title="Pravidla rozvrhu" /><Field label="Časové pásmo"><select value={timeZone} onChange={(event) => patchTimeZone(event.target.value)}>{[...new Set([timeZone, "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"])].map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></Field><p className="aside-note">Klienti si na veřejné rezervační stránce volí vlastní časové pásmo.</p></section>
      </aside>
    </div>
    <div className="two-panel-grid">
      <section className="panel"><SectionHeader title="Výjimky" description="Jiná pracovní doba v konkrétní den" action={<ActionButton icon="plus" variant="secondary" onClick={() => patchOverrides((items) => [...items, { dateKey: nextUnusedDate(), isAvailable: true, startMinute: 540, endMinute: 1020 }])}>Přidat výjimku</ActionButton>} /><div className="exception-list">{overrides.filter((item) => item.isAvailable).map((item, index) => <div className={`exception-row ${conflictingDates.has(item.dateKey) ? "has-conflict" : ""}`} key={item.id ?? `${item.dateKey}-${index}`}><span className="exception-icon"><Icon name="calendar" /></span><div><input type="date" value={item.dateKey} onChange={(event) => patchOverrides((items) => items.map((current) => current === item ? { ...current, dateKey: event.target.value } : current))} aria-label="Datum výjimky" aria-invalid={conflictingDates.has(item.dateKey)} /><span><input type="time" value={clockValue(item.startMinute, 540)} onChange={(event) => patchOverrides((items) => items.map((current) => current === item ? { ...current, startMinute: clockMinutes(event.target.value) } : current))} aria-label={`Začátek pro ${item.dateKey}`} /> – <input type="time" value={clockValue(item.endMinute, 1020)} onChange={(event) => patchOverrides((items) => items.map((current) => current === item ? { ...current, endMinute: clockMinutes(event.target.value) } : current))} aria-label={`Konec pro ${item.dateKey}`} /></span>{conflictingDates.has(item.dateKey) && <small role="alert">Toto datum už je použité.</small>}</div><Badge tone="info">Dostupné</Badge><button className="icon-button" onClick={() => patchOverrides((items) => items.filter((current) => current !== item))} aria-label={`Odebrat výjimku pro ${item.dateKey}`}><Icon name="trash" /></button></div>)}</div>{!overrides.some((item) => item.isAvailable) && <div className="empty-state"><p>Žádné výjimky.</p></div>}</section>
      <section className="panel"><SectionHeader title="Volno" description="Zablokovat celý den" action={<ActionButton icon="plus" variant="secondary" onClick={() => patchOverrides((items) => [...items, { dateKey: nextUnusedDate(), isAvailable: false, startMinute: null, endMinute: null }])}>Přidat volno</ActionButton>} /><div className="exception-list">{overrides.filter((item) => !item.isAvailable).map((item, index) => <div className={`exception-row ${conflictingDates.has(item.dateKey) ? "has-conflict" : ""}`} key={item.id ?? `${item.dateKey}-off-${index}`}><span className="exception-icon exception-off"><Icon name="calendar" /></span><div><input type="date" value={item.dateKey} onChange={(event) => patchOverrides((items) => items.map((current) => current === item ? { ...current, dateKey: event.target.value } : current))} aria-label="Datum volna" aria-invalid={conflictingDates.has(item.dateKey)} /><span>Celý den nedostupné</span>{conflictingDates.has(item.dateKey) && <small role="alert">Toto datum už je použité.</small>}</div><Badge tone="neutral">Nedostupné</Badge><button className="icon-button" onClick={() => patchOverrides((items) => items.filter((current) => current !== item))} aria-label={`Odebrat volno pro ${item.dateKey}`}><Icon name="trash" /></button></div>)}</div>{!overrides.some((item) => !item.isAvailable) && <div className="empty-state"><p>Žádné volno.</p></div>}</section>
    </div>
  </div>;
}
