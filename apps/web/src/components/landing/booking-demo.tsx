"use client";

import { useMemo, useState } from "react";
import styles from "./landing.module.css";

type Service = { id: string; name: string; minutes: number; priceCzk: number };
type Appointment = { start: number; minutes: number; client: string; service: string; isNew?: boolean };

const DEFAULT_SERVICE: Service = { id: "strih", name: "Pánský střih", minutes: 30, priceCzk: 450 };
const SERVICES: Service[] = [
  DEFAULT_SERVICE,
  { id: "vousy", name: "Střih a vousy", minutes: 60, priceCzk: 690 },
  { id: "deti", name: "Dětský střih", minutes: 30, priceCzk: 300 },
];
const DAYS = [
  { short: "Po", long: "pondělí", on: "na pondělí" },
  { short: "Út", long: "úterý", on: "na úterý" },
  { short: "St", long: "středa", on: "na středu" },
  { short: "Čt", long: "čtvrtek", on: "na čtvrtek" },
  { short: "Pá", long: "pátek", on: "na pátek" },
];
const OPEN = 9 * 60;
const CLOSE = 17 * 60;
const STEP = 30;
const SLOT_STARTS = Array.from({ length: (CLOSE - OPEN) / STEP }, (_, index) => OPEN + index * STEP);

const at = (hours: number, minutes = 0) => hours * 60 + minutes;
const INITIAL: Appointment[][] = [
  [
    { start: at(9, 30), minutes: 30, client: "Petr Dvořák", service: "Pánský střih" },
    { start: at(11), minutes: 60, client: "Tomáš Marek", service: "Střih a vousy" },
    { start: at(14, 30), minutes: 30, client: "Jakub Novotný", service: "Pánský střih" },
  ],
  [
    { start: at(9), minutes: 60, client: "Ondřej Král", service: "Střih a vousy" },
    { start: at(13), minutes: 30, client: "Matěj Fiala", service: "Dětský střih" },
    { start: at(15, 30), minutes: 30, client: "Jan Šimek", service: "Pánský střih" },
  ],
  [
    { start: at(10), minutes: 30, client: "Lukáš Bureš", service: "Pánský střih" },
    { start: at(12), minutes: 60, client: "Daniel Vacek", service: "Střih a vousy" },
  ],
  [
    { start: at(9), minutes: 30, client: "Filip Urban", service: "Pánský střih" },
    { start: at(10, 30), minutes: 30, client: "Adam Pokorný", service: "Dětský střih" },
    { start: at(14), minutes: 60, client: "Marek Havel", service: "Střih a vousy" },
    { start: at(16), minutes: 30, client: "Šimon Kolář", service: "Pánský střih" },
  ],
  [
    { start: at(11, 30), minutes: 30, client: "Vojtěch Beneš", service: "Pánský střih" },
    { start: at(13, 30), minutes: 60, client: "Michal Zeman", service: "Střih a vousy" },
  ],
];

const dayName = (index: number) => DAYS[index]?.long ?? "";
const onDay = (index: number) => DAYS[index]?.on ?? "";
const formatTime = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
const isFree = (appointments: Appointment[], start: number, minutes: number) =>
  start + minutes <= CLOSE && appointments.every((item) => start + minutes <= item.start || start >= item.start + item.minutes);

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
  </svg>
);

export function BookingDemo() {
  const [serviceId, setServiceId] = useState(DEFAULT_SERVICE.id);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [calendar, setCalendar] = useState(INITIAL);
  const [booked, setBooked] = useState<{ day: number; start: number } | null>(null);

  const service = SERVICES.find((item) => item.id === serviceId) ?? DEFAULT_SERVICE;
  const dayItems = useMemo(() => calendar[day] ?? [], [calendar, day]);
  const agenda = useMemo(() => [...dayItems].sort((a, b) => a.start - b.start), [dayItems]);
  const selectedIsFree = slot !== null && isFree(dayItems, slot, service.minutes);

  const book = () => {
    if (slot === null || !selectedIsFree) return;
    setCalendar((current) =>
      current.map((items, index) =>
        index === day
          ? [...items.map((item) => ({ ...item, isNew: false })), { start: slot, minutes: service.minutes, client: "Nový klient z webu", service: service.name, isNew: true }]
          : items.map((item) => ({ ...item, isNew: false })),
      ),
    );
    setBooked({ day, start: slot });
    setSlot(null);
  };

  return (
    <div className={styles.demo}>
      <div className={styles.pane}>
        <div className={styles.paneLabel}>
          <span>Co vidí klient</span>
          <span>Ukázka, zkuste si ji</span>
        </div>
        <div className={styles.biz}>
          <span className={styles.bizMark} aria-hidden="true">
            B
          </span>
          <div>
            <strong>Barbershop U Mostu</strong>
            <span>Online rezervace</span>
          </div>
        </div>

        <div>
          <div className={styles.fieldLabel} id="demo-service">
            Služba
          </div>
          <div className={styles.services} role="group" aria-labelledby="demo-service">
            {SERVICES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={styles.choice}
                aria-pressed={item.id === serviceId}
                onClick={() => {
                  setServiceId(item.id);
                  setSlot(null);
                }}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.minutes} min · {item.priceCzk} Kč
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.fieldLabel} id="demo-day">
            Den
          </div>
          <div className={styles.days} role="group" aria-labelledby="demo-day">
            {DAYS.map((item, index) => (
              <button
                type="button"
                key={item.short}
                className={styles.day}
                aria-pressed={index === day}
                aria-label={item.long}
                onClick={() => {
                  setDay(index);
                  setSlot(null);
                }}
              >
                {item.short}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.fieldLabel} id="demo-time">
            Volné časy
          </div>
          <div className={styles.slots} role="group" aria-labelledby="demo-time">
            {SLOT_STARTS.map((start) => {
              const free = isFree(dayItems, start, service.minutes);
              return (
                <button
                  type="button"
                  key={start}
                  className={`${styles.slot} ${styles.mono}`}
                  disabled={!free}
                  aria-pressed={slot === start}
                  aria-label={free ? formatTime(start) : `${formatTime(start)}, obsazeno`}
                  onClick={() => setSlot(start)}
                >
                  {formatTime(start)}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className={`${styles.btn} ${styles.bookBtn}`} disabled={!selectedIsFree} onClick={book}>
          {slot !== null && selectedIsFree ? `Rezervovat ${onDay(day)} v ${formatTime(slot)}` : "Vyberte čas"}
        </button>
      </div>

      <div className={styles.pane}>
        <div className={styles.paneLabel}>
          <span>Co vidíte vy</span>
          <span>Diář · {dayName(day)}</span>
        </div>
        <ul className={styles.agenda}>
          {agenda.map((item) => (
            <li key={`${item.start}-${item.client}`} className={`${styles.appt} ${item.isNew ? styles.apptNew : ""}`}>
              <time className={styles.mono}>{formatTime(item.start)}</time>
              <div>
                <strong>{item.client}</strong>
                <span>
                  {item.service} · {item.minutes} min
                </span>
              </div>
              {item.isNew && <span className={styles.badge}>Nová</span>}
            </li>
          ))}
        </ul>
        <div aria-live="polite" style={{ marginTop: "auto" }}>
          {booked ? (
            <div className={styles.notice}>
              <Check />
              <span>
                Rezervace {onDay(booked.day)} v {formatTime(booked.start)} je v diáři. Klientovi odešlo potvrzení e-mailem a den předem dostane připomínku.
              </span>
            </div>
          ) : (
            <p className={styles.hint}>Vyberte vlevo čas. Rezervace se objeví tady, bez jediného telefonátu.</p>
          )}
        </div>
      </div>
    </div>
  );
}
