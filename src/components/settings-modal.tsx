"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { agentsApi, ApiError, preferencesApi, settingsApi } from "@/lib/api";
import type {
  Agent,
  DetectResult,
  ModelCapability,
  ModelConfig,
  UserPreference,
  UserPreferenceUpdate,
} from "@/lib/types";
import {
  X, User, Palette, Cpu, Database, Network, MessageSquare, Bot, Users,
  Monitor, Sun, Moon, Plus, Trash2, CheckCircle2, ArrowUpRight,
  Wrench, Plug, SlidersHorizontal, Paperclip, FileText, Check,
  ChevronDown, ChevronRight, Play, Pencil, Eye, EyeOff,
  Image as ImageIcon, Code2, Volume2, Brain, Type, Wand2, Loader2,
  AlertTriangle, MinusCircle, Zap
} from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";

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
    if (isDark) return "bg-[#1C1C1C] border-[#2C2C2C] shadow-none text-gray-100";
    return "bg-[#0011ff] border-white/30 shadow-none text-white";
  };

  const getSidebarClasses = () => {
    if (isDark) return "border-r border-[#2C2C2C] bg-[#141414]";
    return "border-r border-white/30 bg-transparent";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal Container */}
      <div className={`relative z-10 flex w-full max-w-5xl h-[85vh] max-h-[800px] rounded-none border overflow-hidden transition-all duration-300 ${getThemeClasses()}`}>
        {/* Left Sidebar */}
        <div className={`w-56 shrink-0 flex flex-col p-3 overflow-y-auto transition-colors duration-300 ${getSidebarClasses()}`}>
          <div className="mb-3">
            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-white/40" : "text-white/50"}`}>{t("settings")}</div>
            <SidebarItem icon={User} label={t("general")} active={activeTab === "general"} onClick={() => setActiveTab("general")} theme={theme} />
            <SidebarItem icon={Palette} label={t("appearance")} active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")} theme={theme} />
            <SidebarItem icon={Cpu} label={t("models")} active={activeTab === "models"} onClick={() => setActiveTab("models")} theme={theme} />
            <SidebarItem icon={Network} label={t("network")} active={activeTab === "network"} onClick={() => setActiveTab("network")} theme={theme} />
            <SidebarItem icon={MessageSquare} label={t("chat")} active={activeTab === "chat"} onClick={() => setActiveTab("chat")} theme={theme} />
            <SidebarItem icon={FileText} label={t("knowledge")} active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")} theme={theme} />
            <SidebarItem icon={Users} label={t("partners")} active={activeTab === "agents"} onClick={() => setActiveTab("agents")} theme={theme} />
          </div>

          <div>
            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-white/40" : "text-white/50"}`}>{t("customize")}</div>
            <SidebarItem icon={Database} label={t("memory")} active={activeTab === "memory"} onClick={() => setActiveTab("memory")} theme={theme} />
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center justify-between px-8 py-4 border-b shrink-0 transition-colors duration-300 ${theme === "dark" ? "border-[#2C2C2C]" : "border-white/30"}`}>
            <div className={`flex items-center text-sm ${theme === "dark" ? "text-white/40" : "text-white/50"}`}>
              <span>{t("settings")}</span>
              <span className="mx-2">›</span>
              <span className={`font-medium capitalize ${theme === "dark" ? "text-gray-100" : "text-white"}`}>{t(activeTab as any)}</span>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-none transition-colors ${theme === "dark" ? "text-white/40 hover:text-white hover:bg-white/10" : "text-white/50 hover:text-white hover:bg-white/10"}`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            {/* Action Bar (shown on specific tabs) */}
            {["models"].includes(activeTab) && (
              <div className={`flex items-center justify-between mb-8 pb-4 border-b transition-colors duration-300 ${theme === "dark" ? "border-[#2C2C2C]" : "border-white/30"}`}>
                <div className="text-sm text-white/60">
                  Simpan profil model agar dipakai di seluruh fitur.
                </div>
                <button
                  onClick={() => setSaveTrigger(prev => prev + 1)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-none shadow-none transition-colors border ${theme === "dark" ? "text-white border-[#3E3E3E] hover:bg-[#2C2C2C]" : "text-white border-white/30 hover:bg-white/10"}`}
                >
                  <Check className="h-4 w-4" />
                  Simpan Profil
                </button>
              </div>
            )}

            {activeTab === "general" && <GeneralTab theme={theme} />}
            {activeTab === "appearance" && <AppearanceTab theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} />}
            {activeTab === "models" && <ModelsTab theme={theme} saveTrigger={saveTrigger} />}
            {activeTab === "network" && <NetworkTab />}
            {activeTab === "chat" && <ChatTab />}
            {activeTab === "knowledge" && <KnowledgeTab />}
            {activeTab === "agents" && <AgentsTab onClose={onClose} />}
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
      className={`flex items-center gap-3 w-full rounded-none px-3 py-2 text-sm transition-colors ${
        active 
          ? (isDark ? "bg-[#2C2C2C] text-gray-100 font-medium" : "bg-white/20 text-white font-bold")
          : (isDark ? "text-white/40 hover:bg-white/5 hover:text-gray-200" : "text-white/70 hover:bg-white/10 hover:text-white")
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
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-white"}`}>{t("profile")}</h3>
        <p className={`text-xs mb-4 ${isDark ? "text-white/40" : "text-white/50"}`}>{t("profileDesc")}</p>
        
        <div className={`rounded-none border px-5 py-2 divide-y shadow-none backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C] divide-[#2C2C2C]" : "bg-transparent border-white/30 divide-white/30"}`}>
          <div className="flex items-center justify-between py-4">
            <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-white"}`}>{t("avatar")}</span>
            <div className="h-10 w-10 rounded-none bg-gray-600 flex items-center justify-center text-white font-bold text-sm shadow-none">N</div>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-white"}`}>{t("fullName")}</span>
            <input type="text" defaultValue="User" className={`text-sm text-right font-medium bg-transparent outline-none border-none ${isDark ? "text-gray-100" : "text-white"}`} />
          </div>
        </div>
      </section>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-white"}`}>{t("instructions")}</h3>
        <p className={`text-xs mb-4 ${isDark ? "text-white/40" : "text-white/50"}`}>{t("instructionsDesc")}</p>
        <textarea 
          placeholder={t("instructionsPlaceholder")}
          className={`w-full h-32 rounded-none border border-transparent px-4 py-3 text-sm outline-none resize-none transition-colors shadow-none ${isDark ? "bg-[#1E1E1E] text-gray-100 placeholder-gray-500 focus:border-[#3E3E3E]" : "bg-black/5 text-white placeholder-gray-400 focus:bg-transparent focus:border-white/30"}`}
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
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-gray-100" : "text-white"}`}>{t("appearanceTitle")}</h2>
        <p className={`text-sm ${isDark ? "text-white/40" : "text-white/70"}`}>
          {t("appearanceDesc")}
        </p>
      </div>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-white"}`}>{t("language")}</h3>
        <p className={`text-sm mb-4 ${isDark ? "text-white/40" : "text-white/50"}`}>{t("languageDesc")}</p>
        
        <div className={`rounded-none border px-5 py-4 flex items-center justify-between transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
          <div>
            <span className={`text-sm font-bold block mb-1 ${isDark ? "text-gray-100" : "text-white"}`}>{t("interfaceLanguage")}</span>
            <span className={`text-xs ${isDark ? "text-white/50" : "text-white/50"}`}>{t("interfaceLanguageDesc")}</span>
          </div>
          <div className={`flex rounded-none p-0.5 border ${isDark ? "bg-[#2C2C2C] border-[#3E3E3E]" : "bg-black/5 border-transparent"}`}>
            <button onClick={() => changeLanguage("en")} className={`px-4 py-1.5 text-xs font-medium rounded-none transition-colors ${lang === "en" ? (isDark ? "bg-[#4A4A4A] text-white" : "bg-transparent text-white shadow-none") : (isDark ? "text-white/40 hover:text-gray-200" : "text-white/50 hover:text-white")}`}>English</button>
            <button onClick={() => changeLanguage("id")} className={`px-4 py-1.5 text-xs font-medium rounded-none transition-colors ${lang === "id" ? (isDark ? "bg-[#4A4A4A] text-white" : "bg-transparent text-white shadow-none") : (isDark ? "text-white/40 hover:text-gray-200" : "text-white/50 hover:text-white")}`}>Bahasa</button>
          </div>
        </div>
      </section>

      <section>
        <h3 className={`text-base font-bold mb-1 ${isDark ? "text-gray-100" : "text-white"}`}>{t("theme")}</h3>
        <p className={`text-sm mb-4 ${isDark ? "text-white/40" : "text-white/50"}`}>{t("themeDesc")}</p>
        
        <div className={`rounded-none border p-6 transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
          <div className="grid grid-cols-3 gap-4 mb-6">
            
            {/* Theme Card: Cream */}
            <button onClick={() => setTheme("cream")} className="group text-left focus:outline-none">
              <div className={`rounded-none border-2 mb-3 overflow-hidden h-32 flex flex-col transition-all ${theme === "cream" ? "ring-2 ring-orange-600/20" : ""}`} style={{ backgroundColor: '#fdfcf9', borderColor: theme === 'cream' ? '#b0501e' : (isDark ? '#3E3E3E' : '#e6decc') }}>
                <div className="flex flex-1 pt-4 pl-4 pr-2">
                  <div className="w-1/4 space-y-2 border-r pr-2" style={{ borderColor: '#f1ede2' }}>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-3/4 rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                  </div>
                  <div className="w-3/4 pl-3 space-y-2">
                    <div className="h-2 w-1/3 rounded-none" style={{ backgroundColor: '#1c1816' }}></div>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-1.5 w-5/6 rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                    <div className="h-3 w-8 rounded mt-2" style={{ backgroundColor: '#b0501e' }}></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-white"}`}>Cream</span>
                <div className={`h-4 w-8 rounded-none flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "cream" ? "#b0501e" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-none bg-transparent transition-all ${theme === "cream" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>

            {/* Theme Card: Dark */}
            <button onClick={() => setTheme("dark")} className="group text-left focus:outline-none">
              <div className={`rounded-none border-2 mb-3 overflow-hidden h-32 flex flex-col transition-all ${theme === "dark" ? "ring-2 ring-orange-500/20" : ""}`} style={{ backgroundColor: '#1a1918', borderColor: theme === 'dark' ? '#d4734b' : (isDark ? '#3a3634' : '#e5e5e5') }}>
                <div className="flex flex-1 pt-4 pl-4 pr-2">
                  <div className="w-1/4 space-y-2 border-r pr-2" style={{ borderColor: '#2a2725' }}>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-3/4 rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                  </div>
                  <div className="w-3/4 pl-3 space-y-2">
                    <div className="h-2 w-1/3 rounded-none" style={{ backgroundColor: '#e8e4de' }}></div>
                    <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-1.5 w-5/6 rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                    <div className="h-3 w-8 rounded mt-2" style={{ backgroundColor: '#d4734b' }}></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-white"}`}>Dark</span>
                <div className={`h-4 w-8 rounded-none flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "dark" ? "#d4734b" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-none bg-transparent transition-all ${theme === "dark" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>

            {/* Theme Card: System (follow device) */}
            <button onClick={() => setTheme("system")} className="group text-left focus:outline-none">
              <div className={`rounded-none border-2 mb-3 overflow-hidden h-32 flex flex-row transition-all ${theme === "system" ? "ring-2 ring-blue-400/20" : ""}`} style={{ borderColor: theme === 'system' ? '#60a5fa' : (isDark ? '#3E3E3E' : '#e5e5e5') }}>
                {/* Left half: Cream preview */}
                <div className="w-1/2 flex flex-col pt-3 pl-3 pr-1 space-y-1.5" style={{ backgroundColor: '#fdfcf9' }}>
                  <div className="h-1.5 w-3/4 rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-1.5 w-2/3 rounded-none" style={{ backgroundColor: '#e6decc' }}></div>
                  <div className="h-2.5 w-6 rounded mt-1" style={{ backgroundColor: '#b0501e' }}></div>
                </div>
                {/* Right half: Dark preview */}
                <div className="w-1/2 flex flex-col pt-3 pl-1 pr-3 space-y-1.5" style={{ backgroundColor: '#1a1918' }}>
                  <div className="h-1.5 w-3/4 rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-1.5 w-full rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-1.5 w-2/3 rounded-none" style={{ backgroundColor: '#3a3634' }}></div>
                  <div className="h-2.5 w-6 rounded mt-1" style={{ backgroundColor: '#d4734b' }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isDark ? "text-gray-300" : "text-white"}`}>System</span>
                <div className={`h-4 w-8 rounded-none flex p-0.5 transition-colors`} style={{ backgroundColor: theme === "system" ? "#60a5fa" : (isDark ? "#3E3E3E" : "#d1d5db") }}>
                  <div className={`h-3 w-3 rounded-none bg-transparent transition-all ${theme === "system" ? "ml-auto" : ""}`}></div>
                </div>
              </div>
            </button>
            
          </div>
          
          <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-white/50"}`}>
            {t("themeInfo")}
          </p>
        </div>
      </section>
    </div>
  );
}

// --- MODELS (Multi-tabbed: LLM, Embedding, STT, TTS) ---
function ModelsTab({ theme, saveTrigger }: { theme: string; saveTrigger: number }) {
  return (
    <div className="max-w-5xl animate-in fade-in duration-200">
      <ModelsLLM theme={theme} saveTrigger={saveTrigger} />
    </div>
  );
}

/** Kemampuan model yang bisa dinyalakan/dimatikan user, lengkap dengan penjelasannya. */
const CAPABILITY_META: {
  id: ModelCapability;
  label: string;
  icon: typeof Type;
  hint: string;
}[] = [
  { id: "text", label: "Teks", icon: Type, hint: "Menjawab dan menulis teks biasa" },
  { id: "vision", label: "Gambar", icon: ImageIcon, hint: "Bisa membaca lampiran gambar & tangkapan layar" },
  { id: "tools", label: "Tool / Agen", icon: Wrench, hint: "Bisa mencari di internet & membaca dokumen sendiri" },
  { id: "reasoning", label: "Penalaran", icon: Brain, hint: "Punya mode berpikir bertahap" },
  { id: "code", label: "Kode", icon: Code2, hint: "Dioptimalkan untuk menulis kode" },
  { id: "audio", label: "Audio", icon: Volume2, hint: "Mendukung suara / transkripsi" },
  { id: "embedding", label: "Embedding", icon: Database, hint: "Membuat vektor untuk pencarian dokumen" },
];

/** Warna dan ikon untuk tiap status hasil pemeriksaan endpoint. */
function probeVisual(status: string) {
  if (status === "ok") return { icon: CheckCircle2, className: "text-emerald-400" };
  if (status === "warn") return { icon: AlertTriangle, className: "text-amber-400" };
  if (status === "fail") return { icon: X, className: "text-red-400" };
  return { icon: MinusCircle, className: "text-white/30" };
}

function ModelsLLM({ theme, saveTrigger }: { theme: string; saveTrigger: number }) {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();
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
  const [embeddingModel, setEmbeddingModel] = useState("nomic-embed-text");
  // Kemampuan yang dipakai untuk memilih model yang tepat saat chat
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(["text"]);

  // Extra Accordion
  const [extraOpen, setExtraOpen] = useState(false);
  const [apiVersion, setApiVersion] = useState("");

  // Diagnostics — hasil pemeriksaan nyata terhadap endpoint milik user
  const [diagOpen, setDiagOpen] = useState(true);
  const [diagStatus, setDiagStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

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
    setContextWindow(String(cfg.context_window ?? 65536));
    setEmbeddingModel(cfg.embedding_model || "nomic-embed-text");
    setCapabilities(cfg.capabilities?.length ? cfg.capabilities : ["text"]);
    // Hasil diagnosa milik profil sebelumnya tidak berlaku untuk profil ini
    setDetectResult(null);
    setDiagStatus("idle");
    setDiagError(null);
  };

  /** Nyalakan/matikan sebuah kemampuan secara manual. "text" selalu aktif. */
  const toggleCapability = (cap: ModelCapability) => {
    if (cap === "text") return;
    setCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
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
      const payload = {
        name,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        embedding_model: embeddingModel || "nomic-embed-text",
        is_active: true,
        capabilities,
        provider_type: detectResult?.provider_type || "openai-compatible",
        context_window: Number(contextWindow) || 65536,
      };

      if (selectedConfigId && selectedConfigId !== "new") {
        await settingsApi.update(token, selectedConfigId, payload);
      } else {
        const newCfg = await settingsApi.create(token, payload);
        setSelectedConfigId(newCfg.id);
      }
      
      const data = await settingsApi.getAll(token);
      setConfigs(data);
      window.dispatchEvent(new CustomEvent("settings-updated"));
      toastSuccess("Konfigurasi model berhasil disimpan.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Gagal menyimpan konfigurasi.";
      setError(msg);
      toastError(msg);
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

  /**
   * Uji koneksi sungguhan ke endpoint: daftar model, satu percakapan kecil,
   * satu percobaan tool call, satu gambar 1x1 piksel, dan satu embedding.
   *
   * @param applyResult bila true, kemampuan hasil deteksi langsung mengisi form.
   */
  const runDiagnostics = async (applyResult: boolean) => {
    if (!token || !baseUrl.trim()) {
      setDiagError("Base URL belum diisi.");
      setDiagStatus("error");
      return;
    }
    setDiagStatus("running");
    setDiagError(null);
    setDiagOpen(true);
    try {
      const result = await settingsApi.detect(token, {
        base_url: baseUrl.trim(),
        api_key: apiKey,
        model_name: modelName.trim(),
        embedding_model: embeddingModel.trim(),
        config_id: selectedConfigId && selectedConfigId !== "new" ? selectedConfigId : null,
      });
      setDetectResult(result);
      setDiagStatus("done");
      if (applyResult) {
        setCapabilities(result.capabilities.length ? result.capabilities : ["text"]);
        setContextWindow(String(result.context_window));
      }
    } catch (err) {
      setDiagError(err instanceof ApiError ? err.message : "Gagal menghubungi endpoint.");
      setDiagStatus("error");
    }
  };

  if (isLoading) {
    return <div className={`text-sm ${isDark ? "text-white/40" : "text-white/50"}`}>Memuat konfigurasi...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side Pane: Profiles list */}
        <div className="space-y-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-white/50"}`}>Profiles</span>
          <div className={`rounded-none border p-2 flex flex-col justify-between h-[380px] ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
            <div className="space-y-1 overflow-y-auto flex-1">
              {configs.map(cfg => (
                <div 
                  key={cfg.id}
                  onClick={() => setSelectedConfigId(cfg.id)}
                  className={`p-3 rounded-none flex items-center justify-between cursor-pointer transition-colors ${
                    selectedConfigId === cfg.id 
                      ? (isDark ? "bg-[#2C2C2C] text-white" : "bg-white/20 text-white font-bold") 
                      : (isDark ? "text-white/40 hover:bg-white/5" : "text-white/70 hover:bg-white/10")
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0" />
                    <div className="truncate pr-2">
                      <div className="text-sm font-bold truncate flex items-center gap-1.5">
                        {cfg.name}
                        {cfg.is_active && <span className="h-1.5 w-1.5 rounded-none bg-white/100"></span>}
                      </div>
                      <div className="text-[10px] text-white/50 truncate mt-0.5">{cfg.base_url}</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingName(true); }} className="text-white/40 hover:text-gray-200 p-1 rounded">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {selectedConfigId === "new" && (
                <div className={`p-3 rounded-none flex items-center gap-2 bg-white/10 text-white`}>
                  <Database className="h-4 w-4 shrink-0" />
                  <div className="truncate">
                    <div className="text-sm font-bold truncate">{name}</div>
                    <div className="text-[10px] text-white/50 truncate mt-0.5">{baseUrl}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={`border-t pt-3 p-1 ${isDark ? "border-[#2C2C2C]" : "border-white/30"}`}>
              <button 
                onClick={handleDeleteProfile}
                className="w-full flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 p-2 rounded-none transition-colors text-left"
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
          <div className={`rounded-none border p-5 space-y-4 shadow-none backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-white"}`}>Provider connection</span>
              <button 
                onClick={handleCreateProfile}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-none border ${
                  isDark ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-transparent border-white/30 hover:bg-transparent"
                }`}
              >
                <Plus className="h-3 w-3" />
                Profile
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>Profile Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                  }`} 
                />
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>Provider</label>
                <div className="relative">
                  <select 
                    value={provider} 
                    onChange={e => setProvider(e.target.value)}
                    className={`w-full rounded-none px-4 py-2.5 text-sm appearance-none outline-none border ${
                      isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                    }`}
                  >
                    <option className="bg-[#0011ff] text-white">Custom OpenAI-compatible</option>
                    <option className="bg-[#0011ff] text-white">Ollama</option>
                    <option className="bg-[#0011ff] text-white">OpenAI</option>
                    <option className="bg-[#0011ff] text-white">Anthropic</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>Base URL</label>
                <input 
                  type="text" 
                  value={baseUrl} 
                  onChange={e => setBaseUrl(e.target.value)} 
                  className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                  }`} 
                />
              </div>

              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>API Key</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    value={apiKey} 
                    onChange={e => setApiKey(e.target.value)} 
                    placeholder="••••••••••••••••••••••••••••••••"
                    className={`w-full rounded-none pl-4 pr-10 py-2.5 text-sm outline-none border ${
                      isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                    }`} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-gray-200"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Extra Accordion */}
              <div className={`border-t pt-3 ${isDark ? "border-[#2C2C2C]" : "border-white/30"}`}>
                <button 
                  onClick={() => setExtraOpen(!extraOpen)}
                  className="flex items-center justify-between w-full text-xs font-bold text-left py-1 text-white/40 hover:text-gray-200"
                >
                  <div>
                    <span>Extra (optional)</span>
                    <span className="block text-[10px] text-white/50 font-medium mt-0.5">API version and extra request headers</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${extraOpen ? "rotate-180" : ""}`} />
                </button>

                {extraOpen && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-[#2C2C2C]/50">
                    <div>
                      <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">API Version</label>
                      <input 
                        type="text" 
                        value={apiVersion} 
                        onChange={e => setApiVersion(e.target.value)} 
                        placeholder="e.g. 2024-02-15"
                        className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                          isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                        }`} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Models config */}
          <div className={`rounded-none border p-5 space-y-4 shadow-none backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-white"}`}>Models</span>
              <div className="flex items-center gap-2">
                <button 
                  className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-none border ${
                    isDark ? "bg-transparent border-[#3E3E3E] text-gray-300 hover:bg-[#2C2C2C]" : "bg-transparent border-white/30 hover:bg-transparent"
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  Model
                </button>
                <button 
                  onClick={handleDeleteProfile}
                  type="button"
                  className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-none text-red-500 hover:bg-red-500/10`}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold rounded-none">
                <Check className="h-3.5 w-3.5" />
                {modelName || "Default model"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>Model ID</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  list="detected-models"
                  className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                  }`}
                />
                {/* Diisi otomatis setelah diagnosa berhasil membaca daftar model */}
                <datalist id="detected-models">
                  {(detectResult?.available_models ?? []).map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {detectResult && detectResult.available_models.length > 0 && (
                  <p className="mt-1 text-[10px] text-white/40">
                    {detectResult.available_models.length} model terdeteksi — ketik untuk memilih
                  </p>
                )}
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>Context Window</label>
                <input
                  type="text"
                  value={contextWindow}
                  onChange={e => setContextWindow(e.target.value)}
                  className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                    isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-medium block mb-1.5 ${isDark ? "text-white/40" : "text-white/70"}`}>
                Model Embedding
              </label>
              <input
                type="text"
                value={embeddingModel}
                onChange={e => setEmbeddingModel(e.target.value)}
                placeholder="mis. text-embedding-3-small"
                className={`w-full rounded-none px-4 py-2.5 text-sm outline-none border ${
                  isDark ? "bg-[#2C2C2C] border-[#3E3E3E] text-white" : "bg-transparent border-white/30 text-white"
                }`}
              />
              <p className="mt-1 text-[10px] text-white/40">
                Dipakai untuk mengindeks dan mencari isi berkas yang dilampirkan di chat.
              </p>
            </div>
          </div>

          {/* Kemampuan model — menentukan tugas apa yang boleh dialihkan ke profil ini */}
          <div className={`rounded-none border p-5 space-y-4 shadow-none backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm font-bold ${isDark ? "text-gray-100" : "text-white"}`}>Kemampuan Model</span>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Nalar memakai daftar ini untuk memilih model yang tepat — lampiran gambar
                  hanya dikirim ke model yang mendukungnya.
                </p>
              </div>
              <button
                onClick={() => runDiagnostics(true)}
                disabled={diagStatus === "running"}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-white/30 text-white rounded-none hover:bg-white/15 disabled:opacity-50 transition-colors"
              >
                {diagStatus === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Deteksi Otomatis
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {CAPABILITY_META.map(cap => {
                const active = capabilities.includes(cap.id);
                const Icon = cap.icon;
                return (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => toggleCapability(cap.id)}
                    title={cap.hint}
                    disabled={cap.id === "text"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-none transition-colors ${
                      active
                        ? "bg-white text-[#0011ff] border-white"
                        : "bg-transparent text-white/50 border-white/25 hover:border-white/60 hover:text-white/80"
                    } ${cap.id === "text" ? "cursor-default" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cap.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-white/40">
              Klik untuk menyalakan/mematikan secara manual, atau tekan Deteksi Otomatis untuk
              mengujinya langsung ke endpoint.
            </p>
          </div>

          {/* Diagnostics */}
          <div className={`rounded-none border p-4 shadow-none backdrop-blur-md transition-colors duration-300 ${isDark ? "bg-[#1E1E1E] border-[#2C2C2C]" : "bg-transparent border-white/30"}`}>
            <button 
              onClick={() => setDiagOpen(!diagOpen)}
              className="flex items-center justify-between w-full text-xs font-bold text-left py-1 text-white/40 hover:text-gray-200"
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                <span>Diagnostics</span>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${diagOpen ? "rotate-90" : ""}`} />
            </button>

            {diagOpen && (
              <div className="mt-4 pt-4 border-t border-white/15 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/50 font-medium">
                    Menguji endpoint secara nyata: daftar model, percakapan, tool call, gambar, dan embedding.
                  </span>
                  <button
                    onClick={() => runDiagnostics(false)}
                    disabled={diagStatus === "running"}
                    className="shrink-0 px-4 py-1.5 text-xs font-bold bg-white text-[#0011ff] rounded-none hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {diagStatus === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Jalankan Tes
                  </button>
                </div>

                {diagStatus === "running" && (
                  <p className="text-xs text-white/50 animate-pulse">
                    Menghubungi {baseUrl || "endpoint"}... ini bisa memakan waktu sampai satu menit.
                  </p>
                )}

                {diagError && (
                  <div className="flex items-start gap-2 border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{diagError}</span>
                  </div>
                )}

                {detectResult && diagStatus !== "running" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`px-2 py-1 font-bold ${detectResult.reachable ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                        {detectResult.reachable ? "Endpoint terhubung" : "Endpoint tidak menjawab"}
                      </span>
                      <span className="px-2 py-1 bg-white/10 text-white/70">
                        Penyedia: {detectResult.provider_type}
                      </span>
                      <span className="px-2 py-1 bg-white/10 text-white/70">
                        Konteks ~{detectResult.context_window.toLocaleString("id-ID")} token
                      </span>
                    </div>

                    <ul className="space-y-1.5">
                      {detectResult.probes.map(p => {
                        const visual = probeVisual(p.status);
                        const Icon = visual.icon;
                        return (
                          <li key={p.name} className="flex items-start gap-2 text-xs">
                            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${visual.className}`} />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-white/85">{p.label}</span>
                              {p.message && <span className="text-white/55"> — {p.message}</span>}
                            </div>
                            {p.latency_ms !== null && p.latency_ms !== undefined && (
                              <span className="shrink-0 flex items-center gap-1 text-[10px] text-white/40">
                                <Zap className="h-3 w-3" />
                                {p.latency_ms} ms
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      onClick={() => {
                        setCapabilities(detectResult.capabilities.length ? detectResult.capabilities : ["text"]);
                        setContextWindow(String(detectResult.context_window));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-white/30 text-white rounded-none hover:bg-white/15 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Pakai hasil deteksi ini
                    </button>
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

// --- PREFERENSI PENGGUNA (dipakai tab Jaringan, Percakapan, Pengetahuan, Memori) ---
function usePreferences() {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    preferencesApi
      .get(token)
      .then((data) => {
        if (!cancelled) {
          setPrefs(data);
          setDirty(false);
        }
      })
      .catch((err) => {
        if (!cancelled) toastError(err instanceof ApiError ? err.message : "Gagal memuat pengaturan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function setField<K extends keyof UserPreference>(key: K, value: UserPreference[K]) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }

  /** Simpan hanya field milik tab yang sedang dibuka. */
  async function save(fields: (keyof UserPreferenceUpdate)[]) {
    if (!token || !prefs) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) payload[field as string] = prefs[field as keyof UserPreference];
      const updated = await preferencesApi.update(token, payload as UserPreferenceUpdate);
      setPrefs(updated);
      setDirty(false);
      toastSuccess("Pengaturan tersimpan.");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  return { prefs, loading, saving, dirty, setField, save };
}

function PrefLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-white/60">
      <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan...
    </div>
  );
}

function SaveBar({ saving, dirty, onSave }: { saving: boolean; dirty: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-white/30 rounded-none text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
      {dirty && !saving && <span className="text-xs text-amber-400">Ada perubahan yang belum disimpan.</span>}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <span className="text-sm font-medium text-white block">{label}</span>
        {hint && <span className="text-xs text-white/50 block mt-0.5">{hint}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          onChange(Math.min(max, Math.max(min, raw)));
        }}
        className="w-28 bg-transparent border border-white/30 rounded-none px-3 py-1.5 text-sm text-white outline-none focus:border-white/60"
      />
      {suffix && <span className="text-xs text-white/50">{suffix}</span>}
    </div>
  );
}

// --- JARINGAN ---
function NetworkTab() {
  const { prefs, loading, saving, dirty, setField, save } = usePreferences();

  if (loading || !prefs) return <PrefLoading />;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <p className="text-sm text-white/70">
        Atur proxy dan batas waktu untuk permintaan chat ke penyedia model AI.
      </p>

      <div className="rounded-none border border-white/30 bg-transparent p-6 shadow-none backdrop-blur-md space-y-5">
        <div>
          <label className="text-xs font-bold text-white/80 mb-1.5 block uppercase tracking-wider">
            URL Proxy (opsional)
          </label>
          <input
            type="text"
            value={prefs.proxy_url ?? ""}
            onChange={(e) => setField("proxy_url", e.target.value)}
            placeholder="http://proxy.contoh.com:8080"
            className="w-full bg-transparent border border-white/30 rounded-none px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/60 transition-colors"
          />
          <p className="text-xs text-white/50 mt-1.5">
            Kosongkan bila koneksi langsung. Dipakai saat chat dan pembuatan saran pertanyaan.
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.bypass_proxy_local}
            onChange={(e) => setField("bypass_proxy_local", e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          <span className="text-sm font-medium text-white/80">
            Lewati proxy untuk alamat lokal (localhost, 127.0.0.1)
          </span>
        </label>

        <div className="border-t border-white/20 pt-2">
          <FieldRow
            label="Batas waktu permintaan"
            hint="Berapa lama menunggu jawaban model sebelum dianggap gagal. 10-900 detik."
          >
            <NumberInput
              value={prefs.request_timeout}
              onChange={(v) => setField("request_timeout", v)}
              min={10}
              max={900}
              step={10}
              suffix="detik"
            />
          </FieldRow>
        </div>
      </div>

      <SaveBar
        saving={saving}
        dirty={dirty}
        onSave={() => save(["proxy_url", "bypass_proxy_local", "request_timeout"])}
      />
    </div>
  );
}

// --- PERCAKAPAN ---
function ChatTab() {
  const { prefs, loading, saving, dirty, setField, save } = usePreferences();

  if (loading || !prefs) return <PrefLoading />;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <p className="text-sm text-white/70">
        Setelan ini langsung dipakai saat kamu mengobrol di halaman Beranda.
      </p>

      <section>
        <h3 className="text-base font-bold text-white mb-1">Parameter Model</h3>
        <p className="text-sm text-white/50 mb-3">Mengatur gaya dan panjang jawaban AI.</p>
        <div className="rounded-none border border-white/30 bg-transparent px-5 py-2 divide-y divide-white/20 shadow-none backdrop-blur-md">
          <FieldRow
            label="Temperature"
            hint="Makin kecil makin konsisten, makin besar makin kreatif. 0 - 2."
          >
            <NumberInput
              value={prefs.chat_temperature}
              onChange={(v) => setField("chat_temperature", v)}
              min={0}
              max={2}
              step={0.1}
            />
          </FieldRow>
          <FieldRow
            label="Maksimum token jawaban"
            hint="Batas panjang satu jawaban. Terlalu kecil membuat jawaban terpotong."
          >
            <NumberInput
              value={prefs.chat_max_tokens}
              onChange={(v) => setField("chat_max_tokens", v)}
              min={256}
              max={64000}
              step={256}
            />
          </FieldRow>
          <FieldRow
            label="Riwayat yang diingat"
            hint="Jumlah pesan terakhir yang ikut dikirim sebagai konteks. 0 - 50."
          >
            <NumberInput
              value={prefs.history_limit}
              onChange={(v) => setField("history_limit", v)}
              min={0}
              max={50}
              suffix="pesan"
            />
          </FieldRow>
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-white mb-1">Kemampuan Asisten</h3>
        <p className="text-sm text-white/50 mb-3">
          Matikan salah satunya bila kamu ingin jawaban murni dari model tanpa alat bantu.
        </p>
        <div className="rounded-none border border-white/30 bg-transparent px-5 py-2 divide-y divide-white/20 shadow-none backdrop-blur-md">
          <FieldRow label="Pencarian web" hint="Alat search_web dan fetch_webpage.">
            <ToggleSwitch
              checked={prefs.enable_web_tools}
              onChange={(v) => setField("enable_web_tools", v)}
            />
          </FieldRow>
          <FieldRow
            label="Akses dokumen"
            hint="Alat list_documents, read_document, dan search_in_document."
          >
            <ToggleSwitch
              checked={prefs.enable_document_tools}
              onChange={(v) => setField("enable_document_tools", v)}
            />
          </FieldRow>
          <FieldRow
            label="Saran pertanyaan lanjutan"
            hint="Tiga usulan pertanyaan yang muncul setelah AI menjawab."
          >
            <ToggleSwitch
              checked={prefs.enable_suggestions}
              onChange={(v) => setField("enable_suggestions", v)}
            />
          </FieldRow>
        </div>
      </section>

      <SaveBar
        saving={saving}
        dirty={dirty}
        onSave={() =>
          save([
            "chat_temperature",
            "chat_max_tokens",
            "history_limit",
            "enable_web_tools",
            "enable_document_tools",
            "enable_suggestions",
          ])
        }
      />
    </div>
  );
}

// --- PUSAT PENGETAHUAN ---
function KnowledgeTab() {
  const { prefs, loading, saving, dirty, setField, save } = usePreferences();

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <div>
        <h3 className="text-xl font-bold text-white mb-1">Pengolahan Dokumen</h3>
        <p className="text-sm text-white/70">
          Menentukan bagaimana berkas yang kamu lampirkan di kolom chat dipotong dan
          dicari kembali saat AI menjawab.
        </p>
      </div>

      {loading || !prefs ? (
        <PrefLoading />
      ) : (
        <>
          <div className="rounded-none border border-white/30 bg-transparent px-5 py-2 divide-y divide-white/20 shadow-none backdrop-blur-md">
            <FieldRow
              label="Ukuran potongan (chunk)"
              hint="Jumlah token per potongan teks. Potongan besar menjaga konteks, potongan kecil lebih presisi. 128 - 4000."
            >
              <NumberInput
                value={prefs.chunk_size}
                onChange={(v) => setField("chunk_size", v)}
                min={128}
                max={4000}
                step={64}
              />
            </FieldRow>
            <FieldRow
              label="Tumpang tindih (overlap)"
              hint="Berapa token dari potongan sebelumnya diulang agar kalimat tidak terputus. Otomatis dibatasi setengah ukuran potongan."
            >
              <NumberInput
                value={prefs.chunk_overlap}
                onChange={(v) => setField("chunk_overlap", v)}
                min={0}
                max={1000}
                step={16}
              />
            </FieldRow>
            <FieldRow
              label="Jumlah potongan diambil"
              hint="Dipakai saat AI mencari isi dokumen di chat dan saat menyusun bahan latihan soal. 1 - 30."
            >
              <NumberInput
                value={prefs.retrieval_top_k}
                onChange={(v) => setField("retrieval_top_k", v)}
                min={1}
                max={30}
              />
            </FieldRow>
          </div>

          <div className="flex items-start gap-2 text-xs text-white/60 border border-white/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Ukuran potongan dan tumpang tindih hanya berlaku untuk dokumen yang diunggah setelah
              disimpan. Dokumen lama perlu diunggah ulang agar memakai setelan baru.
            </span>
          </div>

          <SaveBar
            saving={saving}
            dirty={dirty}
            onSave={() => save(["chunk_size", "chunk_overlap", "retrieval_top_k"])}
          />
        </>
      )}
    </div>
  );
}

// --- PARTNER & AGEN ---
function AgentsTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { token } = useAuth();
  const { toastError } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    agentsApi
      .getAll(token)
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch((err) => {
        if (!cancelled) toastError(err instanceof ApiError ? err.message : "Gagal memuat daftar asisten.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const goToAgents = () => {
    onClose();
    router.push("/agents");
  };

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-white/70">
          Asisten AI dengan persona khusus yang bisa kamu panggil saat mengobrol.
        </p>
        <button
          onClick={goToAgents}
          className="shrink-0 flex items-center gap-2 border border-white/30 text-white px-4 py-2 rounded-none text-sm font-bold transition-colors hover:bg-white/10"
        >
          <Plus className="h-4 w-4" /> Kelola Asisten
        </button>
      </div>

      {loading ? (
        <PrefLoading />
      ) : agents.length === 0 ? (
        <div className="rounded-none border border-dashed border-white/30 bg-transparent p-8 text-center">
          <p className="text-sm text-white/60 mb-4">Belum ada asisten yang dibuat.</p>
          <button
            onClick={goToAgents}
            className="inline-flex items-center gap-2 border border-white/30 text-white px-4 py-2 rounded-none text-sm font-bold transition-colors hover:bg-white/10"
          >
            <Plus className="h-4 w-4" /> Buat Asisten Pertama
          </button>
        </div>
      ) : (
        <div className="rounded-none border border-white/30 bg-transparent divide-y divide-white/20 shadow-none backdrop-blur-md">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={goToAgents}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
            >
              <div className="h-10 w-10 shrink-0 border border-white/30 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white/80" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-white block truncate">{agent.name}</span>
                <span className="text-xs text-white/50 block truncate">
                  {agent.role || "Tanpa peran khusus"}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- MEMORI & INSTRUKSI KHUSUS ---
function MemoryTab() {
  const { prefs, loading, saving, dirty, setField, save } = usePreferences();

  if (loading || !prefs) return <PrefLoading />;

  const instructions = prefs.custom_instructions ?? "";

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <section>
        <h3 className="text-base font-bold text-white mb-1">Instruksi Khusus</h3>
        <p className="text-sm text-white/50 mb-3">
          Ditambahkan ke setiap percakapan baru. Cocok untuk menyebut jurusan, gaya bahasa, atau
          format jawaban yang kamu inginkan.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setField("custom_instructions", e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Contoh: Saya mahasiswa Teknik Informatika. Jelaskan dengan bahasa sederhana dan sertakan contoh kode Python bila relevan."
          className="w-full bg-transparent border border-white/30 rounded-none px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/60 transition-colors resize-y"
        />
        <div className="text-xs text-white/40 mt-1 text-right">{instructions.length}/4000 karakter</div>
      </section>

      <section>
        <h3 className="text-base font-bold text-white mb-1">Nilai Bawaan Fitur Lain</h3>
        <p className="text-sm text-white/50 mb-3">Dipakai sebagai isian awal saat kamu membuka fitur berikut.</p>
        <div className="rounded-none border border-white/30 bg-transparent px-5 py-2 divide-y divide-white/20 shadow-none backdrop-blur-md">
          <FieldRow label="Kedalaman Riset Mendalam" hint="Pilihan awal saat membuat riset baru.">
            <div className="flex border border-white/30">
              {(["ringkas", "standar", "mendalam"] as const).map((depth) => (
                <button
                  key={depth}
                  onClick={() => setField("research_default_depth", depth)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    prefs.research_default_depth === depth
                      ? "bg-white text-[#0011ff]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {depth}
                </button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Jumlah soal latihan" hint="Jumlah pertanyaan awal saat membuat kuis. 1 - 30.">
            <NumberInput
              value={prefs.default_quiz_questions}
              onChange={(v) => setField("default_quiz_questions", v)}
              min={1}
              max={30}
              suffix="soal"
            />
          </FieldRow>
        </div>
      </section>

      <SaveBar
        saving={saving}
        dirty={dirty}
        onSave={() => save(["custom_instructions", "research_default_depth", "default_quiz_questions"])}
      />
    </div>
  );
}

// Utility component for toggles — bisa dipakai terkendali (checked+onChange) atau mandiri.
function ToggleSwitch({
  defaultChecked = false,
  checked,
  onChange,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  return (
    <button
      onClick={() => {
        const next = !value;
        if (!isControlled) setInternal(next);
        onChange?.(next);
      }}
      className={`relative h-6 w-11 rounded-none transition-colors focus:outline-none shadow-none border border-white/30 ${value ? 'bg-white' : 'bg-transparent'}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-none transition-all ${value ? 'left-[26px] bg-[#0011ff]' : 'left-1 bg-white/50'}`} />
    </button>
  );
}
