"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Search,
  Upload,
  Trash2,
  Download,
  X,
  Loader2,
  ArrowDownCircle,
  Image,
} from "lucide-react";

type Kategori = { id: string; nama: string };
type Pegawai = { id: string; nama: string };
type Transaksi = {
  id: string;
  nominal: number;
  tanggal: string;
  periode: string;
  catatan: string | null;
  bukti_path: string | null;
  kategori: { nama: string } | null;
  pegawai: { nama: string } | null;
};

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const formatTgl = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function PemasukanPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    kategori_id: "",
    pegawai_id: "",
    nominal: "",
    tanggal: new Date().toISOString().split("T")[0],
    periode: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
    catatan: "",
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch data
  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transaksi")
      .select(
        `
        id, nominal, tanggal, periode, catatan, bukti_path,
        kategori:kategori_id (nama),
        pegawai:pegawai_id (nama)
      `,
      )
      .eq("jenis", "pemasukan")
      .order("tanggal", { ascending: false });

    if (error) {
      console.error(error);
    }
    // @ts-expect-error - supabase join type
    setRows(data ?? []);
    setLoading(false);
  }

  async function fetchMasterData() {
    const [k, p] = await Promise.all([
      supabase.from("kategori").select("id, nama").eq("jenis", "pemasukan"),
      supabase.from("pegawai").select("id, nama").eq("aktif", true),
    ]);
    setKategoriList(k.data ?? []);
    setPegawaiList(p.data ?? []);
  }

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  // Submit new pemasukan
  async function handleSubmit() {
    if (!form.kategori_id || !form.nominal || !form.tanggal) {
      alert("Kategori, nominal, dan tanggal wajib diisi");
      return;
    }
    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("Sesi habis, silakan login ulang");
      setSubmitting(false);
      return;
    }

    // Step 1: Insert row
    const { data: inserted, error: insertErr } = await supabase
      .from("transaksi")
      .insert({
        jenis: "pemasukan",
        kategori_id: form.kategori_id,
        pegawai_id: form.pegawai_id || null,
        nominal: parseInt(form.nominal),
        tanggal: form.tanggal,
        periode: form.periode,
        catatan: form.catatan || null,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertErr) {
      alert("Gagal menyimpan: " + insertErr.message);
      setSubmitting(false);
      return;
    }

    // Step 2: Upload bukti (jika ada)
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

    // Reset & refresh
    setForm({
      kategori_id: "",
      pegawai_id: "",
      nominal: "",
      tanggal: new Date().toISOString().split("T")[0],
      periode: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
      catatan: "",
      file: null,
    });
    setShowModal(false);
    setSubmitting(false);
    fetchData();
  }

  async function handleDelete(id: string, buktiPath: string | null) {
    if (!confirm("Hapus transaksi ini? Aksi tidak bisa dibatalkan.")) return;

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
  const filtered = rows.filter(
    (r) =>
      (r.kategori?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.pegawai?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.catatan ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalPemasukan = filtered.reduce((sum, r) => sum + r.nominal, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6" />
            Pemasukan
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Kelola seluruh transaksi pemasukan kas
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Pemasukan
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-xs text-gray-400 mb-1">Total Pemasukan (Filter)</p>
        <p className="text-3xl font-bold text-white font-mono tabular-nums">
          {formatRp(totalPemasukan)}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          {filtered.length} transaksi
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Cari kategori, pegawai, atau catatan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            Belum ada data pemasukan
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950/50 border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Tanggal</th>
                <th className="px-6 py-3 font-medium">Kategori</th>
                <th className="px-6 py-3 font-medium">Pegawai</th>
                <th className="px-6 py-3 font-medium">Catatan</th>
                <th className="px-6 py-3 font-medium text-right">Nominal</th>
                <th className="px-6 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-300 font-mono text-xs">
                    {formatTgl(r.periode)}
                  </td>
                  <td className="px-6 py-4 text-white">
                    {r.kategori?.nama ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {r.pegawai?.nama ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                    {r.catatan ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-mono tabular-nums font-semibold">
                    {formatRp(r.nominal)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {r.bukti_path && (
                        <button
                          onClick={() => handleDownloadBukti(r.bukti_path!)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Lihat bukti"
                        >
                          <Image className="w-4 h-4" />
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
                Tambah Pemasukan
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

              <Field label="Pegawai (opsional)">
                <select
                  value={form.pegawai_id}
                  onChange={(e) =>
                    setForm({ ...form, pegawai_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">-- Tidak terkait pegawai --</option>
                  {pegawaiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </select>
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
                  value={form.nominal}
                  onChange={(e) =>
                    setForm({ ...form, nominal: e.target.value })
                  }
                  className="input"
                />
              </Field>

              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={form.catatan}
                  onChange={(e) =>
                    setForm({ ...form, catatan: e.target.value })
                  }
                  className="input resize-none"
                />
              </Field>

              <Field label="Bukti Transfer">
                <label className="flex items-center gap-2 border border-dashed border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-600 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400 flex-1 truncate">
                    {form.file?.name ?? "Pilih file (opsional)"}
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
