import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Ambil tanggal hari ini di timezone Jakarta (bukan UTC server)
export function todayJakarta() {
  const jakarta = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = jakarta.split("-").map(Number);
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return { tahun: y, bulan: m, tanggal: d, isLeapYear: isLeap };
}

// Cek apakah pegawai ultah hari ini (handle 29 Feb)
export function isUltahHariIni(tglLahir: string): boolean {
  if (!tglLahir) return false;
  const parts = tglLahir.split("-").map(Number);
  const bulanLahir = parts[1];
  const tanggalLahir = parts[2];
  const today = todayJakarta();

  // Match exact
  if (bulanLahir === today.bulan && tanggalLahir === today.tanggal) return true;

  // Edge case 29 Feb di tahun non-kabisat → tampil di 28 Feb
  if (
    bulanLahir === 2 &&
    tanggalLahir === 29 &&
    !today.isLeapYear &&
    today.bulan === 2 &&
    today.tanggal === 28
  ) {
    return true;
  }
  return false;
}
