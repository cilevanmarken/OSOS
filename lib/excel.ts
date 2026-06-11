import { promises as fs } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { isoWeek, type VisitDay } from "./week";

export const SHEET_NAME = "klanten registratie";
export const GROUP_SHEET_NAME = "groepen";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "klanten.xlsx");

const BASE_COLUMNS = [
  "ID",
  "Stadpas ID",
  "Voornaam",
  "Achternaam",
  "Postcode",
  "Groep ID",
  "ID gecontroleerd",
  "Notities",
] as const;

const GROUP_COLUMNS = ["Groep ID", "Leden", "Postcode", "Notities"] as const;

export type Customer = {
  id: string;
  stadpasId: string;
  voornaam: string;
  achternaam: string;
  postcode: string;
  groepId: string;
  idVerified: boolean;
  notes: string;
  visitThisWeek?: VisitRecord;
};

export type GroupMember = {
  id: string;
  voornaam: string;
  achternaam: string;
  fullName: string;
  visitThisWeek?: VisitRecord;
  oilThisWeek: boolean;
};

export type GroupView = {
  id: string;
  postcode: string;
  notes: string;
  members: GroupMember[];
  oilUsedThisWeek: boolean;
  oilRecipient: { fullName: string; day: VisitDay | "" } | null;
  hasAnyVisitThisWeek: boolean;
};

export type VisitRecord = {
  week: number;
  day: VisitDay | "";
  products: number | null;
  oil: boolean;
};

export type Row = Record<string, string | number | boolean | null | undefined>;

// Single-writer mutex so concurrent requests don't corrupt the workbook.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadWorkbook(): Promise<XLSX.WorkBook> {
  await ensureDir();
  try {
    const buf = await fs.readFile(FILE_PATH);
    return XLSX.read(buf, { type: "buffer" });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([BASE_COLUMNS as unknown as string[]]);
      XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
      return wb;
    }
    throw err;
  }
}

async function saveWorkbook(wb: XLSX.WorkBook) {
  await ensureDir();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  // Atomic write: write to temp then rename.
  const tmp = FILE_PATH + ".tmp";
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, FILE_PATH);
}

function getSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  let ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    ws = XLSX.utils.aoa_to_sheet([BASE_COLUMNS as unknown as string[]]);
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  }
  return ws;
}

function sheetToRows(ws: XLSX.WorkSheet): { headers: string[]; rows: Row[] } {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
  const rows: Row[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const arr = aoa[i] as unknown[];
    if (!arr || arr.every((v) => v === "" || v == null)) continue;
    const row: Row = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (arr[c] as Row[string]) ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function rowsToSheet(headers: string[], rows: Row[]): XLSX.WorkSheet {
  const aoa: unknown[][] = [headers];
  for (const row of rows) {
    aoa.push(headers.map((h) => (row[h] === undefined ? "" : row[h])));
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function ensureWeekColumns(headers: string[], week: number): string[] {
  const cols = [`Week ${week}`, `Producten ${week}`, `Olie ${week}`];
  const next = [...headers];
  for (const c of cols) {
    if (!next.includes(c)) next.push(c);
  }
  return next;
}

function rowToCustomer(row: Row, week: number): Customer {
  const dayRaw = String(row[`Week ${week}`] ?? "").trim();
  const productsRaw = row[`Producten ${week}`];
  const oilRaw = String(row[`Olie ${week}`] ?? "").trim();
  // A visit is recorded by Week X / Producten X. Olie alone is a per-groep
  // voucher marker and does not count as having physically visited.
  const hasVisit =
    dayRaw !== "" || (productsRaw !== "" && productsRaw != null);
  const visit: VisitRecord | undefined = hasVisit
    ? {
        week,
        day: (dayRaw === "Woensdag" || dayRaw === "Donderdag" ? dayRaw : "") as VisitDay | "",
        products:
          productsRaw === "" || productsRaw == null
            ? null
            : Number(productsRaw),
        oil: oilRaw.toLowerCase() === "ja",
      }
    : undefined;

  return {
    id: String(row["ID"] ?? "").trim(),
    stadpasId: String(row["Stadpas ID"] ?? "").trim(),
    voornaam: String(row["Voornaam"] ?? "").trim(),
    achternaam: String(row["Achternaam"] ?? "").trim(),
    postcode: String(row["Postcode"] ?? "").trim(),
    groepId: String(row["Groep ID"] ?? "").trim(),
    idVerified: String(row["ID gecontroleerd"] ?? "").toLowerCase() === "ja",
    notes: String(row["Notities"] ?? ""),
    visitThisWeek: visit,
  };
}

function getGroepenSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  let ws = wb.Sheets[GROUP_SHEET_NAME];
  if (!ws) {
    ws = XLSX.utils.aoa_to_sheet([GROUP_COLUMNS as unknown as string[]]);
    XLSX.utils.book_append_sheet(wb, ws, GROUP_SHEET_NAME);
  }
  return ws;
}

function rowToGroupMember(row: Row, week: number): GroupMember {
  const c = rowToCustomer(row, week);
  const oilThisWeek =
    String(row[`Olie ${week}`] ?? "").toLowerCase() === "ja";
  return {
    id: c.id,
    voornaam: c.voornaam,
    achternaam: c.achternaam,
    fullName: `${c.voornaam} ${c.achternaam}`.trim(),
    visitThisWeek: c.visitThisWeek,
    oilThisWeek,
  };
}

function computeGroupView(
  klantenRows: Row[],
  groepRow: Row | null,
  groupId: string,
  week: number
): GroupView {
  const members: GroupMember[] = klantenRows
    .filter((r) => String(r["Groep ID"] ?? "").trim() === groupId)
    .map((r) => rowToGroupMember(r, week));

  // Prefer a member who actually visited AND has oil (clear recipient); fall
  // back to any member flagged with Olie this week (manual edit / propagated
  // marker without a recorded visit).
  const visitingOilMember = members.find((m) => m.visitThisWeek?.oil === true);
  const anyOilMember = members.find((m) => m.oilThisWeek);
  const oilRecipient = visitingOilMember
    ? {
        fullName: visitingOilMember.fullName,
        day: visitingOilMember.visitThisWeek?.day ?? "",
      }
    : anyOilMember
    ? { fullName: anyOilMember.fullName, day: "" as VisitDay | "" }
    : null;

  return {
    id: groupId,
    postcode: groepRow ? String(groepRow["Postcode"] ?? "").trim() : "",
    notes: groepRow ? String(groepRow["Notities"] ?? "") : "",
    members,
    oilUsedThisWeek: !!anyOilMember,
    oilRecipient,
    hasAnyVisitThisWeek: members.some((m) => m.visitThisWeek != null),
  };
}

export async function findCustomer(id: string): Promise<Customer | null> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = getSheet(wb);
    const { rows } = sheetToRows(ws);
    const week = isoWeek();
    const match = rows.find((r) => String(r["ID"] ?? "").trim() === id.trim());
    return match ? rowToCustomer(match, week) : null;
  });
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = getSheet(wb);
    const { rows } = sheetToRows(ws);
    const week = isoWeek();
    const matches: Customer[] = [];
    for (const r of rows) {
      const first = String(r["Voornaam"] ?? "").toLowerCase();
      const last = String(r["Achternaam"] ?? "").toLowerCase();
      const full = `${first} ${last}`.trim();
      if (first.includes(q) || last.includes(q) || full.includes(q)) {
        matches.push(rowToCustomer(r, week));
      }
      if (matches.length >= 25) break;
    }
    return matches;
  });
}

export type CreateCustomerInput = {
  id: string;
  voornaam: string;
  achternaam: string;
  postcode: string;
  idVerified: boolean;
  notes?: string;
};

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = getSheet(wb);
    const { headers, rows } = sheetToRows(ws);

    if (rows.some((r) => String(r["ID"] ?? "").trim() === input.id.trim())) {
      throw new Error("CUSTOMER_EXISTS");
    }

    const finalHeaders = [...headers];
    for (const c of BASE_COLUMNS) {
      if (!finalHeaders.includes(c)) finalHeaders.push(c);
    }

    const newRow: Row = {
      ID: input.id,
      "Stadpas ID": input.id,
      Voornaam: input.voornaam,
      Achternaam: input.achternaam,
      Postcode: input.postcode,
      "ID gecontroleerd": input.idVerified ? "Ja" : "",
      Notities: input.notes ?? "",
    };

    const nextRows = [...rows, newRow];
    wb.Sheets[SHEET_NAME] = rowsToSheet(finalHeaders, nextRows);
    await saveWorkbook(wb);
    return rowToCustomer(newRow, isoWeek());
  });
}

export type LogVisitInput = {
  id: string;
  day: VisitDay;
  products: number;
  oil: boolean;
  override?: boolean;
  notes?: string;
};

export type LogVisitResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "ALREADY_VISITED"; existing: VisitRecord; customer: Customer }
  | {
      ok: false;
      reason: "OIL_ALREADY_USED";
      recipient: { fullName: string; day: VisitDay | "" };
    };

export async function logVisit(input: LogVisitInput): Promise<LogVisitResult> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = getSheet(wb);
    const { headers, rows } = sheetToRows(ws);
    const week = isoWeek();

    const idx = rows.findIndex((r) => String(r["ID"] ?? "").trim() === input.id.trim());
    if (idx === -1) return { ok: false, reason: "NOT_FOUND" } as const;

    const row = rows[idx];
    const existingCustomer = rowToCustomer(row, week);

    if (existingCustomer.visitThisWeek && !input.override) {
      return {
        ok: false,
        reason: "ALREADY_VISITED",
        existing: existingCustomer.visitThisWeek,
        customer: existingCustomer,
      } as const;
    }

    // Per-groep oil cap also applies to solo writes (e.g. override flow on a
    // groep member): block if another member of the same groep already has
    // Olie = "Ja" for this ISO week.
    if (input.oil && existingCustomer.groepId) {
      const conflict = rows.find(
        (r) =>
          String(r["Groep ID"] ?? "").trim() === existingCustomer.groepId &&
          String(r["ID"] ?? "").trim() !== existingCustomer.id &&
          String(r[`Olie ${week}`] ?? "").toLowerCase() === "ja"
      );
      if (conflict) {
        return {
          ok: false,
          reason: "OIL_ALREADY_USED",
          recipient: {
            fullName: `${String(conflict["Voornaam"] ?? "").trim()} ${String(
              conflict["Achternaam"] ?? ""
            ).trim()}`.trim(),
            day: String(conflict[`Week ${week}`] ?? "").trim() as VisitDay | "",
          },
        } as const;
      }
    }

    const finalHeaders = ensureWeekColumns(headers, week);
    row[`Week ${week}`] = input.day;
    row[`Producten ${week}`] = input.products;
    row[`Olie ${week}`] = input.oil ? "Ja" : "";
    if (input.notes !== undefined) {
      row["Notities"] = input.notes;
    }

    // Propagate oil grant across the whole groep — voucher is shared.
    if (input.oil && existingCustomer.groepId) {
      for (const r of rows) {
        if (String(r["Groep ID"] ?? "").trim() === existingCustomer.groepId) {
          r[`Olie ${week}`] = "Ja";
        }
      }
    }

    wb.Sheets[SHEET_NAME] = rowsToSheet(finalHeaders, rows);
    await saveWorkbook(wb);

    return { ok: true, customer: rowToCustomer(row, week) } as const;
  });
}

export async function updateNotes(
  id: string,
  notes: string
): Promise<Customer | null> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = getSheet(wb);
    const { headers, rows } = sheetToRows(ws);
    const idx = rows.findIndex((r) => String(r["ID"] ?? "").trim() === id.trim());
    if (idx === -1) return null;
    rows[idx]["Notities"] = notes;
    wb.Sheets[SHEET_NAME] = rowsToSheet(headers, rows);
    await saveWorkbook(wb);
    return rowToCustomer(rows[idx], isoWeek());
  });
}

export async function findCustomerAndGroup(
  id: string
): Promise<{ customer: Customer; group: GroupView | null } | null> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const klantenWs = getSheet(wb);
    const { rows: klantenRows } = sheetToRows(klantenWs);
    const week = isoWeek();
    const match = klantenRows.find(
      (r) => String(r["ID"] ?? "").trim() === id.trim()
    );
    if (!match) return null;
    const customer = rowToCustomer(match, week);
    if (!customer.groepId) return { customer, group: null };
    const groepenWs = getGroepenSheet(wb);
    const { rows: groupRows } = sheetToRows(groepenWs);
    const groepRow =
      groupRows.find(
        (r) => String(r["Groep ID"] ?? "").trim() === customer.groepId
      ) ?? null;
    const group = computeGroupView(
      klantenRows,
      groepRow,
      customer.groepId,
      week
    );
    return { customer, group };
  });
}

export type LogGroupVisitInput = {
  scannerId: string;
  memberIds: string[];
  day: VisitDay;
  products: number;
  oil: boolean;
};

export type LogGroupVisitResult =
  | { ok: true; group: GroupView; loggedIds: string[] }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "NO_GROUP" }
  | { ok: false; reason: "NO_MEMBERS_TO_LOG" }
  | {
      ok: false;
      reason: "OIL_ALREADY_USED";
      recipient: { fullName: string; day: VisitDay | "" };
    };

export async function logGroupVisit(
  input: LogGroupVisitInput
): Promise<LogGroupVisitResult> {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const klantenWs = getSheet(wb);
    const { headers: kHeaders, rows: klantenRows } = sheetToRows(klantenWs);
    const week = isoWeek();

    const scannerIdTrim = input.scannerId.trim();
    const scannerIdx = klantenRows.findIndex(
      (r) => String(r["ID"] ?? "").trim() === scannerIdTrim
    );
    if (scannerIdx === -1) return { ok: false, reason: "NOT_FOUND" } as const;
    const groupId = String(klantenRows[scannerIdx]["Groep ID"] ?? "").trim();
    if (!groupId) return { ok: false, reason: "NO_GROUP" } as const;

    const memberRows = klantenRows.filter(
      (r) => String(r["Groep ID"] ?? "").trim() === groupId
    );

    // Oil voucher cap: only one oil grant per groep per ISO week. If any
    // member already has Olie = "Ja", the volunteer cannot grant oil again.
    const oilHolder = memberRows.find(
      (r) => String(r[`Olie ${week}`] ?? "").toLowerCase() === "ja"
    );
    if (input.oil && oilHolder) {
      return {
        ok: false,
        reason: "OIL_ALREADY_USED",
        recipient: {
          fullName: `${String(oilHolder["Voornaam"] ?? "").trim()} ${String(
            oilHolder["Achternaam"] ?? ""
          ).trim()}`.trim(),
          day: String(oilHolder[`Week ${week}`] ?? "").trim() as VisitDay | "",
        },
      } as const;
    }

    const finalKHeaders = ensureWeekColumns(kHeaders, week);
    const requested = new Set([
      ...input.memberIds.map((s) => s.trim()),
      scannerIdTrim,
    ]);
    const loggedIds: string[] = [];

    for (const r of memberRows) {
      const memberId = String(r["ID"] ?? "").trim();
      if (!requested.has(memberId)) continue;
      const existingDay = String(r[`Week ${week}`] ?? "").trim();
      const existingProducts = r[`Producten ${week}`];
      const hasVisit =
        existingDay !== "" ||
        (existingProducts !== "" && existingProducts != null);
      if (hasVisit) continue;
      r[`Week ${week}`] = input.day;
      r[`Producten ${week}`] =
        memberId === scannerIdTrim ? input.products : 0;
      loggedIds.push(memberId);
    }

    // If oil is granted, mark Olie = "Ja" on every member of the groep — the
    // voucher is shared, so the whole groep is flagged as having claimed it.
    if (input.oil) {
      for (const r of memberRows) {
        r[`Olie ${week}`] = "Ja";
      }
    }

    if (loggedIds.length === 0 && !input.oil) {
      return { ok: false, reason: "NO_MEMBERS_TO_LOG" } as const;
    }

    wb.Sheets[SHEET_NAME] = rowsToSheet(finalKHeaders, klantenRows);

    // Resync Leden in groepen sheet — manager-edited membership stays in sync.
    const groepenWs = getGroepenSheet(wb);
    const { headers: gHeaders, rows: groupRows } = sheetToRows(groepenWs);
    let finalGHeaders = gHeaders;
    for (const c of GROUP_COLUMNS) {
      if (!finalGHeaders.includes(c)) finalGHeaders = [...finalGHeaders, c];
    }
    const ledenStr = klantenRows
      .filter((r) => String(r["Groep ID"] ?? "").trim() === groupId)
      .map((r) =>
        `${String(r["Voornaam"] ?? "").trim()} ${String(
          r["Achternaam"] ?? ""
        ).trim()}`.trim()
      )
      .filter(Boolean)
      .join(", ");
    const groupIdx = groupRows.findIndex(
      (r) => String(r["Groep ID"] ?? "").trim() === groupId
    );
    if (groupIdx === -1) {
      groupRows.push({
        "Groep ID": groupId,
        Leden: ledenStr,
        Postcode: String(klantenRows[scannerIdx]["Postcode"] ?? ""),
        Notities: "",
      });
    } else {
      groupRows[groupIdx]["Leden"] = ledenStr;
    }
    wb.Sheets[GROUP_SHEET_NAME] = rowsToSheet(finalGHeaders, groupRows);

    await saveWorkbook(wb);

    const groepRowAfter =
      groupRows.find((r) => String(r["Groep ID"] ?? "").trim() === groupId) ??
      null;
    const group = computeGroupView(klantenRows, groepRowAfter, groupId, week);
    return { ok: true, group, loggedIds } as const;
  });
}
