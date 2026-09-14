"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Loader2,
  Cake,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { isUltahHariIni, todayJakarta } from "@/lib/utils";

type Saldo = {
  total_pemasukan: number;
  total_pengeluaran: number;
  saldo: number;
};

type MonthlyRow = {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
};

type KategoriBreakdown = {
  name: string;
  value: number;
};

type RecentTx = {
  id: string;
  jenis: "pemasukan" | "pengeluaran";
  nominal: number;
  tanggal: string;
  kategori: { nama: string } | null;
  pegawai: { nama: string } | null;
  catatan: string | null;
};

type PegawaiUltah = {
  id: string;
  nama: string;
  tanggal_lahir: string;
  jabatan: { nama: string } | null;
};

const GRAY_SHADES = ["#e5e7eb", "#9ca3af", "#6b7280", "#4b5563", "#374151"];
const BULAN_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const formatRp = (n: any) => `Rp ${Number(n ?? 0).toLocaleString("id-ID")}`;
const formatTgl = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function DashboardPage() {
  const supabase = createClient();

  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [kategoriData, setKategoriData] = useState<KategoriBreakdown[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    pemasukan: 0,
    pengeluaran: 0,
    trendPemasukan: 0,
    trendPengeluaran: 0,
  });

  const [loading, setLoading] = useState(true);
  const [ultahList, setUltahList] = useState<any[]>([]);

  async function fetchAll() {
    setLoading(true);

    const [saldoRes, monthlyRes, recentRes, kategoriRes] = await Promise.all([
      // 1. Saldo total (all-time)
      supabase.from("saldo_summary").select("*").single(),

      // 2. Monthly chart (6 bulan)
      supabase.rpc("transaksi_per_bulan", { months_back: 6 }),

      // 3. Recent transactions (5 terakhir)
      supabase
        .from("transaksi")
        .select(
          `
          id, jenis, nominal, tanggal, catatan,
          kategori:kategori_id (nama),
          pegawai:pegawai_id (nama)
        `,
        )
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),

      // 4. Kategori breakdown (pengeluaran bulan ini)
      supabase
        .from("transaksi")
        .select(
          `
          nominal,
          kategori:kategori_id (nama)
        `,
        )
        .eq("jenis", "pengeluaran")
        .gte("tanggal", new Date().toISOString().slice(0, 8) + "01"),
    ]);

    // Process saldo
    if (saldoRes.data) setSaldo(saldoRes.data as Saldo);

    // Process monthly (format bulan)
    if (monthlyRes.data) {
      const formatted = (monthlyRes.data as any[]).map((r) => ({
        bulan: BULAN_ID[new Date(r.bulan).getMonth()],
        pemasukan: Number(r.pemasukan),
        pengeluaran: Number(r.pengeluaran),
      }));
      setMonthlyData(formatted);

      // Hitung stats bulan ini vs bulan lalu
      const len = formatted.length;
      const current = formatted[len - 1] ?? { pemasukan: 0, pengeluaran: 0 };
      const prev = formatted[len - 2] ?? { pemasukan: 0, pengeluaran: 0 };

      setMonthlyStats({
        pemasukan: current.pemasukan,
        pengeluaran: current.pengeluaran,
        trendPemasukan:
          prev.pemasukan > 0
            ? ((current.pemasukan - prev.pemasukan) / prev.pemasukan) * 100
            : 0,
        trendPengeluaran:
          prev.pengeluaran > 0
            ? ((current.pengeluaran - prev.pengeluaran) / prev.pengeluaran) *
              100
            : 0,
      });
    }

    // Process recent
    if (recentRes.data) setRecentTx(recentRes.data as any[]);

    // Process kategori breakdown (group by client-side)
    if (kategoriRes.data) {
      const grouped = (kategoriRes.data as any[]).reduce(
        (acc, r) => {
          const nama = r.kategori?.nama ?? "Tanpa Kategori";
          acc[nama] = (acc[nama] ?? 0) + r.nominal;
          return acc;
        },
        {} as Record<string, number>,
      );

      const sorted = Object.entries(grouped)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5

      setKategoriData(sorted);
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pegawai")
        .select("id, nama, tanggal_lahir, jabatan:jabatan_id(nama)")
        .eq("aktif", true)
        .eq("vendor", false); // NEW

      if (!data) return;

      // ⚠️ CRITICAL: filter WAJIB di sini
      const filtered = data.filter((p: any) => isUltahHariIni(p.tanggal_lahir));

      console.log("DEBUG ultah:", {
        total: data.length,
        hasilFilter: filtered.length,
        today: todayJakarta(),
        allData: data.map((p: any) => ({
          nama: p.nama,
          tgl: p.tanggal_lahir,
          match: isUltahHariIni(p.tanggal_lahir),
        })),
      });

      setUltahList(filtered);
    })();
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  })();

  const formatTanggal = () => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  function hitungUmur(tglLahir: string): number {
    const [y] = tglLahir.split("-").map(Number);
    const today = todayJakarta();
    const currentYear = parseInt(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
      }).format(new Date()),
    );
    return currentYear - y;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{greeting}, Admin</h1>
        <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {formatTanggal()}
        </p>
      </div>

      {ultahList.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="w-5 h-5 text-gray-300" />
            <h2 className="text-sm font-semibold text-white">
              Ulang Tahun Hari Ini
            </h2>
            <span className="ml-auto text-xs text-gray-500 font-mono tabular-nums">
              {new Date().toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Jakarta",
              })}
            </span>
          </div>

          <ul className="space-y-2">
            {ultahList.map((p) => {
              const umur = hitungUmur(p.tanggal_lahir);
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-950/60 border border-gray-800"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-gray-200">
                      {p.nama.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {p.nama}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.jabatan?.nama ?? "—"} • {umur} tahun
                    </div>
                  </div>
                  <span className="text-xl">🎂</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label="Saldo Kas"
          value={formatRp(saldo?.saldo ?? 0)}
          highlight
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Pemasukan Bulan Ini"
          value={formatRp(monthlyStats.pemasukan)}
          trend={monthlyStats.trendPemasukan}
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Pengeluaran Bulan Ini"
          value={formatRp(monthlyStats.pengeluaran)}
          trend={monthlyStats.trendPengeluaran}
          inverse
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">
              Arus Kas 6 Bulan Terakhir
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Perbandingan pemasukan vs pengeluaran
            </p>
          </div>
          {monthlyData.length === 0 ? (
            <EmptyChart message="Belum ada data transaksi" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gPemasukan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5e7eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPengeluaran" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="bulan" stroke="#6b7280" fontSize={12} />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(v) => formatRp(v)}
                />
                <Area
                  type="monotone"
                  dataKey="pemasukan"
                  stroke="#e5e7eb"
                  strokeWidth={2}
                  fill="url(#gPemasukan)"
                  name="Pemasukan"
                />
                <Area
                  type="monotone"
                  dataKey="pengeluaran"
                  stroke="#6b7280"
                  strokeWidth={2}
                  fill="url(#gPengeluaran)"
                  name="Pengeluaran"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">
              Kategori Pengeluaran
            </h2>
            <p className="text-xs text-gray-500 mt-1">Bulan ini</p>
          </div>
          {kategoriData.length === 0 ? (
            <EmptyChart message="Belum ada pengeluaran bulan ini" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={kategoriData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {kategoriData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={GRAY_SHADES[i % GRAY_SHADES.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(v) => formatRp(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {kategoriData.map((k, i) => (
                  <div
                    key={k.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: GRAY_SHADES[i % GRAY_SHADES.length],
                        }}
                      />
                      <span className="text-gray-400 truncate">{k.name}</span>
                    </div>
                    <span className="text-gray-200 font-mono tabular-nums shrink-0 ml-2">
                      {formatRp(k.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Transaksi Terbaru
            </h2>
            <p className="text-xs text-gray-500 mt-1">5 transaksi terakhir</p>
          </div>
        </div>
        {recentTx.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Belum ada transaksi
          </div>
        ) : (
          <div className="space-y-1">
            {recentTx.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.jenis === "pemasukan"
                        ? "bg-gray-800 text-gray-100"
                        : "bg-gray-800/50 text-gray-400"
                    }`}
                  >
                    {tx.jenis === "pemasukan" ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">
                      {tx.pegawai?.nama ??
                        tx.catatan ??
                        tx.kategori?.nama ??
                        "Transaksi"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {tx.kategori?.nama ?? "-"} · {formatTgl(tx.tanggal)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-mono tabular-nums font-semibold shrink-0 ml-2 ${
                    tx.jenis === "pemasukan" ? "text-white" : "text-gray-400"
                  }`}
                >
                  {tx.jenis === "pemasukan" ? "+" : "−"} {formatRp(tx.nominal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
  highlight,
  inverse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  highlight?: boolean;
  inverse?: boolean;
}) {
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositive = trend ? (inverse ? trend < 0 : trend > 0) : true;

  return (
    <div
      className={`rounded-xl p-6 border transition-colors ${
        highlight
          ? "bg-gray-100 text-gray-900 border-gray-100"
          : "bg-gray-900 border-gray-800 hover:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            highlight ? "bg-gray-900 text-white" : "bg-gray-800 text-gray-300"
          }`}
        >
          {icon}
        </div>
        {hasTrend && (
          <span
            className={`text-xs font-medium flex items-center gap-1 ${
              isPositive ? "text-gray-300" : "text-gray-500"
            } ${highlight ? "!text-gray-600" : ""}`}
          >
            {trend! > 0 ? "↑" : "↓"} {Math.abs(trend!).toFixed(1)}%
          </span>
        )}
      </div>
      <p
        className={`text-xs mb-1 ${highlight ? "text-gray-600" : "text-gray-400"}`}
      >
        {label}
      </p>
      <p className="text-2xl font-bold font-mono tabular-nums">{value}</p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
      {message}
    </div>
  );
}
