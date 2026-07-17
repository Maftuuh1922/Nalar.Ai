"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

const MAIN_NAV_ITEMS = [
  { href: "/beranda", label: "Beranda" },
  { href: "/materi-saya", label: "Materi Saya" },
  { href: "/latihan-soal", label: "Latihan Soal" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-black/10 bg-white px-4 py-6 dark:border-white/10 dark:bg-black">
      <div className="mb-8 px-2 text-lg font-semibold tracking-tight">Nalar AI</div>

      <nav className="flex flex-1 flex-col gap-1">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-black/10 pt-4 dark:border-white/10">
        <Link
          href="/pengaturan"
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/pengaturan"
              ? "bg-emerald-600 text-white"
              : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          }`}
        >
          Pengaturan
        </Link>

        {user && (
          <div className="mt-2 flex items-center justify-between px-3 text-xs text-black/50 dark:text-white/50">
            <span className="truncate">{user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="ml-2 shrink-0 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Keluar
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
