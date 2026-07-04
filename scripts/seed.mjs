import { sheets, auth } from "@googleapis/sheets";

// Seeds demo data into the Google Sheet configured via env vars.
// Run with:  npm run seed   (loads .env.local via --env-file)

const SHEET_NAME = "klanten registratie";

const email = process.env.GOOGLE_CLIENT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
if (!email || !key || !spreadsheetId) {
  console.error(
    "Ontbrekende env-vars. Vereist: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID.\n" +
      "Maak .env.local aan (zie .env.local.example) en draai: npm run seed"
  );
  process.exit(1);
}

const client = sheets({
  version: "v4",
  auth: new auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }),
});

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const week = isoWeek();
const weekCols = [`Week ${week}`, `Producten ${week}`, `Olie ${week}`];
const baseCols = [
  "Stadpas ID",
  "Voornaam",
  "Achternaam",
  "Postcode",
  "Groep ID",
  "ID gecontroleerd",
  "Notities",
];
const klantenHeaders = [...baseCols, ...weekCols];

const customers = [
  { id: "1001", voornaam: "Sander", achternaam: "Bakker", postcode: "1011 AA", groepId: "", idVerified: true, notes: "" },
  { id: "1002", voornaam: "Linda", achternaam: "Smit", postcode: "1234 AB", groepId: "", idVerified: true, notes: "Spreekt geen Nederlands, alleen Engels" },

  // G001 — couple
  { id: "2001", voornaam: "Maria", achternaam: "de Vries", postcode: "1071 GH", groepId: "G001", idVerified: true, notes: "" },
  { id: "2002", voornaam: "Jan", achternaam: "de Vries", postcode: "1071 GH", groepId: "G001", idVerified: true, notes: "" },

  // G002 — family
  { id: "3001", voornaam: "Ahmed", achternaam: "Hassan", postcode: "1102 KS", groepId: "G002", idVerified: true, notes: "" },
  { id: "3002", voornaam: "Fatima", achternaam: "Hassan", postcode: "1102 KS", groepId: "G002", idVerified: true, notes: "Allergie voor noten" },
  { id: "3003", voornaam: "Yusuf", achternaam: "Hassan", postcode: "1102 KS", groepId: "G002", idVerified: false, notes: "" },

  // G003 — couple with one member already visited this week
  { id: "4001", voornaam: "Peter", achternaam: "de Wit", postcode: "1015 BC", groepId: "G003", idVerified: true, notes: "" },
  { id: "4002", voornaam: "Anna", achternaam: "de Wit", postcode: "1015 BC", groepId: "G003", idVerified: true, notes: "" },
];

const klantenRows = customers.map((c) => ({
  "Stadpas ID": c.id,
  "Voornaam": c.voornaam,
  "Achternaam": c.achternaam,
  "Postcode": c.postcode,
  "Groep ID": c.groepId,
  "ID gecontroleerd": c.idVerified ? "Ja" : "",
  "Notities": c.notes,
  [`Week ${week}`]: "",
  [`Producten ${week}`]: "",
  [`Olie ${week}`]: "",
}));

// Peter de Wit (4001) already visited this week — Anna's scan should trigger the warning.
const peter = klantenRows.find((r) => r["Stadpas ID"] === "4001");
peter[`Week ${week}`] = "Woensdag";
peter[`Producten ${week}`] = 12;
peter[`Olie ${week}`] = "Ja";

function quote(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function ensureTab(title) {
  const meta = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (titles.includes(title)) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

async function replaceTab(title, headers, rows) {
  await ensureTab(title);
  await client.spreadsheets.values.clear({ spreadsheetId, range: quote(title) });
  const values = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${quote(title)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

await replaceTab(SHEET_NAME, klantenHeaders, klantenRows);

console.log(`Seeded ${customers.length} klanten for week ${week}. Groepen worden afgeleid uit de kolom "Groep ID".`);
console.log("");
console.log("Demo scenarios (use ID in 'Handmatig ID invoeren'):");
console.log("  Solo:");
console.log("    1001  Sander Bakker");
console.log("    1002  Linda Smit (heeft notitie)");
console.log("  Groep G001 (stel):");
console.log("    2001  Maria de Vries  ← scan om hele groep in te checken");
console.log("    2002  Jan de Vries");
console.log("  Groep G002 (gezin):");
console.log("    3001  Ahmed Hassan  ← scan om alle 3 in te checken");
console.log("    3002  Fatima Hassan (notitie)");
console.log("    3003  Yusuf Hassan");
console.log("  Groep G003 (stel, één lid al geweest):");
console.log("    4001  Peter de Wit  ← AL GEWEEST (Woensdag, 12 prod, olie Ja)");
console.log("    4002  Anna de Wit   ← scan om waarschuwing + auto-olie te zien");
