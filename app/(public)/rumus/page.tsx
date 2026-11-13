"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Search,
  X,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Wallet,
  Calculator,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Receipt,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { parseFile } from "@/lib/asset-fund/parser";
import {
  buildIndex,
  lookupName,
  rowSubtitle,
  searchNames,
} from "@/lib/asset-fund/helpers";
import {
  clearRemote,
  loadRemote,
  saveRemote,
} from "@/lib/asset-fund/remote";
import type {
  AssetFundRow,
  StoredData,
} from "@/lib/asset-fund/types";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

function parseDecimal(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatDecimal(n: number, maxFrac = 4): string {
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

export default function RumusPage() {
  const [data, setData] = useState<StoredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [inputAsal, setInputAsal] = useState("");
  const [inputTujuan, setInputTujuan] = useState("");
  const [asalRow, setAsalRow] = useState<AssetFundRow | null>(null);
  const [tujuanRow, setTujuanRow] = useState<AssetFundRow | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ambiguous, setAmbiguous] = useState<{
    side: "asal" | "tujuan";
    rows: AssetFundRow[];
  } | null>(null);
  const [nabAsal, setNabAsal] = useState("");
  const [nabTujuan, setNabTujuan] = useState("");
  const [unitAsal, setUnitAsal] = useState("");
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");

  useEffect(() => {
    let active = true;
    loadRemote()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Gagal muat data";
        if (active) toast.error(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const index = useMemo(() => (data ? buildIndex(data.rows) : null), [data]);

  async function handleFile(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const parsed = await parseFile(file);
      await saveRemote(parsed);
      setData(parsed);
      setAsalRow(null);
      setTujuanRow(null);
      setInputAsal("");
      setInputTujuan("");
      const warnMsg =
        parsed.warnings.length > 0
          ? ` (${parsed.warnings.length} warning)`
          : "";
      toast.success(
        `${parsed.rows.length} produk berhasil dimuat & tersimpan${warnMsg}`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal parse file";
      setUploadErr(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleClear() {
    if (!confirm("Hapus data yang sudah diupload?")) return;
    try {
      await clearRemote();
      setData(null);
      setAsalRow(null);
      setTujuanRow(null);
      toast.success("Data dihapus");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal hapus";
      toast.error(msg);
    }
  }

  function doLookup() {
    if (!index || !data) {
      toast.error("Upload file dulu");
      return;
    }
    if (!inputAsal.trim() || !inputTujuan.trim()) {
      setLookupErr("Isi nama asal dan tujuan");
      return;
    }

    setLookupErr(null);
    setSuggestions([]);
    setAmbiguous(null);

    const a = lookupName(inputAsal, index, data.rows);
    const t = lookupName(inputTujuan, index, data.rows);

    if (a.type === "NOT_FOUND") {
      setLookupErr(`Produk asal "${inputAsal}" tidak ditemukan`);
      setSuggestions(a.suggestions);
      return;
    }
    if (t.type === "NOT_FOUND") {
      setLookupErr(`Produk tujuan "${inputTujuan}" tidak ditemukan`);
      setSuggestions(t.suggestions);
      return;
    }
    if (a.type === "AMBIGUOUS") {
      setAmbiguous({ side: "asal", rows: a.candidates });
      return;
    }
    if (t.type === "AMBIGUOUS") {
      setAsalRow(a.row);
      setAmbiguous({ side: "tujuan", rows: t.candidates });
      return;
    }

    setAsalRow(a.row);
    setTujuanRow(t.row);
    setNabAsal("");
    setNabTujuan("");
    setUnitAsal("");

    if (a.row === t.row) {
      toast.warning("Produk asal dan tujuan sama");
    }
  }

  const nabAsalNum = parseDecimal(nabAsal);
  const nabTujuanNum = parseDecimal(nabTujuan);
  const unitAsalNum = parseDecimal(unitAsal);
  const unitTujuanNum =
    nabAsalNum !== null && nabTujuanNum !== null && unitAsalNum !== null && nabTujuanNum > 0
      ? (unitAsalNum * nabAsalNum) / nabTujuanNum
      : null;
  const calcReady =
    nabAsalNum !== null &&
    nabAsalNum > 0 &&
    nabTujuanNum !== null &&
    nabTujuanNum > 0 &&
    unitAsalNum !== null &&
    unitAsalNum > 0;

  function pickAmbiguous(row: AssetFundRow) {
    if (!ambiguous) return;
    if (ambiguous.side === "asal") {
      setAsalRow(row);
      setAmbiguous(null);
      if (!tujuanRow && index && data) {
        const t = lookupName(inputTujuan, index, data.rows);
        if (t.type === "OK") setTujuanRow(t.row);
        else if (t.type === "AMBIGUOUS")
          setAmbiguous({ side: "tujuan", rows: t.candidates });
      }
    } else {
      setTujuanRow(row);
      setAmbiguous(null);
    }
  }

  return (
    <div className={`${poppins.className} min-h-screen bg-amber-50`}>
      <Toaster position="top-right" richColors />

      <nav className="sticky top-0 z-10 backdrop-blur-md bg-amber-50/80 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Kas Kantor</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white hover:bg-amber-100 text-gray-900 font-semibold px-4 py-2 rounded-full border-2 border-amber-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-4">
          <FileSpreadsheet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
          Asset Fund Lookup
        </h1>
        <p className="text-gray-600">
          Upload Excel ODS Asset Fund, bandingkan produk asal & tujuan
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-10">
        {loading && (
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600 bg-white border-2 border-amber-200 rounded-2xl p-4">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            Memuat data dari server...
          </div>
        )}
        <UploadBlock
          data={data}
          uploading={uploading}
          dragOver={dragOver}
          error={uploadErr}
          onFile={handleFile}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClear={handleClear}
        />
      </section>

      {data && (
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <LookupBlock
            rows={data.rows}
            inputAsal={inputAsal}
            inputTujuan={inputTujuan}
            setInputAsal={setInputAsal}
            setInputTujuan={setInputTujuan}
            onSearch={doLookup}
            error={lookupErr}
            suggestions={suggestions}
            onPickSuggestion={(name, side) => {
              if (side === "asal") setInputAsal(name);
              else setInputTujuan(name);
              setSuggestions([]);
            }}
          />

          {ambiguous && (
            <AmbiguousPicker
              side={ambiguous.side}
              rows={ambiguous.rows}
              onPick={pickAmbiguous}
              onCancel={() => setAmbiguous(null)}
            />
          )}
        </section>
      )}

      {asalRow && tujuanRow && data && (
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <CalcInputBlock
            asalName={asalRow["Name"] ?? "-"}
            tujuanName={tujuanRow["Name"] ?? "-"}
            minBalAfterRaw={asalRow["Switch - MB - Min Balance After Trade"] ?? null}
            nabAsal={nabAsal}
            nabTujuan={nabTujuan}
            unitAsal={unitAsal}
            setNabAsal={setNabAsal}
            setNabTujuan={setNabTujuan}
            setUnitAsal={setUnitAsal}
            unitTujuanNum={unitTujuanNum}
            calcReady={calcReady}
          />
        </section>
      )}

      {asalRow && tujuanRow && data && calcReady && (
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <ResultsBlock
            asal={asalRow}
            tujuan={tujuanRow}
            nabAsal={nabAsalNum!}
            nabTujuan={nabTujuanNum!}
            unitAsal={unitAsalNum!}
            unitTujuan={unitTujuanNum!}
            currency={currency}
            setCurrency={setCurrency}
          />
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <ConfirmationCalc
          currency={currency}
          setCurrency={setCurrency}
        />
      </section>

      <footer className="border-t border-amber-200 py-6 text-center text-xs text-gray-500">
        Dikelola dengan ❤️ oleh Bendahara Kas Kantor
      </footer>
    </div>
  );
}

/* ---------- Upload ---------- */

function UploadBlock({
  data,
  uploading,
  dragOver,
  error,
  onFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
}: {
  data: StoredData | null;
  uploading: boolean;
  dragOver: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg text-gray-900">
            Upload .xlsx, .csv, atau .txt
          </h2>
          <p className="text-sm text-gray-500">
            File ODS Asset Fund (maks 10 MB)
          </p>
        </div>
        {data && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-semibold"
          >
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
        )}
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition ${
          dragOver
            ? "border-amber-500 bg-amber-50"
            : "border-amber-300 hover:border-amber-400 hover:bg-amber-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center text-amber-700">
            <Loader2 className="w-10 h-10 animate-spin mb-2" />
            <div className="font-semibold">Memproses file…</div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-600">
            <Upload className="w-10 h-10 mb-2 text-amber-500" />
            <div className="font-semibold text-gray-900">
              Drag & drop atau klik untuk pilih file
            </div>
            <div className="text-xs mt-1">
              .xlsx, .csv, atau .txt — upload baru menimpa data lama
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-2">
                <span className="truncate">{data.fileName}</span>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-green-200 text-green-900 text-[10px] font-bold uppercase tracking-wide">
                  {data.sourceType}
                </span>
              </div>
              <div className="text-xs text-green-700">
                {data.rows.length} produk ·{" "}
                {data.delimiter
                  ? `delimiter "${
                      data.delimiter === "\t" ? "\\t" : data.delimiter
                    }" · `
                  : ""}
                {data.warnings.length > 0
                  ? `${data.warnings.length} warning · `
                  : ""}
                diupload {new Date(data.uploadedAt).toLocaleString("id-ID")}
              </div>
            </div>
            <button
              onClick={() => downloadStoredXlsx(data)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white hover:bg-green-100 border-2 border-green-300 text-green-900 text-sm font-semibold transition"
              title="Download ulang file sebagai .xlsx (dari data tersimpan)"
            >
              <Download className="w-4 h-4" /> Download
            </button>
          </div>

          {data.warnings.length > 0 && (
            <details className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <summary className="cursor-pointer px-3 py-2 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {data.warnings.length} warning saat parsing
              </summary>
              <ul className="px-4 pb-3 pt-1 space-y-1 text-xs list-disc list-inside max-h-48 overflow-y-auto">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

async function downloadStoredXlsx(data: StoredData) {
  try {
    const XLSX: typeof import("xlsx") = await import("xlsx");
    const grid: (string | null)[][] = [
      data.headers,
      ...data.rows.map((r) => data.headers.map((h) => r[h] ?? null)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(grid);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asset Fund");
    const name = /\.xlsx$/i.test(data.fileName)
      ? data.fileName
      : `${data.fileName}.xlsx`;
    XLSX.writeFile(wb, name);
    toast.success("File didownload");
  } catch (e) {
    console.error("download error:", e);
    toast.error("Gagal download file");
  }
}

/* ---------- Lookup ---------- */

function LookupBlock({
  rows,
  inputAsal,
  inputTujuan,
  setInputAsal,
  setInputTujuan,
  onSearch,
  error,
  suggestions,
  onPickSuggestion,
}: {
  rows: AssetFundRow[];
  inputAsal: string;
  inputTujuan: string;
  setInputAsal: (s: string) => void;
  setInputTujuan: (s: string) => void;
  onSearch: () => void;
  error: string | null;
  suggestions: string[];
  onPickSuggestion: (name: string, side: "asal" | "tujuan") => void;
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6">
      <h2 className="font-bold text-lg text-gray-900 mb-4">
        Pilih Produk Asal & Tujuan
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Combobox
          label="Nama Produk Asal"
          value={inputAsal}
          onChange={setInputAsal}
          rows={rows}
          onEnter={onSearch}
        />
        <Combobox
          label="Nama Produk Tujuan"
          value={inputTujuan}
          onChange={setInputTujuan}
          rows={rows}
          onEnter={onSearch}
        />
      </div>

      <button
        onClick={onSearch}
        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-3 rounded-full transition shadow-md"
      >
        <Search className="w-5 h-5" /> Cari & Bandingkan
      </button>

      {error && (
        <div className="mt-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-2 text-sm">
              <div className="text-gray-600 mb-1">Mungkin maksud kamu:</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      const side = error?.toLowerCase().includes("asal")
                        ? "asal"
                        : "tujuan";
                      onPickSuggestion(s, side);
                    }}
                    className="px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold border border-amber-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Combobox({
  label,
  value,
  onChange,
  rows,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  rows: AssetFundRow[];
  onEnter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => (open ? searchNames(value, rows) : []),
    [open, value, rows],
  );

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setOpen(false);
            onEnter();
          }
        }}
        placeholder="Ketik nama produk…"
        className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-200 bg-white text-gray-900 focus:outline-none focus:border-amber-400"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white rounded-xl border-2 border-amber-200 shadow-xl">
          {options.map((o) => (
            <li
              key={o}
              onMouseDown={() => {
                onChange(o);
                setOpen(false);
              }}
              className="px-4 py-2 hover:bg-amber-50 cursor-pointer text-sm text-gray-800"
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AmbiguousPicker({
  side,
  rows,
  onPick,
  onCancel,
}: {
  side: "asal" | "tujuan";
  rows: AssetFundRow[];
  onPick: (r: AssetFundRow) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 bg-white rounded-3xl border-2 border-orange-300 shadow-lg p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">
          Nama {side} cocok ke beberapa produk — pilih satu
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i}>
            <button
              onClick={() => onPick(r)}
              className="w-full text-left p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
            >
              <div className="font-semibold text-gray-900">{r["Name"]}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {rowSubtitle(r) || "—"}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Calc Input ---------- */

function CalcInputBlock({
  asalName,
  tujuanName,
  minBalAfterRaw,
  nabAsal,
  nabTujuan,
  unitAsal,
  setNabAsal,
  setNabTujuan,
  setUnitAsal,
  unitTujuanNum,
  calcReady,
}: {
  asalName: string;
  tujuanName: string;
  minBalAfterRaw: string | null;
  nabAsal: string;
  nabTujuan: string;
  unitAsal: string;
  setNabAsal: (s: string) => void;
  setNabTujuan: (s: string) => void;
  setUnitAsal: (s: string) => void;
  unitTujuanNum: number | null;
  calcReady: boolean;
}) {
  const minBalAfter = toNum(minBalAfterRaw);
  const cannotSwitch = minBalAfter === null || minBalAfter === 0;
  const sanitize = (v: string) => {
    const cleaned = v.replace(/[^0-9.,]/g, "");
    const firstComma = cleaned.indexOf(",");
    if (firstComma === -1) return cleaned;
    return (
      cleaned.slice(0, firstComma + 1) +
      cleaned.slice(firstComma + 1).replace(/,/g, "")
    );
  };

  return (
    <div className="mt-4 bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6">
      {cannotSwitch && (
        <div className="mb-5 p-5 rounded-2xl bg-red-50 border-2 border-red-400 flex items-start gap-3">
          <AlertTriangle className="w-7 h-7 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-black text-red-900 text-lg">
              ⚠️ Tidak Boleh Switch — Harus Ganti Produk
            </div>
            <div className="text-sm text-red-800 mt-1">
              Karena <strong>Min After Switch Unit</strong>{" "}
              {minBalAfter === null ? "null (kosong)" : "0 (nol)"} — switching
              tidak bisa divalidasi. Silakan pilih produk asal lain.
            </div>
            <div className="text-[11px] text-red-700/80 mt-1 font-mono">
              sumber: Switch - MB - Min Balance After Trade ={" "}
              {minBalAfterRaw ?? "null"}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-gray-900">Input Perhitungan</h2>
          <p className="text-sm text-gray-500">
            Isi NAB & Unit Portofolio, Unit Tujuan dihitung otomatis
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <DecimalField
          label="NAB Produk Asal"
          sublabel={asalName}
          value={nabAsal}
          onChange={(v) => setNabAsal(sanitize(v))}
          placeholder="mis. 1.234,56"
          tooltip="Cek di page detail portofolio, nominal pojok kanan atas"
        />
        <DecimalField
          label="NAB Produk Tujuan"
          sublabel={tujuanName}
          value={nabTujuan}
          onChange={(v) => setNabTujuan(sanitize(v))}
          placeholder="mis. 2.000,00"
          tooltip="Cek di page detail portofolio, nominal pojok kanan atas"
        />
        <DecimalField
          label="Unit Portofolio Asal"
          sublabel={asalName}
          value={unitAsal}
          onChange={(v) => setUnitAsal(sanitize(v))}
          placeholder="mis. 100,5"
        />
      </div>

      <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <div className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
                Unit Portofolio Tujuan (otomatis)
              </div>
              <InfoTip
                text={`Rumus switching standar:\n(Unit Porto Asal × NAB Asal) ÷ NAB Tujuan\n\nSemua dari input user.`}
              />
            </div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">
              = (Unit Asal × NAB Asal) ÷ NAB Tujuan
            </div>
          </div>
          <div className="font-mono tabular-nums font-black text-2xl text-amber-900">
            {unitTujuanNum !== null ? formatDecimal(unitTujuanNum) : "—"}
          </div>
        </div>
      </div>

      {!calcReady && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          Isi semua field di atas (nilai &gt; 0) untuk menampilkan perbandingan
          lengkap.
        </p>
      )}
    </div>
  );
}

function DecimalField({
  label,
  sublabel,
  value,
  onChange,
  placeholder,
  tooltip,
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tooltip?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
        {tooltip && (
          <span className="relative group inline-flex">
            <Info
              className="w-3.5 h-3.5 text-amber-500 cursor-help"
              aria-label={tooltip}
            />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs font-normal px-3 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            >
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
            </span>
          </span>
        )}
      </div>
      {sublabel && (
        <div
          className="text-[11px] text-gray-500 mb-1.5 truncate"
          title={sublabel}
        >
          {sublabel}
        </div>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={tooltip}
        className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-200 bg-white text-gray-900 font-mono tabular-nums focus:outline-none focus:border-amber-400"
      />
    </div>
  );
}

/* ---------- Results (Switching Calculation) ---------- */

function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function ResultsBlock({
  asal,
  tujuan,
  nabAsal,
  nabTujuan,
  unitAsal,
  unitTujuan,
  currency,
  setCurrency,
}: {
  asal: AssetFundRow;
  tujuan: AssetFundRow;
  nabAsal: number;
  nabTujuan: number;
  unitAsal: number;
  unitTujuan: number;
  currency: "IDR" | "USD";
  setCurrency: (c: "IDR" | "USD") => void;
}) {
  const minQtyAsal = toNum(asal["Switch - MB - Min Qty"]);
  const minAmtAsal = toNum(asal["Switch - MB - Min Amt"]);
  const minAmtTujuan = toNum(tujuan["Subscription - MB - Min Amt"]);
  const minBalAfter = toNum(asal["Switch - MB - Min Balance After Trade"]);
  const maxHolding = toNum(tujuan["Max Holding (Amt/Unit)"]);

  const minUnitAsalNominal =
    minQtyAsal !== null ? minQtyAsal * nabAsal : null;

  const amountPorto = unitAsal * nabAsal;
  const maxEligibleUnit =
    minBalAfter !== null ? Math.max(unitAsal - minBalAfter, 0) : null;
  const minAfterSwitchNominal =
    minBalAfter !== null ? minBalAfter * nabAsal : null;
  const maxEligibleAmount =
    minAfterSwitchNominal !== null
      ? Math.max(amountPorto - minAfterSwitchNominal, 0)
      : null;

  const cand: Array<{ label: string; unit: number; amount: number }> = [];
  if (minQtyAsal !== null) {
    cand.push({
      label: "Min Unit Asal",
      unit: minQtyAsal,
      amount: minQtyAsal * nabAsal,
    });
  }
  if (minAmtAsal !== null) {
    cand.push({
      label: "Min Amount Asal",
      unit: minAmtAsal / nabAsal,
      amount: minAmtAsal,
    });
  }
  if (minAmtTujuan !== null) {
    cand.push({
      label: "Min Amount Tujuan",
      unit: minAmtTujuan / nabAsal,
      amount: minAmtTujuan,
    });
  }
  const highest = cand.length
    ? cand.reduce((a, b) => (a.amount > b.amount ? a : b))
    : null;

  const check2OK =
    maxEligibleUnit !== null && highest !== null
      ? maxEligibleUnit >= highest.unit
      : null;
  const check3OK =
    maxEligibleUnit !== null ? maxEligibleUnit <= unitAsal : null;
  const check4OK = maxHolding !== null ? maxHolding >= unitAsal : null;

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="font-bold text-lg text-gray-900">
            Hasil Perhitungan Switching
          </h2>
          <p className="text-sm text-gray-500">
            Berdasarkan data table + input kalkulasi
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {(minBalAfter === null || minBalAfter === 0) && (
        <div className="mb-5 p-5 rounded-2xl bg-red-50 border-2 border-red-400 flex items-start gap-3">
          <AlertTriangle className="w-7 h-7 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-red-900 text-lg">
              ⚠️ Tidak Boleh Switch — Harus Ganti Produk
            </div>
            <div className="text-sm text-red-800 mt-1">
              Karena <strong>Min After Switch Unit</strong>{" "}
              {minBalAfter === null ? "null (kosong)" : "0 (nol)"} — switching
              tidak bisa divalidasi.
            </div>
            <div className="text-[11px] text-red-700/80 mt-1 font-mono">
              sumber: Switch - MB - Min Balance After Trade
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <ResultCard title="Asal" subtitle={asal["Name"] ?? "-"} tone="amber">
          <Row
            label="Min. Unit"
            formula={`${fmtNum(minQtyAsal)} × ${fmtNum(nabAsal)}`}
            value={fmtMoney(minUnitAsalNominal, currency)}
            tooltip={`Rumus:\nSwitch - MB - Min Qty (table)\n× NAB Asal (input user)\n\n= ${fmtNum(minQtyAsal)} × ${fmtNum(nabAsal)}\n= ${fmtMoney(minUnitAsalNominal, currency)}`}
          />
          <Row
            label="Min. Amount"
            formula="Switch - MB - Min Amt"
            value={fmtMoney(minAmtAsal, currency)}
            tooltip={`Sumber: kolom table\nSwitch - MB - Min Amt (asal)\n\nNilai mentah: ${fmtNum(minAmtAsal)}`}
          />
        </ResultCard>
        <ResultCard title="Tujuan" subtitle={tujuan["Name"] ?? "-"} tone="amber">
          <Row
            label="Min. Unit"
            formula="—"
            value="null"
            dim
            tooltip="Tujuan tidak punya field Min Unit (sesuai spec)"
          />
          <Row
            label="Min. Amount"
            formula="Subscription - MB - Min Amt"
            value={fmtMoney(minAmtTujuan, currency)}
            tooltip={`Sumber: kolom table\nSubscription - MB - Min Amt (tujuan)\n\nNilai mentah: ${fmtNum(minAmtTujuan)}`}
          />
        </ResultCard>
      </div>

      <div className="mb-5">
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-600" /> Validate
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Row
            label="Min After Switch Unit"
            formula="Switch - MB - Min Balance After Trade"
            value={fmtNum(minBalAfter)}
            block
            tooltip={`Sumber: kolom table\nSwitch - MB - Min Balance After Trade (asal)\n\nMinimum unit yang harus tersisa setelah switch`}
          />
          <Row
            label="Max Eligible (Unit)"
            formula={`${fmtNum(unitAsal)} − ${fmtNum(minBalAfter)}`}
            value={`${fmtNum(maxEligibleUnit)} Unit`}
            block
            tooltip={`Rumus:\nUnit Porto Asal (input user)\n− Min After Switch Unit (table)\n\n= ${fmtNum(unitAsal)} − ${fmtNum(minBalAfter)}\n= ${fmtNum(maxEligibleUnit)} Unit`}
          />
          <Row
            label="Min After Switch Nominal"
            formula={`${fmtNum(minBalAfter)} × ${fmtNum(nabAsal)}`}
            value={fmtMoney(minAfterSwitchNominal, currency)}
            block
            tooltip={`Rumus:\nMin After Switch Unit (table)\n× NAB Asal (input user)\n\n= ${fmtNum(minBalAfter)} × ${fmtNum(nabAsal)}\n= ${fmtMoney(minAfterSwitchNominal, currency)}`}
          />
          <Row
            label="Max Eligible Amount"
            formula={`(${fmtNum(unitAsal)} × ${fmtNum(nabAsal)}) − ${fmtNum(minAfterSwitchNominal)}`}
            value={fmtMoney(maxEligibleAmount, currency)}
            block
            tooltip={`Rumus:\n(Unit Porto × NAB Asal)\n− Min After Switch Nominal\n\n= (${fmtNum(unitAsal)} × ${fmtNum(nabAsal)}) − ${fmtNum(minAfterSwitchNominal)}\n= ${fmtMoney(maxEligibleAmount, currency)}`}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 p-5">
        <h3 className="font-black text-gray-900 mb-3 text-lg">
          Hasil Keseluruhan
        </h3>
        <div className="space-y-3">
          <CheckRow
            no={1}
            label="Min Unit (tertinggi dari semua min)"
            description="Expected: inline error min switch"
            value={
              highest
                ? `${fmtNum(highest.unit)} Unit  ·  ${fmtMoney(highest.amount, currency)}  (${highest.label})`
                : "—"
            }
            tooltip={`Rumus: ambil max dari kandidat (konversi ke unit via NAB Asal)\n\nKandidat:\n${cand
              .map(
                (c) =>
                  `• ${c.label}: ${fmtNum(c.unit)} Unit / ${fmtMoney(c.amount, currency)}`,
              )
              .join("\n")}\n\nSumber:\n• Min Unit Asal = Switch - MB - Min Qty (table)\n• Min Amount Asal = Switch - MB - Min Amt (table) ÷ NAB Asal\n• Min Amount Tujuan = Subscription - MB - Min Amt (table) ÷ NAB Asal`}
          />
          <CheckRow
            no={2}
            label="Max Eligible ≥ Min Unit?"
            description="Aman"
            value={
              maxEligibleUnit !== null && highest
                ? `${fmtNum(maxEligibleUnit)} / ${fmtNum(highest.unit)} Unit`
                : "—"
            }
            ok={check2OK}
            tooltip={`Bandingkan:\nMax Eligible Unit (hasil Validate) ≥ Min Unit (Pengecekan #1)\n\n= ${fmtNum(maxEligibleUnit)} ≥ ${fmtNum(highest?.unit ?? null)}\n= ${check2OK ? "OK" : "NOT OK"}`}
          />
          <CheckRow
            no={3}
            label="Unit Min After Switch ≤ Unit Porto"
            description="Inline error unit after switch"
            value={
              maxEligibleUnit !== null
                ? `${fmtNum(maxEligibleUnit)} → ${fmtNum(unitAsal)} Unit`
                : "—"
            }
            ok={check3OK}
            tooltip={`Bandingkan:\nMax Eligible Unit ≤ Unit Porto Asal (input)\n\n= ${fmtNum(maxEligibleUnit)} ≤ ${fmtNum(unitAsal)}\n= ${check3OK ? "OK" : "NOT OK"}`}
          />
          <CheckRow
            no={4}
            label="Max Holding Tujuan ≥ Unit Porto Asal"
            description="Auto switch all"
            value={
              maxHolding !== null
                ? `${fmtNum(unitAsal)} Unit`
                : "Max Holding tujuan tidak ada"
            }
            ok={check4OK}
            tooltip={`Sumber:\n• Max Holding = Max Holding (Amt/Unit) tujuan (table)\n• Unit Porto Asal (input user)\n\nBandingkan: ${fmtNum(maxHolding)} ≥ ${fmtNum(unitAsal)}\n= ${check4OK ? "OK" : "NOT OK"}`}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-red-50 border-2 border-red-300 p-5">
        <h3 className="font-black text-red-900 mb-1 text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Screen Detail Product Overlay Error
        </h3>
        <p className="text-xs text-red-800/80 mb-3">
          Nilai yang ditampilkan di overlay error pada screen detail product
        </p>
        <div className="p-4 rounded-xl bg-white border border-red-200">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Minimum Amount
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                diambil dari Min Unit (tertinggi dari semua min)
              </div>
            </div>
            <div className="font-mono tabular-nums font-black text-xl text-red-700">
              {highest ? fmtMoney(highest.amount, currency) : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Confirmation Calc (standalone) ---------- */

function ConfirmationCalc({
  currency,
  setCurrency,
}: {
  currency: "IDR" | "USD";
  setCurrency: (c: "IDR" | "USD") => void;
}) {
  const [estValue, setEstValue] = useState("");
  const [fee, setFee] = useState("");

  const sanitize = (v: string) => {
    const cleaned = v.replace(/[^0-9.,]/g, "");
    const firstComma = cleaned.indexOf(",");
    if (firstComma === -1) return cleaned;
    return (
      cleaned.slice(0, firstComma + 1) +
      cleaned.slice(firstComma + 1).replace(/,/g, "")
    );
  };

  const estNum = parseDecimal(estValue);
  const feeNum = parseDecimal(fee);
  const feePct = feeNum !== null ? feeNum / 100 : null;

  const A = estNum !== null && feePct !== null ? estNum * feePct : null;
  const B = estNum !== null && A !== null ? estNum - A : null;

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-gray-900">
              Value Confirmation Page
            </h2>
            <p className="text-sm text-gray-500">
              Perhitungan independen — nggak perlu pilih produk dulu
            </p>
          </div>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <DecimalField
          label={`Estimated Switch Value (${currency})`}
          value={estValue}
          onChange={(v) => setEstValue(sanitize(v))}
          placeholder="mis. 10.000.000"
        />
        <DecimalField
          label="Switching Fee (%)"
          value={fee}
          onChange={(v) => setFee(sanitize(v))}
          placeholder="mis. 0,0055"
        />
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-semibold text-gray-900">
                  A — Biaya Switching
                </div>
                <InfoTip
                  text={`Rumus:\nEstimated Switch Value (input) × Switching Fee % (input) ÷ 100\n\n= ${fmtNum(estNum)} × ${fee || "0"}%\n= ${fmtMoney(A, currency)}`}
                />
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                = Estimated Switch Value × Switching Fee
              </div>
              <div className="text-[11px] text-gray-500 font-mono">
                = {fmtNum(estNum)} × {fee || "0"}%
              </div>
            </div>
            <div className="font-mono tabular-nums font-bold text-lg text-amber-900">
              {fmtMoney(A, currency)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-semibold text-gray-900">
                  B — Hasil Sesungguhnya
                </div>
                <InfoTip
                  text={`Rumus:\nEstimated Switch Value (input) − A (biaya switching)\n\n= ${fmtNum(estNum)} − ${fmtNum(A)}\n= ${fmtMoney(B, currency)}`}
                />
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                = Estimated Switch Value − A
              </div>
              <div className="text-[11px] text-gray-500 font-mono">
                = {fmtNum(estNum)} − {fmtNum(A)}
              </div>
            </div>
            <div className="font-mono tabular-nums font-black text-2xl text-amber-900">
              {fmtMoney(B, currency)}
            </div>
          </div>
        </div>
      </div>

      {(estNum === null || feeNum === null) && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          Isi kedua field untuk melihat hasil
        </p>
      )}
    </div>
  );
}

function CurrencyToggle({
  value,
  onChange,
}: {
  value: "IDR" | "USD";
  onChange: (c: "IDR" | "USD") => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-amber-100 p-1 border border-amber-200">
      {(["IDR", "USD"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
            value === c
              ? "bg-amber-500 text-white shadow"
              : "text-amber-800 hover:text-amber-900"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function ResultCard({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  tone: "amber";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-white p-4">
      <div className="mb-3">
        <div
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-900`}
        >
          {title}
        </div>
        <div
          className="font-semibold text-gray-900 mt-1.5 truncate"
          title={subtitle}
        >
          {subtitle}
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  formula,
  value,
  dim,
  block,
  tooltip,
}: {
  label: string;
  formula?: string;
  value: string;
  dim?: boolean;
  block?: boolean;
  tooltip?: string;
}) {
  return (
    <div
      className={`${block ? "p-3 rounded-xl border border-amber-100 bg-amber-50/40" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-semibold text-gray-800">{label}</div>
          {tooltip && <InfoTip text={tooltip} />}
        </div>
        <div
          className={`font-mono tabular-nums font-bold ${
            dim ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {value}
        </div>
      </div>
      {formula && (
        <div className="text-[11px] text-gray-500 font-mono mt-0.5">
          = {formula}
        </div>
      )}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <Info
        className="w-3.5 h-3.5 text-amber-500 cursor-help"
        aria-label={text}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-64 rounded-lg bg-gray-900 text-white text-[11px] font-normal px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity whitespace-pre-line text-left font-mono leading-relaxed"
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
      </span>
    </span>
  );
}

function CheckRow({
  no,
  label,
  description,
  value,
  ok,
  detail,
  tooltip,
}: {
  no: number;
  label: string;
  description?: string;
  value: string;
  ok?: boolean | null;
  detail?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-amber-200">
      <div className="w-7 h-7 shrink-0 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
        {no}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-sm font-semibold text-gray-900">{label}</div>
              {tooltip && <InfoTip text={tooltip} />}
            </div>
            {description && (
              <div className="text-xs text-amber-800 mt-0.5 italic">
                {description}
              </div>
            )}
          </div>
          <div className="font-mono tabular-nums text-sm text-gray-900">
            {value}
          </div>
        </div>
        {detail && (
          <div className="text-[11px] text-gray-500 mt-1 font-mono break-words">
            {detail}
          </div>
        )}
      </div>
      {ok === true && (
        <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
      )}
      {ok === false && (
        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      )}
    </div>
  );
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function fmtMoney(n: number | null, ccy: "IDR" | "USD"): string {
  if (n === null) return "—";
  return `${fmtNum(n)} ${ccy}`;
}


