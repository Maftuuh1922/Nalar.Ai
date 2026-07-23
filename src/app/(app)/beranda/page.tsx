"use client";

import { useEffect, useState, useRef, useCallback, useMemo, type FormEvent, type ChangeEvent } from "react";
import { Button, TextArea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Popover, PopoverTrigger, PopoverContent, Tooltip, Checkbox, ListBox, ListBoxItem } from "@heroui/react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ArrowUp, 
  Plus, 
  ChevronDown, 
  Settings, 
  Loader2, 
  FileText, 
  BookOpen, 
  BrainCircuit, 
  Bot, 
  X, 
  Check, 
  Paperclip,
  Database,
  Zap,
  RotateCcw,
  Copy,
  Sparkles,
  Highlighter,
  Search,
  MessageSquareQuote,
  BookmarkPlus,
  FolderPlus,
  Pencil,
  Clock,
  Timer,
  AlignLeft,
  AlignJustify
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { settingsApi, chatSessionsApi, agentsApi, documentsApi, notebooksApi, ApiError } from "@/lib/api";
import type { ModelConfig, ChatSession, Agent, Document as UserDoc } from "@/lib/types";
import { ChatMessage } from "@/components/chat-message";
import type { DisplayMessage } from "@/components/chat-message";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetchRaw<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let detail = "Terjadi kesalahan.";
    try { const d = await response.json(); detail = d.detail ?? detail; } catch {}
    throw new Error(String(detail));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface Source {
  filename: string;
  page: string;
  excerpt: string;
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  rtk_saved_tokens?: number;
}

interface ChatResponseData {
  id: string;
  answer: string;
  thinking_process?: string;
  sources: Source[];
  usage?: TokenUsage;
  created_at: string;
}

// DisplayMessage interface is imported from @/components/chat-message

export default function BerandaPage() {
  const { user, token } = useAuth();
  const [message, setMessage] = useState("");
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableReasoning, setEnableReasoning] = useState(false);
  const [enableRtk, setEnableRtk] = useState(true); // RTK Token Server enabled by default
  const [textAlign, setTextAlign] = useState<"left" | "justify">("justify"); // Mode Baca Penjajaran Teks (Kanan-Kiri / Justify & Kiri)
  const [showAlignPicker, setShowAlignPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Toast notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Document selection state (DeepTutor KnowledgeSelector)
  const [userDocuments, setUserDocuments] = useState<UserDoc[]>([]);
  const [selectedDocMode, setSelectedDocMode] = useState<"all" | "none" | "custom">("all");
  const [selectedCustomDocIds, setSelectedCustomDocIds] = useState<string[]>([]);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // Agent & Model Config state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!user || !token) return;
      try {
        const [cfgData, agentData, docData] = await Promise.all([
          settingsApi.getAll(token).catch(() => []),
          agentsApi.getAll(token).catch(() => []),
          documentsApi.getAll(token).catch(() => []),
        ]);
        setConfigs(cfgData);
        setAgents(agentData);
        setUserDocuments(docData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoadingConfigs(false);
      }
    }
    loadData();
  }, [user, token]);

  // Load chat sessions
  useEffect(() => {
    async function loadSessions() {
      if (!token) return;
      try {
        const data = await chatSessionsApi.getAll(token);
        setSessions(data);
      } catch {}
    }
    loadSessions();
  }, [token]);

  // Load session from URL
  useEffect(() => {
    const s = searchParams.get("s");
    if (s && s !== sessionId) {
      loadSession(s);
    } else if (!s && sessionId) {
      startNewChat();
    }
  }, [searchParams, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleSetActive(id: string) {
    if (!token) return;
    try {
      await settingsApi.setActive(token, id);
      setConfigs((prev) =>
        prev.map((c) => ({ ...c, is_active: c.id === id }))
      );
    } catch (error) {
      console.error("Failed to set active config", error);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    setUploadingFileName(file.name);

    try {
      const doc = await documentsApi.upload(token, file);
      setUploadedDocumentId(doc.id);
      setUserDocuments((prev) => [doc, ...prev]);
      setSelectedDocMode("custom");
      setSelectedCustomDocIds([doc.id]);
      showToast(`📄 Berhasil mengunggah & mengimpor "${file.name}" ke Workspace!`);
    } catch (err) {
      alert(`Gagal mengunggah dokumen: ${err instanceof ApiError ? err.message : String(err)}`);
      setUploadingFileName(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }


  function toggleCustomDocSelection(docId: string) {
    setSelectedDocMode("custom");
    setSelectedCustomDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  async function handleSaveToWorkspace() {
    if (!token) return;
    const lastAiMsg = [...chatMessages].reverse().find((m) => m.role === "assistant");
    if (!lastAiMsg) {
      showToast("⚠️ Belum ada balasan AI untuk disimpan ke Catatan Workspace.");
      return;
    }

    try {
      const title = `Catatan AI - ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
      await notebooksApi.create(token, { title, content: lastAiMsg.content });
      showToast("🚀 Berhasil diimpor & disimpan ke Catatan Workspace!");
    } catch (err) {
      showToast(`⚠️ Gagal menyimpan ke Catatan Workspace: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleSaveEditPrompt(msgIndex: number, newPrompt: string) {
    if (!newPrompt.trim() || isSubmitting || !token) return;
    setIsSubmitting(true);

    const startTime = Date.now();
    const userTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // Determine attached documents
    let attachedDocsList: { id: string; filename: string }[] = [];
    if (uploadingFileName && uploadedDocumentId) {
      attachedDocsList = [{ id: uploadedDocumentId, filename: uploadingFileName }];
    } else if (selectedDocMode === "custom" && selectedCustomDocIds.length > 0) {
      attachedDocsList = userDocuments
        .filter((d) => selectedCustomDocIds.includes(d.id))
        .map((d) => ({ id: d.id, filename: d.filename }));
    } else if (selectedDocMode === "all" && userDocuments.length > 0) {
      attachedDocsList = userDocuments.map((d) => ({ id: d.id, filename: d.filename }));
    }

    const updatedMessages = chatMessages.slice(0, msgIndex + 1);
    updatedMessages[msgIndex] = { role: "user", content: newPrompt.trim(), timestamp: userTimeStr, attachedDocs: attachedDocsList };
    setChatMessages(updatedMessages);

    try {
      const requestBody: Record<string, unknown> = {
        message: newPrompt.trim(),
      };
      if (sessionId) requestBody.session_id = sessionId;
      if (selectedDocMode === "custom" && selectedCustomDocIds.length > 0) requestBody.document_ids = selectedCustomDocIds;
      if (selectedDocMode === "none") requestBody.document_ids = [];
      if (activeAgent) requestBody.agent_id = activeAgent.id;
      if (enableReasoning) requestBody.enable_reasoning = true;
      if (enableRtk) requestBody.enable_rtk = true;

      const result = await apiFetchRaw<ChatResponseData>("/chat", {
        method: "POST",
        token,
        body: requestBody,
      });

      const elapsedMs = Date.now() - startTime;
      const assistantTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          thinkingProcess: result.thinking_process,
          sources: result.sources,
          usage: result.usage,
          agentName: activeAgent?.name,
          timestamp: assistantTimeStr,
          responseTimeMs: elapsedMs,
        },
      ]);
    } catch (error: unknown) {
      const err = error as Error;
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Gagal mengulang respon AI."}`,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegenerate() {
    if (isSubmitting || !token) return;
    const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setIsSubmitting(true);
    const startTime = Date.now();

    try {
      const requestBody: Record<string, unknown> = {
        message: lastUserMsg.content,
      };
      
      if (sessionId) requestBody.session_id = sessionId;
      
      if (selectedDocMode === "custom" && selectedCustomDocIds.length > 0) {
        requestBody.document_ids = selectedCustomDocIds;
      } else if (selectedDocMode === "none") {
        requestBody.document_ids = [];
      }
      
      if (activeAgent) requestBody.agent_id = activeAgent.id;
      if (enableReasoning) requestBody.enable_reasoning = true;
      if (enableRtk) requestBody.enable_rtk = true;

      const result = await apiFetchRaw<ChatResponseData>("/chat", {
        method: "POST",
        token,
        body: requestBody,
      });

      const elapsedMs = Date.now() - startTime;
      const assistantTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          thinkingProcess: result.thinking_process,
          sources: result.sources,
          usage: result.usage,
          agentName: activeAgent?.name,
          timestamp: assistantTimeStr,
          responseTimeMs: elapsedMs,
        },
      ]);
    } catch (error: unknown) {
      const err = error as Error;
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Gagal mengulang respon AI."}`,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || isSubmitting || !token) return;

    const userMessage = message.trim();
    setMessage("");
    setIsSubmitting(true);
    
    // Auto-resize reset to native height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    const startTime = Date.now();
    const userTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // Store current attachment
    const currentDocId = uploadedDocumentId;
    const currentDocName = uploadingFileName;
    setUploadingFileName(null);
    setUploadedDocumentId(null);

    // Determine attached documents
    let attachedDocsList: { id: string; filename: string }[] = [];
    if (currentDocName && currentDocId) {
      attachedDocsList = [{ id: currentDocId, filename: currentDocName }];
    } else if (selectedDocMode === "custom" && selectedCustomDocIds.length > 0) {
      attachedDocsList = userDocuments
        .filter((d) => selectedCustomDocIds.includes(d.id))
        .map((d) => ({ id: d.id, filename: d.filename }));
    } else if (selectedDocMode === "all" && userDocuments.length > 0) {
      attachedDocsList = userDocuments.map((d) => ({ id: d.id, filename: d.filename }));
    }

    // Add user message to display with attached document chips
    setChatMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: userTimeStr,
        attachedDocs: attachedDocsList,
      },
    ]);

    try {
      const requestBody: Record<string, unknown> = {
        message: userMessage,
      };
      
      if (sessionId) {
        requestBody.session_id = sessionId;
      }
      
      // Document filter selection
      if (currentDocId) {
        requestBody.document_ids = [currentDocId];
      } else if (selectedDocMode === "custom" && selectedCustomDocIds.length > 0) {
        requestBody.document_ids = selectedCustomDocIds;
      } else if (selectedDocMode === "none") {
        requestBody.document_ids = [];
      }
      
      if (activeAgent) {
        requestBody.agent_id = activeAgent.id;
      }

      if (enableReasoning) {
        requestBody.enable_reasoning = true;
      }

      if (enableRtk) {
        requestBody.enable_rtk = true;
      }

      const result = await apiFetchRaw<ChatResponseData>("/chat", {
        method: "POST",
        token,
        body: requestBody,
      });

      const elapsedMs = Date.now() - startTime;
      const assistantTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      // Refresh sessions
      if (!sessionId && result) {
        chatSessionsApi.getAll(token).then(setSessions).catch(() => {});
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          thinkingProcess: result.thinking_process,
          sources: result.sources,
          usage: result.usage,
          agentName: activeAgent?.name,
          timestamp: assistantTimeStr,
          responseTimeMs: elapsedMs,
        },
      ]);
    } catch (error: unknown) {
      const err = error as Error;
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Gagal mengirim pesan. Pastikan backend berjalan dan model AI sudah dikonfigurasi."}`,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadSession(id: string) {
    if (!token) return;
    setSessionId(id);
    try {
      const history = await chatSessionsApi.getHistory(token, id);
      setChatMessages(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources_json ? JSON.parse(m.sources_json) : undefined,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        }))
      );
    } catch {
      setChatMessages([]);
    }
  }

  function startNewChat() {
    setSessionId(null);
    setChatMessages([]);
    setActiveAgent(null);
  }

  const firstName = user?.full_name?.split(" ")[0] || user?.email.split("@")[0];
  const activeConfig = configs.find((c) => c.is_active);
  const isInChat = chatMessages.length > 0;

  // Context limit & token analytics state
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const CONTEXT_LIMIT = 128000; // Standard context window limit (128k tokens)

  // Calculate realtime total token usage for current chat session
  const totalPromptTokens = chatMessages.reduce((sum, msg) => sum + (msg.usage?.prompt_tokens ?? 0), 0);
  const totalCompletionTokens = chatMessages.reduce((sum, msg) => sum + (msg.usage?.completion_tokens ?? 0), 0);
  const totalRtkSavedTokens = chatMessages.reduce((sum, msg) => sum + (msg.usage?.rtk_saved_tokens ?? 0), 0);
  const totalSessionTokens = totalPromptTokens + totalCompletionTokens;
  const usagePercentage = totalSessionTokens > 0 ? (totalSessionTokens / CONTEXT_LIMIT) * 100 : 0;
  const formattedPercentage = usagePercentage < 0.1 && totalSessionTokens > 0 ? "< 0.1%" : `${usagePercentage.toFixed(1)}%`;

  // Knowledge label summary
  let knowledgeBadgeLabel = `Semua Dokumen (${userDocuments.length})`;
  if (selectedDocMode === "none") {
    knowledgeBadgeLabel = "Chat Umum (Tanpa Dokumen)";
  } else if (selectedDocMode === "custom") {
    knowledgeBadgeLabel = `${selectedCustomDocIds.length} Dokumen Terpilih`;
  }

  const filteredDocs = userDocuments.filter((d) =>
    d.filename.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col relative">
      {/* Floating Workspace Quick Tools Dock - Auto-Shift Left when Token Analytics Open */}
      <div className={`fixed top-20 z-30 flex flex-col gap-2.5 items-center bg-background/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-2.5 shadow-sm transition-all duration-300 ease-in-out ${
        showTokenDetails ? "right-[360px]" : "right-6"
      }`}>

        {/* Mode Baca & Penjajaran Teks Button */}
        <div className="relative">
          <Button
            isIconOnly
            onPress={() => setShowAlignPicker(!showAlignPicker)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-[1.25rem] bg-transparent text-muted-foreground border border-transparent hover:border-border/50 hover:bg-foreground/5 hover:text-foreground transition-all"
            aria-label="Mode Baca & Penjajaran Teks"
          >
            {textAlign === "left" && <AlignLeft className="h-5 w-5" />}
            {textAlign === "justify" && <AlignJustify className="h-5 w-5" />}
            <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90 shadow-sm z-50">
              Mode Baca ({textAlign === "justify" ? "Rata Kanan-Kiri" : "Rata Kiri"})
            </span>
          </Button>

          {/* Alignment Picker Popover (Rata Kiri vs Justify) */}
          {showAlignPicker && (
            <div className="absolute right-14 top-0 z-50 flex items-center gap-1.5 bg-orange-50/80 backdrop-blur-2xl p-1.5 rounded-[1.5rem] border border-gray-200/50 shadow-lg animate-in fade-in zoom-in-95">
              <Button
                isIconOnly={false}
                onPress={() => { setTextAlign("left"); setShowAlignPicker(false); showToast("Mode Baca: Rata Kiri"); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors h-9 ${textAlign === "left" ? "bg-black/10 text-gray-900 font-bold" : "bg-transparent text-gray-500/80 hover:bg-black/5 hover:text-gray-800"}`}
                aria-label="Rata Kiri"
              >
                <AlignLeft className="h-4 w-4" />
                <span>Kiri</span>
              </Button>
              <Button
                isIconOnly={false}
                onPress={() => { setTextAlign("justify"); setShowAlignPicker(false); showToast("Mode Baca: Rata Kanan-Kiri (Justify)"); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors h-9 ${textAlign === "justify" ? "bg-black/10 text-gray-900 font-bold" : "bg-transparent text-gray-500/80 hover:bg-black/5 hover:text-gray-800"}`}
                aria-label="Rata Kanan-Kiri (Justify)"
              >
                <AlignJustify className="h-4 w-4" />
                <span>Justify</span>
              </Button>
            </div>
          )}
        </div>

        {/* Impor / Simpan ke Catatan Workspace Button */}
        <Button
          isIconOnly
          onPress={handleSaveToWorkspace}
          className="group relative flex h-10 w-10 items-center justify-center rounded-[1.25rem] bg-transparent text-muted-foreground border border-transparent hover:border-border/50 hover:bg-foreground/5 hover:text-foreground transition-all"
          aria-label="Impor & Simpan Jawaban ke Catatan Workspace"
        >
          <BookmarkPlus className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90 shadow-sm z-50">
            Simpan ke Catatan
          </span>
        </Button>

        {/* Panggil AI Asisten ke Workspace Button */}
        <Button
          isIconOnly
          onPress={() => setShowAgentPicker(!showAgentPicker)}
          className="group relative flex h-10 w-10 items-center justify-center rounded-[1.25rem] bg-transparent text-muted-foreground border border-transparent hover:border-border/50 hover:bg-foreground/5 hover:text-foreground transition-all"
          aria-label="Panggil AI Asisten Spesialis ke Workspace"
        >
          <Bot className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90 shadow-sm z-50">
            AI Spesialis
          </span>
        </Button>

        {/* Unggah / Impor Dokumen Baru Button */}
        <Button
          isIconOnly
          onPress={() => fileInputRef.current?.click()}
          className="group relative flex h-10 w-10 items-center justify-center rounded-[1.25rem] bg-transparent text-muted-foreground border border-transparent hover:border-border/50 hover:bg-foreground/5 hover:text-foreground transition-all"
          aria-label="Unggah & Impor Dokumen Baru ke Workspace"
        >
          <FolderPlus className="h-5 w-5" />
          <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90 shadow-sm z-50">
            Impor Dokumen
          </span>
        </Button>
      </div>

      {/* Floating Realtime Token Tracker Badge with Analytics Popover */}
      {isInChat && (
        <div className="absolute top-4 right-6 z-20 flex flex-col items-end">
          <button
            type="button"
            onClick={() => setShowTokenDetails(!showTokenDetails)}
            className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/95 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm backdrop-blur-md transition-all hover:bg-emerald-100 hover:scale-105 active:scale-95 cursor-pointer"
            title="Klik untuk melihat rincian pemakaian token per pesan & kapasitas konteks"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500 animate-pulse" />
            <span>Token:</span>
            <span className="font-black text-emerald-800">{totalSessionTokens.toLocaleString()}</span>
            <span className="inline-flex items-center rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-950">
              {formattedPercentage}
            </span>
            <ChevronDown className={`h-3 w-3 text-emerald-700 transition-transform ${showTokenDetails ? "rotate-180" : ""}`} />
          </button>

          {/* Unified Emerald Token Analytics Popover */}
          {showTokenDetails && (
            <div className="mt-2 w-80 rounded-2xl border border-emerald-200/80 bg-white p-4 shadow-xl backdrop-blur-xl z-50 text-xs text-gray-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5 mb-3">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <Zap className="h-4 w-4 text-emerald-600 fill-emerald-500" />
                  <span>Realtime Token Analytics</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTokenDetails(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* RTK Token Server Engine Card */}
              <div className="mb-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-emerald-600 fill-emerald-500" />
                    <span className="font-bold text-emerald-950 text-xs">RTK Token Server</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableRtk}
                      onChange={(e) => {
                        setEnableRtk(e.target.checked);
                        showToast(e.target.checked ? "⚡ RTK Token Server diaktifkan (Hemat 35%-60% token)!" : "RTK Token Server dinonaktifkan");
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="mt-1 text-[10px] text-emerald-800 leading-normal">
                  Mengompresi & memangkas konteks prompt secara realtime berbasis engine <span className="font-mono font-bold">rtk-ai/rtk</span> untuk menghemat token server.
                </p>
                {totalRtkSavedTokens > 0 && (
                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-emerald-900 border-t border-emerald-200/60 pt-1.5">
                    <span>Penghematan RTK:</span>
                    <span className="bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-full font-bold">
                      +{totalRtkSavedTokens.toLocaleString()} tokens hemat
                    </span>
                  </div>
                )}
              </div>

              {/* Context Window Capacity Bar */}
              <div className="mb-4 bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
                <div className="flex justify-between items-center mb-1.5 font-medium">
                  <span className="text-gray-700 font-semibold">Kapasitas Konteks (128K):</span>
                  <span className="font-bold text-emerald-800">{formattedPercentage}</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(1, Math.min(100, usagePercentage))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Terpakai: {totalSessionTokens.toLocaleString()}</span>
                  <span>Maks: {CONTEXT_LIMIT.toLocaleString()}</span>
                </div>
              </div>

              {/* Prompt vs Response Breakdown */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase block">Prompt (Input)</span>
                  <span className="text-sm font-bold text-gray-900">{totalPromptTokens.toLocaleString()}</span>
                </div>
                <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase block">Response (Output)</span>
                  <span className="text-sm font-bold text-gray-900">{totalCompletionTokens.toLocaleString()}</span>
                </div>
              </div>

              {/* Turn-by-Turn Breakdown */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Rincian Per Pesan (Turn)</p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {chatMessages
                    .filter((m) => m.role === "assistant")
                    .map((m, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-2 text-[11px] border border-gray-100">
                        <span className="font-medium text-gray-700">Respons #{idx + 1}</span>
                        {m.usage ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {m.usage.total_tokens} tokens
                            </span>
                            {m.usage.rtk_saved_tokens ? (
                              <span className="text-[9px] font-bold text-emerald-700">
                                (RTK: +{m.usage.rtk_saved_tokens} hemat)
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </div>
                    ))}
                  {chatMessages.filter((m) => m.role === "assistant").length === 0 && (
                    <p className="text-gray-400 text-center py-2 italic text-[11px]">Belum ada balasan AI</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Area */}
      {isInChat ? (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-5xl lg:max-w-6xl space-y-7 pt-4">
            {chatMessages.map((msg, i) => (
              <ChatMessage
                key={i}
                msg={msg}
                index={i}
                textAlign={textAlign}
                onRegenerate={handleRegenerate}
                onSaveEditPrompt={handleSaveEditPrompt}
                isSubmitting={isSubmitting}
              />
            ))}



            {/* Fathoming... Clean Thinking View (Disalin dari Screenshot) */}
            {isSubmitting && (
              <div className="flex justify-start py-2">
                <div className="flex items-center gap-2.5 text-gray-700 text-sm font-medium animate-in fade-in duration-300">
                  <Sparkles className="h-4.5 w-4.5 text-orange-500 fill-orange-400 animate-spin" />
                  <span className="font-sans text-gray-800 font-medium">Fathoming...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        /* Welcome Screen */
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900/10">
            <BookOpen className="h-8 w-8 text-gray-900" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold font-serif text-foreground">Halo, {firstName} 👋</h1>
          <p className="max-w-md text-center text-sm text-cloudy">
            Unggah materi belajarmu di menu <span className="font-medium text-gray-900">Materi Saya</span>, lalu
            tanyakan apa saja tentang isinya di sini.
          </p>
          
          {/* Quick actions */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/materi-saya"
              className="flex items-center gap-2 rounded-xl border border-cloudy/20 bg-pampas px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-gray-900/30 hover:shadow-sm"
            >
              <FileText className="h-4 w-4 text-foreground" />
              Kelola Materi
            </Link>
            <Link
              href="/latihan-soal"
              className="flex items-center gap-2 rounded-xl border border-cloudy/20 bg-pampas px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-gray-900/30 hover:shadow-sm"
            >
              <BrainCircuit className="h-4 w-4 text-foreground" />
              Latihan Soal
            </Link>
            <button
              onClick={() => setShowAgentPicker(true)}
              className="flex items-center gap-2 rounded-xl border border-cloudy/20 bg-pampas px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-gray-900/30 hover:shadow-sm"
            >
              <Bot className="h-4 w-4 text-foreground" />
              {activeAgent ? `Asisten: ${activeAgent.name}` : "Konfigurasi Mode AI & Server"}
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="mx-auto w-full max-w-5xl lg:max-w-6xl p-4">

        {/* Active Agent Badge */}
        {activeAgent && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground">
              <Bot className="h-3 w-3" />
              {activeAgent.name}
              <button onClick={() => setActiveAgent(null)} className="ml-1 hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
            <span className="text-[10px] text-cloudy">{activeAgent.role}</span>
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
          className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-[2rem] shadow-sm border border-border/50 transition-colors focus-within:border-border relative glass-form"
        >
          {/* Attachment Chip */}
          {uploadingFileName && (
            <div className="px-3 pt-2 -mb-1 flex">
              <div className="flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur-md group shadow-sm">
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" /> : <FileText className="h-3.5 w-3.5 text-gray-500" />}
                <span className="truncate max-w-[150px]">{uploadingFileName}</span>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadingFileName(null);
                      setUploadedDocumentId(null);
                    }}
                    className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-700 transition-colors"
                    title="Batal lampirkan dokumen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pt-2 pb-8">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent);
                }
              }}
              placeholder={activeAgent ? `Tanya ${activeAgent.name}...` : "Tulis pesan..."}
              className="w-full resize-none bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none overflow-y-auto max-h-[30vh]"
              style={{ minHeight: '24px' }}
            />
          </div>

          {/* Bottom Actions Bar */}
          <div className="flex items-center justify-between pl-1 pr-1 pb-1 absolute bottom-2 left-2 right-2">
            <div className="flex shrink-0 items-center gap-1 flex-wrap">
              {/* Upload Button (Replaces Claude's + button) */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.txt,.md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex shrink-0 h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 hover:text-gray-800 transition-colors disabled:opacity-50"
                title="Unggah Dokumen Baru"
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              </button>

              {/* Agent Robot Icon & AI Server Settings Popover */}
              <div className="relative">
                <Button
                  isIconOnly
                  onPress={() => setShowAgentPicker(!showAgentPicker)}
                  className={`flex shrink-0 h-9 w-9 items-center justify-center rounded-full transition-all ${
                    activeAgent || enableReasoning || enableRtk
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                  aria-label="Pengaturan Mode AI, Asisten Spesialis, CoT Reasoning & RTK Token Server"
                >
                  <Bot className="h-[18px] w-[18px]" />
                </Button>

                {/* Agent Robot Popover with RTK Token Server & CoT Reasoning Markdown Explanations */}
                {showAgentPicker && (
                  <div className="absolute bottom-14 left-0 z-50 w-72 sm:w-80 rounded-[2rem] border border-gray-200 bg-white p-4 shadow-xl text-xs space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-gray-800">
                        <Bot className="h-4 w-4 text-gray-600" />
                        <span>Pengaturan Mode AI & Server</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAgentPicker(false)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-black/5 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* RTK Token Server Toggle & Markdown Explanation */}
                    <div className="p-3 rounded-xl border border-gray-200/50 bg-black/5 backdrop-blur-md">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-emerald-600 fill-emerald-500" />
                          <span className="font-bold text-emerald-950 text-xs">RTK Token Server</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableRtk}
                            onChange={(e) => {
                              setEnableRtk(e.target.checked);
                              showToast(e.target.checked ? "⚡ RTK Token Server diaktifkan!" : "RTK Token Server dinonaktifkan");
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                      <div className="text-[10px] text-emerald-900 leading-relaxed space-y-1 font-sans border-t border-emerald-200/60 pt-1.5 mt-1.5">
                        <p className="font-medium">
                          <strong className="font-bold">Penjelasan RTK Token Server:</strong> Fitur pemangkasan & kompresi konteks prompt dokumen secara *realtime* berbasis engine <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[9px]">rtk-ai/rtk</code> untuk menghemat <span className="font-bold text-emerald-950">35% ~ 60% token server</span> pada setiap pertanyaan.
                        </p>
                      </div>
                    </div>

                    {/* CoT Reasoning Toggle & Markdown Explanation */}
                    <div className="p-3 rounded-xl border border-purple-200/90 bg-purple-50/70">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <BrainCircuit className="h-4 w-4 text-purple-600" />
                          <span className="font-bold text-purple-950 text-xs">CoT Reasoning</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableReasoning}
                            onChange={(e) => {
                              setEnableReasoning(e.target.checked);
                              showToast(e.target.checked ? "🧠 CoT Reasoning diaktifkan!" : "CoT Reasoning dinonaktifkan");
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      <div className="text-[10px] text-purple-900 leading-relaxed space-y-1 font-sans border-t border-purple-200/60 pt-1.5 mt-1.5">
                        <p className="font-medium">
                          <strong className="font-bold">Penjelasan CoT Reasoning:</strong> Mengaktifkan mode penalaran logis bertahap bertingkat (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[9px]">&lt;think&gt; ... &lt;/think&gt;</code>) untuk menganalisis masalah secara mendalam sebelum memberikan jawaban akhir.
                        </p>
                      </div>
                    </div>

                    {/* Agent Selection List */}
                    {agents.length > 0 && (
                      <div className="border-t border-gray-100 pt-2">
                        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-cloudy">Pilih Asisten Spesialis</p>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {agents.map((ag) => (
                            <button
                              key={ag.id}
                              type="button"
                              onClick={() => { setActiveAgent(ag); setShowAgentPicker(false); }}
                              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
                                activeAgent?.id === ag.id ? "bg-gray-50 font-bold" : ""
                              }`}
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900/10">
                                <Bot className="h-3.5 w-3.5 text-gray-900" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-gray-900">{ag.name}</p>
                                <p className="truncate text-[10px] text-gray-500">{ag.role}</p>
                              </div>
                              {activeAgent?.id === ag.id && <Check className="h-3.5 w-3.5 shrink-0 text-gray-900" />}
                            </button>
                          ))}
                        </div>
                        {activeAgent && (
                          <button
                            type="button"
                            onClick={() => { setActiveAgent(null); setShowAgentPicker(false); }}
                            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                          >
                            <X className="h-3.5 w-3.5" /> Hapus Asisten Spesialis
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DeepTutor KnowledgeSelector Modal Picker */}
              <div className="relative">
                <div
                  className={`flex items-center rounded-full transition-all ${
                    selectedDocMode === "none"
                      ? "bg-transparent border-transparent"
                      : "bg-secondary shadow-sm border border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setShowKnowledgePicker(!showKnowledgePicker)}
                    className="flex items-center gap-1.5 py-1 pl-2 pr-1.5 text-[13px] font-medium cursor-pointer hover:bg-foreground/5 rounded-full transition-colors"
                    title="Pilih dokumen / modul pembelajaran"
                  >
                    <span className={`truncate max-w-[150px] ${selectedDocMode === "none" ? "text-muted-foreground" : "text-foreground"}`}>{knowledgeBadgeLabel}</span>
                  </button>

                  {selectedDocMode !== "none" && (
                    <div className="pr-1 flex items-center">
                      <div className="w-px h-3 bg-gray-200 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => { setSelectedDocMode("none"); setSelectedCustomDocIds([]); }}
                        className="p-0.5 rounded-full text-gray-400 hover:bg-black/5 transition-colors"
                        title="Batal gunakan dokumen (Kembali ke Chat Umum)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Knowledge Selector Popover Modal */}
                {showKnowledgePicker && (
                  <div className="absolute bottom-12 left-0 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-popover p-3 shadow-xl text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                      <span className="font-bold text-popover-foreground flex items-center gap-1.5">
                        <Database className="h-4 w-4 text-primary" />
                        <span>Pilih Referensi Dokumen</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowKnowledgePicker(false)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Mode Selection Options */}
                    <div className="space-y-1.5 mb-3 border-b border-border pb-2.5">
                      <button
                        type="button"
                        onClick={() => { setSelectedDocMode("none"); setSelectedCustomDocIds([]); }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                          selectedDocMode === "none" ? "bg-secondary font-bold text-secondary-foreground" : "hover:bg-secondary text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquareQuote className="h-4 w-4 text-gray-500" />
                          <span>Chat Umum (Tanpa Dokumen)</span>
                        </span>
                        {selectedDocMode === "none" && <Check className="h-3.5 w-3.5 text-foreground" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setSelectedDocMode("all"); setSelectedCustomDocIds([]); }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                          selectedDocMode === "all" ? "bg-primary/10 font-bold text-primary" : "hover:bg-secondary text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-primary" />
                          <span>Semua Dokumen Saya ({userDocuments.length})</span>
                        </span>
                        {selectedDocMode === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </div>

                    {/* Custom Document Multi-Select Search */}
                    {userDocuments.length > 0 && (
                      <div>
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={docSearchQuery}
                            onChange={(e) => setDocSearchQuery(e.target.value)}
                            placeholder="Cari modul..."
                            className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary text-foreground placeholder-muted-foreground"
                          />
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {filteredDocs.map((doc) => {
                            const isChecked = selectedDocMode === "custom" && selectedCustomDocIds.includes(doc.id);
                            const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
                            const isWord = doc.filename.toLowerCase().match(/\.(docx|doc)$/);
                            const iconColor = isPdf ? "text-red-500" : isWord ? "text-blue-500" : "text-gray-500";
                            
                            return (
                              <label
                                key={doc.id}
                                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer transition-colors ${
                                  isChecked ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCustomDocSelection(doc.id)}
                                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                                />
                                <FileText className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                                <span className={`truncate flex-1 text-xs ${isChecked ? "text-primary" : "text-muted-foreground"}`}>{doc.filename}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Model Switcher Pill */}
              {!isLoadingConfigs && configs.length === 0 ? (
                <Link
                  href="/pengaturan"
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">Belum ada model</span>
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Popover {...({ placement: "top-end", offset: 8 } as any)}>
                  <PopoverTrigger>
                    <div className="flex items-center gap-1 rounded-xl px-2 py-1 text-[13px] transition-colors hover:bg-foreground/5 cursor-pointer text-muted-foreground hover:text-foreground">
                      <span className="truncate max-w-[100px] sm:max-w-[150px] font-medium">
                        {activeConfig?.name || "Pilih Model"}
                      </span>
                      <span className="font-normal opacity-80">
                        Sedang
                      </span>
                      <ChevronDown className="h-3 w-3 ml-0.5" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-1 min-w-[200px] shadow-xl border border-border rounded-xl bg-popover mb-2">
                    <div className="flex flex-col w-full">
                      {configs.map((config) => (
                        <button
                          key={config.id}
                          onClick={() => handleSetActive(config.id)}
                          className={`flex items-center justify-between px-3 py-2 text-left rounded-lg transition-colors ${
                            config.id === activeConfig?.id 
                              ? "bg-primary/10 text-primary" 
                              : "hover:bg-secondary text-muted-foreground"
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-[13px]">{config.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">{config.model_name}</span>
                          </div>
                          {config.id === activeConfig?.id && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                      
                      <div className="h-px bg-gray-100 my-1 mx-1" />
                      
                      <Link
                        href="/pengaturan"
                        className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium hover:bg-secondary rounded-lg text-primary w-full text-left transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Tambah Model Baru</span>
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Send Button */}
              <button
                type="submit"
                disabled={!message.trim() || isSubmitting}
                className="flex h-8 w-8 ml-1 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-90 active:scale-95 disabled:bg-secondary disabled:text-muted-foreground"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-2xl bg-gray-950 text-white px-4 py-3 text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 border border-gray-800">
          <Sparkles className="h-4 w-4 text-emerald-400 fill-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
