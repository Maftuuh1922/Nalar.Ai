"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { agentsApi, ApiError } from "@/lib/api";
import type { Agent } from "@/lib/types";
import {
  Bot, BrainCircuit, BookOpen, Code, Cpu, Edit3, Loader2,
  MessageSquare, Plus, Sparkles, Trash2, User, Zap, AlertCircle,
} from "lucide-react";

// Daftar ikon yang bisa dipilih user sebagai avatar agen
const ICON_OPTIONS = [
  { name: "Bot", Icon: Bot },
  { name: "BrainCircuit", Icon: BrainCircuit },
  { name: "BookOpen", Icon: BookOpen },
  { name: "Cpu", Icon: Cpu },
  { name: "Code", Icon: Code },
  { name: "MessageSquare", Icon: MessageSquare },
  { name: "Sparkles", Icon: Sparkles },
  { name: "User", Icon: User },
  { name: "Zap", Icon: Zap },
  { name: "Edit3", Icon: Edit3 },
];

// Template prompt siap pakai
const PROMPT_TEMPLATES = [
  {
    label: "Tutor Saintifik",
    role: "Tutor ilmu pengetahuan yang ketat dan sistematis",
    prompt: "Kamu adalah tutor sains yang ketat. Jelaskan setiap konsep secara bertahap, mulai dari definisi hingga contoh konkret. Selalu minta siswa untuk memverifikasi pemahaman mereka di setiap langkah. Gunakan analogi untuk memperjelas konsep abstrak.",
  },
  {
    label: "Reviewer Kritis",
    role: "Pengulas akademik yang teliti dan konstruktif",
    prompt: "Kamu adalah reviewer akademik yang sangat teliti. Identifikasi kelemahan argumen, celah logika, dan inkonsistensi dalam jawaban. Berikan kritik yang konstruktif dan tunjukkan cara memperbaikinya. Jangan terlalu memuji, fokuslah pada pengembangan.",
  },
  {
    label: "Guru Menyenangkan",
    role: "Pendidik yang ramah, kreatif, dan antusias",
    prompt: "Kamu adalah guru yang sangat antusias dan kreatif. Buat setiap pembelajaran terasa menyenangkan dengan menggunakan analogi lucu, cerita menarik, dan pertanyaan interaktif. Mulai setiap sesi dengan sapaan hangat dan semangati siswa.",
  },
  {
    label: "Asisten Teknis",
    role: "Ahli teknis yang presisi dan berorientasi solusi",
    prompt: "Kamu adalah ahli teknis yang berfokus pada solusi praktis. Jawab pertanyaan secara langsung dan to-the-point. Sertakan contoh kode atau langkah-langkah konkret jika relevan. Hindari penjelasan berlebihan; fokuslah pada apa yang perlu dilakukan.",
  },
];

function AgentIcon({ name, className }: { name: string; className?: string }) {
  const found = ICON_OPTIONS.find((o) => o.name === name);
  const Icon = found?.Icon ?? Bot;
  return <Icon className={className} />;
}

export default function AgentsPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [avatarIcon, setAvatarIcon] = useState("Bot");

  async function loadAgents() {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await agentsApi.getAll(token);
      setAgents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, [token]);

  function openCreateForm() {
    setEditingAgent(null);
    setName("");
    setRole("");
    setSystemPrompt("");
    setAvatarIcon("Bot");
    setError(null);
    setIsFormOpen(true);
  }

  function openEditForm(agent: Agent) {
    setEditingAgent(agent);
    setName(agent.name);
    setRole(agent.role);
    setSystemPrompt(agent.system_prompt);
    setAvatarIcon(agent.avatar_icon);
    setError(null);
    setIsFormOpen(true);
  }

  function applyTemplate(tpl: typeof PROMPT_TEMPLATES[0]) {
    setRole(tpl.role);
    setSystemPrompt(tpl.prompt);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingAgent) {
        await agentsApi.update(token, editingAgent.id, { name, role, system_prompt: systemPrompt, avatar_icon: avatarIcon });
      } else {
        await agentsApi.create(token, { name, role, system_prompt: systemPrompt, avatar_icon: avatarIcon });
      }
      setIsFormOpen(false);
      await loadAgents();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan asisten.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Hapus asisten ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      await agentsApi.delete(token, id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Gagal menghapus asisten.");
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cloudy/10 px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Asisten AI</h1>
          <p className="mt-1 text-sm text-cloudy">
            Buat persona AI khusus dengan instruksi dan gaya jawaban yang berbeda-beda.
          </p>
        </div>
        {!isFormOpen && (
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-gray-800 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Buat Asisten
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl">

          {/* Form */}
          {isFormOpen && (
            <div className="mb-8 rounded-2xl border border-cloudy/20 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingAgent ? "Edit Asisten" : "Buat Asisten Baru"}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-sm text-cloudy hover:text-gray-900"
                >
                  Batal
                </button>
              </div>

              {/* Templates */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cloudy">Template Cepat</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="rounded-full border border-cloudy/20 bg-pampas px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-gray-900/30 hover:bg-gray-900/5"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-cloudy">
                      Nama Asisten <span className="text-gray-900">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tutor Fisika, Reviewer Skripsi, dll."
                      required
                      className="w-full rounded-xl border border-cloudy/30 bg-pampas px-4 py-3 text-sm outline-none focus:border-gray-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-cloudy">
                      Peran Singkat <span className="text-gray-900">*</span>
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Misal: Ahli kimia organik yang sabar"
                      required
                      className="w-full rounded-xl border border-cloudy/30 bg-pampas px-4 py-3 text-sm outline-none focus:border-gray-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-cloudy">
                    Instruksi Sistem (System Prompt) <span className="text-gray-900">*</span>
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    required
                    minLength={10}
                    placeholder="Jelaskan kepribadian, gaya bahasa, dan cara AI ini harus merespons pengguna..."
                    className="w-full rounded-xl border border-cloudy/30 bg-pampas px-4 py-3 text-sm outline-none focus:border-gray-900 focus:bg-white resize-none"
                  />
                  <p className="mt-1.5 text-xs text-cloudy">{systemPrompt.length} karakter</p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-cloudy">
                    Ikon Avatar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map(({ name: iconName, Icon }) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setAvatarIcon(iconName)}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                          avatarIcon === iconName
                            ? "border-gray-900 bg-gray-900 text-white shadow-md"
                            : "border-cloudy/20 bg-pampas text-cloudy hover:border-gray-400 hover:text-gray-900"
                        }`}
                        title={iconName}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    {editingAgent ? "Simpan Perubahan" : "Buat Asisten"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Agent List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-cloudy" />
            </div>
          ) : agents.length === 0 && !isFormOpen ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cloudy/30 bg-pampas py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-900/10">
                <Bot className="h-8 w-8 text-gray-900" />
              </div>
              <h3 className="mb-1 text-base font-bold text-gray-900">Belum ada Asisten AI</h3>
              <p className="mb-6 max-w-xs text-sm text-cloudy">
                Buat persona AI khusus dengan gaya bicara dan fokus bidang yang kamu inginkan.
              </p>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" /> Buat Asisten Pertama
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="group relative flex flex-col rounded-2xl border border-cloudy/20 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                >
                  {/* Avatar + Name */}
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900/10">
                      <AgentIcon name={agent.avatar_icon} className="h-6 w-6 text-gray-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 leading-tight">{agent.name}</h3>
                      <p className="mt-0.5 text-xs text-cloudy line-clamp-2">{agent.role}</p>
                    </div>
                  </div>

                  {/* System Prompt Preview */}
                  <p className="flex-1 text-xs text-gray-600 line-clamp-3 leading-relaxed">
                    {agent.system_prompt}
                  </p>

                  {/* Actions */}
                  <div className="mt-5 flex items-center gap-2 border-t border-cloudy/10 pt-4">
                    <button
                      onClick={() => openEditForm(agent)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cloudy/20 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-pampas"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
