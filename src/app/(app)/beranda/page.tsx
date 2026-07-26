"use client";

import { useEffect, useState, useRef, useCallback, useMemo, memo, type FormEvent, type ChangeEvent } from "react";
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
  AlignJustify,
  MessageSquarePlus,
  Download,
  Maximize,
  Minimize,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Square,
  BookMarked,
  Quote,
  ExternalLink,
  Globe,
  PenLine,
  ScrollText
} from "lucide-react";
import { marked } from "marked";

import { useAuth } from "@/components/auth-provider";
import { settingsApi, chatSessionsApi, agentsApi, documentsApi, notebooksApi, ApiError } from "@/lib/api";
import type { ModelConfig, ChatSession, Agent, Document as UserDoc } from "@/lib/types";
import { ChatMessage } from "@/components/chat-message";
import type { DisplayMessage } from "@/components/chat-message";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { DrawioViewer } from "@/components/drawio-viewer";
import { ReferenceViewer, isPdfUrl, type ViewerSource } from "@/components/reference-viewer";

const MemoDrawioViewer = memo(DrawioViewer);

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Satu rujukan yang dikumpulkan agen selama percakapan (web atau dokumen). */
type SourceRef = { type: string; title: string; url: string; snippet?: string };

/** Gaya sitasi yang tersedia untuk tombol salin cepat. */
type CitationStyle = "apa" | "ieee" | "mla";

const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: "apa", label: "APA" },
  { id: "ieee", label: "IEEE" },
  { id: "mla", label: "MLA" },
];

/** Label pendek kemampuan model untuk lencana di pemilih model. */
const CAPABILITY_LABEL: Record<string, string> = {
  vision: "Gambar",
  tools: "Agen",
  reasoning: "Nalar",
  code: "Kode",
  audio: "Audio",
  embedding: "Embed",
};

/** Laporan yang terdeteksi dari balasan AI dan siap dibuka di kanvas. */
type ReportDraft = { title: string; markdown: string; html: string };

/** Kata kunci yang menandakan user memang sedang meminta sebuah laporan. */
const REPORT_REQUEST = /\b(laporan|makalah|paper|artikel ilmiah|proposal|skripsi|tesis|esai|essay|karya tulis|literature review|tinjauan pustaka)\b/i;

/**
 * Tebak apakah balasan AI berbentuk laporan sehingga layak dibuka di kanvas.
 * Kriteria sengaja konservatif supaya jawaban obrolan biasa tidak ikut terbuka:
 * struktur berjudul banyak + cukup panjang, atau user memang minta laporan.
 */
function detectReport(answer: string, userMessage: string): { title: string; markdown: string } | null {
  // Blok kode (mis. XML draw.io) tidak dihitung sebagai isi laporan.
  const clean = answer.replace(/```[\s\S]*?```/g, "");
  const headings = clean.match(/^#{1,3}\s+\S.*$/gm) ?? [];
  const words = clean.split(/\s+/).filter(Boolean).length;
  const asked = REPORT_REQUEST.test(userMessage);

  const qualifies = asked ? headings.length >= 2 && words >= 200 : headings.length >= 3 && words >= 450;
  if (!qualifies) return null;

  const h1 = clean.match(/^#\s+(.+)$/m);
  const rawTitle = (h1?.[1] ?? headings[0] ?? "").replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim();
  const title = (rawTitle || "Laporan Nalar AI").slice(0, 120);
  return { title, markdown: clean.trim() };
}

/** Ambil nama situs dari URL untuk dipakai sebagai penerbit di sitasi. */
function siteNameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Susun satu entri daftar pustaka. Tanggal akses memakai hari ini karena
 * sumber diambil langsung saat percakapan berlangsung.
 */
function formatCitation(ref: SourceRef, index: number, style: CitationStyle): string {
  const site = siteNameOf(ref.url);
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const year = new Date().getFullYear();

  if (ref.type === "document") {
    if (style === "ieee") return `[${index}] "${ref.title}," dokumen pribadi, diakses ${today}.`;
    if (style === "mla") return `"${ref.title}." Dokumen pribadi, diakses ${today}.`;
    return `${ref.title}. (${year}). Dokumen pribadi. Diakses ${today}.`;
  }

  if (style === "ieee") {
    return `[${index}] "${ref.title}," ${site || "web"}. [Daring]. Tersedia: ${ref.url}. [Diakses: ${today}].`;
  }
  if (style === "mla") {
    return `"${ref.title}." ${site || "Web"}, ${ref.url}. Diakses ${today}.`;
  }
  return `${site || "Sumber web"}. (${year}). ${ref.title}. Diakses ${today}, dari ${ref.url}`;
}

async function apiFetchRaw<T>(path: string, options: { method?: string; token?: string; body?: unknown; onEvent?: (parsed: any) => void; abortSignal?: AbortSignal } = {}): Promise<T> {
  const { method = "GET", body, token, abortSignal } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: abortSignal,
  });
  if (!response.ok) {
    let detail: string | any = "Terjadi kesalahan.";
    try {
      const d = await response.json();
      detail = d.detail ?? detail;
      if (Array.isArray(detail)) {
        detail = detail.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`).join("\n");
      } else if (typeof detail === "object" && detail !== null) {
        detail = JSON.stringify(detail);
      }
    } catch { }
    throw new Error(String(detail));
  }
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("x-ndjson") || contentType.includes("ndjson")) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let answer = "";
    let thinking_process = "";
    let sources = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let suggestions: string[] = [];
    let buffer = "";

    let streamError: Error | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (options.onEvent) options.onEvent(parsed);
          if (parsed.event === "text") answer += parsed.data;
          else if (parsed.event === "reasoning") thinking_process += parsed.data;
          else if (parsed.event === "sources") sources = parsed.data;
          else if (parsed.event === "usage") usage = parsed.data;
          else if (parsed.event === "suggestions") suggestions = parsed.data;
          else if (parsed.event === "error") streamError = new Error(parsed.data);
        } catch (e) { }
      }
      if (streamError) throw streamError;
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (options.onEvent) options.onEvent(parsed);
        if (parsed.event === "text") answer += parsed.data;
        else if (parsed.event === "reasoning") thinking_process += parsed.data;
        else if (parsed.event === "sources") sources = parsed.data;
        else if (parsed.event === "usage") usage = parsed.data;
        else if (parsed.event === "suggestions") suggestions = parsed.data;
        else if (parsed.event === "error") throw new Error(parsed.data);
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          throw e;
        }
      }
    }

    return { answer, thinking_process, sources, usage, suggestions } as T;
  }

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
  answer: string;
  thinking_process?: string;
  sources?: any[];
  usage?: TokenUsage;
  suggestions?: string[];
  created_at: string;
}

// DisplayMessage interface is imported from @/components/chat-message

export default function BerandaPage() {
  const { user, token } = useAuth();
  const [message, setMessage] = useState("");
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thinkingText, setThinkingText] = useState("Fathoming...");
  const [enableReasoning, setEnableReasoning] = useState(false);
  const [enableRtk, setEnableRtk] = useState(true); // RTK Token Server enabled by default
  const [textAlign, setTextAlign] = useState<"left" | "justify">("justify"); // Mode Baca Penjajaran Teks (Kanan-Kiri / Justify & Kiri)
  const [showAlignPicker, setShowAlignPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachedImages, setAttachedImages] = useState<{ name: string, base64: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeDiagramXml, setActiveDiagramXml] = useState<string | null>(null);

  // Kanvas laporan: terbuka otomatis begitu balasan AI berbentuk laporan
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isOpeningReport, setIsOpeningReport] = useState(false);

  // Toast notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const extractAndSetDiagramXml = useCallback((answer: string) => {
    const match = answer.match(/```(?:xml|drawio)[\s\n]*([\s\S]*?)```/) || answer.match(/(<mxfile[\s\S]*?<\/mxfile>)/);
    if (match) {
      setActiveDiagramXml(match[1].trim());
    }
  }, []);

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

  // Referensi yang dikumpulkan agen sepanjang percakapan, untuk sitasi instan
  const [webRefs, setWebRefs] = useState<SourceRef[]>([]);
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [expandedRef, setExpandedRef] = useState<number | null>(null);
  const [previewSource, setPreviewSource] = useState<ViewerSource | null>(null);


  // Agent & Model Config state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSubmitting(false);
      setThinkingText("Dibatalkan.");
      showToast("Pembuatan respons dibatalkan");
    }
  }, [showToast]);

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

    // Listen for settings updates from the modal
    const handleSettingsUpdated = () => loadData();
    window.addEventListener("settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("settings-updated", handleSettingsUpdated);
  }, [user, token]);

  // Load chat sessions
  useEffect(() => {
    async function loadSessions() {
      if (!token) return;
      try {
        const data = await chatSessionsApi.getAll(token);
        setSessions(data);
      } catch { }
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

  // Listen for open-drawio-diagram events from markdown-content
  useEffect(() => {
    const handleOpenDiagram = (e: Event) => {
      const customEvent = e as CustomEvent<{ xml: string }>;
      if (customEvent.detail?.xml) {
        setActiveDiagramXml(customEvent.detail.xml);
      }
    };
    window.addEventListener("open-drawio-diagram", handleOpenDiagram);
    return () => window.removeEventListener("open-drawio-diagram", handleOpenDiagram);
  }, []);

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
      showToast(`⚠️ Gagal mengunggah dokumen: ${err instanceof ApiError ? err.message : String(err)}`);
      setUploadingFileName(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImages(prev => [...prev, { name: file.name, base64: event.target!.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    }

    if (imageInputRef.current) imageInputRef.current.value = "";
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
      // Editor catatan menyimpan HTML, jadi markdown balasan AI dikonversi dulu
      // agar judul, daftar, dan tabelnya tampil rapi — bukan sebagai teks mentah.
      const html = withBibliography(await marked.parse(lastAiMsg.content));
      await notebooksApi.create(token, { title, content: html });
      showToast("🚀 Berhasil diimpor & disimpan ke Catatan Workspace!");
    } catch (err) {
      showToast(`⚠️ Gagal menyimpan ke Catatan Workspace: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Tempelkan daftar pustaka dari rujukan yang terkumpul di akhir dokumen. */
  function withBibliography(html: string): string {
    if (webRefs.length === 0) return html;
    const items = webRefs
      .map((r, i) => `<li>${formatCitation(r, i + 1, citationStyle)}</li>`)
      .join("");
    return `${html}<h2>Daftar Pustaka</h2><ol>${items}</ol>`;
  }

  /**
   * Begitu AI selesai menulis sesuatu yang berbentuk laporan, kanvas dibuka
   * otomatis di sebelah chat supaya user langsung melihat hasilnya utuh.
   */
  async function maybeOpenReportCanvas(answer: string, userMessage: string) {
    const detected = detectReport(answer, userMessage);
    if (!detected) return;
    const html = await marked.parse(detected.markdown);
    setReportDraft({ ...detected, html });
    setIsReportOpen(true);
  }

  /**
   * Kirim laporan di kanvas ke menu Catatan sebagai dokumen baru, lalu buka
   * langsung editornya lewat deep-link `/catatan?nb=<id>`.
   */
  async function openReportEditor() {
    if (!token || !reportDraft || isOpeningReport) return;
    setIsOpeningReport(true);
    try {
      const nb = await notebooksApi.create(token, {
        title: reportDraft.title,
        content: withBibliography(reportDraft.html),
      });
      showToast("📄 Laporan dibuka di editor Catatan");
      router.push(`/catatan?nb=${nb.id}`);
    } catch (err) {
      showToast(`⚠️ Gagal membuka editor laporan: ${err instanceof Error ? err.message : String(err)}`);
      setIsOpeningReport(false);
    }
  }

  /** Salin isi laporan (markdown mentah) ke papan klip. */
  async function copyReport() {
    if (!reportDraft) return;
    try {
      await navigator.clipboard.writeText(reportDraft.markdown);
      showToast("Isi laporan disalin");
    } catch {
      showToast("⚠️ Gagal menyalin laporan");
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
        message: activeDiagramXml
          ? `${newPrompt.trim()}\n\n[Context Diagram Draw.io Saat Ini]:\n\`\`\`xml\n${activeDiagramXml}\n\`\`\`\n`
          : newPrompt.trim(),
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

      extractAndSetDiagramXml(result.answer);
      void maybeOpenReportCanvas(result.answer, newPrompt);

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
        message: activeDiagramXml
          ? `${lastUserMsg.content}\n\n[Context Diagram Draw.io Saat Ini]:\n\`\`\`xml\n${activeDiagramXml}\n\`\`\`\n`
          : lastUserMsg.content,
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

      extractAndSetDiagramXml(result.answer);
      void maybeOpenReportCanvas(result.answer, lastUserMsg.content);

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
    const currentMessage = textareaRef.current?.value || "";
    if (!currentMessage.trim() || isSubmitting || !token) return;

    const userMessage = currentMessage.trim();
    // Also reset message state just in case other things use it temporarily
    setMessage("");
    setIsSubmitting(true);

    // Auto-resize reset to native height and clear value
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = '24px';
      const submitBtn = document.getElementById('chat-submit-btn') as HTMLButtonElement;
      if (submitBtn) submitBtn.disabled = true;
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

    // Handle images
    const currentImages = [...attachedImages];
    setAttachedImages([]);

    // Lampiran gambar hanya bisa dibaca model dengan kemampuan "vision".
    // Kalau profil aktif tidak mendukungnya, pindah otomatis ke profil yang bisa.
    if (currentImages.length > 0) {
      const active = configs.find((c) => c.is_active);
      if (active && !(active.capabilities ?? []).includes("vision")) {
        const visionCfg = configs.find((c) => (c.capabilities ?? []).includes("vision"));
        if (visionCfg) {
          await handleSetActive(visionCfg.id);
          showToast(`🖼️ Beralih ke "${visionCfg.name}" karena bisa membaca gambar`);
        } else {
          showToast("⚠️ Belum ada model dengan kemampuan gambar — atur di Pengaturan > Model AI");
        }
      }
    }

    // Add user message to display with attached document chips
    setChatMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: userTimeStr,
        attachedDocs: attachedDocsList,
        attachedImages: currentImages.map(img => img.base64),
      },
    ]);

    try {
      const requestBody: Record<string, unknown> = {
        message: activeDiagramXml
          ? `${userMessage}\n\n[Context Diagram Draw.io Saat Ini]:\n\`\`\`xml\n${activeDiagramXml}\n\`\`\`\n`
          : userMessage,
      };

      if (currentImages.length > 0) {
        requestBody.images = currentImages.map(img => img.base64);
      }

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

      setThinkingText("Menyambungkan ke agen AI...");

      const assistantTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      // Append an empty assistant message as a placeholder for streaming
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          thinkingProcess: "",
          sources: [],
          usage: undefined,
          suggestions: [],
          agentName: activeAgent?.name,
          timestamp: assistantTimeStr,
          responseTimeMs: 0,
        },
      ]);

      abortControllerRef.current = new AbortController();
      // Penanda agar label proses tidak melompat mundur saat model
      // menyelipkan potongan penalaran di tengah penulisan jawaban.
      let hasStartedWriting = false;

      const result = await apiFetchRaw<ChatResponseData>("/chat", {
        method: "POST",
        token,
        body: requestBody,
        abortSignal: abortControllerRef.current.signal,
        onEvent: (parsed) => {
          if (parsed.event === "tool_call") {
            if (parsed.name === "search_in_document") setThinkingText("Mencari informasi di dalam dokumen...");
            else if (parsed.name === "read_document") setThinkingText("Membaca isi dokumen...");
            else if (parsed.name === "list_documents") setThinkingText("Mengecek daftar dokumen...");
            else if (parsed.name === "search_web") setThinkingText("Mencari informasi di internet...");
            else setThinkingText(`Mengeksekusi tool: ${parsed.name}...`);
          } else if (parsed.event === "tool_result") {
            setThinkingText("Menganalisis hasil pencarian...");
            // Kumpulkan rujukan agar bisa disitasi instan, tanpa duplikat
            if (Array.isArray(parsed.sources) && parsed.sources.length > 0) {
              setWebRefs(prev => {
                const merged = [...prev];
                for (const src of parsed.sources as SourceRef[]) {
                  const key = (src.url || src.title).toLowerCase();
                  if (!merged.some(r => (r.url || r.title).toLowerCase() === key)) merged.push(src);
                }
                return merged;
              });
            }
          } else if (parsed.event === "reasoning") {
            // Begitu jawaban mulai ditulis, jangan mundur lagi ke label "berpikir" —
            // itu membuat user mengira prosesnya mengulang dari awal.
            if (!hasStartedWriting) setThinkingText("Menyusun pemikiran...");
            setChatMessages(prev => {
              const newArr = [...prev];
              const lastIdx = newArr.length - 1;
              if (newArr[lastIdx] && newArr[lastIdx].role === "assistant") {
                newArr[lastIdx] = { ...newArr[lastIdx], thinkingProcess: (newArr[lastIdx].thinkingProcess || "") + parsed.data };
              }
              return newArr;
            });
          } else if (parsed.event === "text") {
            hasStartedWriting = true;
            setThinkingText("Menulis jawaban...");
            setChatMessages(prev => {
              const newArr = [...prev];
              const lastIdx = newArr.length - 1;
              if (newArr[lastIdx] && newArr[lastIdx].role === "assistant") {
                newArr[lastIdx] = { ...newArr[lastIdx], content: newArr[lastIdx].content + parsed.data };
              }
              return newArr;
            });
          } else if (parsed.event === "sources") {
            setChatMessages(prev => {
              const newArr = [...prev];
              const lastIdx = newArr.length - 1;
              if (newArr[lastIdx] && newArr[lastIdx].role === "assistant") {
                newArr[lastIdx] = { ...newArr[lastIdx], sources: parsed.data };
              }
              return newArr;
            });
          }
        }
      });

      const elapsedMs = Date.now() - startTime;

      // Refresh sessions
      if (!sessionId && result) {
        chatSessionsApi.getAll(token).then(setSessions).catch(() => { });
      }

      extractAndSetDiagramXml(result.answer);
      void maybeOpenReportCanvas(result.answer, userMessage);

      // Finalize the last message with full result to guarantee exact match
      setChatMessages((prev) => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (newArr[lastIdx] && newArr[lastIdx].role === "assistant") {
          newArr[lastIdx] = {
            ...newArr[lastIdx],
            content: result.answer,
            thinkingProcess: result.thinking_process,
            sources: result.sources,
            usage: result.usage,
            suggestions: result.suggestions,
            responseTimeMs: elapsedMs,
          };
        }
        return newArr;
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Generation aborted by user");
        return;
      }
      const err = error as Error;
      setChatMessages((prev) => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (newArr[lastIdx] && newArr[lastIdx].role === "assistant") {
          newArr[lastIdx] = {
            ...newArr[lastIdx],
            content: `⚠️ ${err.message || "Gagal mengirim pesan."}`,
          };
          return newArr;
        }
        return [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${err.message || "Gagal mengirim pesan. Pastikan backend berjalan dan model AI sudah dikonfigurasi."}`,
          },
        ];
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadSession(id: string) {
    if (!token) return;
    setSessionId(id);
    setReportDraft(null);
    setIsReportOpen(false);
    try {
      const history = await chatSessionsApi.getHistory(token, id);
      const formattedMsgs = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: (() => {
          if (!m.sources_json) return undefined;
          try { return JSON.parse(m.sources_json); } catch { return undefined; }
        })(),
        attachedImages: (() => {
          if (!m.images_json) return undefined;
          try { return JSON.parse(m.images_json); } catch { return undefined; }
        })(),
        usage: (() => {
          if (!m.usage_json) return undefined;
          try { return JSON.parse(m.usage_json); } catch { return undefined; }
        })(),
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      }));
      setChatMessages(formattedMsgs);

      // Extract diagram from the latest assistant message that contains a diagram if it exists
      const lastDiagramMsg = [...formattedMsgs].reverse().find(m =>
        m.role === "assistant" && (m.content.includes("```xml") || m.content.includes("```drawio") || m.content.includes("<mxfile"))
      );
      if (lastDiagramMsg) {
        extractAndSetDiagramXml(lastDiagramMsg.content);
      } else {
        setActiveDiagramXml(null);
      }
    } catch {
      showToast("⚠️ Gagal memuat riwayat obrolan.");
    }
  }

  function startNewChat() {
    setSessionId(null);
    setChatMessages([]);
    setActiveAgent(null);
    setActiveDiagramXml(null);
    setReportDraft(null);
    setIsReportOpen(false);
    setWebRefs([]);
    setExpandedRef(null);
  }

  /** Salin satu entri sitasi sesuai gaya yang dipilih. */
  async function copyCitation(ref: SourceRef, index: number) {
    try {
      await navigator.clipboard.writeText(formatCitation(ref, index + 1, citationStyle));
      showToast(`Sitasi ${citationStyle.toUpperCase()} disalin`);
    } catch {
      showToast("⚠️ Gagal menyalin sitasi");
    }
  }

  /** Salin seluruh daftar pustaka sekaligus. */
  async function copyAllCitations() {
    if (webRefs.length === 0) return;
    const text = webRefs.map((r, i) => formatCitation(r, i + 1, citationStyle)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${webRefs.length} sitasi ${citationStyle.toUpperCase()} disalin`);
    } catch {
      showToast("⚠️ Gagal menyalin daftar pustaka");
    }
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(true);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  const downloadChat = () => {
    if (chatMessages.length === 0) {
      showToast("Tidak ada chat untuk diunduh");
      return;
    }
    const text = chatMessages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n-----------------\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chat_Nalar_AI_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Chat berhasil diunduh");
  };

  const deleteCurrentSession = async () => {
    if (!sessionId) {
      startNewChat();
      showToast("Chat dibersihkan");
      return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus sesi chat ini permanen?")) {
      try {
        await chatSessionsApi.delete(token!, sessionId);
        showToast("Sesi berhasil dihapus");
        chatSessionsApi.getAll(token!).then(setSessions).catch(() => { });
        startNewChat();
      } catch (err) {
        showToast("Gagal menghapus sesi");
      }
    }
  };

  const drawioViewerContent = useMemo(() => {
    if (!activeDiagramXml) return null;
    return (
      <MemoDrawioViewer
        xml={activeDiagramXml}
        onDiagramChange={setActiveDiagramXml}
      />
    );
  }, [activeDiagramXml]);

  // Diagram diprioritaskan kalau keduanya aktif; kanvas laporan menyusul.
  const showReportCanvas = Boolean(reportDraft && isReportOpen && !activeDiagramXml);
  const isSplitView = Boolean(activeDiagramXml) || showReportCanvas;

  return (
    <div className="flex h-[100dvh] w-full flex-col relative bg-[#F4F4F5] text-gray-900 selection:bg-blue-200">
      {/* Floating Workspace Quick Tools Dock - Auto-Shift Left when Token Analytics Open */}
      <div className={`fixed top-20 z-30 flex flex-col gap-2.5 items-center bg-white backdrop-blur-2xl border border-gray-200 shadow-sm rounded-none p-1.5 transition-all duration-300 ease-in-out ${showTokenDetails ? "right-[360px]" : "right-6"
        }`}>

        <Button
          isIconOnly
          onPress={() => setIsDockExpanded(!isDockExpanded)}
          className={`group relative flex h-8 w-8 items-center justify-center rounded-none bg-transparent text-gray-400 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all ${isDockExpanded ? "mb-1" : ""}`}
          aria-label={isDockExpanded ? "Sembunyikan Menu" : "Tampilkan Menu"}
        >
          {isDockExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          <span className="absolute right-10 top-1 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-2 py-1 text-[10px] font-medium text-white shadow-sm z-50">
            {isDockExpanded ? "Tutup" : "Buka"}
          </span>
        </Button>

        {isDockExpanded && (
          <>
            {/* Panggil AI Asisten ke Workspace Button */}
            <Button
              isIconOnly
              onPress={() => setShowAgentPicker(!showAgentPicker)}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
              aria-label="Panggil AI Asisten Spesialis"
            >
              <Bot className="h-5 w-5" />
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                AI Spesialis
              </span>
            </Button>

            {/* Referensi & Sitasi Instan */}
            <Button
              isIconOnly
              onPress={() => setShowRefPanel(!showRefPanel)}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent border transition-all ${showRefPanel
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                }`}
              aria-label="Referensi & Sitasi"
            >
              <BookMarked className="h-5 w-5" />
              {webRefs.length > 0 && (
                <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                  {webRefs.length}
                </span>
              )}
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                Referensi & Sitasi
              </span>
            </Button>

            {/* Kanvas Laporan — hanya muncul kalau AI memang menulis laporan */}
            {reportDraft && (
              <Button
                isIconOnly
                onPress={() => setIsReportOpen(!isReportOpen)}
                className={`group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent border transition-all ${isReportOpen
                  ? "border-[#0011ff] bg-[#0011ff] text-white"
                  : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                aria-label="Kanvas Laporan"
              >
                <ScrollText className="h-5 w-5" />
                <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                  Kanvas Laporan
                </span>
              </Button>
            )}

            {/* Simpan balasan terakhir ke Catatan */}
            <Button
              isIconOnly
              onPress={handleSaveToWorkspace}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
              aria-label="Simpan ke Catatan"
            >
              <BookmarkPlus className="h-5 w-5" />
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                Simpan ke Catatan
              </span>
            </Button>

            {/* Mulai Chat Baru */}
            <Button
              isIconOnly
              onPress={startNewChat}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
              aria-label="Mulai Chat Baru"
            >
              <MessageSquarePlus className="h-5 w-5" />
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                Mulai Chat Baru
              </span>
            </Button>

            {/* Unduh Chat */}
            <Button
              isIconOnly
              onPress={downloadChat}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
              aria-label="Unduh Chat"
            >
              <Download className="h-5 w-5" />
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                Unduh Percakapan
              </span>
            </Button>

            {/* Layar Penuh */}
            <Button
              isIconOnly
              onPress={toggleFullscreen}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all"
              aria-label="Layar Penuh"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-gray-900 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                {isFullscreen ? "Tutup Layar Penuh" : "Layar Penuh"}
              </span>
            </Button>

            {/* Hapus Chat / Riwayat */}
            <Button
              isIconOnly
              onPress={deleteCurrentSession}
              className="group relative flex h-10 w-10 items-center justify-center rounded-none bg-transparent text-gray-500 border border-transparent hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all"
              aria-label="Hapus Percakapan"
            >
              <Trash2 className="h-5 w-5" />
              <span className="absolute right-12 top-1.5 hidden group-hover:block whitespace-nowrap rounded-none bg-red-600 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white shadow-sm z-50">
                Hapus Percakapan
              </span>
            </Button>
          </>
        )}
      </div>

      {/* Panel Referensi & Sitasi Instan */}
      {showRefPanel && (
        <div className="fixed top-20 right-[76px] z-30 w-[360px] max-h-[70vh] flex flex-col border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-right-2">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-gray-900">
              <BookMarked className="h-4 w-4" /> Referensi ({webRefs.length})
            </span>
            <Button
              isIconOnly
              onPress={() => setShowRefPanel(false)}
              className="h-7 w-7 min-w-7 rounded-none bg-transparent text-gray-400 hover:text-gray-900"
              aria-label="Tutup panel referensi"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {webRefs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Globe className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-[12px] font-medium text-gray-500">Belum ada rujukan</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                Minta AI mencari di internet — setiap sumber yang dibukanya muncul di sini
                dan bisa langsung disalin sebagai sitasi.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-1">
                  {CITATION_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setCitationStyle(s.id)}
                      className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${citationStyle === s.id
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-200"
                        }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={copyAllCitations}
                  className="flex items-center gap-1 border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-900 hover:text-white"
                >
                  <Copy className="h-3 w-3" /> Salin Semua
                </button>
              </div>

              <ol className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {webRefs.map((ref, i) => (
                  <li key={`${ref.url || ref.title}-${i}`} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => setExpandedRef(expandedRef === i ? null : i)}
                        className="flex w-full items-start gap-1 text-left"
                      >
                        <ChevronRight
                          className={`mt-0.5 h-3 w-3 shrink-0 text-gray-400 transition-transform ${expandedRef === i ? "rotate-90" : ""}`}
                        />
                        <span className={`text-[12px] font-semibold text-gray-900 ${expandedRef === i ? "" : "line-clamp-2"}`}>
                          {ref.title}
                        </span>
                      </button>

                      {ref.url && (
                        <button
                          onClick={() => setPreviewSource(ref)}
                          title="Buka pratinjau sumber di dalam aplikasi"
                          className="ml-4 mt-0.5 flex w-full items-center gap-1 truncate text-left text-[10px] text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{siteNameOf(ref.url) || ref.url}</span>
                          {isPdfUrl(ref.url) && (
                            <span className="shrink-0 bg-red-50 px-1 text-[8px] font-bold uppercase text-red-600">pdf</span>
                          )}
                        </button>
                      )}

                      {expandedRef === i && (
                        <div className="ml-4 mt-2 space-y-2">
                          {ref.snippet ? (
                            <p className="border-l-2 border-gray-200 pl-2 text-[11px] italic leading-relaxed text-gray-500">
                              {ref.snippet}
                            </p>
                          ) : (
                            <p className="text-[11px] italic text-gray-400">Tidak ada cuplikan.</p>
                          )}
                          <p className="bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-600">
                            {formatCitation(ref, i + 1, citationStyle)}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => copyCitation(ref, i)}
                        className="ml-4 mt-1.5 flex items-center gap-1 border border-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-900 hover:text-white"
                      >
                        <Quote className="h-3 w-3" /> Salin {citationStyle}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {/* Main Split Screen Area */}
      <PanelGroup
        key={isSplitView ? "split-mode" : "single-mode"}
        id={isSplitView ? "chat-layout-split" : "chat-layout-single"}
        orientation="horizontal"
        className="flex-1 overflow-hidden min-h-0"
      >
        <Panel id="chat-panel" defaultSize={isSplitView ? 50 : 100} className="flex flex-col relative h-full min-h-0">
          {/* Chat Messages Area */}
          {isInChat ? (
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-8">
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
                    isStreaming={isSubmitting && i === chatMessages.length - 1 && msg.role === "assistant"}
                  />
                ))}



                {/* Menu laporan di dalam chat — jalan pintas ke kanvas & editor */}
                {reportDraft && !isSubmitting && (
                  <div className="flex flex-wrap items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                    <ScrollText className="h-4 w-4 shrink-0 text-[#0011ff]" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-900" title={reportDraft.title}>
                      {reportDraft.title}
                    </span>
                    <button
                      onClick={() => setIsReportOpen((v) => !v)}
                      className="flex items-center gap-1.5 border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Maximize className="h-3 w-3" />
                      {isReportOpen ? "Tutup Kanvas" : "Buka Kanvas"}
                    </button>
                    <button
                      onClick={openReportEditor}
                      disabled={isOpeningReport}
                      className="flex items-center gap-1.5 bg-[#0011ff] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {isOpeningReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                      Menu Laporan
                    </button>
                  </div>
                )}

                {/* Fathoming... Clean Thinking View (Disalin dari Screenshot) */}
                {isSubmitting && (
                  <div className="flex justify-start py-2">
                    <div className="flex items-center gap-2.5 text-gray-500 text-sm font-medium animate-in fade-in duration-300">
                      <Sparkles className="h-4.5 w-4.5 text-orange-500 fill-orange-400 animate-spin" />
                      <span className="font-sans text-gray-900 font-medium">{thinkingText}</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : (
            /* Welcome Screen */
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <h1 className="mb-4 text-5xl font-black font-serif uppercase tracking-tighter text-gray-900 text-center">NALAR AI</h1>
              <p className="max-w-md text-center text-[10px] font-mono tracking-widest uppercase text-gray-500">
                Lampirkan materi belajarmu langsung di kolom chat, lalu tanyakan apa saja
                tentang isinya di sini.
              </p>

              {/* Quick actions */}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-none border border-gray-200 bg-white shadow-sm px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-900 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-gray-900" />
                  Lampirkan Materi
                </button>
                <Link
                  href="/latihan-soal"
                  className="flex items-center gap-2 rounded-none border border-gray-200 bg-white shadow-sm px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-900 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  <BrainCircuit className="h-4 w-4 text-gray-900" />
                  Latihan Soal
                </Link>
                <button
                  onClick={() => setShowAgentPicker(true)}
                  className="flex items-center gap-2 rounded-none border border-gray-200 bg-white shadow-sm px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-900 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  <Bot className="h-4 w-4 text-gray-900" />
                  {activeAgent ? `Asisten: ${activeAgent.name}` : "Konfigurasi AI"}
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="mx-auto w-full max-w-5xl lg:max-w-6xl p-4 shrink-0">

            {/* Active Agent Badge */}
            {activeAgent && (
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 rounded-none bg-[#0011ff]/10 px-3 py-1 text-xs font-medium text-gray-900">
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
              className="flex flex-col gap-2 p-3 bg-white rounded-2xl shadow-sm border border-gray-200 transition-colors focus-within:border-blue-400 relative backdrop-blur-md"
            >
              {/* Attachment & Context Chips */}
              {(uploadingFileName || attachedImages.length > 0 || selectedDocMode !== "none") && (
                <div className="px-3 pt-2 -mb-1 flex flex-wrap gap-2">
                  {/* Knowledge / Document Context Badge */}
                  {selectedDocMode !== "none" && (
                    <div
                      onClick={() => setShowKnowledgePicker(true)}
                      className="flex items-center gap-1.5 rounded-none bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 backdrop-blur-md group shadow-sm border border-blue-100 cursor-pointer transition-colors hover:bg-blue-100"
                    >
                      <Database className="h-3.5 w-3.5 text-blue-600" />
                      <span className="truncate max-w-[150px]">{knowledgeBadgeLabel}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocMode("none");
                          setSelectedCustomDocIds([]);
                        }}
                        className="ml-1 rounded-none p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700 transition-colors"
                        title="Hapus referensi dokumen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Uploading File Badge */}
                  {uploadingFileName && (
                    <div className="flex items-center gap-1.5 rounded-none bg-[#0011ff]/10 px-3 py-1.5 text-xs font-medium text-gray-500 backdrop-blur-md group shadow-sm">
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-900/50" /> : <FileText className="h-3.5 w-3.5 text-gray-900/50" />}
                      <span className="truncate max-w-[150px]">{uploadingFileName}</span>
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={() => {
                            setUploadingFileName(null);
                            setUploadedDocumentId(null);
                          }}
                          className="ml-1 rounded-none p-0.5 text-gray-900/40 hover:bg-black/5 hover:text-gray-500 transition-colors"
                          title="Batal lampirkan dokumen"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.base64}
                        alt={img.name}
                        className="h-12 w-12 object-cover rounded-lg border border-gray-200 shadow-sm cursor-zoom-in hover:opacity-80 transition-opacity"
                        onClick={() => setZoomedImage(img.base64)}
                      />
                      <button
                        type="button"
                        onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 shadow-sm text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 pt-2 pb-8">
                <textarea
                  ref={textareaRef}
                  name="chat-input"
                  defaultValue={""}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;

                    // Directly manage the disabled state of the submit button to avoid React re-renders
                    const submitBtn = document.getElementById('chat-submit-btn') as HTMLButtonElement;
                    if (submitBtn) {
                      submitBtn.disabled = !target.value.trim() || isSubmitting;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as FormEvent);
                    }
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      const item = items[i];
                      if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setAttachedImages(prev => [...prev, { name: file.name || `pasted_image_${Date.now()}.png`, base64: event.target!.result as string }]);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }
                    }
                  }}
                  placeholder={activeAgent ? `Tanya ${activeAgent.name}...` : "Tulis pesan..."}
                  className="w-full resize-none bg-transparent text-[15px] text-gray-900 placeholder:text-gray-900/50 outline-none overflow-y-auto max-h-[30vh] font-sans"
                  style={{ minHeight: '24px' }}
                />
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between pl-1 pr-1 pb-1 absolute bottom-2 left-2 right-2">
                <div className="flex shrink-0 items-center gap-1 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.txt,.md"
                  />
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageChange}
                    className="hidden"
                    accept="image/*"
                    multiple
                  />

                  {/* Plus Menu (Attachment, Agent, Knowledge) */}
                  <Popover isOpen={isPlusMenuOpen} onOpenChange={setIsPlusMenuOpen} {...({ placement: "top-start" } as any)}>
                    <PopoverTrigger>
                      <button
                        type="button"
                        className="flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-transparent text-gray-500 hover:bg-black/5 hover:text-gray-900 transition-colors"
                      >
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 min-w-[220px] rounded-2xl shadow-xl border border-gray-200/60 bg-white">
                      <div className="flex flex-col w-full text-[13px] text-gray-700 font-medium space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { fileInputRef.current?.click(); setIsPlusMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors text-left"
                        >
                          <FileText className="h-4 w-4 text-gray-400" /> Tambahkan dokumen
                        </button>
                        <button
                          type="button"
                          onClick={() => { imageInputRef.current?.click(); setIsPlusMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors text-left"
                        >
                          <Paperclip className="h-4 w-4 text-gray-400" /> Tambahkan foto
                        </button>

                        <div className="h-px bg-gray-100 my-1 mx-2" />

                        <button
                          type="button"
                          onClick={() => { setShowKnowledgePicker(true); setIsPlusMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors text-left"
                        >
                          <Database className="h-4 w-4 text-gray-400" /> Referensi Materi
                        </button>

                        <button
                          type="button"
                          onClick={() => { setShowAgentPicker(true); setIsPlusMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors text-left"
                        >
                          <Bot className="h-4 w-4 text-gray-400" /> Pengaturan AI & Server
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Agent Robot Popover with RTK Token Server & CoT Reasoning Markdown Explanations */}
                  <div className="relative">
                    {showAgentPicker && (
                      <div className="absolute bottom-14 left-0 z-50 w-72 sm:w-80 rounded-none border border-white/20 bg-white p-4 shadow-xl text-xs space-y-3 border border-gray-100 rounded-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div className="flex items-center gap-1.5 font-bold text-gray-900">
                            <Bot className="h-4 w-4 text-gray-900/60" />
                            <span>Pengaturan Mode AI & Server</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAgentPicker(false)}
                            className="p-1.5 text-gray-900/40 hover:text-gray-900/60 rounded-none hover:bg-black/5 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* RTK Token Server Toggle & Markdown Explanation */}
                        <div className="p-3 rounded-none border border-white/20 bg-black/5 backdrop-blur-md">
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
                              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#0011ff] after:border-gray-300 after:border after:rounded-none after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                          <div className="text-[10px] text-emerald-900 leading-relaxed space-y-1 font-sans border-t border-emerald-200/60 pt-1.5 mt-1.5">
                            <p className="font-medium">
                              <strong className="font-bold">Penjelasan RTK Token Server:</strong> Fitur pemangkasan & kompresi konteks prompt dokumen secara *realtime* berbasis engine <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[9px]">rtk-ai/rtk</code> untuk menghemat <span className="font-bold text-emerald-950">35% ~ 60% token server</span> pada setiap pertanyaan.
                            </p>
                          </div>
                        </div>

                        {/* CoT Reasoning Toggle & Markdown Explanation */}
                        <div className="p-3 rounded-none border border-purple-200/90 bg-purple-50/70">
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
                              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#0011ff] after:border-gray-300 after:border after:rounded-none after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                          </div>
                          <div className="text-[10px] text-purple-900 leading-relaxed space-y-1 font-sans border-t border-purple-200/60 pt-1.5 mt-1.5">
                            <p className="font-medium">
                              <strong className="font-bold">Penjelasan CoT Reasoning:</strong> Mengaktifkan mode penalaran logis bertahap bertingkat (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[9px]">&lt;think&gt; ... &lt;/think&gt;</code>) untuk menganalisis masalah secara mendalam sebelum memberikan jawaban akhir.
                            </p>
                          </div>
                        </div>

                        {/* Agent Selection List */}
                        <div className="border-t border-gray-100 pt-3">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pilih Asisten Spesialis</p>
                            <Link href="/agents" className="text-[10px] font-bold text-blue-600 hover:underline">Kelola Agen</Link>
                          </div>

                          {agents.length > 0 ? (
                            <>
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {agents.map((ag) => (
                                  <button
                                    key={ag.id}
                                    type="button"
                                    onClick={() => { setActiveAgent(ag); setShowAgentPicker(false); }}
                                    className={`flex w-full items-center gap-2.5 rounded-none px-2.5 py-2 text-left text-xs transition-colors hover:bg-[#0011ff]/5 ${activeAgent?.id === ag.id ? "bg-[#0011ff]/5 font-bold" : ""
                                      }`}
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-gray-900/10">
                                      <Bot className="h-3.5 w-3.5 text-gray-900" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium text-gray-900">{ag.name}</p>
                                      <p className="truncate text-[10px] text-gray-900/50">{ag.role}</p>
                                    </div>
                                    {activeAgent?.id === ag.id && <Check className="h-3.5 w-3.5 shrink-0 text-gray-900" />}
                                  </button>
                                ))}
                              </div>
                              {activeAgent && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveAgent(null); setShowAgentPicker(false); }}
                                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-none px-3 py-1.5 text-xs text-red-600 font-medium hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" /> Batalkan Spesialis
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="p-3 text-center bg-gray-50 border border-gray-200 border-dashed flex flex-col items-center">
                              <Bot className="h-6 w-6 text-gray-400 mb-2" />
                              <p className="text-[10px] text-gray-600 mb-2 leading-relaxed">
                                Belum ada agen. Buat asisten AI kustom Anda (misal: Pakar Pajak, Translator) agar bisa dipanggil ke dalam chat.
                              </p>
                              <Link href="/agents" className="inline-block px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                                + Buat Agen
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DeepTutor KnowledgeSelector Modal Picker */}
                  <div className="relative">
                    {/* Knowledge Selector Popover Modal */}
                    {showKnowledgePicker && (
                      <div className="absolute bottom-12 left-0 z-50 w-72 sm:w-80 rounded-none border border-white/20 bg-[#0011ff] p-3 shadow-xl text-xs">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                          <span className="font-bold text-popover-foreground flex items-center gap-1.5">
                            <Database className="h-4 w-4 text-primary" />
                            <span>Pilih Referensi Dokumen</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowKnowledgePicker(false)}
                            className="p-1 text-gray-900/40 hover:text-gray-900/60"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Mode Selection Options */}
                        <div className="space-y-1.5 mb-3 border-b border-gray-100 pb-2.5">
                          <button
                            type="button"
                            onClick={() => { setSelectedDocMode("none"); setSelectedCustomDocIds([]); }}
                            className={`flex w-full items-center justify-between rounded-none px-2.5 py-2 text-left transition-colors ${selectedDocMode === "none" ? "bg-[#0011ff]/10 font-bold text-secondary-foreground" : "hover:bg-[#0011ff]/10 text-gray-900/60"
                              }`}
                          >
                            <span className="flex items-center gap-2">
                              <MessageSquareQuote className="h-4 w-4 text-gray-900/50" />
                              <span>Chat Umum (Tanpa Dokumen)</span>
                            </span>
                            {selectedDocMode === "none" && <Check className="h-3.5 w-3.5 text-gray-900" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => { setSelectedDocMode("all"); setSelectedCustomDocIds([]); }}
                            className={`flex w-full items-center justify-between rounded-none px-2.5 py-2 text-left transition-colors ${selectedDocMode === "all" ? "bg-primary/10 font-bold text-primary" : "hover:bg-[#0011ff]/10 text-gray-900/60"
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
                              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-900/40" />
                              <input
                                type="text"
                                value={docSearchQuery}
                                onChange={(e) => setDocSearchQuery(e.target.value)}
                                placeholder="Cari modul..."
                                className="w-full rounded-none border border-white/20 bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary text-gray-900 placeholder-muted-foreground"
                              />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                              {filteredDocs.map((doc) => {
                                const isChecked = selectedDocMode === "custom" && selectedCustomDocIds.includes(doc.id);
                                const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
                                const isWord = doc.filename.toLowerCase().match(/\.(docx|doc)$/);
                                const iconColor = isPdf ? "text-red-500" : isWord ? "text-blue-500" : "text-gray-900/50";

                                return (
                                  <label
                                    key={doc.id}
                                    className={`flex items-center gap-2.5 rounded-none px-2.5 py-2 cursor-pointer transition-colors ${isChecked ? "bg-primary/10 text-primary font-medium" : "hover:bg-[#0011ff]/10 text-gray-900"
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleCustomDocSelection(doc.id)}
                                      className="rounded border-white/20 text-primary focus:ring-primary h-3.5 w-3.5"
                                    />
                                    <FileText className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                                    <span className={`truncate flex-1 text-xs ${isChecked ? "text-primary" : "text-gray-900/60"}`}>{doc.filename}</span>
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

                  {/* Floating Realtime Token Tracker Badge with Analytics Popover */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowTokenDetails(!showTokenDetails)}
                      className="flex items-center gap-1.5 rounded-none px-2 py-1 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50/80 cursor-pointer"
                      title="Klik untuk melihat rincian pemakaian token per pesan & kapasitas konteks"
                    >
                      <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500 animate-pulse" />
                      {!activeDiagramXml && (
                        <span className="hidden sm:inline">Token:</span>
                      )}
                      <span className="font-black text-emerald-800">{totalSessionTokens.toLocaleString()}</span>
                      {!activeDiagramXml && (
                        <span className="hidden sm:inline-flex items-center rounded-none bg-emerald-200/80 px-1.5 py-0.5 text-[9px] font-bold text-emerald-950">
                          {formattedPercentage}
                        </span>
                      )}
                    </button>

                    {/* Unified Emerald Token Analytics Popover */}
                    {showTokenDetails && (
                      <div className="absolute bottom-full right-0 mb-2 w-80 rounded-none border border-emerald-200 bg-white p-4 shadow-xl rounded-2xl backdrop-blur-xl z-50 text-xs text-gray-900 animate-in fade-in zoom-in-95 origin-bottom-right">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5 mb-3">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                            <Zap className="h-4 w-4 text-emerald-600 fill-emerald-500" />
                            <span>Realtime Token Analytics</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTokenDetails(false)}
                            className="rounded-none p-1 text-gray-900/40 hover:bg-[#0011ff]/10 hover:text-gray-900/60"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* RTK Token Server Engine Card */}
                        <div className="mb-3.5 rounded-none border border-emerald-200/90 bg-emerald-50/70 p-3">
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
                              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#0011ff] after:border-gray-300 after:border after:rounded-none after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                          <p className="mt-1 text-[10px] text-emerald-800 leading-normal">
                            Mengompresi & memangkas konteks prompt secara realtime berbasis engine <span className="font-mono font-bold">rtk-ai/rtk</span> untuk menghemat token server.
                          </p>
                          {totalRtkSavedTokens > 0 && (
                            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-emerald-900 border-t border-emerald-200/60 pt-1.5">
                              <span>Penghematan RTK:</span>
                              <span className="bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-none font-bold">
                                +{totalRtkSavedTokens.toLocaleString()} tokens hemat
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Context Window Capacity Bar */}
                        <div className="mb-4 bg-emerald-50/60 rounded-none p-3 border border-emerald-100">
                          <div className="flex justify-between items-center mb-1.5 font-medium">
                            <span className="text-gray-500 font-semibold">Kapasitas Konteks (128K):</span>
                            <span className="font-bold text-emerald-800">{formattedPercentage}</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2 rounded-none overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-none transition-all duration-500"
                              style={{ width: `${Math.max(1, Math.min(100, usagePercentage))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-900/50 mt-1">
                            <span>Terpakai: {totalSessionTokens.toLocaleString()}</span>
                            <span>Maks: {CONTEXT_LIMIT.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Prompt vs Response Breakdown */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="rounded-none bg-gray-50 p-2.5 border border-gray-100 rounded-xl text-center">
                            <span className="text-[10px] font-semibold text-gray-900/50 uppercase block">Prompt (Input)</span>
                            <span className="text-sm font-bold text-gray-900">{totalPromptTokens.toLocaleString()}</span>
                          </div>
                          <div className="rounded-none bg-gray-50 p-2.5 border border-gray-100 rounded-xl text-center">
                            <span className="text-[10px] font-semibold text-gray-900/50 uppercase block">Response (Output)</span>
                            <span className="text-sm font-bold text-gray-900">{totalCompletionTokens.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Turn-by-Turn Breakdown */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900/50 mb-2">Rincian Per Pesan (Turn)</p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {chatMessages
                              .filter((m) => m.role === "assistant")
                              .map((m, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#0011ff]/5 rounded-none p-2 text-[11px] border border-white/20">
                                  <span className="font-medium text-gray-500">Respons #{idx + 1}</span>
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
                                    <span className="text-gray-900/40 italic">N/A</span>
                                  )}
                                </div>
                              ))}
                            {chatMessages.filter((m) => m.role === "assistant").length === 0 && (
                              <p className="text-gray-900/40 text-center py-2 italic text-[11px]">Belum ada balasan AI</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="h-4 w-px bg-gray-200 mx-0.5" />

                  {/* Model Switcher Pill */}
                  {!isLoadingConfigs && configs.length === 0 ? (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
                      className="flex items-center gap-1.5 rounded-none px-2 py-1 text-[13px] font-medium text-gray-900/60 transition-colors hover:bg-[#0011ff]/10 hover:text-gray-900"
                    >
                      <span className="truncate max-w-[100px] sm:max-w-[150px]">Belum ada model</span>
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <Popover {...({ placement: "top-end", offset: 8 } as any)}>
                      <PopoverTrigger>
                        <div className="flex items-center gap-1 rounded-none px-2 py-1 text-[13px] transition-colors hover:bg-[#0011ff]/10 cursor-pointer text-gray-900/60 hover:text-gray-900">
                          <span className="truncate max-w-[100px] sm:max-w-[150px] font-medium">
                            {activeConfig?.name || "Pilih Model"}
                          </span>
                          <span className="font-normal opacity-80">
                            Sedang
                          </span>
                          <ChevronDown className="h-3 w-3 ml-0.5" />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="p-1 min-w-[200px] shadow-xl border border-gray-200 rounded-none bg-white mb-2">
                        <div className="flex flex-col w-full">
                          {configs.map((config) => (
                            <button
                              key={config.id}
                              onClick={() => handleSetActive(config.id)}
                              className={`flex items-center justify-between px-3 py-2 text-left rounded-none transition-colors ${config.id === activeConfig?.id
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-[#0011ff]/10 text-gray-900/60"
                                }`}
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-medium text-[13px]">{config.name}</span>
                                <span className="text-[10px] text-gray-900/60 font-normal">{config.model_name}</span>
                                {/* Lencana kemampuan supaya jelas model mana yang bisa baca gambar / pakai tool */}
                                {(config.capabilities ?? []).length > 1 && (
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {(config.capabilities ?? [])
                                      .filter((c) => c !== "text")
                                      .map((c) => (
                                        <span
                                          key={c}
                                          className="bg-gray-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-gray-500"
                                        >
                                          {CAPABILITY_LABEL[c] ?? c}
                                        </span>
                                      ))}
                                  </span>
                                )}
                              </div>
                              {config.id === activeConfig?.id && <Check className="h-4 w-4 text-primary" />}
                            </button>
                          ))}

                          <div className="h-px bg-[#0011ff]/10 my-1 mx-1" />

                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
                            className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium hover:bg-[#0011ff]/10 rounded-none text-primary w-full text-left transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Tambah Model Baru</span>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Send / Cancel Button */}
                  {isSubmitting ? (
                    <button
                      id="chat-stop-btn"
                      type="button"
                      onClick={handleStopGeneration}
                      className="flex h-8 w-8 ml-1 items-center justify-center rounded-full bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95 shadow-sm"
                      title="Batalkan (Stop)"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      id="chat-submit-btn"
                      type="submit"
                      disabled={textareaRef.current ? !textareaRef.current.value.trim() : true}
                      className="flex h-8 w-8 ml-1 items-center justify-center rounded-none bg-[#0011ff] text-white transition-all hover:opacity-90 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </Panel>

        {activeDiagramXml && (
          <>
            <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-emerald-400 transition-colors cursor-col-resize flex flex-col items-center justify-center shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
              <div className="h-10 w-0.5 rounded-full bg-gray-400" />
            </PanelResizeHandle>
            <Panel id="drawio-panel" defaultSize={50} className="flex flex-col bg-white h-full relative border-l border-gray-300">
              {drawioViewerContent}
            </Panel>
          </>
        )}

        {/* Kanvas Laporan — terbuka otomatis saat AI menulis laporan */}
        {showReportCanvas && reportDraft && (
          <>
            <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-[#0011ff] transition-colors cursor-col-resize flex flex-col items-center justify-center shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
              <div className="h-10 w-0.5 rounded-full bg-gray-400" />
            </PanelResizeHandle>
            <Panel id="report-panel" defaultSize={50} className="flex flex-col bg-white h-full relative border-l border-gray-300 min-h-0">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ScrollText className="h-4 w-4 shrink-0 text-[#0011ff]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-gray-900" title={reportDraft.title}>
                      {reportDraft.title}
                    </p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
                      Kanvas Laporan
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={copyReport}
                    title="Salin isi laporan"
                    className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={openReportEditor}
                    disabled={isOpeningReport}
                    className="flex items-center gap-1.5 bg-[#0011ff] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isOpeningReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
                    Editor Laporan
                  </button>
                  <button
                    onClick={() => setIsReportOpen(false)}
                    title="Tutup kanvas"
                    className="flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
                <article
                  className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-[#0011ff]"
                  dangerouslySetInnerHTML={{ __html: reportDraft.html }}
                />
                {webRefs.length > 0 && (
                  <div className="mt-8 border-t border-gray-200 pt-5">
                    <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
                      Daftar Pustaka ({citationStyle.toUpperCase()})
                    </p>
                    <ol className="space-y-1.5 text-[11px] leading-relaxed text-gray-600">
                      {webRefs.map((r, i) => (
                        <li key={i}>{formatCitation(r, i + 1, citationStyle)}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Pratinjau sumber rujukan di dalam aplikasi */}
      <ReferenceViewer source={previewSource} onClose={() => setPreviewSource(null)} />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-none bg-gray-950 text-gray-900 px-4 py-3 text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 border border-gray-800">
          <Sparkles className="h-4 w-4 text-emerald-400 fill-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedImage}
            alt="Zoomed preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
