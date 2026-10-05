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
  ArrowDownCircle,
  Image,
  Pencil,
} from "lucide-react";

type Kategori = { id: string; nama: string };
type Pegawai = {
  id: string;
  nama: string;
  npp: string;
  iuran_bulanan: number;
};
type Transaksi = {
  id: string;
  nominal: number;
  tanggal: string;
  periode: string;
  catatan: string | null;
  bukti_path: string | null;
  kategori_id: string | null;
  pegawai_id: string | null;
  kategori: { nama: string } | null;
  pegawai: { nama: string } | null;
};

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const formatTgl = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function PemasukanPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBulan, setFilterBulan] = useState<string>("");
  const [filterTahun, setFilterTahun] = useState<string>("");
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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRange, setBulkRange] = useState({
    dari: new Date().toISOString().slice(0, 7),
    sampai: new Date().toISOString().slice(0, 7),
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [existingBuktiPath, setExistingBuktiPath] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setForm({
      kategori_id: "",
      pegawai_id: "",
      nominal: "",
      tanggal: new Date().toISOString().split("T")[0],
      periode: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
      catatan: "",
      file: null,
    });
    setBulkMode(false);
    setBulkRange({
      dari: new Date().toISOString().slice(0, 7),
      sampai: new Date().toISOString().slice(0, 7),
    });
    setEditId(null);
    setExistingBuktiPath(null);
  }

  function handleEdit(row: Transaksi) {
    setEditId(row.id);
    setExistingBuktiPath(row.bukti_path);
    setBulkMode(false);
    setForm({
      kategori_id: row.kategori_id ?? "",
      pegawai_id: row.pegawai_id ?? "",
      nominal: String(row.nominal),
      tanggal: row.tanggal,
      periode: row.periode,
      catatan: row.catatan ?? "",
      file: null,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  const selectedPegawai = pegawaiList.find((p) => p.id === form.pegawai_id);
  const bulkMonths = useMemo(() => {
    if (!bulkMode) return [];
    const [sy, sm] = bulkRange.dari.split("-").map(Number);
    const [ey, em] = bulkRange.sampai.split("-").map(Number);
    if (!sy || !sm || !ey || !em) return [];
    if (ey < sy || (ey === sy && em < sm)) return [];
    const out: string[] = [];
    let y = sy;
    let m = sm;
    while (y < ey || (y === ey && m <= em)) {
      out.push(`${y}-${String(m).padStart(2, "0")}-01`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  }, [bulkMode, bulkRange]);
  const bulkTotal = (selectedPegawai?.iuran_bulanan ?? 0) * bulkMonths.length;

  // Fetch data
  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transaksi")
      .select(
        `
        id, nominal, tanggal, periode, catatan, bukti_path, kategori_id, pegawai_id,
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
      supabase
        .from("pegawai")
        .select("id, nama, npp, jabatan:jabatan_id (iuran_bulanan)")
        .eq("aktif", true)
        .order("nama"),
    ]);
    setKategoriList(k.data ?? []);
    const pegawaiRows = (p.data ?? []).map((row: any) => ({
      id: row.id,
      nama: row.nama,
      npp: row.npp,
      iuran_bulanan: Number(row.jabatan?.iuran_bulanan ?? 0),
    }));
    setPegawaiList(pegawaiRows);
  }

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  // Submit new pemasukan
  async function handleSubmit() {
    if (!form.kategori_id || !form.tanggal) {
      alert("Kategori dan tanggal wajib diisi");
      return;
    }

    if (bulkMode) {
      if (!form.pegawai_id) {
        alert("Pilih pegawai untuk pembayaran iuran beberapa bulan");
        return;
      }
      if (!selectedPegawai || selectedPegawai.iuran_bulanan <= 0) {
        alert("Jabatan pegawai belum punya iuran bulanan");
        return;
      }
      if (bulkMonths.length === 0) {
        alert("Rentang periode tidak valid (dari harus ≤ sampai)");
        return;
      }
    } else if (!form.nominal) {
      alert("Nominal wajib diisi");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("Sesi habis, silakan login ulang");
      setSubmitting(false);
      return;
    }

    let targetIds: string[] = [];

    if (editId) {
      // Update mode (single row)
      const { error: updateErr } = await supabase
        .from("transaksi")
        .update({
          kategori_id: form.kategori_id,
          pegawai_id: form.pegawai_id || null,
          nominal: parseInt(form.nominal),
          tanggal: form.tanggal,
          periode: form.periode,
          catatan: form.catatan || null,
        })
        .eq("id", editId);

      if (updateErr) {
        alert("Gagal mengubah: " + updateErr.message);
        setSubmitting(false);
        return;
      }
      targetIds = [editId];
    } else {
      // Insert mode (single atau bulk)
      const basePayload = {
        jenis: "pemasukan" as const,
        kategori_id: form.kategori_id,
        pegawai_id: form.pegawai_id || null,
        tanggal: form.tanggal,
        catatan: form.catatan || null,
        created_by: userData.user.id,
      };

      const payloads = bulkMode
        ? bulkMonths.map((periode) => ({
            ...basePayload,
            nominal: selectedPegawai!.iuran_bulanan,
            periode,
          }))
        : [
            {
              ...basePayload,
              nominal: parseInt(form.nominal),
              periode: form.periode,
            },
          ];

      const { data: insertedRows, error: insertErr } = await supabase
        .from("transaksi")
        .insert(payloads)
        .select("id");

      if (insertErr) {
        alert("Gagal menyimpan: " + insertErr.message);
        setSubmitting(false);
        return;
      }
      targetIds = (insertedRows ?? []).map((r) => r.id);
    }

    // Upload bukti baru (replace jika ada bukti lama)
    if (form.file && targetIds.length > 0) {
      const ext = form.file.name.split(".").pop();
      const path = `${targetIds[0]}/bukti.${ext}`;

      if (existingBuktiPath && existingBuktiPath !== path) {
        await supabase.storage
          .from("bukti-transaksi")
          .remove([existingBuktiPath]);
      }

      const { error: uploadErr } = await supabase.storage
        .from("bukti-transaksi")
        .upload(path, form.file, { upsert: true });

      if (uploadErr) {
        alert("Data tersimpan, tapi upload bukti gagal: " + uploadErr.message);
      } else {
        await supabase
          .from("transaksi")
          .update({ bukti_path: path })
          .in("id", targetIds);
      }
    }

    closeModal();
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

  // Daftar tahun unik dari data (untuk opsi filter)
  const tahunList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.tanggal.slice(0, 4)));
    const now = new Date().getFullYear().toString();
    set.add(now);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  // Filter
  const filtered = rows.filter((r) => {
    const matchSearch =
      (r.kategori?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.pegawai?.nama ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.catatan ?? "").toLowerCase().includes(search.toLowerCase());
    const [y, m] = r.tanggal.split("-");
    const matchBulan = !filterBulan || m === filterBulan;
    const matchTahun = !filterTahun || y === filterTahun;
    return matchSearch && matchBulan && matchTahun;
  });

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

      {/* Search + Filter Periode */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Cari kategori, pegawai, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
          />
        </div>
        <select
          value={filterBulan}
          onChange={(e) => setFilterBulan(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-600 min-w-[150px]"
        >
          <option value="">Semua Bulan</option>
          {BULAN.map((nama, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>
              {nama}
            </option>
          ))}
        </select>
        <select
          value={filterTahun}
          onChange={(e) => setFilterTahun(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-600 min-w-[120px]"
        >
          <option value="">Semua Tahun</option>
          {tahunList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(filterBulan || filterTahun) && (
          <button
            onClick={() => {
              setFilterBulan("");
              setFilterTahun("");
            }}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Reset
          </button>
        )}
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
                    <div className="flex items-center justify-center gap-1">
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
                        onClick={() => handleEdit(r)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
                {editId ? "Edit Pemasukan" : "Tambah Pemasukan"}
              </h2>
              <button
                onClick={closeModal}
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

              <Field label={bulkMode ? "Pegawai *" : "Pegawai (opsional)"}>
                <PegawaiCombobox
                  list={pegawaiList}
                  value={form.pegawai_id}
                  onChange={(id) => setForm({ ...form, pegawai_id: id })}
                />
                {bulkMode && selectedPegawai && (
                  <p className="text-xs text-gray-500 mt-1.5 font-mono">
                    Iuran: {formatRp(selectedPegawai.iuran_bulanan)}/bulan
                  </p>
                )}
              </Field>

              {/* Toggle bulk mode (hanya saat tambah, tidak saat edit) */}
              {!editId && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-800 bg-gray-950/40 cursor-pointer hover:border-gray-700">
                  <input
                    type="checkbox"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    className="mt-0.5 accent-gray-200"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">
                      Bayar iuran beberapa bulan sekaligus
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pilih rentang bulan — sistem buat 1 transaksi per bulan
                      sesuai iuran jabatan
                    </p>
                  </div>
                </label>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Tanggal Bayar *">
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) =>
                      setForm({ ...form, tanggal: e.target.value })
                    }
                    className="input"
                  />
                </Field>
                {!bulkMode && (
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
                )}
              </div>

              {bulkMode ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Dari Periode *">
                      <input
                        type="month"
                        value={bulkRange.dari}
                        onChange={(e) =>
                          setBulkRange({ ...bulkRange, dari: e.target.value })
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Sampai Periode *">
                      <input
                        type="month"
                        value={bulkRange.sampai}
                        onChange={(e) =>
                          setBulkRange({ ...bulkRange, sampai: e.target.value })
                        }
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-xs text-gray-400 mb-2">
                      Preview transaksi yang akan dibuat
                    </p>
                    {bulkMonths.length === 0 ? (
                      <p className="text-xs text-rose-400">
                        Rentang tidak valid — pastikan "Dari" ≤ "Sampai"
                      </p>
                    ) : !selectedPegawai ? (
                      <p className="text-xs text-gray-500">
                        Pilih pegawai dulu untuk melihat preview
                      </p>
                    ) : selectedPegawai.iuran_bulanan <= 0 ? (
                      <p className="text-xs text-rose-400">
                        Jabatan pegawai ini belum punya iuran bulanan
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                          {bulkMonths.map((p) => (
                            <li
                              key={p}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-gray-300 font-mono">
                                {formatTgl(p).slice(3)}
                              </span>
                              <span className="text-white font-mono tabular-nums">
                                {formatRp(selectedPegawai.iuran_bulanan)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                          <span className="text-xs text-gray-400">
                            {bulkMonths.length} bulan
                          </span>
                          <span className="text-sm text-white font-mono tabular-nums font-semibold">
                            {formatRp(bulkTotal)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
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
              )}

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
                    {form.file?.name ??
                      (existingBuktiPath
                        ? "Bukti tersimpan — pilih file baru untuk mengganti"
                        : "Pilih file (opsional)")}
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
                onClick={closeModal}
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
                {editId ? "Simpan Perubahan" : "Simpan"}
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
              -- Tidak terkait pegawai --
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
