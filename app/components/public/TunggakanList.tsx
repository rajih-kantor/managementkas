"use client";

import { useMemo, useState } from "react";
import { PartyPopper, Search, Users } from "lucide-react";

export type TunggakanRow = {
  inisial: string;
  jabatan: string;
  bulan: string[];
};

export default function TunggakanList({ data }: { data: TunggakanRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.inisial.toLowerCase().includes(q) ||
        p.jabatan.toLowerCase().includes(q),
    );
  }, [query, data]);

  return (
    <div className="bg-white rounded-3xl p-6 border-2 border-amber-200 shadow-lg">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau jabatan..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full border-2 border-amber-200 bg-amber-50/50 focus:outline-none focus:border-amber-400 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 whitespace-nowrap">
          {filtered.length} orang
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <PartyPopper className="w-10 h-10 text-green-500 mb-2" />
          <div className="font-semibold text-gray-700">Semua sudah setor!</div>
          <div className="text-xs text-gray-400">Mantap 🎊</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Tidak ada nama yang cocok
        </div>
      ) : (
        <ul className="space-y-2 max-h-[36rem] overflow-y-auto pr-1 scroll-smooth">
          {filtered.map((p, i) => (
            <li
              key={`${p.inisial}-${i}`}
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-50"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-gray-900 text-sm tracking-wider truncate">
                  {p.inisial}
                </div>
                {p.jabatan && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {p.jabatan}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.bulan.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
