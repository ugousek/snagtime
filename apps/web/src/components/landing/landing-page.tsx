import type { ReactNode } from "react";
import { BookingDemo } from "./booking-demo";
import { landingMono, landingSans } from "./fonts";
import styles from "./landing.module.css";
import { Pricing, type LandingPlan } from "./pricing";
import { themeBootScript } from "./theme";
import { ThemeToggle } from "./theme-toggle";

const SIGNUP = "/signup";
const LOGIN = "/dashboard";

const TRADES = ["Kadeřnictví", "Barbershopy", "Masáže", "Kosmetika", "Nehtová studia", "Fyzioterapie", "Poradny", "Lektoři a lekce"];

const STEPS = [
  { title: "Zadáte služby a pracovní dobu", text: "Pánský střih 30 minut, masáž zad 60 minut. Nastavíte dny a hodiny, kdy berete klienty." },
  { title: "Pošlete odkaz klientům", text: "Dostanete vlastní rezervační stránku. Odkaz dáte na Instagram, do Google Map nebo jako tlačítko na svůj web." },
  { title: "Klienti se objednávají sami", text: "Vidí jen volné časy a nemusí si zakládat účet. Vám přijde e-mail o každé nové rezervaci." },
];

const icon = (path: ReactNode) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);
const FEATURES = [
  {
    title: "Rezervace ve dne v noci",
    text: "Klient vidí jen skutečně volné časy. Dva lidé se na stejný termín neobjednají.",
    icon: icon(
      <>
        <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>,
    ),
  },
  {
    title: "Připomínka den předem",
    text: "Každý klient dostane 24 hodin před termínem e-mail s časem a adresou. Méně zapomenutých návštěv.",
    icon: icon(<path d="M6 8.5a6 6 0 1 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15 6 8.5ZM10 20a2.2 2.2 0 0 0 4 0" />),
  },
  {
    title: "Zrušení a přesun bez telefonu",
    text: "Když klientovi něco vleze do cesty, termín si zruší nebo přesune sám přes odkaz v e-mailu.",
    icon: icon(<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />),
  },
  {
    title: "Přehled klientů",
    text: "Kdo k vám chodí, kolikrát už byl a kdy naposledy. Seznam si stáhnete jako CSV do Excelu.",
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
      </>,
    ),
  },
  {
    title: "Tlačítko na váš web",
    text: "WordPress, Webnode, Wix i vlastní web. Zkopírujete krátký kód a tlačítko „Rezervovat online“ je na stránce.",
    icon: icon(<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />),
  },
  {
    title: "Skupinové lekce",
    text: "U služby nastavíte počet míst. Hodí se pro lekce jógy, kurzy nebo workshopy.",
    icon: icon(
      <>
        <circle cx="12" cy="7" r="3" />
        <circle cx="5" cy="10" r="2" />
        <circle cx="19" cy="10" r="2" />
        <path d="M7 20a5 5 0 0 1 10 0M2 18a3.2 3.2 0 0 1 4.5-2.9M22 18a3.2 3.2 0 0 0-4.5-2.9" />
      </>,
    ),
  },
];

const FAQ = [
  {
    q: "Potřebuji k tomu vlastní web?",
    a: "Nepotřebujete. Každá provozovna dostane vlastní rezervační stránku s odkazem, který můžete dát na Instagram, Facebook nebo do Google Map. Pokud web máte, vložíte na něj tlačítko.",
  },
  {
    q: "Musí si klient zakládat účet?",
    a: "Ne. Vyplní jméno a e-mail a rezervace je hotová. Potvrzení i připomínka mu přijdou e-mailem.",
  },
  {
    q: "Co když mi v tarifu Zdarma dojdou rezervace?",
    a: "Do konce měsíce už další online rezervace nepřijmete, ty stávající zůstanou. Kdykoli můžete přejít na vyšší tarif.",
  },
  {
    q: "Jak se platí?",
    a: "Na fakturu, měsíčně nebo ročně. Za tarif Zdarma neplatíte nic a platební kartu po vás nechceme.",
  },
  {
    q: "Jak dlouho trvá nastavení?",
    a: "Většině provozoven stačí jedno odpoledne. Zadáte služby, pracovní dobu a odkaz můžete rovnou poslat klientům.",
  },
];

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="17" fill="#2563EB" />
    <rect x="12" y="14" width="40" height="38" rx="10" fill="#2563EB" stroke="#fff" strokeWidth="4" />
    <path d="M22 10v10M42 10v10M12 25h40" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <rect x="20" y="31" width="13" height="8" rx="4" fill="#93C5FD" />
    <rect x="35" y="31" width="11" height="8" rx="4" fill="#fff" />
  </svg>
);
const Tick = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export function LandingPage({ plans }: { plans: LandingPlan[] }) {
  return (
    <div className={`${styles.root} ${landingSans.variable} ${landingMono.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />

      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.nav}`}>
          <a className={styles.logo} href="/" aria-label="Rezervace, úvodní stránka">
            <Logo />
            Rezervace
          </a>
          <nav className={styles.navLinks} aria-label="Hlavní navigace">
            <a href="#jak-to-funguje">Jak to funguje</a>
            <a href="#funkce">Funkce</a>
            <a href="#cenik">Ceník</a>
            <a href="#otazky">Otázky</a>
          </nav>
          <ThemeToggle />
          <a className={styles.login} href={LOGIN}>
            Přihlásit se
          </a>
          <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} href={SIGNUP}>
            Vyzkoušet zdarma
          </a>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <span className={styles.pill}>
                <i aria-hidden="true" />
                Online rezervace pro provozovny
              </span>
              <h1 className={styles.h1}>
                Klienti se objednají sami. <em>I v neděli večer.</em>
              </h1>
              <p className={styles.lead}>
                Rezervační stránka pro kadeřnictví, barbershopy, masáže i poradny. Klient si vybere službu a volný čas, vy máte termín v diáři a on den předem dostane připomínku.
              </p>
              <div className={styles.ctaRow}>
                <a className={`${styles.btn} ${styles.btnPrimary}`} href={SIGNUP}>
                  Začít zdarma
                </a>
                <a className={`${styles.btn} ${styles.btnGhost}`} href="#cenik">
                  Zobrazit ceník
                </a>
              </div>
              <ul className={styles.assure}>
                <li>
                  <Tick />
                  Tarif Zdarma bez časového omezení
                </li>
                <li>
                  <Tick />
                  Bez platební karty
                </li>
                <li>
                  <Tick />
                  Celé v češtině
                </li>
              </ul>
            </div>
            <BookingDemo />
          </div>
        </section>

        <div className={styles.trades}>
          <div className={`${styles.wrap} ${styles.tradesInner}`}>
            <b>Pro obory jako</b>
            {TRADES.map((trade) => (
              <span key={trade}>{trade}</span>
            ))}
          </div>
        </div>

        <section className={styles.section} id="jak-to-funguje">
          <div className={styles.wrap}>
            <div className={styles.head}>
              <span className={styles.eyebrow}>Jak to funguje</span>
              <h2 className={styles.h2}>Spuštěno za jedno odpoledne</h2>
              <p className={styles.sub}>Nic neinstalujete. Zaregistrujete se, vyplníte, co nabízíte, a odkaz pošlete klientům.</p>
            </div>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3 className={styles.h3}>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionSoft}`} id="funkce">
          <div className={styles.wrap}>
            <div className={styles.head}>
              <span className={styles.eyebrow}>Funkce</span>
              <h2 className={styles.h2}>Méně telefonování, méně prázdných termínů</h2>
            </div>
            <div className={styles.features}>
              {FEATURES.map((feature) => (
                <div key={feature.title} className={styles.feature}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <h3 className={styles.h3}>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              ))}
            </div>
            <p className={styles.soon}>
              <strong>Připravujeme:</strong> výběr konkrétního pracovníka, rezervace na vaší vlastní doméně a půjčovny.
            </p>
          </div>
        </section>

        <section className={styles.section} id="cenik">
          <div className={styles.wrap}>
            <Pricing plans={plans} />
          </div>
        </section>

        <section className={styles.section} id="otazky" style={{ paddingTop: 0 }}>
          <div className={`${styles.wrap} ${styles.faq}`}>
            <div className={styles.head}>
              <span className={styles.eyebrow}>Časté otázky</span>
              <h2 className={styles.h2}>Na co se provozovny ptají</h2>
            </div>
            <div className={styles.faqList}>
              {FAQ.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>
                    {item.q}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.final}>
          <div className={styles.wrap}>
            <div className={styles.finalBox}>
              <h2 className={styles.h2}>Ať se zítra objedná i ten, kdo se vám dnes nedovolal</h2>
              <p className={styles.sub}>Registrace zabere pár minut. Tarif Zdarma vám zůstane, dokud budete chtít.</p>
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={SIGNUP}>
                Vytvořit rezervační stránku
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerInner}`}>
          <span>© {new Date().getFullYear()} Rezervace · provozuje Kodio</span>
          <nav className={styles.footerLinks} aria-label="Patička">
            <a href="#funkce">Funkce</a>
            <a href="#cenik">Ceník</a>
            <a href={LOGIN}>Přihlásit se</a>
            <a href={SIGNUP}>Registrace</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
