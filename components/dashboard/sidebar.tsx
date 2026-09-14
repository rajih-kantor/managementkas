"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  FileBarChart,
  LogOut,
  Users,
  UserCircle,
} from "lucide-react";

const menu = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pemasukan", href: "/dashboard/pemasukan", icon: ArrowDownCircle },
  { label: "Pengeluaran", href: "/dashboard/pengeluaran", icon: ArrowUpCircle },
  { label: "Jabatan", href: "/dashboard/master/jabatan", icon: Users },
  { label: "Pegawai", href: "/dashboard/master/pegawai", icon: UserCircle },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
];

export default function Sidebar({
  userEmail = "bendahara@kantor.com",
}: {
  userEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-950">
      {/* Brand */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-gray-900" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">
              Kas Kantor
            </h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              Panel Bendahara
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
          Menu Utama
        </p>
        {menu.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] transition-colors ${
                  active
                    ? "text-gray-900"
                    : "text-gray-500 group-hover:text-white"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: User + Logout */}
      <div className="border-t border-gray-800 p-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-gray-300">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">Admin</p>
            <p className="text-[11px] text-gray-500 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-all hover:bg-gray-900 hover:text-white"
        >
          <LogOut className="w-[18px] h-[18px] text-gray-500 group-hover:text-white transition-colors" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
