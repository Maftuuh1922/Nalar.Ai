"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Library, BrainCircuit, TrendingUp, Settings, LogOut, Globe, HelpCircle, ArrowUpCircle, Download, Info, ChevronsUpDown, Bot, Edit3 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const MAIN_NAV_ITEMS = [
  { href: "/beranda", label: "Beranda", icon: MessageSquare },
  { href: "/materi-saya", label: "Materi Saya", icon: Library },
  { href: "/latihan-soal", label: "Latihan Soal", icon: BrainCircuit },
  { href: "/agents", label: "Asisten AI", icon: Bot },
  { href: "/catatan", label: "Catatan", icon: Edit3 },
  { href: "/progress", label: "Progress Belajar", icon: TrendingUp },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="md:hidden sticky top-0 z-50 flex flex-col">
      <div className="flex items-center justify-between border-b border-cloudy/30 bg-pampas px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold tracking-tight text-crail text-2xl font-serif">Nalar AI.</Link>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-cloudy hover:text-crail hover:bg-white/60 transition-colors"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[60px] z-50 bg-white flex flex-col shadow-xl overflow-y-auto">
          <nav className="flex flex-1 flex-col gap-1 p-4 overflow-y-auto">
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-all ${
                    isActive
                      ? "bg-pampas text-crail border border-cloudy/20 shadow-sm"
                      : "text-cloudy hover:bg-pampas hover:text-crail"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            
            <div className="mt-8 px-4">
              <p className="text-xs font-bold text-cloudy uppercase tracking-widest mb-3">Riwayat Anda</p>
              <div className="text-sm text-cloudy/60 italic">Belum ada riwayat.</div>
            </div>
          </nav>
          
          <div className="relative border-t border-cloudy/30 p-4 pb-6 mt-auto flex flex-col gap-4">
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute bottom-full left-4 right-4 z-50 mb-2 rounded-2xl border border-cloudy/30 bg-white p-2 shadow-xl">
                  <div className="mb-2 px-3 py-2 text-xs font-medium text-cloudy">
                    {user?.email}
                  </div>
                  <Link href="/pengaturan" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail" onClick={() => { setIsDropdownOpen(false); setIsOpen(false); }}>
                    <Settings className="h-4 w-4" />
                    Pengaturan
                  </Link>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail">
                    <Globe className="h-4 w-4" />
                    Bahasa
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail">
                    <HelpCircle className="h-4 w-4" />
                    Dapatkan bantuan
                  </button>
                  
                  <div className="my-1 border-t border-cloudy/20"></div>
                  
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail">
                    <ArrowUpCircle className="h-4 w-4" />
                    Tingkatkan paket
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail">
                    <Download className="h-4 w-4" />
                    Aplikasi dan ekstensi
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-pampas hover:text-crail">
                    <Info className="h-4 w-4" />
                    Pelajari lebih lanjut
                  </button>
                  
                  <div className="my-1 border-t border-cloudy/20"></div>

                  <button onClick={() => { setIsOpen(false); logout(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-red-50 hover:text-red-600">
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </div>
              </>
            )}

            {user && (
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex w-full items-center justify-between rounded-xl bg-transparent p-2 transition-colors hover:bg-pampas"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crail text-sm font-bold text-white">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start truncate text-left">
                    <span className="truncate text-sm font-medium text-foreground">
                      {user.email.split('@')[0]}
                    </span>
                    <span className="truncate text-xs text-cloudy">
                      Paket gratis
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronsUpDown className="h-4 w-4 text-cloudy" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
