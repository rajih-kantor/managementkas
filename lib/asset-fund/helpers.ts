import type { AssetFundRow } from "./types";
import { AMT_FIELDS, BOOL_FIELDS, DATE_FIELDS, SECTION_MAP } from "./types";

export function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

export type NameIndex = Map<string, AssetFundRow[]>;

export function buildIndex(rows: AssetFundRow[]): NameIndex {
  const idx: NameIndex = new Map();
  for (const row of rows) {
    const name = row["Name"];
    if (!name) continue;
    const key = normalizeName(name);
    const arr = idx.get(key) ?? [];
    arr.push(row);
    idx.set(key, arr);
  }
  return idx;
}

export function uniqueNames(rows: AssetFundRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const n = r["Name"];
    if (!n) continue;
    const k = normalizeName(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export type LookupResult =
  | { type: "NOT_FOUND"; suggestions: string[] }
  | { type: "AMBIGUOUS"; candidates: AssetFundRow[] }
  | { type: "OK"; row: AssetFundRow };

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(
        curr + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      prev[j - 1] = curr;
      curr = next;
    }
    prev[b.length] = curr;
  }
  return prev[b.length];
}

export function suggest(
  input: string,
  rows: AssetFundRow[],
  limit = 3,
): string[] {
  const q = normalizeName(input);
  const names = uniqueNames(rows);
  return names
    .map((n) => ({ n, d: levenshtein(q, normalizeName(n)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.n);
}

export function lookupName(
  input: string,
  index: NameIndex,
  rows: AssetFundRow[],
  disambiguateId?: string,
): LookupResult {
  const key = normalizeName(input);
  let hits = index.get(key);

  if (!hits || hits.length === 0) {
    const sub: AssetFundRow[] = [];
    for (const [k, arr] of index.entries()) {
      if (k.includes(key)) sub.push(...arr);
    }
    if (sub.length === 0) {
      return { type: "NOT_FOUND", suggestions: suggest(input, rows) };
    }
    hits = sub;
  }

  if (disambiguateId) {
    const pick = hits.find(
      (r) =>
        r["Avaloq Id"] === disambiguateId ||
        r["UT Code"] === disambiguateId ||
        r["Internal Id"] === disambiguateId,
    );
    if (pick) return { type: "OK", row: pick };
  }

  if (hits.length === 1) return { type: "OK", row: hits[0] };
  return { type: "AMBIGUOUS", candidates: hits };
}

export function searchNames(q: string, rows: AssetFundRow[]): string[] {
  const nq = normalizeName(q);
  if (!nq) return uniqueNames(rows).slice(0, 20);
  const names = uniqueNames(rows);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const n of names) {
    const nn = normalizeName(n);
    if (nn.startsWith(nq)) starts.push(n);
    else if (nn.includes(nq)) contains.push(n);
    if (starts.length >= 20) break;
  }
  return [...starts, ...contains].slice(0, 20);
}

const NO_LIMIT_THRESHOLD = BigInt("999999999");

function tryBigInt(s: string): bigint | null {
  if (!/^-?\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

export function isNoLimit(raw: string): boolean {
  const b = tryBigInt(raw);
  if (b === null) return false;
  return b >= NO_LIMIT_THRESHOLD;
}

export function formatBigNumber(raw: string): string {
  const b = tryBigInt(raw);
  if (b === null) {
    const f = parseFloat(raw);
    if (Number.isFinite(f)) return f.toLocaleString("id-ID");
    return raw;
  }
  return b.toLocaleString("id-ID");
}

export function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day} ${mon} ${yr}`;
}

export function formatBool(raw: string): string {
  if (raw.toUpperCase() === "TRUE") return "Yes";
  if (raw.toUpperCase() === "FALSE") return "No";
  return raw;
}

export type FormattedValue = {
  display: string;
  raw: string | null;
  isNoLimit?: boolean;
  isUrl?: boolean;
};

export function formatField(field: string, raw: string | null): FormattedValue {
  if (raw === null || raw === "") return { display: "-", raw };

  if (DATE_FIELDS.has(field)) {
    return { display: formatDate(raw), raw };
  }
  if (BOOL_FIELDS.has(field)) {
    return { display: formatBool(raw), raw };
  }
  if (AMT_FIELDS.has(field)) {
    return {
      display: formatBigNumber(raw),
      raw,
      isNoLimit: isNoLimit(raw),
    };
  }
  if (/url$/i.test(field)) {
    return { display: raw, raw, isUrl: true };
  }
  return { display: raw, raw };
}

export function orderedFields(headers: string[]): Array<{
  title: string;
  fields: string[];
}> {
  const mapped = new Set<string>();
  const sections = SECTION_MAP.map((s) => {
    const present = s.fields.filter((f) => headers.includes(f));
    present.forEach((f) => mapped.add(f));
    return { title: s.title, fields: present };
  }).filter((s) => s.fields.length > 0);

  const extras = headers.filter((h) => !mapped.has(h));
  if (extras.length > 0) sections.push({ title: "Lainnya", fields: extras });
  return sections;
}

export function diffFields(
  asal: AssetFundRow,
  tujuan: AssetFundRow,
  fields: string[],
): Set<string> {
  const diff = new Set<string>();
  for (const f of fields) {
    const a = asal[f] ?? null;
    const t = tujuan[f] ?? null;
    if (a !== t) diff.add(f);
  }
  return diff;
}

export function rowSubtitle(row: AssetFundRow): string {
  const parts = [
    row["Avaloq Id"],
    row["UT Code"],
    row["Internal Id"],
  ].filter(Boolean);
  return parts.join(" · ");
}
