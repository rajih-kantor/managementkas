/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Verifier manual untuk parser Asset Fund.
 * Jalankan: npx tsx scripts/test-parse.ts
 */
import * as XLSX from "xlsx";
import { parseFile } from "../lib/asset-fund/parser";
import { buildIndex, lookupName } from "../lib/asset-fund/helpers";

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label: string, msg?: string) {
  failed++;
  console.log(`  ✗ ${label}${msg ? " — " + msg : ""}`);
}
function assert(cond: unknown, label: string, msg?: string) {
  if (cond) ok(label);
  else fail(label, msg);
}
function eq<T>(got: T, want: T, label: string) {
  if (JSON.stringify(got) === JSON.stringify(want)) ok(label);
  else
    fail(
      label,
      `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`,
    );
}

/* ---------- Fixtures ---------- */
const HEADERS = [
  "Name",
  "Asset Type",
  "Status",
  "Allow Switching",
  "Open Date",
  "Close Date",
  "Issuer",
  "Trade Unit MD",
  "Quota in Amt",
];

type Row = Record<string, string | null>;
const DATA_ROWS: Row[] = [
  {
    Name: "BNI-AM DANA  DOMPET DHUAFA",
    "Asset Type": "MF",
    Status: "ACTIVE",
    "Allow Switching": "TRUE",
    "Open Date": "2021-12-01",
    "Close Date": null,
    Issuer: "ISS Bowsprit Asset Management.,PT",
    "Trade Unit MD": "1,000.00",
    "Quota in Amt": "100000000000000000000",
  },
  {
    Name: "INSIGHT INFRASTRUKTUR",
    "Asset Type": "MF",
    Status: "ACTIVE",
    "Allow Switching": "TRUE",
    "Open Date": "2020-01-15",
    "Close Date": null,
    Issuer: "INSIGHT A",
    "Trade Unit MD": "500.00",
    "Quota in Amt": "999999999999999",
  },
  {
    Name: "INSIGHT INFRASTRUKTUR",
    "Asset Type": "MF",
    Status: "ACTIVE",
    "Allow Switching": "FALSE",
    "Open Date": "2022-06-30",
    "Close Date": null,
    Issuer: "INSIGHT B",
    "Trade Unit MD": "250",
    "Quota in Amt": "500000",
  },
];

/* ---------- Text builders (BOM + CRLF) ---------- */
function csvQuote(v: string | null): string {
  if (v === null) return "";
  if (/[,"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function rowCells(headers: string[], r: Row): string[] {
  return headers.map((h) => {
    const v = r[h];
    if (v === null) return "";
    if (
      (h === "Open Date" || h === "Close Date") &&
      /^\d{4}-\d{2}-\d{2}$/.test(v)
    ) {
      return v.replace(/-/g, "");
    }
    return v;
  });
}
function buildCsv(
  headers: string[],
  rows: Row[],
  opts: { bom?: boolean; crlf?: boolean; extraCols?: number[] } = {},
): string {
  const nl = opts.crlf ? "\r\n" : "\n";
  const lines: string[] = [];
  lines.push(headers.map((h) => csvQuote(h)).join(","));
  rows.forEach((r, idx) => {
    const cells = rowCells(headers, r);
    if (opts.extraCols && opts.extraCols.includes(idx)) cells.push("extra");
    lines.push(cells.map((c) => csvQuote(c)).join(","));
  });
  return (opts.bom ? "﻿" : "") + lines.join(nl) + nl;
}
function buildTxt(
  headers: string[],
  rows: Row[],
  opts: { bom?: boolean; crlf?: boolean; extraCols?: number[] } = {},
): string {
  const nl = opts.crlf ? "\r\n" : "\n";
  const lines: string[] = [];
  lines.push(headers.join("|"));
  rows.forEach((r, idx) => {
    const cells = rowCells(headers, r);
    if (opts.extraCols && opts.extraCols.includes(idx)) cells.push("extra");
    lines.push(cells.join("|"));
  });
  return (opts.bom ? "﻿" : "") + lines.join(nl) + nl;
}

/* ---------- XLSX builder (all cells as text) ---------- */
function buildXlsxBuffer(headers: string[], rows: Row[]): ArrayBuffer {
  const aoa: (string | null)[][] = [];
  aoa.push(headers);
  for (const r of rows) {
    aoa.push(headers.map((h) => r[h] ?? null));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Force all cells to string type so big numbers survive
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = (ws as any)[addr];
      if (cell && cell.v !== undefined && cell.v !== null) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asset Fund");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf as ArrayBuffer;
}

/* ---------- Helpers ---------- */
function makeFile(
  content: string | ArrayBuffer,
  name: string,
  mime: string,
): File {
  return new File([content as any], name, { type: mime });
}

/* ---------- TESTS ---------- */
(async () => {
  console.log("\n== CSV: happy path ==");
  const csv = buildCsv(HEADERS, DATA_ROWS, { bom: true, crlf: true });
  const csvFile = makeFile(csv, "ods.csv", "text/csv");
  const csvRes = await parseFile(csvFile);
  eq(csvRes.sourceType, "csv" as const, "sourceType=csv");
  eq(csvRes.rows.length, 3, "3 rows parsed");
  eq(csvRes.warnings.length, 0, "no warnings");
  eq(csvRes.rows[0]["Trade Unit MD"], "1,000.00", "quoted comma preserved");
  eq(csvRes.rows[0]["Issuer"], "ISS Bowsprit Asset Management.,PT", "issuer quoted");
  eq(csvRes.rows[0]["Quota in Amt"], "100000000000000000000", "big int stays string");
  eq(csvRes.rows[0]["Open Date"], "2021-12-01", "yyyymmdd → ISO");
  eq(csvRes.rows[0]["Close Date"], null, "empty date → null");

  console.log("\n== XLSX: happy path (same data) ==");
  const xlsxBuf = buildXlsxBuffer(HEADERS, DATA_ROWS);
  const xlsxFile = makeFile(xlsxBuf, "ods.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const xlsxRes = await parseFile(xlsxFile);
  eq(xlsxRes.sourceType, "xlsx" as const, "sourceType=xlsx");
  eq(xlsxRes.rows.length, 3, "3 rows parsed");

  console.log("\n== TXT (pipe): happy path ==");
  const txt = buildTxt(HEADERS, DATA_ROWS, { bom: true, crlf: true });
  const txtFile = makeFile(txt, "ods.txt", "text/plain");
  const txtRes = await parseFile(txtFile);
  eq(txtRes.sourceType, "txt" as const, "sourceType=txt");
  eq(txtRes.delimiter, "|", "delimiter=|");
  eq(txtRes.rows.length, 3, "3 rows parsed");
  eq(txtRes.warnings.length, 0, "no warnings");
  eq(
    txtRes.rows[0]["Trade Unit MD"],
    "1,000.00",
    "pipe: comma inside value preserved",
  );
  eq(
    txtRes.rows[0]["Issuer"],
    "ISS Bowsprit Asset Management.,PT",
    "pipe: issuer with .,PT preserved",
  );
  eq(
    txtRes.rows[0]["Quota in Amt"],
    "100000000000000000000",
    "pipe: big int stays string",
  );
  eq(txtRes.rows[0]["Open Date"], "2021-12-01", "pipe: yyyymmdd → ISO");

  console.log("\n== Parity: CSV vs XLSX vs TXT ==");
  eq(xlsxRes.headers, csvRes.headers, "headers csv==xlsx");
  eq(txtRes.headers, csvRes.headers, "headers csv==txt");
  for (let i = 0; i < 3; i++) {
    eq(xlsxRes.rows[i], csvRes.rows[i], `row[${i}] csv==xlsx`);
    eq(txtRes.rows[i], csvRes.rows[i], `row[${i}] csv==txt`);
  }

  console.log("\n== Lookup parity ==");
  const idxC = buildIndex(csvRes.rows);
  const idxX = buildIndex(xlsxRes.rows);
  const idxT = buildIndex(txtRes.rows);
  const rC = lookupName("BNI-AM DANA DOMPET DHUAFA", idxC, csvRes.rows);
  const rX = lookupName("BNI-AM DANA DOMPET DHUAFA", idxX, xlsxRes.rows);
  const rT = lookupName("BNI-AM DANA DOMPET DHUAFA", idxT, txtRes.rows);
  assert(
    rC.type === "OK" && rX.type === "OK" && rT.type === "OK",
    "lookup OK on csv/xlsx/txt (double-space in name)",
  );
  const ambC = lookupName("INSIGHT INFRASTRUKTUR", idxC, csvRes.rows);
  const ambX = lookupName("INSIGHT INFRASTRUKTUR", idxX, xlsxRes.rows);
  const ambT = lookupName("INSIGHT INFRASTRUKTUR", idxT, txtRes.rows);
  assert(
    ambC.type === "AMBIGUOUS" &&
      ambX.type === "AMBIGUOUS" &&
      ambT.type === "AMBIGUOUS",
    "duplicate name → AMBIGUOUS on all three",
  );

  console.log("\n== Missing required header ==");
  const badHeaders = HEADERS.filter((h) => h !== "Status");
  const badCsv = buildCsv(badHeaders, DATA_ROWS);
  try {
    await parseFile(makeFile(badCsv, "bad.csv", "text/csv"));
    fail("missing-header throws");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    assert(/Header wajib hilang.*Status/i.test(msg), "missing-header error mentions Status");
  }

  console.log("\n== Row with wrong column count → warning (csv & txt) ==");
  const csvExtra = buildCsv(HEADERS, DATA_ROWS, { extraCols: [1] });
  const rCsvExtra = await parseFile(makeFile(csvExtra, "extra.csv", "text/csv"));
  eq(rCsvExtra.rows.length, 2, "csv: 2 rows survived (1 skipped)");
  assert(
    rCsvExtra.warnings.some((w) => /jumlah kolom tidak sesuai/i.test(w)),
    "csv: warning text present",
  );
  const txtExtra = buildTxt(HEADERS, DATA_ROWS, { extraCols: [0] });
  const rTxtExtra = await parseFile(makeFile(txtExtra, "extra.txt", "text/plain"));
  eq(rTxtExtra.rows.length, 2, "txt: 2 rows survived (1 skipped)");
  assert(
    rTxtExtra.warnings.some((w) => /jumlah kolom tidak sesuai/i.test(w)),
    "txt: warning text present",
  );

  console.log("\n== Semicolon delimiter rejected (csv & txt) ==");
  const semi = HEADERS.join(";") + "\n" + HEADERS.map(() => "x").join(";") + "\n";
  for (const [name, mime] of [
    ["semi.csv", "text/csv"],
    ["semi.txt", "text/plain"],
  ] as const) {
    try {
      await parseFile(makeFile(semi, name, mime));
      fail(`${name}: semicolon throws`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      assert(
        /pemisah tidak didukung/i.test(msg),
        `${name}: semicolon rejected with clear msg`,
      );
    }
  }

  console.log("\n== Empty / header only ==");
  try {
    await parseFile(makeFile(HEADERS.join(",") + "\n", "empty.csv", "text/csv"));
    fail("header-only throws");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    assert(/hanya berisi header/i.test(msg), "header-only error clear");
  }

  console.log("\n== Wrong extension ==");
  try {
    await parseFile(makeFile("x", "a.docx", "application/msword"));
    fail("wrong-ext throws");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    assert(
      /\.xlsx, \.csv, atau \.txt/i.test(msg),
      "wrong-ext error clear",
    );
  }

  console.log("\n== Magic byte check: xlsx disguised as .txt ==");
  try {
    const xlsxAsTxt = new Uint8Array(xlsxBuf);
    await parseFile(
      new File([xlsxAsTxt as any], "fake.txt", { type: "text/plain" }),
    );
    fail("xlsx-as-txt throws");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    assert(
      /isi file tidak sesuai ekstensi/i.test(msg),
      "xlsx-as-txt rejected with clear msg",
    );
  }

  console.log("\n== Unknown headers tolerated (go to 'Lainnya' section) ==");
  const extraHeaders = [...HEADERS, "Custom Extra Field"];
  const extraRow: Row = { ...DATA_ROWS[0], "Custom Extra Field": "foo" };
  const csvExtraHdr = buildCsv(extraHeaders, [extraRow]);
  const rExtraHdr = await parseFile(
    makeFile(csvExtraHdr, "extrah.csv", "text/csv"),
  );
  eq(
    rExtraHdr.rows[0]["Custom Extra Field"],
    "foo",
    "unknown header survives in row",
  );

  console.log(`\n==== ${passed} passed, ${failed} failed ====`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
