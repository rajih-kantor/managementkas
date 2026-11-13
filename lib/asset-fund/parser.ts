import type { ParseResult, SourceType } from "./types";
import { parseDelimited } from "./csv-parser";
import { normalizeRows, validateRequiredHeaders } from "./normalize";

const MAX_SIZE = 10 * 1024 * 1024;

function detectSourceType(file: File): SourceType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".txt")) return "txt";
  throw new Error("File harus .xlsx, .csv, atau .txt");
}

function looksLikeZip(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return (
    view.length >= 4 &&
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    view[2] === 0x03 &&
    view[3] === 0x04
  );
}

function cellToString(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v.toString();
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("w" in o && typeof o.w === "string") return o.w;
    if ("v" in o) return cellToString(o.v);
    if ("text" in o && typeof o.text === "string") return o.text;
    return null;
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<{
  headers: string[];
  grid: (string | null)[][];
  warnings: string[];
}> {
  let XLSX: any;
  try {
    XLSX = await import("xlsx");
  } catch (e) {
    console.error("xlsx import error:", e);
    throw new Error("Library xlsx gagal dimuat");
  }

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

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  if (raw.length === 0) throw new Error("Sheet kosong");

  const headers = (raw[0] ?? []).map((h) => {
    const s = cellToString(h);
    return s ? s.replace(/\s+/g, " ").trim() : "";
  });

  const warnings: string[] = [];
  const grid: (string | null)[][] = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r] ?? [];
    if (row.length > headers.length) {
      warnings.push(
        `Baris ${r + 1}: jumlah kolom tidak sesuai (${row.length} vs ${headers.length})`,
      );
      continue;
    }
    const cells = headers.map((_h, i) => cellToString(row[i]));
    grid.push(cells);
  }

  return { headers, grid, warnings };
}

export async function parseFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_SIZE) {
    throw new Error("Ukuran file maksimal 10 MB");
  }

  const sourceType = detectSourceType(file);
  const warnings: string[] = [];
  let headers: string[];
  let grid: (string | null)[][];
  let delimiter: string | undefined;

  if (sourceType === "xlsx") {
    const buf = await file.arrayBuffer();
    if (!looksLikeZip(buf)) {
      throw new Error("Isi file tidak sesuai ekstensi (.xlsx bukan zip)");
    }
    try {
      const res = await parseXlsxBuffer(buf);
      headers = res.headers;
      grid = res.grid;
      warnings.push(...res.warnings);
    } catch (e) {
      throw e;
    }
  } else {
    const buf = await file.arrayBuffer();
    if (looksLikeZip(buf)) {
      throw new Error(
        `Isi file tidak sesuai ekstensi (.${sourceType} tampak seperti xlsx/zip)`,
      );
    }
    const text = new TextDecoder("utf-8").decode(buf);
    const res = parseDelimited(text, {
      delimiter: "auto",
      useQuotes: "auto",
    });
    headers = res.headers;
    grid = res.rows;
    delimiter = res.delimiter;
    warnings.push(...res.warnings);
  }

  validateRequiredHeaders(headers);
  const normalized = normalizeRows(headers, grid);
  warnings.push(...normalized.warnings);

  return {
    rows: normalized.rows,
    headers: headers.filter(Boolean),
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    sourceType,
    warnings,
    delimiter,
  };
}

export const parseExcel = parseFile;
