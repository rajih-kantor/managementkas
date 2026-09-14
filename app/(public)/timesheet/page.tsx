"use client";
import { useState, FormEvent } from "react";
import { FileUp, Loader2, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TimesheetPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name_project: "",
    unit_divisi: "",
    name: "",
    mii_id: "",
    site: "",
    project_name: "",
    sign_date: "",
  });
  const [html, setHtml] = useState<File | null>(null);
  const [excel, setExcel] = useState<File | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!html || !excel) {
      setError("File HTML & Excel wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("html", html);
      fd.append("excel", excel);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_TIMESHEET_API_URL}/fill`,
        {
          method: "POST",
          body: fd,
        },
      );
      console.log(res);
      if (!res.ok) throw new Error(`Gagal generate (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheet-${form.name}-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const fields: [keyof typeof form, string, string][] = [
    ["name_project", "Nama Project", "Maverick"],
    ["unit_divisi", "Unit/Divisi", "Retail Digital Delivery"],
    ["name", "Nama Lengkap", "Nama Lengkap"],
    ["mii_id", "MII ID", "10000000"],
    ["site", "Site", "Maverick"],
    ["project_name", "Project Name", "MMP2 R6"],
    ["sign_date", "Tanggal TTD", "04 September 2026"],
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-6">Generate Timesheet</h1>
        <form
          onSubmit={onSubmit}
          className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-800"
        >
          <FileInput
            label="File HTML"
            onChange={setHtml}
            accept=".html"
            file={html}
          />
          <FileInput
            label="File Excel"
            onChange={setExcel}
            accept=".xlsx,.xls"
            file={excel}
          />
          {fields.map(([k, l, p]) => (
            <div key={k}>
              <label className="block text-sm mb-1 text-gray-300">{l}</label>
              <input
                required
                value={form[k]}
                onChange={set(k)}
                placeholder={p}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:border-gray-500 outline-none"
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded py-2 flex items-center justify-center gap-2 font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate & Download
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function FileInput({
  label,
  onChange,
  accept,
  file,
}: {
  label: string;
  onChange: (f: File | null) => void;
  accept: string;
  file: File | null;
}) {
  return (
    <div>
      <label className="block text-sm mb-1 text-gray-300">{label}</label>
      <label className="flex items-center gap-2 bg-gray-800 border border-gray-700 border-dashed rounded px-3 py-2 cursor-pointer hover:border-gray-500">
        <FileUp className="w-4 h-4" />
        <span className="text-sm text-gray-400">
          {file?.name || `Pilih ${label}`}
        </span>
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="hidden"
        />
      </label>
    </div>
  );
}
