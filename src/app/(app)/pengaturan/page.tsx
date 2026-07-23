"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, settingsApi } from "@/lib/api";
import type { ModelConfig } from "@/lib/types";
import { 
  Palette, Network, Box, Database, MessageSquare, 
  Users, HardDrive, ChevronRight, Activity, Cpu, 
  Search, ArrowLeft, CheckCircle2, Save 
} from "lucide-react";

export default function PengaturanPage() {
  const { token } = useAuth();
  
  // View State: 'dashboard' | 'models'
  const [currentView, setCurrentView] = useState<"dashboard" | "models">("dashboard");

  // Model State
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [isActive, setIsActive] = useState(false);

  const activeConfig = configs.find(c => c.is_active);

  const loadConfigs = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const data = await settingsApi.getAll(token);
      setConfigs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [token]);

  const resetForm = () => {
    setName("");
    setBaseUrl("");
    setApiKey("");
    setModelName("");
    setEmbeddingModel("");
    setIsActive(false);
    setEditingId(null);
    setIsEditing(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleEdit = (config: ModelConfig) => {
    setName(config.name);
    setBaseUrl(config.base_url);
    setApiKey(""); 
    setModelName(config.model_name);
    setEmbeddingModel(config.embedding_model);
    setIsActive(config.is_active);
    setEditingId(config.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Yakin ingin menghapus konfigurasi ini?")) return;
    try {
      await settingsApi.delete(token, id);
      await loadConfigs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetActive = async (id: string) => {
    if (!token) return;
    try {
      await settingsApi.setActive(token, id);
      await loadConfigs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = {
        name,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        embedding_model: embeddingModel,
        is_active: isActive
      };

      if (editingId) {
        await settingsApi.update(token, editingId, data);
        setSuccessMsg("Tersimpan.");
      } else {
        await settingsApi.create(token, data);
        setSuccessMsg("Tersimpan.");
      }
      
      resetForm();
      await loadConfigs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- DASHBOARD VIEW ---
  if (currentView === "dashboard") {
    return (
      <div className="mx-auto max-w-5xl p-8 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif text-gray-900">Settings</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage appearance, models and services, knowledge base, chat, and memory.
            </p>
          </div>
          <button className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Search className="h-4 w-4" /> Tour
          </button>
        </div>

        {/* Status Bar */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex items-center flex-wrap gap-x-8 gap-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm font-bold text-gray-900">Backend</span>
            <span className="text-sm text-gray-500">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${activeConfig ? "bg-emerald-500" : "bg-red-500"}`}></div>
            <span className="text-sm font-bold text-gray-900">LLM</span>
            <span className="text-sm text-gray-500">{activeConfig ? activeConfig.model_name : "Not set"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${activeConfig?.embedding_model ? "bg-emerald-500" : "bg-red-500"}`}></div>
            <span className="text-sm font-bold text-gray-900">Embedding</span>
            <span className="text-sm text-gray-500">{activeConfig?.embedding_model || "Not set"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm font-bold text-gray-900">Search</span>
            <span className="text-sm text-gray-500">duckduckgo</span>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsCard 
            icon={Palette} 
            title="Appearance" 
            desc="Theme and interface language" 
            onClick={() => {}} 
          />
          <SettingsCard 
            icon={Network} 
            title="Network" 
            desc="API http://localhost:8001" 
            onClick={() => {}} 
          />
          <SettingsCard 
            icon={Box} 
            title="Models" 
            desc={`${configs.length}/7 configured`} 
            onClick={() => setCurrentView("models")} 
          />
          <SettingsCard 
            icon={Database} 
            title="Knowledge Base" 
            desc="Document parsing engine" 
            onClick={() => {}} 
          />
          <SettingsCard 
            icon={MessageSquare} 
            title="Chat" 
            desc="Tools, MCP servers, capabilities, and attachments" 
            onClick={() => {}} 
          />
          <SettingsCard 
            icon={Users} 
            title="Partners & Agents" 
            desc="Configure the subagents you can call on in chat" 
            onClick={() => {}} 
          />
          <SettingsCard 
            icon={HardDrive} 
            title="Memory" 
            desc="Chunking, budget, dedup, and reference policies" 
            onClick={() => {}} 
          />
        </div>
      </div>
    );
  }

  // --- MODELS SETTING VIEW ---
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <button onClick={() => setCurrentView("dashboard")} className="hover:text-gray-900 transition-colors">Settings</button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-bold">Models</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 mr-4 hidden sm:inline">Saved to database</span>
          <button className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button 
            type="submit"
            form="configForm"
            className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#FAF9F5]">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold font-serif text-gray-900 mb-2">LLM</h1>
          <p className="text-sm text-gray-500 mb-8">
            Configure language model profiles. The active model is used for chat and most agent reasoning.
          </p>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Sidebar List inside Models */}
            <div className="w-full md:w-64 shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 px-2">
                Profiles
              </div>
              <div className="space-y-1">
                {configs.map(cfg => (
                  <button 
                    key={cfg.id}
                    onClick={() => handleEdit(cfg)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                      editingId === cfg.id 
                        ? "bg-gray-900 text-white shadow-sm" 
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="truncate">{cfg.name}</span>
                    {cfg.is_active && <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></div>}
                  </button>
                ))}
                
                <button 
                  onClick={resetForm}
                  className={`w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors mt-2 ${
                    !editingId && isEditing 
                      ? "bg-gray-900 text-white shadow-sm" 
                      : "text-gray-900 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  + Profile
                </button>
              </div>
            </div>

            {/* Form Area */}
            <div className="flex-1 w-full flex flex-col gap-6">
              {(isEditing || editingId) ? (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-gray-900">Provider connection</h3>
                    </div>
                    
                    <form id="configForm" onSubmit={handleSubmit} className="flex flex-col gap-5">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">Nama Profile</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">Base URL</label>
                        <input
                          type="url"
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          required
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">API Key</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={editingId ? "••••••••••••" : ""}
                          required={!editingId}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-900 focus:bg-white"
                        />
                      </div>
                    </form>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-gray-900">Models</h3>
                      {editingId && (
                        <button 
                          type="button"
                          onClick={() => handleDelete(editingId)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete Profile
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">Model ID (LLM)</label>
                        <input
                          type="text"
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                          form="configForm"
                          required
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">Embedding Model</label>
                        <input
                          type="text"
                          value={embeddingModel}
                          onChange={(e) => setEmbeddingModel(e.target.value)}
                          form="configForm"
                          required
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-900 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-900">
                          Set as active model
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-4">
                         {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
                         {successMsg && <span className="text-sm text-emerald-600 font-medium">{successMsg}</span>}
                      </div>
                    </div>
                    
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-300">
                  <p className="text-gray-500 font-medium mb-4">No profiles configured. Add a profile to start.</p>
                  <button 
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-900 hover:bg-gray-50"
                  >
                    + Profile
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function SettingsCard({ icon: Icon, title, desc, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-900 hover:shadow-md h-36"
    >
      <div className="flex items-start justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 group-hover:text-gray-900 transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-900 transition-colors" />
      </div>
      <div className="mt-4 text-sm text-gray-500">
        {desc}
      </div>
    </button>
  );
}
