export type DelimitedParseResult = {
  headers: string[];
  rows: (string | null)[][];
  warnings: string[];
  delimiter: Delimiter;
};

export type Delimiter = "," | "|" | "\t";

export type ParseDelimitedOptions = {
  delimiter?: Delimiter | "auto";
  useQuotes?: boolean | "auto";
};

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function firstLine(text: string): string {
  const nl = text.indexOf("\n");
  return (nl === -1 ? text : text.slice(0, nl)).replace(/\r$/, "");
}

function detectDelimiter(line: string): Delimiter {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  const pipe = (line.match(/\|/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;

  const max = Math.max(comma, pipe, tab);
  if (max === 0) {
    if (semi > 0) {
      throw new Error(
        "Pemisah tidak didukung, gunakan koma, pipe (|), atau tab",
      );
    }
    throw new Error("Tidak dapat mendeteksi pemisah kolom");
  }

  if (semi > max) {
    throw new Error(
      "Pemisah tidak didukung, gunakan koma, pipe (|), atau tab",
    );
  }

  if (pipe === max) return "|";
  if (tab === max) return "\t";
  return ",";
}

function splitWithQuotes(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

function splitPlain(text: string, delim: string): string[][] {
  const out: string[][] = [];
  const lines = text.split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (line === "") continue;
    out.push(line.split(delim));
  }
  return out;
}

export function parseDelimited(
  raw: string,
  opts: ParseDelimitedOptions = {},
): DelimitedParseResult {
  const text = stripBom(raw);
  const head = firstLine(text);

  const delimiter: Delimiter =
    opts.delimiter && opts.delimiter !== "auto"
      ? opts.delimiter
      : detectDelimiter(head);

  const useQuotes =
    opts.useQuotes === undefined || opts.useQuotes === "auto"
      ? delimiter === ","
      : opts.useQuotes;

  const grid = (useQuotes
    ? splitWithQuotes(text, delimiter)
    : splitPlain(text, delimiter)
  ).filter((r) => !(r.length === 1 && r[0] === ""));

  if (grid.length === 0) throw new Error("File kosong");

  const headers = grid[0].map((h) => h.trim());
  if (headers.filter(Boolean).length === 0) {
    throw new Error("Baris header kosong");
  }

  const seen = new Set<string>();
  for (const h of headers) {
    if (!h) continue;
    if (seen.has(h)) throw new Error(`Header duplikat: "${h}"`);
    seen.add(h);
  }

  if (grid.length === 1) {
    throw new Error("File hanya berisi header, tidak ada baris data");
  }

  const warnings: string[] = [];
  const rows: (string | null)[][] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (row.length !== headers.length) {
      warnings.push(
        `Baris ${r + 1}: jumlah kolom tidak sesuai (${row.length} vs ${headers.length})`,
      );
      continue;
    }
    const cleaned = row.map((v) =>
      v === undefined || v === null || v === "" ? null : v,
    );
    const hasVal = cleaned.some((v) => v !== null);
    if (!hasVal) continue;
    rows.push(cleaned);
  }

  return { headers, rows, warnings, delimiter };
}

export function parseCsv(raw: string): DelimitedParseResult {
  return parseDelimited(raw, { delimiter: ",", useQuotes: true });
}
