import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  Sparkles,
  LogIn,
  ArrowUpRight,
  ArrowDownRight,
  PartyPopper,
  FileText,
} from "lucide-react";
import InfoPembayaran from "../components/public/InfoPembayaran";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

const tanggal = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

// Periode = tanggal 1 bulan target (format YYYY-MM-01)
function periodeTarget(offsetBulan = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetBulan);
  return d.toISOString().slice(0, 10);
}

export const revalidate = 60; // ISR 1 menit

export default async function LandingPage() {
  const supabase = await createClient();
  const periodeIni = periodeTarget(0);
  const periodeLalu = periodeTarget(-1);

  const [saldoRes, feedRes, tIniRes, tLaluRes] = await Promise.all([
    supabase.from("saldo_summary").select("*").single(),
    supabase
      .from("transaksi_publik")
      .select("*")
      .order("tanggal", { ascending: false })
      .limit(10),
    supabase.rpc("tunggakan_iuran", { periode_target: periodeIni }),
    supabase.rpc("tunggakan_iuran", { periode_target: periodeLalu }),
  ]);

  const saldo = saldoRes.data;
  const feed = feedRes.data ?? [];
  const tIni = tIniRes.data ?? [];
  const tLalu = tLaluRes.data ?? [];

  const namaBulan = (offset: number) =>
    new Date(
      new Date().setMonth(new Date().getMonth() + offset),
    ).toLocaleDateString("id-ID", { month: "long" });

  return (
    <div className={`${poppins.className} min-h-screen bg-amber-50`}>
      {/* NAV */}
      <nav className="sticky top-0 z-10 backdrop-blur-md bg-amber-50/80 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Kas Kantor</span>
          </div>
          <Link
            href="/timesheet"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 
             text-white font-semibold px-5 py-3 rounded-full transition shadow-lg"
          >
            <FileText className="w-5 h-5" />
            Generate Timesheet
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
          Uang Kas Kita Sekarang
        </h1>
        <p className="text-gray-600 mb-8">
          Transparan, terbuka, biar semua tau ke mana perginya duit iuran ✨
        </p>

        <div className="relative inline-block">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl blur-2xl opacity-40" />
          <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-white/80 text-xs font-bold mb-5 uppercase tracking-widest">
              Total Saldo
            </div>
            <div className="text-4xl md:text-6xl font-black text-white font-mono tabular-nums">
              {rupiah(saldo?.saldo ?? 0)}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-5xl mx-auto px-6 mb-12">
        <div className="grid md:grid-cols-2 gap-4">
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            iconBg="bg-green-100"
            border="border-green-200"
            label="Total Masuk"
            value={rupiah(saldo?.total_pemasukan ?? 0)}
            valueColor="text-green-600"
          />
          <StatCard
            icon={<TrendingDown className="w-5 h-5 text-red-600" />}
            iconBg="bg-red-100"
            border="border-red-200"
            label="Total Keluar"
            value={rupiah(saldo?.total_pengeluaran ?? 0)}
            valueColor="text-red-600"
          />
        </div>
      </section>

      <InfoPembayaran />

      {/* TUNGGAKAN */}
      <section className="max-w-5xl mx-auto px-6 mb-12">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
            Yang Belum Setor Iuran 👀
          </h2>
          <p className="text-gray-500 text-sm">Nama disamarkan demi privasi</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <TunggakanCard
            title={`Bulan Ini (${namaBulan(0)})`}
            data={tIni}
            color="orange"
          />
          <TunggakanCard
            title={`Bulan Lalu (${namaBulan(-1)})`}
            data={tLalu}
            color="red"
          />
        </div>
      </section>

      {/* FEED */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
            Aktivitas Terbaru 🎉
          </h2>
          <p className="text-gray-500 text-sm">10 transaksi terakhir</p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg overflow-hidden">
          {feed.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              Belum ada transaksi
            </div>
          ) : (
            <ul className="divide-y divide-amber-100">
              {feed.map((t: any) => (
                <li
                  key={t.id}
                  className="p-4 flex items-center gap-4 hover:bg-amber-50 transition"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      t.jenis === "pemasukan" ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {t.jenis === "pemasukan" ? (
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {t.kategori ?? "—"}
                    </div>
                    {t.jenis === "pengeluaran" && t.catatan && (
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2 italic">
                        &ldquo;{t.catatan}&rdquo;
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {tanggal(t.tanggal)}
                    </div>
                  </div>
                  <div
                    className={`font-mono tabular-nums font-bold ${
                      t.jenis === "pemasukan"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {t.jenis === "pemasukan" ? "+" : "-"}
                    {rupiah(t.nominal)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-amber-200 py-6 text-center text-xs text-gray-500">
        Dikelola dengan ❤️ oleh Bendahara Kas Kantor
      </footer>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatCard({
  icon,
  iconBg,
  border,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  border: string;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className={`bg-white rounded-3xl p-6 border-2 ${border} shadow-lg`}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="font-semibold text-gray-700">{label}</div>
      </div>
      <div
        className={`text-2xl font-black font-mono tabular-nums ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

function TunggakanCard({
  title,
  data,
  color,
}: {
  title: string;
  data: { inisial: string; jabatan: string }[];
  color: "orange" | "red";
}) {
  const border = color === "orange" ? "border-orange-200" : "border-red-200";
  const badge =
    color === "orange"
      ? "bg-orange-100 text-orange-700"
      : "bg-red-100 text-red-700";

  return (
    <div className={`bg-white rounded-3xl p-6 border-2 ${border} shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge}`}>
          {data.length} orang
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <PartyPopper className="w-8 h-8 text-green-500 mb-2" />
          <div className="font-semibold text-gray-700">Semua sudah setor!</div>
          <div className="text-xs text-gray-400">Mantap 🎊</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((p, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-mono font-bold text-gray-900 text-sm tracking-wider">
                  {p.inisial}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
