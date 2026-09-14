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
  Users,
  Save,
} from "lucide-react";

type Jabatan = {
  id: string;
  nama: string;
  iuran_bulanan: number;
  created_at: string;
};

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function JabatanPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Jabatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ nama: "", iuran_bulanan: "" });

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("jabatan")
      .select("*")
      .order("nama", { ascending: true });

    if (error) console.error(error);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm({ nama: "", iuran_bulanan: "" });
    setShowModal(true);
  }

  function openEdit(row: Jabatan) {
    setEditId(row.id);
    setForm({
      nama: row.nama,
      iuran_bulanan: row.iuran_bulanan.toString(),
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.nama.trim()) {
      alert("Nama jabatan wajib diisi");
      return;
    }
    const iuran = parseInt(form.iuran_bulanan) || 0;
    if (iuran < 0) {
      alert("Iuran tidak boleh negatif");
      return;
    }

    setSubmitting(true);
    const payload = {
      nama: form.nama.trim(),
      iuran_bulanan: iuran,
    };

    const { error } = editId
      ? await supabase.from("jabatan").update(payload).eq("id", editId)
      : await supabase.from("jabatan").insert(payload);

    if (error) {
      // Handle unique constraint
      if (error.code === "23505") {
        alert("Nama jabatan sudah terdaftar");
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

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus jabatan "${nama}"? Aksi tidak bisa dibatalkan.`))
      return;

    const { error } = await supabase.from("jabatan").delete().eq("id", id);
    if (error) {
      // FK constraint violation
      if (error.code === "23503") {
        alert("Tidak bisa hapus. Jabatan ini masih dipakai oleh pegawai.");
      } else {
        alert("Gagal menghapus: " + error.message);
      }
      return;
    }
    fetchData();
  }

  const filtered = rows.filter((r) =>
    r.nama.toLowerCase().includes(search.toLowerCase()),
  );

  const totalIuran = filtered.reduce((sum, r) => sum + r.iuran_bulanan, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            Master Jabatan
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Kelola jabatan dan nominal iuran bulanan
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Jabatan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-400 mb-1">Total Jabatan</p>
          <p className="text-3xl font-bold text-white font-mono tabular-nums">
            {filtered.length}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-400 mb-1">
            Total Iuran / Bulan (jika semua terisi)
          </p>
          <p className="text-3xl font-bold text-white font-mono tabular-nums">
            {formatRp(totalIuran)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Cari jabatan..."
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
            {search ? "Jabatan tidak ditemukan" : "Belum ada data jabatan"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950/50 border-b border-gray-800">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Nama Jabatan</th>
                <th className="px-6 py-3 font-medium text-right">
                  Iuran Bulanan
                </th>
                <th className="px-6 py-3 font-medium text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 text-white font-medium">{r.nama}</td>
                  <td className="px-6 py-4 text-right text-white font-mono tabular-nums">
                    {formatRp(r.iuran_bulanan)}
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
                {editId ? "Edit Jabatan" : "Tambah Jabatan"}
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
                  Nama Jabatan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Manager, Staff, Direktur"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Iuran Bulanan (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="150000"
                  min="0"
                  value={form.iuran_bulanan}
                  onChange={(e) =>
                    setForm({ ...form, iuran_bulanan: e.target.value })
                  }
                  className="input"
                />
                {form.iuran_bulanan && (
                  <p className="text-xs text-gray-500 mt-1.5 font-mono">
                    ≈ {formatRp(parseInt(form.iuran_bulanan) || 0)}
                  </p>
                )}
              </div>
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
