# OSos — Omgekeerde Supermarkt OS

Mobile-first volunteer app for the free grocery store. Volunteers scan a
stadspas barcode to check customers in; visits are written to an Excel
sheet (`data/klanten.xlsx`).

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

For barcode scanning on a phone you need HTTPS or `localhost`. Easiest path:
serve over a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`)
and open it on your phone.

## Data file

- Location: `data/klanten.xlsx` (auto-created on first use; gitignored).
- Sheet: `klanten registratie`.
- Base columns: `ID`, `Stadpas ID`, `Voornaam`, `Achternaam`, `Postcode`,
  `ID gecontroleerd`, `Notities`.
- Per ISO week the app appends three columns when first used:
  `Week X`, `Producten X`, `Olie X`.

To pre-load existing customers, put `klanten.xlsx` in the `data/` folder
before starting the app.

## Routes

- `/` — home, two big buttons (Scan / Search).
- `/scan` — camera barcode scanner.
- `/check-in/[id]` — check-in form (day, products, oil).
- `/already-visited/[id]` — warning + override flow.
- `/register/[id]` — new customer form + first visit.
- `/search` — manual search by name.
- `/done/[id]` — success screen.

## Build

```bash
npm run build
npm start
```
