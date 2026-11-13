import type { AssetFundRow } from "./types";
import { DATE_FIELDS, REQUIRED_HEADERS } from "./types";

export function validateRequiredHeaders(headers: string[]): void {
  const set = new Set(headers.filter(Boolean));
  const missing = REQUIRED_HEADERS.filter((h) => !set.has(h));
  if (missing.length > 0) {
    throw new Error(
      `Header wajib hilang: ${missing.map((h) => `"${h}"`).join(", ")}`,
    );
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function normalizeDate(
  raw: string,
  field: string,
): { value: string; warning?: string } {
  const s = raw.trim();
  if (!s) return { value: s };

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s };

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return { value: s.slice(0, 10) };
  }

  if (/^\d{8}$/.test(s)) {
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}` };
    }
    return {
      value: s,
      warning: `Kolom "${field}": tanggal tidak valid "${s}"`,
    };
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return {
      value: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    };
  }

  return {
    value: s,
    warning: `Kolom "${field}": format tanggal tidak dikenali "${s}"`,
  };
}

export function normalizeRows(
  headers: string[],
  grid: (string | null)[][],
): { rows: AssetFundRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows: AssetFundRow[] = [];

  for (let r = 0; r < grid.length; r++) {
    const rowArr = grid[r];
    const obj: AssetFundRow = {};
    let hasVal = false;

    headers.forEach((h, i) => {
      if (!h) return;
      let v = rowArr[i] ?? null;

      if (v !== null && DATE_FIELDS.has(h)) {
        const norm = normalizeDate(v, h);
        v = norm.value || null;
        if (norm.warning) warnings.push(norm.warning);
      }

      obj[h] = v;
      if (v !== null && v !== "") hasVal = true;
    });

    if (hasVal) rows.push(obj);
  }

  return { rows, warnings };
}
