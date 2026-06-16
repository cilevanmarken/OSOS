# OSos — Omgekeerde Supermarkt OS

Mobile-first volunteer app for the free grocery store. Volunteers scan a
stadspas barcode to check customers in; visits are written to a **Google
Sheet** via a service account.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the Google credentials
npm run dev                         # http://localhost:3000
```

For barcode scanning on a phone you need HTTPS or `localhost`. Easiest path:
serve over a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`)
and open it on your phone.

## Google Sheet koppeling

The app reads and writes one Google Spreadsheet through the Google Sheets API.

**1. Service account**
- In the [Google Cloud Console](https://console.cloud.google.com/): create (or
  pick) a project, enable the **Google Sheets API**.
- Create a **service account** and generate a **JSON key**.

**2. Share the sheet**
- Open the target Google Sheet and **share it** (Editor) with the service
  account's e-mail (`client_email` from the JSON key).

**3. Configure env vars** — copy `.env.local.example` to `.env.local` and fill:
- `GOOGLE_CLIENT_EMAIL` — the `client_email` from the JSON key.
- `GOOGLE_PRIVATE_KEY` — the `private_key` from the JSON key (keep the literal
  `\n` newlines, wrapped in double quotes).
- `GOOGLE_SHEET_ID` — the ID in the sheet URL
  (`.../spreadsheets/d/<ID>/edit`).
- `APP_PASSWORD` — the shared password that gates the whole app (see
  [Toegang](#toegang-wachtwoord)).

> ⚠️ Never commit the JSON key or `.env.local`. If a key has been pasted or
> shared anywhere, rotate it in the Cloud Console.

## Spreadsheet structure

Two tabs (created automatically on first write if missing):

- **`klanten registratie`** — base columns `Stadpas ID`, `Voornaam`,
  `Achternaam`, `Postcode`, `Groep ID`, `ID gecontroleerd`, `Notities`. The
  `Stadpas ID` is the unique identifier; customers without a stadspas get an
  auto-generated `ZP#` id. Per ISO week the app appends `Week X`, `Producten X`,
  `Olie X` when first used.
- **`groepen`** — `Groep ID`, `Leden`, `Postcode`, `Notities`.

Seed demo data into the configured sheet (overwrites both tabs):

```bash
npm run seed
```

## Toegang (wachtwoord)

De hele app zit achter één gedeeld wachtwoord (`APP_PASSWORD`). Wie de URL
opent komt eerst op `/login`; na het juiste wachtwoord wordt een `httpOnly`
sessie-cookie gezet (30 dagen geldig). Een middleware beschermt alle routes —
ook de API — zodat de klantgegevens niet zonder inloggen op te vragen zijn.

- Stel `APP_PASSWORD` in als env-var (lokaal in `.env.local`, in productie bij
  de hosting-omgeving). Zonder deze waarde kan niemand inloggen.
- Het wachtwoord **wijzigen verloopt automatisch alle bestaande sessies**: de
  sessie-cookie is afgeleid van het wachtwoord.
- Uitloggen kan via de link op het startscherm.

## Bezoekregels

- Een bezoek "telt" pas wanneer de klant iets meekrijgt: **producten > 0 of
  olie**. Een bezoek met 0 producten en geen olie blokkeert niet — de klant
  mag diezelfde week nog een keer komen.
- Voor groepen geldt de regel op groepsniveau: een groep met 0 producten en
  geen olie mag opnieuw komen.

## Routes

- `/` — home, two big buttons (Scan / Search).
- `/scan` — camera barcode scanner.
- `/check-in/[id]` — check-in form (day, products, oil).
- `/already-visited/[id]` — warning + override flow.
- `/register/[id]` — new customer form + first visit (stadspas known).
- `/register` — new customer from name search (stadspas typed by hand, or
  left blank to auto-generate a unique ID).
- `/search` — manual search by name (+ "nieuwe klant toevoegen").
- `/done/[id]` — success screen.

## Build

```bash
npm run build
npm start
```

## Deploy (Vercel + eigen subdomein)

De app draait op **Vercel** en is bereikbaar via het subdomein
`osos.deomgekeerdesupermarkt.nl`. De WordPress-site op
`deomgekeerdesupermarkt.nl` blijft ongemoeid.

**1. Project op Vercel**
- Push de repo naar GitHub en koppel hem in [Vercel](https://vercel.com)
  (New Project → import de repo). Vercel detecteert Next.js automatisch — geen
  extra config nodig.

**2. Environment-variabelen** (Vercel → Project → Settings → Environment
Variables, voor *Production*) — dezelfde drie als in `.env.local`:
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY` — plak de waarde **zonder** de omringende dubbele
  quotes; de letterlijke `\n`-tekens behouden.
- `GOOGLE_SHEET_ID`

Deploy daarna opnieuw zodat de variabelen actief worden.

**3. Subdomein koppelen**
- Vercel → Project → Settings → Domains → voeg `osos.deomgekeerdesupermarkt.nl`
  toe. Vercel toont het gewenste DNS-record (een `CNAME` naar
  `cname.vercel-dns.com`).
- Voeg dat record toe in het DNS-beheer van WordPress.com / WP Cloud
  (Domeinen → het domein → DNS-records):
  `Type CNAME · Naam osos · Waarde cname.vercel-dns.com`.
- Zodra de DNS is doorgevoerd zet Vercel automatisch een TLS-certificaat klaar
  en is de app live op `https://osos.deomgekeerdesupermarkt.nl`.
