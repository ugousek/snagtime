# Vlastní hosting (jeden server s Dockerem)

Spustí celou aplikaci na jednom Linux serveru: PostgreSQL 18, web, worker na e-maily a Caddy s automatickým HTTPS (Let's Encrypt).

## Co potřebuješ

- VPS s Linuxem (stačí 2 GB RAM, 1–2 vCPU), Docker Engine s pluginem `docker compose`, `git` a `openssl`.
- Doménu (např. `rezervace.kodio.cz`), jejíž A záznam míří na IP serveru. Porty 80 a 443 musí být otevřené.
- SMTP účet pro odesílání e-mailů (ověření registrace, potvrzení rezervací).

## Instalace

```bash
git clone https://github.com/ugousek/snagtime.git
cd snagtime
cp deploy/env.example deploy/.env
nano deploy/.env          # doplň doménu, e-mail pro certifikát a SMTP
./deploy/setup.sh         # zeptá se na heslo k SMTP, vše ostatní vygeneruje
```

První sestavení trvá několik minut. Potom otevři `https://<tvoje-doména>/signup` a založ provozovnu.

## Aktualizace

```bash
git pull
./deploy/setup.sh
```

Skript je bezpečné spouštět opakovaně: tajné klíče a data v databázi zůstanou, provedou se jen nové migrace.

## Běžné příkazy

```bash
./deploy/dc.sh ps                 # stav kontejnerů
./deploy/dc.sh logs -f web        # logy webu
./deploy/dc.sh logs -f worker     # logy odesílání e-mailů
./deploy/dc.sh down               # zastavení (data zůstanou ve volume)
```

## Zálohy

Tajné klíče jsou v `deploy/secrets/` a data ve volume `rezervace_postgres_data`. Zálohuj obojí, bez `deploy/secrets/token_encryption_key` nejdou dešifrovat uložené tokeny. Jednoduchá denní záloha databáze:

```bash
./deploy/dc.sh exec -T postgres sh -c 'PGPASSWORD="$(cat /run/secrets/postgres_owner_password)" pg_dump -U tempocove_owner -Fc tempocove' > zaloha-$(date +%F).dump
```

## Volitelné integrace

Výchozí nastavení funguje bez Googlu i Stripu (rezervace se ukládají do vlastního kalendáře aplikace, služby jsou zdarma).

- Google Kalendář: v `.env` nastav `CALENDAR_PROVIDER=google` a `GOOGLE_CLIENT_ID`, tajemství vlož do `deploy/secrets/google_client_secret`.
- Platby Stripe (zatím jen testovací režim): `PAYMENTS_PROVIDER=stripe`, klíče do `deploy/secrets/stripe_secret_key` a `deploy/secrets/stripe_webhook_secret`.

Po změně znovu spusť `./deploy/setup.sh`.
