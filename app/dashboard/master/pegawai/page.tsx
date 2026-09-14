"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Loader2,
  UserCircle,
  Save,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type Jabatan = {
  id: string;
  nama: string;
  iuran_bulanan: number;
};

type Pegawai = {
  id: string;
  nama: string;
  npp: string; // NEW
  tanggal_lahir: string; // NEW (format: YYYY-MM-DD)
  jabatan_id: string;
  aktif: boolean;
  vendor: boolean; // NEW
  nama_vendor: string | null; // NEW
  jabatan?: { nama: string; iuran_bulanan: number };
};

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PegawaiPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Pegawai[]>([]);
  const [jabatanList, setJabatanList] = useState<Jabatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "aktif" | "nonaktif"
  >("all");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nama: "",
    npp: "", // NEW
    tanggal_lahir: "", // NEW
    jabatan_id: "",
    aktif: true,
    vendor: false, // NEW
    nama_vendor: "",
  });
  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pegawai")
      .select(
        `id, nama, npp, tanggal_lahir, jabatan_id, aktif, 
         vendor, nama_vendor,
         jabatan:jabatan_id (nama, iuran_bulanan)`,
      )
      .order("nama", { ascending: true });

    if (error) console.error(error);
    // @ts-expect-error - supabase join type
    setRows(data ?? []);
    setLoading(false);
  }

  async function fetchJabatan() {
    const { data } = await supabase
      .from("jabatan")
      .select("id, nama, iuran_bulanan")
      .order("nama");
    setJabatanList(data ?? []);
  }

  useEffect(() => {
    fetchData();
    fetchJabatan();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm({
      nama: "",
      npp: "",
      tanggal_lahir: "",
      jabatan_id: "",
      aktif: true,
      vendor: false,
      nama_vendor: "",
    });
    setShowModal(true);
  }

  function openEdit(row: Pegawai) {
    setEditId(row.id);
    setForm({
      nama: row.nama,
      npp: row.npp,
      tanggal_lahir: row.tanggal_lahir,
      jabatan_id: row.jabatan_id,
      aktif: row.aktif,
      vendor: row.vendor,
      nama_vendor: row.nama_vendor ?? "",
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.nama.trim()) {
      alert("Nama pegawai wajib diisi");
      return;
    }
    if (!form.jabatan_id) {
      alert("Jabatan wajib dipilih");
      return;
    }
    if (!form.npp.trim()) {
      alert("NPP wajib diisi (angka)");
      return;
    }
    if (!form.tanggal_lahir) {
      alert("Tanggal lahir wajib diisi");
      return;
    }
    if (form.vendor && !form.nama_vendor.trim()) {
      alert("Nama Vendor wajib diisi kalau status vendor aktif");
      return;
    }

    setSubmitting(true);
    const payload = {
      nama: form.nama.trim(),
      npp: form.npp.trim(),
      tanggal_lahir: form.tanggal_lahir,
      jabatan_id: form.jabatan_id,
      aktif: form.aktif,
      vendor: form.vendor, // NEW
      nama_vendor: form.vendor ? form.nama_vendor.trim() : null, // NEW
    };
    const { error } = editId
      ? await supabase.from("pegawai").update(payload).eq("id", editId)
      : await supabase.from("pegawai").insert(payload);

    if (error) {
      if (error.code === "23505") {
        alert(`NPP ${form.npp} sudah dipakai pegawai lain`);
      } else if (error.code === "23514") {
        alert("NPP harus angka saja");
      } else {
        alert("Gagal menyimpan: " + error.message);
      }
      setSubmitting(false);
      return;
    }

    setShowModal(false);
    setSubmitting(false);
    fetchData();
  }

  async function handleToggleAktif(row: Pegawai) {
    const action = row.aktif ? "menonaktifkan" : "mengaktifkan";
    if (!confirm(`Yakin ${action} pegawai "${row.nama}"?`)) return;

    const { error } = await supabase
      .from("pegawai")
      .update({ aktif: !row.aktif })
      .eq("id", row.id);

    if (error) return alert("Gagal update status: " + error.message);
    fetchData();
  }

  async function handleDelete(id: string, nama: string) {
    if (
      !confirm(
        `Hapus pegawai "${nama}"?\n\nCatatan: Jika pegawai sudah punya transaksi, sebaiknya nonaktifkan saja (bukan hapus).`,
      )
    )
      return;

    const { error } = await supabase.from("pegawai").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        alert(
          "Tidak bisa hapus. Pegawai ini masih punya transaksi. Nonaktifkan saja.",
        );
      } else {
        alert("Gagal menghapus: " + error.message);
      }
      return;
    }
    fetchData();
  }

  // Filter
  const filtered = rows.filter((r) => {
    const matchSearch =
      r.nama.toLowerCase().includes(search.toLowerCase()) ||
      r.npp.includes(search) || // NEW
      (r.jabatan?.nama ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "aktif" && r.aktif) ||
      (filterStatus === "nonaktif" && !r.aktif);
    return matchSearch && matchStatus;
  });

  // Stats
  const totalAktif = rows.filter((r) => r.aktif).length;
  const totalPotensiIuran = rows
    .filter((r) => r.aktif)
    .reduce((sum, r) => sum + (r.jabatan?.iuran_bulanan ?? 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCircle className="w-6 h-6" />
            Master Pegawai
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Kelola daftar pegawai dan status keaktifan
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={jabatanList.length === 0}
          className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={
            jabatanList.length === 0
              ? "Tambah jabatan dulu sebelum tambah pegawai"
              : ""
          }
        >
          <Plus className="w-4 h-4" />
          Tambah Pegawai
        </button>
      </div>

      {/* Warning kalau belum ada jabatan */}
      {jabatanList.length === 0 && !loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
          ⚠️ Belum ada jabatan. Silakan tambah jabatan dulu di menu{" "}
          <a href="/dashboard/master/jabatan" className="text-white underline">
            Master Jabatan
          </a>
          .
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox label="Total Pegawai" value={rows.length.toString()} />
        <StatBox label="Pegawai Aktif" value={totalAktif.toString()} />
        <StatBox
          label="Potensi Iuran / Bulan"
          value={formatRp(totalPotensiIuran)}
        />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Cari nama, NPP, atau jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
          />
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {(["all", "aktif", "nonaktif"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filterStatus === s
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {s === "all" ? "Semua" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            {search || filterStatus !== "all"
              ? "Pegawai tidak ditemukan"
              : "Belum ada data pegawai"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950/50 border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">NPP</th>
                <th className="px-6 py-3 font-medium">Nama</th>
                <th className="px-6 py-3 font-medium">Jabatan</th>
                <th className="px-6 py-3 font-medium">Tgl Lahir</th> {/* NEW */}
                <th className="px-6 py-3 font-medium text-center">Tipe</th>
                <th className="px-6 py-3 font-medium text-right">Iuran</th>
                <th className="px-6 py-3 font-medium text-center">Status</th>
                <th className="px-6 py-3 font-medium text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-800/30 transition-colors ${
                    !r.aktif ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-6 py-4 font-mono tabular-nums text-gray-300">
                    {r.npp}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-gray-300">
                          {r.nama.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-medium">{r.nama}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {r.jabatan?.nama ?? "-"}
                  </td>
                  <td className="px-6 py-4 font-mono tabular-nums text-gray-300 text-sm">
                    {r.tanggal_lahir
                      ? r.tanggal_lahir.split("-").reverse().join("/")
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.vendor ? (
                      <div>
                        <span
                          className="inline-flex px-2 py-0.5 rounded bg-gray-800 
                       text-xs text-gray-300"
                        >
                          Vendor
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {r.nama_vendor}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Pegawai</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300 font-mono tabular-nums">
                    {formatRp(r.jabatan?.iuran_bulanan ?? 0)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleAktif(r)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        r.aktif
                          ? "bg-gray-800 text-gray-100 hover:bg-gray-700"
                          : "bg-gray-800/50 text-gray-500 hover:bg-gray-800"
                      }`}
                      title="Klik untuk toggle status"
                    >
                      {r.aktif ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Nonaktif
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id, r.nama)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {editId ? "Edit Pegawai" : "Tambah Pegawai"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Nama Pegawai *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  NPP *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 0001"
                  value={form.npp}
                  onChange={(e) =>
                    setForm({ ...form, npp: e.target.value.replace(/\D/g, "") })
                  }
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Angka saja, harus unik
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Tanggal Lahir *
                </label>
                <input
                  type="date"
                  value={form.tanggal_lahir}
                  max={new Date().toISOString().split("T")[0]}
                  min="1940-01-01"
                  onChange={(e) =>
                    setForm({ ...form, tanggal_lahir: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Jabatan *
                </label>
                <select
                  value={form.jabatan_id}
                  onChange={(e) =>
                    setForm({ ...form, jabatan_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Pilih jabatan</option>
                  {jabatanList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nama} — {formatRp(j.iuran_bulanan)}
                    </option>
                  ))}
                </select>
                {form.jabatan_id && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Iuran bulanan akan mengikuti jabatan yang dipilih
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.aktif}
                    onChange={(e) =>
                      setForm({ ...form, aktif: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-gray-100 focus:ring-0 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm text-white font-medium">
                      Status Aktif
                    </p>
                    <p className="text-xs text-gray-500">
                      Pegawai nonaktif tidak akan muncul di dropdown pemasukan
                    </p>
                  </div>
                </label>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.vendor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        vendor: e.target.checked,
                        nama_vendor: e.target.checked ? form.nama_vendor : "",
                      })
                    }
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-gray-100"
                  />
                  <div>
                    <p className="text-sm text-white font-medium">
                      Status Vendor
                    </p>
                    <p className="text-xs text-gray-500">
                      Vendor tidak muncul di laporan iuran & ultah
                    </p>
                  </div>
                </label>
              </div>

              {form.vendor && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Nama Vendor *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: PT Katering Sejahtera"
                    value={form.nama_vendor}
                    onChange={(e) =>
                      setForm({ ...form, nama_vendor: e.target.value })
                    }
                    className="input"
                  />
                </div>
              )}
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
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editId ? "Update" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white font-mono tabular-nums">
        {value}
      </p>
    </div>
  );
}
