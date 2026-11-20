# Rezervace (fork SnagTime)

Česká rezervační služba pro provozovny (kadeřnictví, barbershopy, masáže, poradny, lekce). Prodává se jako služba s předplatným, plánovaná adresa `rezervace.kodio.cz`. S uživatelem komunikuj česky.

## Stav k 20. 11. 2026

- PR #1 (`claude/project-thread-cs17hw` → `main`): opravy instalace, čeština, e-maily s připomínkou 24 h, přehled klientů s CSV, tlačítko na web, tarify, skupinové termíny, Docker nasazení. Otevřený.
- PR #2 (`claude/project-thread-5g4c6a` → větev PR #1): prodejní úvodní stránka na `/`. Otevřený. Tato větev obsahuje všechno z PR #1.
- Aplikace zatím nikde veřejně neběží. `kodio.cz` je sdílený PHP hosting, pro Next.js je potřeba VPS a nasměrovat na něj subdoménu.

## Lokální spuštění

Node 24 (viz `.nvmrc`).

```bash
npm install            # `npm ci` na této větvi padá, lockfile nesedí
npm run setup          # vytvoří .env.local; když už existuje, přeskoč
npx dotenv -e .env.local -- npm run db:generate
npx dotenv -e .env.local -- npm run db:migrate
npm run dev            # http://localhost:3000
```

Produkční start (`npm run start`) vyžaduje PostgreSQL a `BUILD_ID`, lokálně používej `npm run dev`.

Kontroly před commitem: `npm run typecheck`, `npm run lint`, `npm run build` (s `.env.local`).

## Úvodní stránka (landing)

- `apps/web/src/app/page.tsx`: přihlášeného (cookie relace) pošle na `/dashboard`, ostatním ukáže landing. Ceny bere z `PLANS`.
- `apps/web/src/components/landing/`:
  - `landing-page.tsx` texty a struktura sekcí,
  - `booking-demo.tsx` živá ukázka rezervace v úvodu,
  - `pricing.tsx` ceník s přepínačem měsíčně / ročně,
  - `theme-toggle.tsx`, `theme.ts` světlý (výchozí) a tmavý režim, platí jen pro landing,
  - `landing.module.css` všechny styly, barvy jako proměnné na `.root`,
  - `fonts/` písmo Geist (OFL), načítané přes `next/font/local`.
- Zadání od majitele: moderní vzhled podle velkých zahraničních konkurentů, žádný balast, rychlé, bez chyb, jednoduché na ovládání. Žádné nové velké knihovny, bez Tailwindu.

## Pravidla pro obsah

- Tarify se liší jen limity (`apps/web/src/server/services/plans.ts`): Zdarma 0 Kč, Start 199 Kč, Profi 399 Kč měsíčně; ročně 1 990 a 3 990 Kč. Ceny bez DPH, platba fakturou.
- Neslibuj nehotové funkce. Připravuje se: výběr pracovníka, vlastní domény klientů, půjčovny.
- Žádné vymyšlené recenze, loga zákazníků ani čísla o počtu uživatelů.

## Co zbývá

- Kontakt do patičky, obchodní podmínky a zásady ochrany osobních údajů (čeká na podklady od majitele).
- Náhledový obrázek pro sdílení (og:image).
- E2E testy (Playwright) a měření rychlosti na landing page zatím neběžely.
- Nasazení na VPS a DNS pro `rezervace.kodio.cz`.
