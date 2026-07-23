"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { 
  MessageSquare, Library, BrainCircuit, TrendingUp, Settings, LogOut, 
  Bot, Edit3, FileText, Database, ChevronUp, Search, PanelLeftClose, PanelLeft, X,
  Home, Heart, Pen, Box, LayoutGrid, MoreHorizontal, Share2, PencilLine, Trash2, Plus
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { SettingsModal } from "@/components/settings-modal";
import { chatSessionsApi } from "@/lib/api";
import type { ChatSession } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

// Context for sidebar state
const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed(c => !c) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSessionId = searchParams.get("s");
  const { user, logout, token } = useAuth();
  const { t } = useLanguage();
  const { collapsed, toggle } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Fetch sessions
  useEffect(() => {
    if (!token) return;
    chatSessionsApi.getAll(token).then(setSessions).catch(() => {});
  }, [token]);

  // Close popup when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const initial = user ? user.email.charAt(0).toUpperCase() : "N";
  const username = user?.email?.split("@")[0] || "user";

  const filteredSessions = sessions.filter(s =>
    !searchQuery || (s.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (collapsed) {
    return (
      <>
        <aside className="hidden md:flex flex-col w-[70px] h-screen shrink-0 bg-transparent border-r border-black/5 items-center py-5 gap-2">
          <button onClick={toggle} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors mb-3">
            <PanelLeft className="h-4.5 w-4.5" />
          </button>
          
          <NavIconOnly href="/beranda" icon={Home} isActive={pathname === "/beranda"} label={t("home")} />
          <NavIconOnly href="/materi-saya" icon={Library} isActive={pathname === "/materi-saya"} label={t("materials")} />
          <NavIconOnly href="/agents" icon={Box} isActive={pathname === "/agents"} label={t("aiAssistant")} />
          <NavIconOnly href="/catatan" icon={Edit3} isActive={pathname === "/catatan"} label={t("notes")} />
          <NavIconOnly href="/latihan-soal" icon={BrainCircuit} isActive={pathname === "/latihan-soal"} label={t("practice")} />
          <NavIconOnly href="/progress" icon={LayoutGrid} isActive={pathname === "/progress"} label={t("learningSpace")} />

          <div className="mt-auto">
            <button 
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white text-xs font-bold hover:scale-105 transition-transform shadow-md"
            >
              {initial}
            </button>
          </div>
        </aside>
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <aside className="hidden md:flex flex-col w-[260px] h-screen shrink-0 bg-transparent border-r border-black/5">
        
        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between shrink-0">
          <Link href="/beranda" className="text-[22px] font-extrabold font-serif tracking-tight text-gray-900 hover:opacity-80 transition-opacity">
            Nalar AI.
          </Link>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setSearchOpen(!searchOpen)} 
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors"
              title="Cari"
            >
              <Search className="h-[17px] w-[17px]" />
            </button>
            <button 
              onClick={toggle} 
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors"
              title="Tutup sidebar"
            >
              <PanelLeftClose className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>

        {/* Search Bar (collapsible) */}
        {searchOpen && (
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-black/8 bg-black/5 px-3 py-2 shadow-none">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                autoFocus
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-gray-400 text-gray-800"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* New Chat Button */}
        <div className="px-3 pb-3 shrink-0">
          <Link
            href="/beranda"
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl bg-gray-900 text-white text-[13.5px] font-semibold hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{t("newChat")}</span>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 scrollbar-none">
          <nav className="flex flex-col gap-0.5">
            <NavItem href="/beranda" icon={Home} label={t("home")} isActive={pathname === "/beranda" && !currentSessionId} />
            <NavItem href="/materi-saya" icon={Library} label={t("materials")} isActive={pathname === "/materi-saya"} />
            <NavItem href="/agents" icon={Box} label={t("aiAssistant")} isActive={pathname === "/agents"} />
            <NavItem href="/catatan" icon={Edit3} label={t("notes")} isActive={pathname === "/catatan"} />
            <NavItem href="/latihan-soal" icon={BrainCircuit} label={t("practice")} isActive={pathname === "/latihan-soal"} />
            <NavItem href="/progress" icon={LayoutGrid} label={t("learningSpace")} isActive={pathname === "/progress"} />
          </nav>

          {/* Riwayat */}
          <div className="mt-6 mb-4">
            <div className="px-2 mb-2 flex items-center justify-between">
              <span className="text-[10.5px] text-gray-400 font-bold uppercase tracking-widest">{t("history")}</span>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-400 italic">
                {searchQuery ? t("notFound") : t("noConversations")}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredSessions.slice(0, 12).map((session) => {
                  const isActive = currentSessionId === session.id;
                  return (
                    <div
                      key={session.id}
                      className={`group relative flex items-center justify-between rounded-xl pr-1 transition-all duration-150 ${
                        isActive
                          ? "bg-black/7 text-gray-900"
                          : "text-gray-500 hover:text-gray-800 hover:bg-black/5"
                      }`}
                    >
                      <Link
                        href={`/beranda?s=${session.id}`}
                        className="flex items-center px-3 py-2 text-[13px] truncate flex-1 min-w-0"
                      >
                        <span className={`truncate ${isActive ? "font-semibold text-gray-900" : "font-normal"}`}>
                          {session.title || t("newConversation")}
                        </span>
                      </Link>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex shrink-0 items-center">
                        <Popover {...({ placement: "bottom-end", offset: 4 } as any)}>
                          <PopoverTrigger>
                            <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-1 min-w-[150px] shadow-xl border border-gray-100 rounded-xl bg-white">
                            <div className="flex flex-col w-full">
                              <button className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-gray-50 rounded-lg text-gray-700 w-full text-left transition-colors">
                                <Share2 className="h-3.5 w-3.5 text-gray-400" /> {t("share")}
                              </button>
                              <button className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-gray-50 rounded-lg text-gray-700 w-full text-left transition-colors">
                                <PencilLine className="h-3.5 w-3.5 text-gray-400" /> {t("rename")}
                              </button>
                              <div className="h-px bg-gray-100 my-1 mx-1"></div>
                              <button className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-red-50 rounded-lg text-red-600 w-full text-left transition-colors">
                                <Trash2 className="h-3.5 w-3.5 text-red-500" /> {t("delete")}
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Bar - pinned to bottom */}
        <div className="relative shrink-0 px-3 pb-4 pt-2 border-t border-black/5" onClick={(e) => e.stopPropagation()}>
          {/* Popup Menu */}
          {menuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl border border-black/5 bg-white/90 backdrop-blur-xl p-2 shadow-xl shadow-black/5 z-50">
              <div className="px-3 py-2.5 mb-1.5 rounded-xl bg-gray-50">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">{t("signedInAs")}</span>
                <span className="text-[13px] font-bold text-gray-900 truncate block mt-0.5">{user?.email}</span>
              </div>
              <button 
                onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left w-full"
              >
                <Settings className="h-4 w-4 text-gray-400" /> {t("settings")}
              </button>
              <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left w-full">
                <Database className="h-4 w-4 text-gray-400" /> {t("memory")}
              </button>
              <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left w-full">
                <FileText className="h-4 w-4 text-gray-400" /> {t("knowledge")}
              </button>
              <div className="my-1.5 h-px bg-black/5"></div>
              <button 
                onClick={logout}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors text-left w-full"
              >
                <LogOut className="h-4 w-4 text-red-500" /> {t("logout")}
              </button>
            </div>
          )}

          {/* User Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-between w-full p-1.5 rounded-xl hover:bg-black/5 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-[13px] font-bold shadow-sm group-hover:scale-105 transition-transform">
                {initial}
              </div>
              <div className="flex flex-col items-start truncate min-w-0">
                <span className="text-[13.5px] font-bold text-gray-900 truncate w-full">{username}</span>
                <span className="text-[11px] font-medium text-gray-500">{t("freePlan")}</span>
              </div>
            </div>
            <ChevronUp className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </aside>

      {/* Floating Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function NavItem({ href, icon: Icon, label, isActive }: { href: string; icon: any; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${
        isActive
          ? "bg-black/7 text-gray-900 font-semibold"
          : "text-gray-500 hover:text-gray-800 hover:bg-black/5"
      }`}
    >
      <Icon 
        strokeWidth={isActive ? 2.2 : 1.8} 
        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-gray-800" : "text-gray-400"}`} 
      />
      {label}
    </Link>
  );
}

function NavIconOnly({ href, icon: Icon, isActive, label }: { href: string; icon: any; isActive: boolean; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
        isActive
          ? "bg-black/7 text-gray-900"
          : "text-gray-400 hover:text-gray-700 hover:bg-black/5"
      }`}
    >
      <Icon strokeWidth={isActive ? 2.2 : 1.8} className={`h-[18px] w-[18px] ${isActive ? "text-gray-800" : "text-gray-400"}`} />
    </Link>
  );
}
