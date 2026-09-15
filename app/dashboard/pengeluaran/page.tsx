"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Search,
  Upload,
  Trash2,
  Download,
  X,
  Loader2,
  ArrowUpCircle,
} from "lucide-react";

type Kategori = { id: string; nama: string };

type Pegawai = { id: string; nama: string; npp: string };
type Transaksi = {
  id: string;
  nominal: number;
  tanggal: string;
  periode: string;
  catatan: string | null;
  bukti_path: string | null;
  kategori: { nama: string } | null;
  pic: { nama: string } | null;
};

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const formatTgl = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function PengeluaranPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);

  const [form, setForm] = useState({
    kategori_id: "",
    nominal: "",
    tanggal: new Date().toISOString().split("T")[0],
    periode: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
    catatan: "",
    pic_pegawai_id: "",
    file: null as File | null,
  });

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transaksi")
      .select(
        `
        id, nominal, tanggal, periode, catatan, bukti_path,
        kategori:kategori_id (nama),
        pic:pic_pegawai_id (nama)
      `,
      )
      .eq("jenis", "pengeluaran")
      .order("tanggal", { ascending: false });

    if (error) console.error(error);
    // @ts-expect-error - supabase join type
    setRows(data ?? []);
    setLoading(false);
  }

  async function fetchKategori() {
    const { data } = await supabase
      .from("kategori")
      .select("id, nama")
      .eq("jenis", "pengeluaran")
      .order("nama");
    setKategoriList(data ?? []);
  }

  async function fetchPegawai() {
    const { data } = await supabase
      .from("pegawai")
      .select("id, nama, npp")
      .eq("aktif", true)
      .order("nama");
    setPegawaiList(data ?? []);
  }

  useEffect(() => {
    fetchData();
    fetchKategori();
    fetchPegawai();
  }, []);

  async function handleSubmit() {
    if (!form.kategori_id || !form.nominal || !form.tanggal) {
      alert("Kategori, nominal, dan tanggal wajib diisi");
      return;
    }
    if (!form.catatan.trim()) {
      alert("Catatan wajib diisi untuk pengeluaran (untuk audit)");
      return;
    }

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("Sesi habis, silakan login ulang");
      setSubmitting(false);
      return;
    }

    // Step 1: Insert
    const { data: inserted, error: insertErr } = await supabase
      .from("transaksi")
      .insert({
        jenis: "pengeluaran",
        kategori_id: form.kategori_id,
        pegawai_id: null,
        pic_pegawai_id: form.pic_pegawai_id || null,
        nominal: parseInt(form.nominal),
        tanggal: form.tanggal,
        periode: form.periode,
        catatan: form.catatan.trim(),
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertErr) {
      alert("Gagal menyimpan: " + insertErr.message);
      setSubmitting(false);
      return;
    }

    // Step 2: Upload bukti
    if (form.file && inserted) {
      const ext = form.file.name.split(".").pop();
      const path = `${inserted.id}/bukti.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("bukti-transaksi")
        .upload(path, form.file, { upsert: true });

      if (uploadErr) {
        alert("Data tersimpan, tapi upload bukti gagal: " + uploadErr.message);
      } else {
        await supabase
          .from("transaksi")
          .update({ bukti_path: path })
          .eq("id", inserted.id);
      }
    }

    setForm({
      kategori_id: "",
      nominal: "",
      tanggal: new Date().toISOString().split("T")[0],
      periode: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
      pic_pegawai_id: "",
      catatan: "",
      file: null,
    });
    setShowModal(false);
    setSubmitting(false);
    fetchData();
  }

  async function handleDelete(id: string, buktiPath: string | null) {
    if (!confirm("Hapus pengeluaran ini? Aksi tidak bisa dibatalkan.")) return;

    if (buktiPath) {
      await supabase.storage.from("bukti-transaksi").remove([buktiPath]);
    }
    const { error } = await supabase.from("transaksi").delete().eq("id", id);
    if (error) return alert("Gagal menghapus: " + error.message);
    fetchData();
  }

  async function handleDownloadBukti(path: string) {
    const { data, error } = await supabase.storage
      .from("bukti-transaksi")
      .createSignedUrl(path, 60);
    if (error) return alert("Gagal mengambil bukti");
    window.open(data.signedUrl, "_blank");
  }

  // Filter
  const filtered = rows.filter((r) => {
    const matchSearch =
      (r.pic?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.kategori?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.catatan ?? "").toLowerCase().includes(search.toLowerCase());
    const matchKategori =
      !filterKategori || r.kategori?.nama === filterKategori;
    return matchSearch && matchKategori;
  });

  const totalPengeluaran = filtered.reduce((sum, r) => sum + r.nominal, 0);

  // Group by kategori untuk stats
  const kategoriStats = filtered.reduce(
    (acc, r) => {
      const k = r.kategori?.nama ?? "Tanpa Kategori";
      acc[k] = (acc[k] ?? 0) + r.nominal;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topKategori = Object.entries(kategoriStats).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6" />
            Pengeluaran
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Kelola seluruh transaksi pengeluaran kas
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={kategoriList.length === 0}
          className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-white disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengeluaran
        </button>
      </div>

      {/* Warning kalau belum ada kategori */}
      {kategoriList.length === 0 && !loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
          ⚠️ Belum ada kategori pengeluaran. Silakan seed kategori terlebih
          dahulu di database.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-400 mb-1">Total Pengeluaran</p>
          <p className="text-3xl font-bold text-white font-mono tabular-nums">
            {formatRp(totalPengeluaran)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {filtered.length} transaksi
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-400 mb-1">Rata-rata per Transaksi</p>
          <p className="text-3xl font-bold text-white font-mono tabular-nums">
            {filtered.length > 0
              ? formatRp(Math.round(totalPengeluaran / filtered.length))
              : "Rp 0"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-400 mb-1">Kategori Tertinggi</p>
          <p className="text-lg font-bold text-white truncate">
            {topKategori?.[0] ?? "-"}
          </p>
          <p className="text-xs text-gray-500 mt-2 font-mono tabular-nums">
            {topKategori ? formatRp(topKategori[1]) : "Rp 0"}
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Cari kategori, catatan, atau PIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
          />
        </div>
        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-600 min-w-[180px]"
        >
          <option value="">Semua Kategori</option>
          {kategoriList.map((k) => (
            <option key={k.id} value={k.nama}>
              {k.nama}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            {search || filterKategori
              ? "Pengeluaran tidak ditemukan"
              : "Belum ada data pengeluaran"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950/50 border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Tanggal</th>
                <th className="px-6 py-3 font-medium">Kategori</th>
                <th className="px-6 py-3 font-medium">Catatan</th>
                <th className="px-6 py-3 font-medium">PIC</th>
                <th className="px-6 py-3 font-medium text-right">Nominal</th>
                <th className="px-6 py-3 font-medium text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-300 font-mono text-xs">
                    {formatTgl(r.tanggal)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2.5 py-1 bg-gray-800 text-gray-200 rounded-md text-xs font-medium">
                      {r.kategori?.nama ?? "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 max-w-md">
                    <div className="truncate" title={r.catatan ?? ""}>
                      {r.catatan ?? "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {r.pic?.nama ? (
                      <span className="inline-block px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded text-xs">
                        {r.pic.nama}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-mono tabular-nums font-semibold">
                    − {formatRp(r.nominal)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      {r.bukti_path && (
                        <button
                          onClick={() => handleDownloadBukti(r.bukti_path!)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Lihat bukti"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id, r.bukti_path)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-rose-400 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Tambah */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                Tambah Pengeluaran
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Field label="Kategori *">
                <select
                  value={form.kategori_id}
                  onChange={(e) =>
                    setForm({ ...form, kategori_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Pilih kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="PIC / Ditalangi oleh">
                <PegawaiCombobox
                  list={pegawaiList}
                  value={form.pic_pegawai_id}
                  onChange={(id) => setForm({ ...form, pic_pegawai_id: id })}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Isi jika ada pegawai yang menalangi & perlu dibayar balik
                </p>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Tanggal *">
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) =>
                      setForm({ ...form, tanggal: e.target.value })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Periode *">
                  <input
                    type="month"
                    value={form.periode.slice(0, 7)}
                    onChange={(e) =>
                      setForm({ ...form, periode: e.target.value + "-01" })
                    }
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Nominal (Rp) *">
                <input
                  type="number"
                  placeholder="150000"
                  min="1"
                  value={form.nominal}
                  onChange={(e) =>
                    setForm({ ...form, nominal: e.target.value })
                  }
                  className="input"
                />
                {form.nominal && (
                  <p className="text-xs text-gray-500 mt-1.5 font-mono">
                    ≈ {formatRp(parseInt(form.nominal) || 0)}
                  </p>
                )}
              </Field>

              <Field label="Catatan / Keperluan *">
                <textarea
                  rows={3}
                  placeholder="Contoh: Beli konsumsi rapat mingguan tim"
                  value={form.catatan}
                  onChange={(e) =>
                    setForm({ ...form, catatan: e.target.value })
                  }
                  className="input resize-none"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Wajib diisi untuk keperluan audit
                </p>
              </Field>

              <Field label="Bukti Pengeluaran">
                <label className="flex items-center gap-2 border border-dashed border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-600 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400 flex-1 truncate">
                    {form.file?.name ?? "Pilih file (nota / kwitansi)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setForm({ ...form, file: e.target.files?.[0] ?? null })
                    }
                    className="hidden"
                  />
                </label>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white disabled:opacity-50 transition-colors"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function PegawaiCombobox({
  list,
  value,
  onChange,
}: {
  list: Pegawai[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = list.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (p) =>
          p.nama.toLowerCase().includes(q) || p.npp.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [query, list]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 input">
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-white placeholder:text-gray-500"
          placeholder={
            selected
              ? `${selected.nama} (${selected.npp})`
              : "Cari nama atau NPP..."
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {selected && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800"
            >
              -- Kas langsung (tidak ditalangi) --
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">
              Pegawai tidak ditemukan
            </li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-800 ${
                    p.id === value ? "bg-gray-800 text-white" : "text-gray-300"
                  }`}
                >
                  {p.nama}{" "}
                  <span className="text-xs text-gray-500">({p.npp})</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
