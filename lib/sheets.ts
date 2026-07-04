import { sheets, auth, type sheets_v4 } from "@googleapis/sheets";

// Low-level Google Sheets access. The domain logic lives in lib/excel.ts and
// works on a "headers + rows" model, just like the old local-xlsx version;
// this module only handles auth and reading/writing raw cell grids.
//
// Required environment variables (see .env.local.example):
//   GOOGLE_CLIENT_EMAIL  – service-account email
//   GOOGLE_PRIVATE_KEY   – service-account private key (\n-escaped newlines)
//   GOOGLE_SHEET_ID      – the spreadsheet ID from its URL
// The spreadsheet must be shared with the service-account email (Editor).

export type Cell = string | number | boolean;

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Google-credentials ontbreken: stel GOOGLE_CLIENT_EMAIL en GOOGLE_PRIVATE_KEY in (.env.local)."
    );
  }
  const jwt = new auth.JWT({ email, key, scopes: SCOPES });
  cachedClient = sheets({ version: "v4", auth: jwt });
  return cachedClient;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID ontbreekt (.env.local).");
  return id;
}

// Quote a tab title for use in an A1 range (titles can contain spaces).
function rangeFor(title: string, suffix = ""): string {
  const quoted = `'${title.replace(/'/g, "''")}'`;
  return suffix ? `${quoted}!${suffix}` : quoted;
}

// Read every cell of a tab as a 2-D array. A missing tab is treated as empty
// so callers can initialise it on first write.
export async function readGrid(title: string): Promise<Cell[][]> {
  try {
    const res = await getClient().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: rangeFor(title),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return (res.data.values ?? []) as Cell[][];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Unable to parse range/i.test(msg)) return [];
    throw err;
  }
}

// Ensure a tab exists, creating it (with a header row) if needed.
async function ensureTab(title: string, headerRow: string[]): Promise<void> {
  const client = getClient();
  const id = spreadsheetId();
  const meta = await client.spreadsheets.get({
    spreadsheetId: id,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (titles.includes(title)) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  if (headerRow.length) {
    await client.spreadsheets.values.update({
      spreadsheetId: id,
      range: rangeFor(title, "A1"),
      valueInputOption: "RAW",
      requestBody: { values: [headerRow] },
    });
  }
}

// Overwrite a tab with the given grid, starting at A1. The app only ever adds
// rows/columns (never removes), so a plain update never leaves stale cells.
export async function writeGrid(title: string, values: Cell[][]): Promise<void> {
  await ensureTab(title, (values[0] ?? []).map(String));
  const client = getClient();
  const id = spreadsheetId();
  await client.spreadsheets.values.update({
    spreadsheetId: id,
    range: rangeFor(title, "A1"),
    valueInputOption: "RAW",
    requestBody: { values },
  });
  // If the tab is backed by a native Google Sheets Table, values.update only
  // fills cells — it never grows the table's structural range. Resize the table
  // so new rows (people) and new columns (weeks) become part of it.
  await resizeTableToData(client, id, title, values);
}

// Grow the tab's Table (if any) to cover the freshly written data grid. The app
// writes A1-anchored, so the data spans rows [0, numRows) and columns
// [0, numCols); we keep the table's existing top-left anchor and extend its end
// to that extent. A resize failure is logged but never fails the write — the
// values themselves are already saved.
async function resizeTableToData(
  client: sheets_v4.Sheets,
  id: string,
  title: string,
  values: Cell[][]
): Promise<void> {
  const numRows = values.length;
  const numCols = Math.max(0, ...values.map((r) => r.length));
  if (numRows === 0 || numCols === 0) return;

  try {
    const meta = await client.spreadsheets.get({
      spreadsheetId: id,
      fields: "sheets(properties(sheetId,title),tables(tableId,range))",
    });
    const sheet = (meta.data.sheets ?? []).find(
      (s) => s.properties?.title === title
    );
    const sheetId = sheet?.properties?.sheetId;
    const table = (sheet?.tables ?? [])[0];
    if (!table?.tableId || sheetId == null) return;

    const range = table.range ?? {};
    const startRowIndex = range.startRowIndex ?? 0;
    const startColumnIndex = range.startColumnIndex ?? 0;
    // Already covers the data — nothing to do.
    if (
      startRowIndex === 0 &&
      startColumnIndex === 0 &&
      range.endRowIndex === numRows &&
      range.endColumnIndex === numCols
    ) {
      return;
    }

    await client.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: [
          {
            updateTable: {
              table: {
                tableId: table.tableId,
                range: {
                  sheetId,
                  startRowIndex,
                  startColumnIndex,
                  endRowIndex: numRows,
                  endColumnIndex: numCols,
                },
              },
              fields: "range",
            },
          },
        ],
      },
    });
  } catch (err: unknown) {
    console.warn(
      `Kon de tabel op tab "${title}" niet vergroten:`,
      err instanceof Error ? err.message : err
    );
  }
}
