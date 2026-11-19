"use client";

import { useState } from "react";
import styles from "./landing.module.css";

export type LandingPlan = {
  id: string;
  name: string;
  priceCzk: number;
  yearlyPriceCzk: number;
  monthlyBookings: number | null;
  members: number;
};

const AUDIENCE: Record<string, string> = {
  FREE: "Na vyzkoušení a pro menší živnosti.",
  START: "Pro salon nebo studio s pár kolegy.",
  PROFI: "Pro větší provozovny s celým týmem.",
};
const HIGHLIGHTED = "START";

/** Thousands separated by a non-breaking space; written by hand so server and browser always agree. */
const czk = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const membersLabel = (count: number) => (count === 1 ? "1 uživatel" : `Až ${count} uživatelů`);

const Tick = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export function Pricing({ plans }: { plans: LandingPlan[] }) {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <div className={styles.priceHead}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Ceník</span>
          <h2 className={styles.h2}>Začněte zdarma, plaťte až porostete</h2>
          <p className={styles.sub}>Všechny tarify mají stejné funkce. Liší se jen počtem rezervací a lidí v týmu.</p>
        </div>
        <div className={styles.billing} role="group" aria-label="Fakturační období">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
            Měsíčně
          </button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
            Ročně <small>2 měsíce zdarma</small>
          </button>
        </div>
      </div>

      <div className={styles.plans}>
        {plans.map((plan) => {
          const free = plan.priceCzk === 0;
          const hot = plan.id === HIGHLIGHTED;
          return (
            <div key={plan.id} className={`${styles.plan} ${hot ? styles.planHot : ""}`}>
              <div>
                <div className={styles.planName}>
                  {plan.name}
                  {hot && <span className={styles.badge}>Nejčastější volba</span>}
                </div>
                <p className={styles.planFor}>{AUDIENCE[plan.id] ?? ""}</p>
              </div>
              <div>
                <div className={styles.price}>
                  {czk(yearly ? plan.yearlyPriceCzk : plan.priceCzk)}&nbsp;Kč
                  <span>{free ? "navždy" : yearly ? "za rok" : "měsíčně"}</span>
                </div>
                <p className={styles.priceNote}>
                  {free ? "Bez platební karty." : yearly ? `Místo ${czk(plan.priceCzk * 12)} Kč při měsíční platbě.` : `Nebo ${czk(plan.yearlyPriceCzk)} Kč za rok.`}
                </p>
              </div>
              <ul className={styles.planList}>
                <li>
                  <Tick />
                  {plan.monthlyBookings === null ? "Neomezeně online rezervací" : `${czk(plan.monthlyBookings)} online rezervací měsíčně`}
                </li>
                <li>
                  <Tick />
                  {membersLabel(plan.members)}
                </li>
                <li>
                  <Tick />
                  Rezervační stránka a tlačítko na web
                </li>
                <li>
                  <Tick />
                  Připomínky e-mailem a přehled klientů
                </li>
              </ul>
              <a className={`${styles.btn} ${hot ? styles.btnPrimary : styles.btnGhost}`} href="/signup">
                {free ? "Začít zdarma" : `Vybrat ${plan.name}`}
              </a>
            </div>
          );
        })}
      </div>
      <p className={styles.vat}>Ceny jsou bez DPH. Platí se na fakturu a tarif můžete kdykoli změnit.</p>
    </>
  );
}
