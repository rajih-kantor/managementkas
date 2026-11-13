import type { AssetFundRow, ParseResult } from "./types";
import { REQUIRED_HEADERS } from "./types";

function toCellString(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v.toString();
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("w" in o && typeof o.w === "string") return o.w;
    if ("v" in o) return toCellString(o.v);
    if ("text" in o && typeof o.text === "string") return o.text;
    return null;
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function parseExcel(file: File): Promise<ParseResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("File harus .xlsx");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ukuran file maksimal 10 MB");
  }

  let XLSX: any;
  try {
    XLSX = await import("xlsx");
  } catch (e) {
    console.error("xlsx import error:", e);
    throw new Error("Library xlsx gagal dimuat");
  }

  const buffer = await file.arrayBuffer();

  let wb: any;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true, cellNF: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("xlsx read error:", e);
    throw new Error(`Gagal baca file: ${msg}`);
  }

  const sheetName =
    wb.SheetNames.find((n: string) => n === "Asset Fund") ?? wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook tidak punya sheet");

  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak bisa dibaca`);

  // Convert sheet to 2D array (header: 1 → first row as array)
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  if (grid.length === 0) throw new Error("Sheet kosong");

  const rawHeaders = grid[0] ?? [];
  const headers: string[] = rawHeaders.map((h) => {
    const s = toCellString(h);
    return s ? s.replace(/\s+/g, " ").trim() : "";
  });

  const headerSet = new Set(headers.filter(Boolean));
  if (headerSet.size === 0) throw new Error("Baris header kosong di sheet");

  const missing = REQUIRED_HEADERS.filter((h) => !headerSet.has(h));
  if (missing.length > 0) {
    throw new Error(
      `Header wajib hilang: ${missing.map((h) => `"${h}"`).join(", ")}`,
    );
  }

  const rows: AssetFundRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const rowArr = grid[r] ?? [];
    const obj: AssetFundRow = {};
    let hasVal = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const v = toCellString(rowArr[i]);
      obj[h] = v;
      if (v !== null) hasVal = true;
    });
    if (hasVal) rows.push(obj);
  }

  return {
    rows,
    headers: headers.filter(Boolean),
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };
}
