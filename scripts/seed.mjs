import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

XLSX.set_fs(fs);

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "klanten.xlsx");

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
  "ID",
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
  "ID": c.id,
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
const peter = klantenRows.find((r) => r["ID"] === "4001");
peter[`Week ${week}`] = "Woensdag";
peter[`Producten ${week}`] = 12;
peter[`Olie ${week}`] = "Ja";

const groepenHeaders = ["Groep ID", "Leden", "Postcode", "Notities"];
const groepenRows = [
  { "Groep ID": "G001", "Leden": "Maria de Vries, Jan de Vries", "Postcode": "1071 GH", "Notities": "" },
  { "Groep ID": "G002", "Leden": "Ahmed Hassan, Fatima Hassan, Yusuf Hassan", "Postcode": "1102 KS", "Notities": "" },
  { "Groep ID": "G003", "Leden": "Peter de Wit, Anna de Wit", "Postcode": "1015 BC", "Notities": "" },
];

fs.mkdirSync(dataDir, { recursive: true });

if (fs.existsSync(filePath)) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = path.join(dataDir, `klanten.${ts}.bak.xlsx`);
  fs.copyFileSync(filePath, bak);
  console.log(`Existing data backed up to ${path.basename(bak)}`);
}

const wb = XLSX.utils.book_new();

const klantenAoa = [klantenHeaders, ...klantenRows.map((r) => klantenHeaders.map((h) => r[h] ?? ""))];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(klantenAoa), "klanten registratie");

const groepenAoa = [groepenHeaders, ...groepenRows.map((r) => groepenHeaders.map((h) => r[h] ?? ""))];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(groepenAoa), "groepen");

XLSX.writeFile(wb, filePath);

console.log(`Seeded ${customers.length} klanten and ${groepenRows.length} groepen for week ${week}.`);
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
