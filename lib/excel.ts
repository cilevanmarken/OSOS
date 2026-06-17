import { readGrid, writeGrid, type Cell } from "./sheets";
import { isoWeek, type VisitDay } from "./week";

export const SHEET_NAME = "klanten registratie";
export const GROUP_SHEET_NAME = "groepen";

const BASE_COLUMNS = [
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
  // The stadspas ID — the single identifier column ("Stadpas ID") in the
  // sheet. Customers without a stadspas get an auto-generated "ZP#" id.
  id: string;
  voornaam: string;
  achternaam: string;
  postcode: string;
  groepId: string;
  idVerified: boolean;
  notes: string;
  visitThisWeek?: VisitRecord;
  // True when this customer's OWN visit this week "counts" (products > 0 or
  // oil) and they may NOT come again. Each customer has an independent weekly
  // slot — a groep member being locked does not lock the rest of the groep.
  // A visit with 0 products and no oil does not count — the customer is free
  // to return later in the same week.
  lockedThisWeek: boolean;
};

export type GroupMember = {
  id: string;
  voornaam: string;
  achternaam: string;
  fullName: string;
  visitThisWeek?: VisitRecord;
  oilThisWeek: boolean;
  // True when this member's visit counts (products > 0 or oil). A 0-product,
  // no-oil visit does not count, so the member may still be checked in.
  countsThisWeek: boolean;
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

// Single-writer mutex so concurrent requests don't interleave read-modify-write
// cycles on the spreadsheet within this server instance.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// Convert a raw cell grid (header row + data rows) into keyed rows.
function gridToRows(values: Cell[][]): { headers: string[]; rows: Row[] } {
  const headers = (values[0] ?? []).map((h) => String(h ?? ""));
  const rows: Row[] = [];
  for (let i = 1; i < values.length; i++) {
    const arr = values[i] ?? [];
    if (!arr.length || arr.every((v) => v === "" || v == null)) continue;
    const row: Row = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (arr[c] as Row[string]) ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function rowsToGrid(headers: string[], rows: Row[]): Cell[][] {
  const grid: Cell[][] = [headers];
  for (const row of rows) {
    grid.push(
      headers.map((h) => {
        const v = row[h];
        return v === undefined || v === null ? "" : v;
      })
    );
  }
  return grid;
}

async function loadRows(title: string): Promise<{ headers: string[]; rows: Row[] }> {
  return gridToRows(await readGrid(title));
}

async function saveRows(title: string, headers: string[], rows: Row[]): Promise<void> {
  await writeGrid(title, rowsToGrid(headers, rows));
}

function ensureWeekColumns(headers: string[], week: number): string[] {
  const cols = [`Week ${week}`, `Producten ${week}`, `Olie ${week}`];
  const next = [...headers];
  for (const c of cols) {
    if (!next.includes(c)) next.push(c);
  }
  return next;
}

// A visit "counts" — i.e. uses up the customer's weekly slot — only when the
// customer actually received something: at least one product or an oil
// voucher. A 0-product, no-oil visit is effectively a no-op, so the customer
// may come back later this week.
function visitCounts(visit: VisitRecord | undefined): boolean {
  return !!visit && ((visit.products ?? 0) > 0 || visit.oil);
}

// Split a product total as evenly as possible across `parts` people. Each gets
// the floor share; the leftover remainder is handed out one extra at a time to
// the first members (e.g. splitEvenly(5, 2) → [3, 2]).
function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;
  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    return base + extra;
  });
}

// Whether a customer is locked out for the week. Every customer — solo or
// groep member — uses their OWN weekly slot. A groep member who has not shopped
// yet may still come even if another member already did. Oil is the only
// shared, once-per-groep resource; that cap is enforced separately at log time.
function computeLocked(customer: Customer): boolean {
  return visitCounts(customer.visitThisWeek);
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
    id: String(row["Stadpas ID"] ?? "").trim(),
    voornaam: String(row["Voornaam"] ?? "").trim(),
    achternaam: String(row["Achternaam"] ?? "").trim(),
    postcode: String(row["Postcode"] ?? "").trim(),
    groepId: String(row["Groep ID"] ?? "").trim(),
    idVerified: String(row["ID gecontroleerd"] ?? "").toLowerCase() === "ja",
    notes: String(row["Notities"] ?? ""),
    visitThisWeek: visit,
    // Locked purely on this customer's own visit — groep membership no longer
    // affects whether an individual may shop (only the oil voucher is shared).
    lockedThisWeek: visitCounts(visit),
  };
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
    countsThisWeek: (c.visitThisWeek?.products ?? 0) > 0 || oilThisWeek,
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
    // Only counting visits (products > 0 or oil) lock the groep — a 0-product,
    // no-oil visit lets the groep return this week.
    hasAnyVisitThisWeek: members.some((m) => m.countsThisWeek),
  };
}

export async function findCustomer(id: string): Promise<Customer | null> {
  return withLock(async () => {
    const { rows } = await loadRows(SHEET_NAME);
    const week = isoWeek();
    const match = rows.find((r) => String(r["Stadpas ID"] ?? "").trim() === id.trim());
    if (!match) return null;
    const customer = rowToCustomer(match, week);
    customer.lockedThisWeek = computeLocked(customer);
    return customer;
  });
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return withLock(async () => {
    const { rows } = await loadRows(SHEET_NAME);
    const week = isoWeek();
    const matches: Customer[] = [];
    for (const r of rows) {
      const first = String(r["Voornaam"] ?? "").toLowerCase();
      const last = String(r["Achternaam"] ?? "").toLowerCase();
      const full = `${first} ${last}`.trim();
      if (first.includes(q) || last.includes(q) || full.includes(q)) {
        const customer = rowToCustomer(r, week);
        customer.lockedThisWeek = computeLocked(customer);
        matches.push(customer);
      }
      if (matches.length >= 25) break;
    }
    return matches;
  });
}

export type CreateCustomerInput = {
  // The stadspas ID. Leave empty when the customer has no stadspas — a unique
  // internal ID is then generated automatically.
  id: string;
  voornaam: string;
  achternaam: string;
  postcode: string;
  idVerified: boolean;
  notes?: string;
};

// Generate a unique internal ID for customers without a stadspas. The "ZP"
// prefix (zonder pas) keeps it from colliding with numeric stadspas barcodes.
function generateUniqueId(rows: Row[]): string {
  const existing = new Set(rows.map((r) => String(r["Stadpas ID"] ?? "").trim()));
  let n = 1;
  while (existing.has(`ZP${n}`)) n++;
  return `ZP${n}`;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return withLock(async () => {
    const { headers, rows } = await loadRows(SHEET_NAME);

    const stadpas = input.id.trim();
    let id = stadpas;
    if (!id) {
      id = generateUniqueId(rows);
    } else if (rows.some((r) => String(r["Stadpas ID"] ?? "").trim() === id)) {
      throw new Error("CUSTOMER_EXISTS");
    }

    const finalHeaders = [...headers];
    for (const c of BASE_COLUMNS) {
      if (!finalHeaders.includes(c)) finalHeaders.push(c);
    }

    const newRow: Row = {
      "Stadpas ID": id,
      Voornaam: input.voornaam,
      Achternaam: input.achternaam,
      Postcode: input.postcode,
      "ID gecontroleerd": input.idVerified ? "Ja" : "",
      Notities: input.notes ?? "",
    };

    const nextRows = [...rows, newRow];
    await saveRows(SHEET_NAME, finalHeaders, nextRows);
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
    const { headers, rows } = await loadRows(SHEET_NAME);
    const week = isoWeek();

    const idx = rows.findIndex((r) => String(r["Stadpas ID"] ?? "").trim() === input.id.trim());
    if (idx === -1) return { ok: false, reason: "NOT_FOUND" } as const;

    const row = rows[idx];
    const existingCustomer = rowToCustomer(row, week);

    // Only a counting visit (products > 0 or oil) blocks a re-check this week;
    // a previous 0-product, no-oil visit may simply be overwritten.
    if (computeLocked(existingCustomer) && !input.override) {
      return {
        ok: false,
        reason: "ALREADY_VISITED",
        existing: existingCustomer.visitThisWeek ?? {
          week,
          day: "",
          products: null,
          oil: false,
        },
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
          String(r["Stadpas ID"] ?? "").trim() !== existingCustomer.id &&
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

    // Oil is marked only on the actual recipient (set above). It is NOT
    // propagated across the groep — other members keep their own slot and may
    // still shop. The once-per-groep oil cap is enforced by the conflict check
    // above, which already blocks a second oil grant within the same groep.

    await saveRows(SHEET_NAME, finalHeaders, rows);

    return { ok: true, customer: rowToCustomer(row, week) } as const;
  });
}

export async function updateNotes(
  id: string,
  notes: string
): Promise<Customer | null> {
  return withLock(async () => {
    const { headers, rows } = await loadRows(SHEET_NAME);
    const idx = rows.findIndex((r) => String(r["Stadpas ID"] ?? "").trim() === id.trim());
    if (idx === -1) return null;
    rows[idx]["Notities"] = notes;
    await saveRows(SHEET_NAME, headers, rows);
    return rowToCustomer(rows[idx], isoWeek());
  });
}

export async function findCustomerAndGroup(
  id: string
): Promise<{ customer: Customer; group: GroupView | null } | null> {
  return withLock(async () => {
    const { rows: klantenRows } = await loadRows(SHEET_NAME);
    const week = isoWeek();
    const match = klantenRows.find(
      (r) => String(r["Stadpas ID"] ?? "").trim() === id.trim()
    );
    if (!match) return null;
    const customer = rowToCustomer(match, week);
    customer.lockedThisWeek = computeLocked(customer);
    if (!customer.groepId) return { customer, group: null };
    const { rows: groupRows } = await loadRows(GROUP_SHEET_NAME);
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
    const { headers: kHeaders, rows: klantenRows } = await loadRows(SHEET_NAME);
    const week = isoWeek();

    const scannerIdTrim = input.scannerId.trim();
    const scannerIdx = klantenRows.findIndex(
      (r) => String(r["Stadpas ID"] ?? "").trim() === scannerIdTrim
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

    // Members actually being logged this round: requested, in this groep, and
    // not already counted (products > 0 or oil). A previous 0-product, no-oil
    // visit can be overwritten — those members are eligible again.
    const rowsToLog = memberRows.filter((r) => {
      const memberId = String(r["Stadpas ID"] ?? "").trim();
      if (!requested.has(memberId)) return false;
      const countsAlready =
        Number(r[`Producten ${week}`] || 0) > 0 ||
        String(r[`Olie ${week}`] ?? "").toLowerCase() === "ja";
      return !countsAlready;
    });

    // Split the total products evenly across everyone the scanner shops for, so
    // each person is recorded as having received groceries and therefore cannot
    // shop again this week. The remainder is spread one extra over the first
    // few members (e.g. 5 products over 2 people → 3 and 2).
    const shares = splitEvenly(input.products, rowsToLog.length);
    const loggedIds: string[] = [];
    rowsToLog.forEach((r, i) => {
      r[`Week ${week}`] = input.day;
      r[`Producten ${week}`] = shares[i];
      loggedIds.push(String(r["Stadpas ID"] ?? "").trim());
    });

    // Oil is the only once-per-groep resource. Mark it on the scanner (the
    // member physically collecting) — NOT on the whole groep. Other members
    // keep their own weekly slot and may still shop; only a second oil grant
    // is blocked (by the oilHolder check above).
    if (input.oil) {
      klantenRows[scannerIdx][`Olie ${week}`] = "Ja";
    }

    if (loggedIds.length === 0 && !input.oil) {
      return { ok: false, reason: "NO_MEMBERS_TO_LOG" } as const;
    }

    await saveRows(SHEET_NAME, finalKHeaders, klantenRows);

    // Resync Leden in groepen sheet — manager-edited membership stays in sync.
    const { headers: gHeaders, rows: groupRows } = await loadRows(GROUP_SHEET_NAME);
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
    await saveRows(GROUP_SHEET_NAME, finalGHeaders, groupRows);

    const groepRowAfter =
      groupRows.find((r) => String(r["Groep ID"] ?? "").trim() === groupId) ??
      null;
    const group = computeGroupView(klantenRows, groepRowAfter, groupId, week);
    return { ok: true, group, loggedIds } as const;
  });
}
