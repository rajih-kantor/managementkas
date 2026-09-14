// ============================================================
// File: app/dashboard/reports/page.tsx
// Purpose: Halaman laporan iuran — matrix view + export Excel
//          Custom range bulan (start & end)
// ============================================================

"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

// ---------- Types ----------
type StatusIuran = "lunas" | "belum" | "na";

type LaporanRow = {
  pegawai_id: string;
  nama: string;
  npp: string;
  jenjang: string;
  periode: string; // 'YYYY-MM-DD'
  status: StatusIuran;
  tanggal_transaksi: string | null;
};

type PegawaiMatrix = {
  pegawai_id: string;
  nama: string;
  npp: string;
  jenjang: string;
  bulan: Record<string, { status: StatusIuran; tanggal: string | null }>;
};

// ---------- Helpers ----------
const formatBulan = (periode: string) => {
  const d = new Date(periode);
  const s = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatTanggal = (dateStr: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

// Default: awal tahun berjalan → bulan sekarang
const getDefaultRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    start: `${year}-01`,
    end: `${year}-${month}`,
  };
};

// ---------- Component ----------
export default function ReportsPage() {
  const supabase = createClient();
  const defaults = getDefaultRange();

  const [startMonth, setStartMonth] = useState(defaults.start);
  const [endMonth, setEndMonth] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pegawaiList, setPegawaiList] = useState<PegawaiMatrix[]>([]);
  const [periodes, setPeriodes] = useState<string[]>([]);

  // Fetch data dari RPC
  const fetchData = useCallback(async () => {
    if (startMonth > endMonth) {
      setError("Bulan mulai tidak boleh lebih besar dari bulan akhir");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "laporan_iuran_detail",
        {
          p_start: `${startMonth}-01`,
          p_end: `${endMonth}-01`,
        },
      );

      if (rpcError) throw rpcError;

      // Transform flat rows → matrix (pegawai × bulan)
      const pegawaiMap = new Map<string, PegawaiMatrix>();
      const periodeSet = new Set<string>();

      for (const row of (data ?? []) as LaporanRow[]) {
        periodeSet.add(row.periode);
        if (!pegawaiMap.has(row.pegawai_id)) {
          pegawaiMap.set(row.pegawai_id, {
            pegawai_id: row.pegawai_id,
            nama: row.nama,
            npp: row.npp,
            jenjang: row.jenjang,
            bulan: {},
          });
        }
        pegawaiMap.get(row.pegawai_id)!.bulan[row.periode] = {
          status: row.status,
          tanggal: row.tanggal_transaksi,
        };
      }

      setPeriodes(Array.from(periodeSet).sort());
      setPegawaiList(
        Array.from(pegawaiMap.values()).sort((a, b) =>
          a.nama.localeCompare(b.nama),
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, supabase]);

  // Initial load
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle export Excel
  const handleExport = async () => {
    if (pegawaiList.length === 0) return;

    setExporting(true);
    try {
      const res = await fetch("/api/reports/export-iuran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: `${startMonth}-01`,
          end: `${endMonth}-01`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal export" }));
        throw new Error(err.error || "Gagal export Excel");
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-iuran-${startMonth}-sd-${endMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message ?? "Gagal export Excel");
    } finally {
      setExporting(false);
    }
  };

  // ---------- Summary stats ----------
  const totalPegawai = pegawaiList.length;
  const totalPeriode = periodes.length;

  let lunasCount = 0;
  let belumCount = 0;
  pegawaiList.forEach((p) => {
    periodes.forEach((pr) => {
      const s = p.bulan[pr]?.status;
      if (s === "lunas") lunasCount++;
      else if (s === "belum") belumCount++;
    });
  });

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-full px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-100"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Laporan Iuran</h1>
            <p className="text-sm text-gray-400">
              Matrix status pembayaran iuran per pegawai per bulan
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Dari Bulan
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Sampai Bulan
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              Terapkan
            </button>

            <div className="ml-auto">
              <button
                onClick={handleExport}
                disabled={exporting || loading || pegawaiList.length === 0}
                className="flex items-center gap-2 rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Download size={16} />
                )}
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-xs text-gray-400">Total Pegawai</div>
            <div className="mt-1 text-2xl font-bold">{totalPegawai}</div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-xs text-gray-400">Periode</div>
            <div className="mt-1 text-2xl font-bold">{totalPeriode} bulan</div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-xs text-gray-400">Lunas</div>
            <div className="mt-1 text-2xl font-bold text-green-400">
              {lunasCount}
            </div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-xs text-gray-400">Belum Bayar</div>
            <div className="mt-1 text-2xl font-bold text-red-400">
              {belumCount}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Matrix table */}
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-gray-800">
                {/* Row 1: No | Nama | NPP | Jenjang | Bulan1 (colspan 2) | ... */}
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 w-12 bg-gray-800 px-3 py-2 text-center"
                  >
                    No
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-12 z-30 min-w-[220px] bg-gray-800 px-3 py-2 text-left"
                  >
                    Nama
                  </th>
                  <th rowSpan={2} className="w-24 px-3 py-2 text-left">
                    NPP
                  </th>
                  <th rowSpan={2} className="w-28 px-3 py-2 text-left">
                    Jenjang
                  </th>
                  {periodes.map((p) => (
                    <th
                      key={p}
                      colSpan={2}
                      className="min-w-[180px] border-l border-gray-700 px-3 py-2 text-center"
                    >
                      {formatBulan(p)}
                    </th>
                  ))}
                </tr>
                {/* Row 2: sub-header Ket + Tanggal Transfer */}
                <tr>
                  {periodes.map((p) => (
                    <Fragment key={`sub-${p}`}>
                      <th className="border-l border-gray-700 px-2 py-1 text-xs font-normal text-gray-400">
                        Ket
                      </th>
                      <th className="px-2 py-1 text-xs font-normal text-gray-400">
                        Tgl Transfer
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4 + periodes.length * 2}
                      className="py-12 text-center text-gray-400"
                    >
                      <Loader2 className="inline animate-spin" size={20} />
                      <span className="ml-2">Memuat data...</span>
                    </td>
                  </tr>
                ) : pegawaiList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + periodes.length * 2}
                      className="py-12 text-center text-gray-400"
                    >
                      Tidak ada data untuk periode ini
                    </td>
                  </tr>
                ) : (
                  pegawaiList.map((p, idx) => (
                    <tr
                      key={p.pegawai_id}
                      className="border-t border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 text-center">
                        {idx + 1}
                      </td>
                      <td className="sticky left-12 z-10 bg-gray-900 px-3 py-2 font-medium">
                        {p.nama}
                      </td>
                      <td className="px-3 py-2 text-gray-300">{p.npp}</td>
                      <td className="px-3 py-2 text-gray-300">{p.jenjang}</td>

                      {periodes.map((periode) => {
                        const b = p.bulan[periode];

                        // Belum bayar
                        if (!b || b.status === "belum") {
                          return (
                            <Fragment key={periode}>
                              <td className="border-l border-gray-800 bg-red-950/30 px-2 py-2 text-center">
                                <span className="text-xs text-red-400">
                                  Belum
                                </span>
                              </td>
                              <td className="bg-red-950/30 px-2 py-2 text-center text-xs text-gray-500">
                                -
                              </td>
                            </Fragment>
                          );
                        }

                        // Non-aktif / cuti
                        if (b.status === "na") {
                          return (
                            <Fragment key={periode}>
                              <td className="border-l border-gray-800 px-2 py-2 text-center text-xs text-gray-600">
                                -
                              </td>
                              <td className="px-2 py-2 text-center text-xs text-gray-600">
                                -
                              </td>
                            </Fragment>
                          );
                        }

                        // Lunas
                        return (
                          <Fragment key={periode}>
                            <td className="border-l border-gray-800 bg-green-950/30 px-2 py-2 text-center">
                              <span className="text-xs text-green-400">
                                Done
                              </span>
                            </td>
                            <td className="bg-green-950/30 px-2 py-2 text-center text-xs text-gray-300">
                              {formatTanggal(b.tanggal)}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-950/60" />
            <span>Sudah bayar (Done)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-950/60" />
            <span>Belum bayar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded border border-gray-700" />
            <span>Tidak aktif / cuti</span>
          </div>
        </div>
      </div>
    </div>
  );
}
