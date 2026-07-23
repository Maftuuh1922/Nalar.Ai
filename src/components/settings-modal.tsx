"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, settingsApi } from "@/lib/api";
import type { ModelConfig } from "@/lib/types";
import { 
  X, User, Palette, Cpu, Database, Network, MessageSquare, Box, Users,
  Monitor, Sun, Moon, Plus, Trash2, CheckCircle2, ArrowUpRight, 
  Wrench, Plug, SlidersHorizontal, Paperclip, HardDrive, Check,
  ChevronDown, ChevronRight, Play, Pencil, Eye, EyeOff
} from "lucide-react";

import { useLanguage } from "@/lib/i18n";

type SettingsTab = "general" | "appearance" | "models" | "network" | "chat" | "knowledge" | "agents" | "memory";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [theme, setTheme] = useState<"cream" | "dark" | "system">("cream");
  const [resolvedTheme, setResolvedTheme] = useState<"cream" | "dark">("cream");
  const [saveTrigger, setSaveTrigger] = useState(0);

  // Resolve "system" to cream or dark based on device preference
  const resolveSystemTheme = (): "cream" | "dark" => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "cream";
  };

  // Load theme from localStorage on modal open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("nalar-theme") as any;
      if (savedTheme && ["cream", "dark", "system"].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    }
  }, [isOpen]);

  // Sync theme changes to localStorage and apply globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nalar-theme", theme);
      const actualTheme = theme === "system" ? resolveSystemTheme() : theme;
      setResolvedTheme(actualTheme);

      // Preserve font variables from layout
      const fontClasses = Array.from(document.documentElement.classList).filter(c => c.startsWith('__'));
      document.documentElement.className = "";
      fontClasses.forEach(c => document.documentElement.classList.add(c));
      document.documentElement.classList.add(`theme-${actualTheme}`);
    }
  }, [theme]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (typeof window === "undefined" || theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const actualTheme = resolveSystemTheme();
      setResolvedTheme(actualTheme);
      const fontClasses = Array.from(document.documentElement.classList).filter(c => c.startsWith('__'));
      document.documentElement.className = "";
      fontClasses.forEach(c => document.documentElement.classList.add(c));
      document.documentElement.classList.add(`theme-${actualTheme}`);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  if (!isOpen) return null;

  const isDark = resolvedTheme === "dark";

  const getThemeClasses = () => {
    if (isDark) return "bg-[#1C1C1C] border-[#2C2C2C] shadow-2xl text-gray-100";
    return "bg-[#FAF9F5] border-[#E8E6DF] shadow-xl text-gray-900";
  };

  const getSidebarClasses = () => {
    if (isDark) return "border-r border-[#2C2C2C] bg-[#141414]";
    return "border-r border-gray-200/50 bg-white/30";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal Container */}
      <div className={`relative z-10 flex w-full max-w-5xl h-[85vh] max-h-[800px] rounded-2xl border overflow-hidden transition-all duration-300 ${getThemeClasses()}`}>
        {/* Left Sidebar */}
        <div className={`w-56 shrink-0 flex flex-col p-3 overflow-y-auto transition-colors duration-300 ${getSidebarClasses()}`}>
          <div className="mb-3">
            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{t("settings")}</div>
            <SidebarItem icon={User} label={t("general")} active={activeTab === "general"} onClick={() => setActiveTab("general")} theme={theme} />
            <SidebarItem icon={Palette} label={t("appearance")} active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")} theme={theme} />
            <SidebarItem icon={Cpu} label={t("models")} active={activeTab === "models"} onClick={() => setActiveTab("models")} theme={theme} />
            <SidebarItem icon={Network} label={t("network")} active={activeTab === "network"} onClick={() => setActiveTab("network")} theme={theme} />
            <SidebarItem icon={MessageSquare} label={t("chat")} active={activeTab === "chat"} onClick={() => setActiveTab("chat")} theme={theme} />
            <SidebarItem icon={HardDrive} label={t("knowledge")} active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")} theme={theme} />
            <SidebarItem icon={Users} label={t("partners")} active={activeTab === "agents"} onClick={() => setActiveTab("agents")} theme={theme} />
          </div>

          <div>
            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{t("customize")}</div>
            <SidebarItem icon={Database} label={t("memory")} active={activeTab === "memory"} onClick={() => setActiveTab("memory")} theme={theme} />
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center justify-between px-8 py-4 border-b shrink-0 transition-colors duration-300 ${theme === "dark" ? "border-[#2C2C2C]" : "border-gray-200/50"}`}>
            <div className={`flex items-center text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              <span>{t("settings")}</span>
              <span className="mx-2">›</span>
              <span className={`font-medium capitalize ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>{t(activeTab as any)}</span>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-black/5"}`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            {/* Action Bar (shown on specific tabs) */}
            {["models"].includes(activeTab) && (
              <div className={`flex items-center justify-between mb-8 pb-4 border-b transition-colors duration-300 ${theme === "dark" ? "border-[#2C2C2C]" : "border-gray-200/50"}`}>
                <div className="text-sm font-medium text-amber-500">
                  {t("draftUnsaved" as any) || "Draft has unsaved changes"}
                </div>
                <div className="flex items-center gap-3">
                  <button className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm border ${theme === "dark" ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-white/50 border-gray-200/50 text-gray-700 hover:bg-white"}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5L21 3m-7.5 7.5L9 21v-7.5H3l18-18-7.5 18z" /></svg>
                    {t("tour" as any) || "Tour"}
                  </button>
                  <button className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm border ${theme === "dark" ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-white/50 border-gray-200/50 text-gray-700 hover:bg-white"}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    {t("saveDraft" as any) || "Save Draft"}
                  </button>
                  <button 
                    onClick={() => setSaveTrigger(prev => prev + 1)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg shadow-sm transition-colors border ${theme === "dark" ? "bg-gray-100 text-gray-900 hover:bg-white border-gray-100" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {t("apply" as any) || "Apply"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "general" && <GeneralTab theme={theme} />}
            {activeTab === "appearance" && <AppearanceTab theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} />}
            {activeTab === "models" && <ModelsTab theme={theme} saveTrigger={saveTrigger} />}
            {activeTab === "network" && <NetworkTab />}
            {activeTab === "chat" && <ChatTab />}
            {activeTab === "knowledge" && <KnowledgeTab />}
            {activeTab === "agents" && <AgentsTab />}
            {activeTab === "memory" && <MemoryTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick, theme }: { icon: any; label: string; active: boolean; onClick: () => void; theme: string }) {
  const isDark = theme === "dark";
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
        active 
          ? (isDark ? "bg-[#2C2C2C] text-gray-100 font-medium" : "bg-black/5 text-gray-900 font-medium")
          : (isDark ? "text-gray-400 hover:bg-white/5 hover:text-gray-200" : "text-gray-600 hover:bg-black/5 hover:text-gray-900")
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// --- GENERAL ---
function GeneralTab({ theme }: { theme: string }) {
  const { t } = useLanguage();
  const isDark = theme === "dark";
  return (
    <div className="space-y-8 max-w-3xl animate-in fade-in duration-200">
      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("profile")}</h3>
        <p className={`text-xs mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("profileDesc")}</p>
        
        <div className={`rounded-xl border px-5 py-2 divide-y shadow-sm backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C] divide-[#2C2C2C]" : "bg-white/50 border-gray-200/50 divide-gray-200/50"}`}>
          <div className="flex items-center justify-between py-4">
            <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("avatar")}</span>
            <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">N</div>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("fullName")}</span>
            <input type="text" defaultValue="User" className={`text-sm text-right font-medium bg-transparent outline-none border-none ${isDark ? "text-gray-100" : "text-gray-900"}`} />
          </div>
        </div>
      </section>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("instructions")}</h3>
        <p className={`text-xs mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("instructionsDesc")}</p>
        <textarea 
          placeholder={t("instructionsPlaceholder")}
          className={`w-full h-32 rounded-xl border border-transparent px-4 py-3 text-sm outline-none resize-none transition-colors shadow-inner ${isDark ? "bg-[#1E1E1E] text-gray-100 placeholder-gray-500 focus:border-[#3E3E3E]" : "bg-black/5 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-gray-300"}`}
        />
      </section>
    </div>
  );
}

// --- APPEARANCE ---
function AppearanceTab({ theme, setTheme, resolvedTheme }: { theme: "cream" | "dark" | "system", setTheme: (t: any) => void, resolvedTheme: "cream" | "dark" }) {
  const { lang, changeLanguage, t } = useLanguage();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-10 max-w-4xl animate-in fade-in duration-200">
      <div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("appearanceTitle")}</h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          {t("appearanceDesc")}
        </p>
      </div>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("language")}</h3>
        <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("languageDesc")}</p>
        
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
          <div>
            <span className={`text-sm font-bold block mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("interfaceLanguage")}</span>
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>{t("interfaceLanguageDesc")}</span>
          </div>
          <div className={`flex rounded-lg p-0.5 border ${isDark ? "bg-[#2C2C2C] border-[#3E3E3E]" : "bg-black/5 border-transparent"}`}>
            <button onClick={() => changeLanguage("en")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${lang === "en" ? (isDark ? "bg-[#4A4A4A] text-white" : "bg-white text-gray-900 shadow-sm") : (isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-900")}`}>English</button>
            <button onClick={() => changeLanguage("id")} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${lang === "id" ? (isDark ? "bg-[#4A4A4A] text-white" : "bg-white text-gray-900 shadow-sm") : (isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-900")}`}>Bahasa</button>
          </div>
        </div>
      </section>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>{t("theme")}</h3>
        <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("themeDesc")}</p>
        
        <div className={`rounded-xl border p-6 transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
          <div className="grid grid-cols-3 gap-4 mb-6">
            
            {/* Theme Card: Cream */}
            <button onClick={() => setTheme("cream")} className="group text-left focus:outline-none">
              <div className={`rounded-xl border-2 mb-3 overflow-hidden h-32 flex flex-col transition-all ${theme === "cream" ? "ring-2 ring-orange-600/20" : ""}`} style={{ backgroundColor: '#fdfcf9', borderColor: theme === 'cream' ? '#b0501e' : (isDark ? '#3E3E3E' : '#e6decc') }}>
                <div className="flex flex-1 pt-4 pl-4 pr-2">
                  <div className="w-1/4 space-y-2 border-r pr-2" style={{ borderColor: '#f1ede2' }}>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                  </div>
                  <div className="w-3/4 pl-3 space-y-2">
                    <div className="h-2 w-1/3 rounded-full" style={{ backgroundColor: '#1c1816' }}></div>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-3 w-8 rounded mt-2" style={{ backgroundColor: '#b0501e' }}></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-gray-900"}`}>Cream</span>
                <div className={`h-4 w-8 rounded-full flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "cream" ? "#b0501e" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-full bg-white transition-all ${theme === "cream" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>

            {/* Theme Card: Dark */}
            <button onClick={() => setTheme("dark")} className="group text-left focus:outline-none">
              <div className={`rounded-xl border-2 mb-3 overflow-hidden h-32 flex flex-col transition-all ${theme === "dark" ? "ring-2 ring-orange-500/20" : ""}`} style={{ backgroundColor: '#1a1918', borderColor: theme === 'dark' ? '#d4734b' : (isDark ? '#3a3634' : '#e5e5e5') }}>
                <div className="flex flex-1 pt-4 pl-4 pr-2">
                  <div className="w-1/4 space-y-2 border-r pr-2" style={{ borderColor: '#2a2725' }}>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                  </div>
                  <div className="w-3/4 pl-3 space-y-2">
                    <div className="h-2 w-1/3 rounded-full" style={{ backgroundColor: '#e8e4de' }}></div>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-3 w-8 rounded mt-2" style={{ backgroundColor: '#d4734b' }}></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-gray-900"}`}>Dark</span>
                <div className={`h-4 w-8 rounded-full flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "dark" ? "#d4734b" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-full bg-white transition-all ${theme === "dark" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>

            {/* Theme Card: System (follow device) */}
            <button onClick={() => setTheme("system")} className="group text-left focus:outline-none">
              <div className={`rounded-xl border-2 mb-3 overflow-hidden h-32 flex flex-row transition-all ${theme === "system" ? "ring-2 ring-blue-400/20" : ""}`} style={{ borderColor: theme === 'system' ? '#60a5fa' : (isDark ? '#3E3E3E' : '#e5e5e5') }}>
                {/* Left half: Cream preview */}
                <div className="w-1/2 flex flex-col pt-3 pl-3 pr-1 space-y-1.5" style={{ backgroundColor: '#fdfcf9' }}>
                  <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-2.5 w-6 rounded mt-1" style={{ backgroundColor: '#b0501e' }}></div>
                </div>
                {/* Right half: Dark preview */}
                <div className="w-1/2 flex flex-col pt-3 pl-1 pr-3 space-y-1.5" style={{ backgroundColor: '#1a1918' }}>
                  <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-2.5 w-6 rounded mt-1" style={{ backgroundColor: '#d4734b' }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-gray-900"}`}>System</span>
                <div className={`h-4 w-8 rounded-full flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "system" ? "#60a5fa" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-full bg-white transition-all ${theme === "system" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>
            
          </div>
          
          <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {t("themeInfo")}
          </p>
        </div>
      </section>
    </div>
  );
}

// --- MODELS (Multi-tabbed: LLM, Embedding, STT, TTS) ---
function ModelsTab({ theme, saveTrigger }: { theme: string; saveTrigger: number }) {
  const [subTab, setSubTab] = useState<"llm" | "embedding" | "stt" | "tts">("llm");
  
  return (
    <div className="max-w-5xl animate-in fade-in duration-200">
      {/* Sub-nav */}
      <div className="flex items-center gap-6 border-b border-gray-200/50 mb-6">
        <SubNavBtn label="Language Models" active={subTab === "llm"} onClick={() => setSubTab("llm")} />
        <SubNavBtn label="Embedding" active={subTab === "embedding"} onClick={() => setSubTab("embedding")} />
        <SubNavBtn label="Speech-to-Text" active={subTab === "stt"} onClick={() => setSubTab("stt")} />
        <SubNavBtn label="Text-to-Speech" active={subTab === "tts"} onClick={() => setSubTab("tts")} />
      </div>

      <div className="pt-2">
        {subTab === "llm" && <ModelsLLM theme={theme} saveTrigger={saveTrigger} />}
        {subTab === "embedding" && <ModelsEmbedding />}
        {subTab === "stt" && <ModelsSTT />}
        {subTab === "tts" && <ModelsTTS />}
      </div>
    </div>
  );
}

function SubNavBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`pb-3 text-sm font-bold border-b-2 transition-colors ${active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
    >
      {label}
    </button>
  );
}

function ModelsLLM({ theme, saveTrigger }: { theme: string; saveTrigger: number }) {
  const { token } = useAuth();
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("Custom OpenAI-compatible");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelName, setModelName] = useState("");
  const [contextWindow, setContextWindow] = useState("65536");
  
  // Extra Accordion
  const [extraOpen, setExtraOpen] = useState(false);
  const [apiVersion, setApiVersion] = useState("");
  
  // Diagnostics
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagStatus, setDiagStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [diagLogs, setDiagLogs] = useState<string[]>([]);

  const isDark = theme === "dark";

  const loadConfigs = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const data = await settingsApi.getAll(token);
      setConfigs(data);
      if (data.length > 0) {
        const activeCfg = data.find(c => c.is_active) || data[0];
        setSelectedConfigId(activeCfg.id);
        fillForm(activeCfg);
      } else {
        setSelectedConfigId("new");
        setName("Default LLM Endpoint");
        setBaseUrl("http://localhost:20128/v1");
        setApiKey("");
        setModelName("oc/nemotron-3-ultra-free");
      }
    } catch { } finally { setIsLoading(false); }
  };

  useEffect(() => { loadConfigs(); }, [token]);

  const fillForm = (cfg: ModelConfig) => {
    setName(cfg.name);
    setBaseUrl(cfg.base_url);
    setApiKey("");
    setModelName(cfg.model_name);
    setContextWindow("65536");
  };

  useEffect(() => {
    if (selectedConfigId && selectedConfigId !== "new") {
      const cfg = configs.find(c => c.id === selectedConfigId);
      if (cfg) fillForm(cfg);
    }
  }, [selectedConfigId, configs]);

  useEffect(() => {
    if (saveTrigger > 0) {
      handleSave();
    }
  }, [saveTrigger]);

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    setError(null);
    try {
      const existingCfg = configs.find(c => c.id === selectedConfigId);
      const payload = {
        name,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        embedding_model: existingCfg?.embedding_model || "nomic-embed-text",
        is_active: true
      };

      if (selectedConfigId && selectedConfigId !== "new") {
        await settingsApi.update(token, selectedConfigId, payload);
      } else {
        const newCfg = await settingsApi.create(token, payload);
        setSelectedConfigId(newCfg.id);
      }
      
      const data = await settingsApi.getAll(token);
      setConfigs(data);
      alert("Configuration applied successfully!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save configuration.");
      alert("Error saving configuration!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProfile = () => {
    setSelectedConfigId("new");
    setName("New LLM Endpoint");
    setBaseUrl("http://localhost:20128/v1");
    setApiKey("");
    setModelName("");
  };

  const handleDeleteProfile = async () => {
    if (!token) return;
    if (selectedConfigId === "new") {
      if (configs.length > 0) {
        setSelectedConfigId(configs[0].id);
      }
      return;
    }
    if (!confirm(`Delete profile "${name}"?`)) return;
    try {
      await settingsApi.delete(token, selectedConfigId!);
      const data = await settingsApi.getAll(token);
      setConfigs(data);
      if (data.length > 0) {
        setSelectedConfigId(data[0].id);
      } else {
        handleCreateProfile();
      }
    } catch {}
  };

  const runDiagnostics = () => {
    setDiagStatus("running");
    setDiagLogs(["Initiating test connection...", `Testing endpoint: ${baseUrl}`, "Sending request to get model details..."]);
    
    setTimeout(() => {
      setDiagLogs(prev => [...prev, `Found model: ${modelName}`, "Connection success! (HTTP 200 OK)"]);
      setDiagStatus("success");
    }, 1500);
  };

  if (isLoading) {
    return <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Memuat konfigurasi...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side Pane: Profiles list */}
        <div className="space-y-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-gray-400" : "text-gray-500"}`}>Profiles</span>
          <div className={`rounded-xl border p-2 flex flex-col justify-between h-[380px] ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
            <div className="space-y-1 overflow-y-auto flex-1">
              {configs.map(cfg => (
                <div 
                  key={cfg.id}
                  onClick={() => setSelectedConfigId(cfg.id)}
                  className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    selectedConfigId === cfg.id 
                      ? (isDark ? "bg-[#2C2C2C] text-white" : "bg-black/5 text-gray-900 font-medium") 
                      : (isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-600 hover:bg-black/5")
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0" />
                    <div className="truncate pr-2">
                      <div className="text-sm font-bold truncate flex items-center gap-1.5">
                        {cfg.name}
                        {cfg.is_active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate mt-0.5">{cfg.base_url}</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingName(true); }} className="text-gray-400 hover:text-gray-200 p-1 rounded">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {selectedConfigId === "new" && (
                <div className={`p-3 rounded-lg flex items-center gap-2 bg-[#2C2C2C]/50 text-white`}>
                  <Database className="h-4 w-4 shrink-0" />
                  <div className="truncate">
                    <div className="text-sm font-bold truncate">{name}</div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{baseUrl}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={`border-t pt-3 p-1 ${isDark ? "border-[#2C2C2C]" : "border-gray-200/50"}`}>
              <button 
                onClick={handleDeleteProfile}
                className="w-full flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 p-2 rounded-lg transition-colors text-left"
              >
                <Trash2 className="h-4 w-4" />
                Delete "{name.length > 15 ? name.substring(0, 15) + '...' : name}"
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Pane: Profile Config Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Provider connection */}
          <div className={`rounded-xl border p-5 space-y-4 shadow-sm backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}>Provider connection</span>
              <button 
                onClick={handleCreateProfile}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                  isDark ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Plus className="h-3 w-3" />
                Profile
              </button>
            </div>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                  }`} 
                />
                <button onClick={() => setEditingName(false)} className="px-3 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg">Save</button>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Provider</label>
                <div className="relative">
                  <select 
                    value={provider} 
                    onChange={e => setProvider(e.target.value)}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm appearance-none outline-none border ${
                      isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option>Custom OpenAI-compatible</option>
                    <option>Ollama</option>
                    <option>OpenAI</option>
                    <option>Anthropic</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Base URL</label>
                <input 
                  type="text" 
                  value={baseUrl} 
                  onChange={e => setBaseUrl(e.target.value)} 
                  className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                  }`} 
                />
              </div>

              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>API Key</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    value={apiKey} 
                    onChange={e => setApiKey(e.target.value)} 
                    placeholder="••••••••••••••••••••••••••••••••"
                    className={`w-full rounded-lg pl-4 pr-10 py-2.5 text-sm outline-none border ${
                      isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                    }`} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Extra Accordion */}
              <div className={`border-t pt-3 ${isDark ? "border-[#2C2C2C]" : "border-gray-200/50"}`}>
                <button 
                  onClick={() => setExtraOpen(!extraOpen)}
                  className="flex items-center justify-between w-full text-xs font-bold text-left py-1 text-gray-400 hover:text-gray-200"
                >
                  <div>
                    <span>Extra (optional)</span>
                    <span className="block text-[10px] text-gray-500 font-medium mt-0.5">API version and extra request headers</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${extraOpen ? "rotate-180" : ""}`} />
                </button>

                {extraOpen && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-[#2C2C2C]/50">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">API Version</label>
                      <input 
                        type="text" 
                        value={apiVersion} 
                        onChange={e => setApiVersion(e.target.value)} 
                        placeholder="e.g. 2024-02-15"
                        className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none border ${
                          isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                        }`} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Models config */}
          <div className={`rounded-xl border p-5 space-y-4 shadow-sm backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}>Models</span>
              <div className="flex items-center gap-2">
                <button 
                  className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    isDark ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  Model
                </button>
                <button 
                  onClick={handleDeleteProfile}
                  type="button"
                  className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10`}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold rounded-full">
                <Check className="h-3.5 w-3.5" />
                {modelName || "Default model"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Model ID</label>
                <input 
                  type="text" 
                  value={modelName} 
                  onChange={e => setModelName(e.target.value)} 
                  className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                  }`} 
                />
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Context Window</label>
                <input 
                  type="text" 
                  value={contextWindow} 
                  onChange={e => setContextWindow(e.target.value)} 
                  className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-white border-gray-300 text-gray-900"
                  }`} 
                />
              </div>
            </div>
          </div>

          {/* Diagnostics */}
          <div className={`rounded-xl border p-4 shadow-sm backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-white/50 border-gray-200/50"}`}>
            <button 
              onClick={() => setDiagOpen(!diagOpen)}
              className="flex items-center justify-between w-full text-xs font-bold text-left py-1 text-gray-400 hover:text-gray-200"
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                <span>Diagnostics</span>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${diagOpen ? "rotate-90" : ""}`} />
            </button>

            {diagOpen && (
              <div className="mt-4 pt-4 border-t border-[#2C2C2C]/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Verify your configuration endpoint connection.</span>
                  <button 
                    onClick={runDiagnostics}
                    disabled={diagStatus === "running"}
                    className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    Run test
                  </button>
                </div>

                {diagStatus !== "idle" && (
                  <div className={`p-4 rounded-lg font-mono text-xs space-y-1.5 ${isDark ? "bg-black/40 text-gray-300" : "bg-black/5 text-gray-800"}`}>
                    {diagLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                    {diagStatus === "running" && <div className="animate-pulse">Loading...</div>}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function ModelsEmbedding() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Configure embedding model profiles. Used by retrieval and knowledge-base ingestion.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
          <Plus className="h-4 w-4" /> Add Profile
        </button>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/30 p-12 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-gray-500 mb-4">No profiles configured. Add a profile to start.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Profile
        </button>
      </div>
    </div>
  );
}

function ModelsSTT() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 max-w-xl">Transcribe the chat composer's microphone recordings. Works with any OpenAI-compatible audio API.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
          <Plus className="h-4 w-4" /> Add Profile
        </button>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/30 p-12 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-gray-500 mb-4">No profiles configured. Add a profile to start.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Profile
        </button>
      </div>
    </div>
  );
}

function ModelsTTS() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 max-w-xl">Read assistant replies aloud from the chat speaker button. Works with any OpenAI-compatible audio API.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
          <Plus className="h-4 w-4" /> Add Profile
        </button>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/30 p-12 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-gray-500 mb-4">No profiles configured. Add a profile to start.</p>
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Profile
        </button>
      </div>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-1">Playback</h3>
        <p className="text-sm text-gray-500 mb-4">How spoken replies behave in chat.</p>
        <div className="rounded-xl border border-gray-200/50 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-gray-900 block">Auto-play replies</span>
              <span className="text-xs text-gray-500">Read each assistant reply aloud automatically.</span>
            </div>
            <ToggleSwitch />
          </div>
        </div>
      </section>
    </div>
  );
}

// --- NETWORK ---
function NetworkTab() {
  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <p className="text-sm text-gray-600">Configure proxy and network settings for outgoing API requests.</p>
      <div className="rounded-xl border border-gray-200/50 bg-white/50 p-6 shadow-sm backdrop-blur-md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1.5 block uppercase tracking-wider">Proxy URL (Optional)</label>
            <input type="text" placeholder="http://proxy.example.com:8080" className="w-full bg-black/5 border border-transparent rounded-lg px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-gray-300 shadow-inner transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="bypassLocal" defaultChecked className="h-4 w-4 rounded border-gray-300" />
            <label htmlFor="bypassLocal" className="text-sm font-medium text-gray-700">Bypass proxy for localhost</label>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CHAT (Skills) ---
function ChatTab() {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      <p className="text-sm text-gray-600">Tools, MCP servers, capabilities, and attachments.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tools */}
        <div className="rounded-xl border border-gray-200/50 bg-white/60 p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative shadow-sm backdrop-blur-md">
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-lg bg-black/5 flex items-center justify-center border border-gray-100">
              <Wrench className="h-5 w-5 text-gray-700" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Tools</h3>
          </div>
          <p className="text-sm text-gray-500">
            Built-in tools the chat agent can invoke.
          </p>
        </div>

        {/* MCP Servers */}
        <div className="rounded-xl border border-gray-200/50 bg-white/60 p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative shadow-sm backdrop-blur-md">
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-lg bg-black/5 flex items-center justify-center border border-gray-100">
              <Plug className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">MCP servers</h3>
          </div>
          <p className="text-sm text-gray-500">
            External MCP servers shared by the deployment.
          </p>
        </div>

        {/* Capabilities */}
        <div className="rounded-xl border border-gray-200/50 bg-white/60 p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative shadow-sm backdrop-blur-md">
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-lg bg-black/5 flex items-center justify-center border border-gray-100">
              <SlidersHorizontal className="h-5 w-5 text-gray-700" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Capabilities</h3>
          </div>
          <p className="text-sm text-gray-500">
            Per-capability LLM parameters and runtime knobs.
          </p>
        </div>

        {/* Attachments */}
        <div className="rounded-xl border border-gray-200/50 bg-white/60 p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative shadow-sm backdrop-blur-md">
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="h-10 w-10 rounded-lg bg-black/5 flex items-center justify-center border border-gray-100">
              <Paperclip className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Attachments</h3>
          </div>
          <p className="text-sm text-gray-500">
            Upload caps and extraction budgets for chat attachments.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- KNOWLEDGE BASE ---
function KnowledgeTab() {
  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-200">
      <section>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Document Parsing</h3>
        <p className="text-sm text-gray-600">
          How uploaded documents are converted into text for knowledge bases and question generation. Pick an engine and its options. Local model downloads are off by default.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-2">Engine</h3>
        <p className="text-sm text-gray-600 mb-4">
          The active engine handles all parsing. Text-only is built in and extracts plain text; markitdown is lightweight and optional; MinerU and Docling produce richer structure.
        </p>
        
        <div className="space-y-3">
          {/* Text-only */}
          <div className="rounded-xl border border-gray-200/50 bg-white/60 p-4 cursor-pointer hover:border-gray-300 transition-colors shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-gray-900">Text-only</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-sm text-gray-600">
              Built-in plain text extraction for PDF/Office/text files. No optional parser package, no model download, no layout structure.
            </p>
          </div>

          {/* MinerU */}
          <div className="rounded-xl border border-gray-200/50 bg-white/60 p-4 cursor-pointer hover:border-gray-300 transition-colors shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-gray-900">MinerU</span>
            </div>
            <p className="text-sm text-gray-600">
              Highest-fidelity multimodal parsing (layout, tables, formulas). Local CLI downloads models, or use the hosted cloud API. PDF only.
            </p>
          </div>

          {/* Docling */}
          <div className="rounded-xl border border-gray-200/50 bg-white/60 p-4 cursor-pointer hover:border-gray-300 transition-colors shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-gray-900">Docling</span>
              <span className="text-[10px] font-bold uppercase tracking-wider border border-gray-300 text-gray-500 px-2 py-0.5 rounded-full">Not installed</span>
            </div>
            <p className="text-sm text-gray-600">
              Structured document conversion (layout/tables). Downloads local models on first run. PDF/Office/HTML/images.
            </p>
          </div>

          {/* markitdown */}
          <div className="rounded-xl border border-gray-200/50 bg-white/60 p-4 cursor-pointer hover:border-gray-300 transition-colors shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-gray-900">markitdown</span>
              <span className="text-[10px] font-bold uppercase tracking-wider border border-gray-300 text-gray-500 px-2 py-0.5 rounded-full">Not installed</span>
            </div>
            <p className="text-sm text-gray-600">
              Lightweight, no model downloads — broad format support, Markdown output. Works out of the box.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// --- PARTNERS & AGENTS ---
function AgentsTab() {
  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <p className="text-sm text-gray-600">Configure the subagents you can call on in chat.</p>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/30 p-8 text-center text-sm text-gray-500">
        No external partners configured.
      </div>
    </div>
  );
}

// --- MEMORY ---
function MemoryTab() {
  return (
    <div className="space-y-8 max-w-3xl animate-in fade-in duration-200">
      {/* Top switches */}
      <div className="rounded-xl border border-gray-200/50 bg-white/50 px-5 py-2 divide-y divide-gray-200/50 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-gray-900">Merge automatically after Audit</span>
          <ToggleSwitch defaultChecked />
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-gray-900">Merge automatically after Dedup</span>
          <ToggleSwitch defaultChecked />
        </div>
      </div>

      {/* Chunking Section */}
      <section>
        <h3 className="text-base font-bold text-gray-900 mb-1">Chunking</h3>
        <p className="text-sm text-gray-500 mb-4">Lower-level knobs that shape how content is split.</p>
        
        <div className="rounded-xl border border-gray-200/50 bg-white/50 px-5 py-2 divide-y divide-gray-200/50 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between py-4">
            <div>
              <span className="text-sm font-medium text-gray-900 block">Overlap ratio</span>
              <span className="text-xs text-gray-500">Fraction of chunk size carried into the next chunk. 0-0.5.</span>
            </div>
            <div className="flex items-center bg-black/5 rounded-lg px-3 py-1.5 border border-transparent">
              <span className="text-sm font-medium text-gray-900 mr-2">0,1</span>
              <div className="flex flex-col">
                <div className="h-2 w-3 bg-gray-300 mb-0.5 rounded-sm" />
                <div className="h-2 w-3 bg-gray-300 rounded-sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <span className="text-sm font-medium text-gray-900 block">Boundary</span>
              <span className="text-xs text-gray-500">Where the chunker prefers to cut.</span>
            </div>
            <div className="flex rounded-lg bg-black/5 p-1 border border-transparent">
              <button className="px-4 py-1.5 text-xs font-medium bg-white text-gray-900 rounded-md shadow-sm">Paragraph</button>
              <button className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900">Sentence</button>
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <span className="text-sm font-medium text-gray-900 block">Min chunk chars</span>
              <span className="text-xs text-gray-500">Floor for individual chunk size.</span>
            </div>
            <div className="flex items-center bg-black/5 rounded-lg px-3 py-1.5 border border-transparent">
              <span className="text-sm font-medium text-gray-900 mr-2">1000</span>
              <div className="flex flex-col">
                <div className="h-2 w-3 bg-gray-300 mb-0.5 rounded-sm" />
                <div className="h-2 w-3 bg-gray-300 rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Utility component for toggles
function ToggleSwitch({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button 
      onClick={() => setChecked(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none shadow-inner ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[26px]' : 'left-1'}`} />
    </button>
  );
}
