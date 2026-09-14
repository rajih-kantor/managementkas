// ============================================================
// File: components/public/InfoPembayaran.tsx
// Purpose: Info rekening pembayaran kas di landing page publik
//          Match design amber/orange (Saweria-inspired) + Poppins
// ============================================================

"use client";

import { useState } from "react";
import { Wallet, Copy, Check, AlertCircle } from "lucide-react";

// Data rekening (hardcode — konsisten dgn Excel export)
const REKENING = {
  metode: "LinkAja",
  nomor: "082351121587",
  atasNama: "Zahra Ramadhanti",
} as const;

export default function InfoPembayaran() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(REKENING.nomor);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: kalau clipboard API gagal (mis. http non-secure)
      alert(`Nomor: ${REKENING.nomor}`);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg shadow-amber-100/50 md:p-8">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
            <Wallet className="text-white" size={24} />
          </div>
          <div>
            <h2 className="font-poppins text-xl font-bold text-gray-900 md:text-2xl">
              Info Pembayaran Kas
            </h2>
            <p className="font-poppins text-sm text-gray-600">
              Transfer via metode di bawah
            </p>
          </div>
        </div>

        {/* Card rekening */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100">
          {/* Metode */}
          <div className="mb-4 flex items-center justify-between border-b border-dashed border-amber-200 pb-4">
            <span className="font-poppins text-sm text-gray-500">Metode</span>
            <span className="font-poppins text-lg font-bold text-orange-600">
              {REKENING.metode}
            </span>
          </div>

          {/* Nomor + tombol copy */}
          <div className="mb-4 border-b border-dashed border-amber-200 pb-4">
            <div className="mb-1 font-poppins text-sm text-gray-500">Nomor</div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-poppins text-2xl font-bold tracking-wide text-gray-900">
                {REKENING.nomor}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 font-poppins text-sm font-semibold text-orange-700 transition hover:bg-amber-200 active:scale-95"
                aria-label="Salin nomor"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Salin
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Atas nama */}
          <div>
            <div className="mb-1 font-poppins text-sm text-gray-500">
              Atas Nama
            </div>
            <div className="font-poppins text-lg font-semibold text-gray-900">
              {REKENING.atasNama}
            </div>
          </div>
        </div>

        {/* Warning note */}
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-orange-100 p-3">
          <AlertCircle
            className="mt-0.5 flex-shrink-0 text-orange-600"
            size={18}
          />
          <p className="font-poppins text-sm text-orange-900">
            <span className="font-bold">Penting:</span> Pembayaran hanya
            diterima melalui <span className="font-bold">LinkAja</span>. Tidak
            menerima transfer via bank atau e-wallet lain.
          </p>
        </div>
      </div>
    </section>
  );
}
