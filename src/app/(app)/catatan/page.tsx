"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { notebooksApi, chatApi, settingsApi } from "@/lib/api";
import { marked } from "marked";
import type { Notebook, ModelConfig } from "@/lib/types";
import { Plus, Trash2, Edit3, Save, CheckCircle2, FileText, Search, ArrowLeft, BookOpen, Clock, File, WandSparkles, Loader2, X, Sparkles, MessageCircle, Send, ChevronDown, ChevronRight, Check, Download, Eye, BookMarked, PenLine, ExternalLink } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { getHTMLFromFragment } from "@tiptap/core";
import { ReferenceViewer, hostOf, isPdfUrl, type ViewerSource } from "@/components/reference-viewer";
import { useToast } from "@/components/toast-provider";

/** Satu sumber rujukan yang dikumpulkan agen (hasil pencarian web / dokumen). */
type SourceRef = ViewerSource;

type CanvasBlock = { kind: "update_editor" | "append_editor"; body: string; closed: boolean };

/** Satu langkah kerja agen yang ditampilkan sebagai jejak proses di panel chat. */
type AgentStep = {
  name: string;
  status: "running" | "done";
  /** Ringkasan argumen, mis. kata kunci pencarian atau URL yang dibuka. */
  detail?: string;
  /** Berapa sumber yang dihasilkan langkah ini. */
  found?: number;
};

/** Berapa kali agen boleh diminta menyambung laporan yang terpotong batas token. */
const MAX_CONTINUATIONS = 4;

/** Ambil argumen paling informatif dari sebuah tool call untuk ditampilkan ke user. */
function stepDetail(rawArgs: string): string {
  try {
    const args = JSON.parse(rawArgs);
    const value = args.query ?? args.url ?? args.keyword ?? args.document_id_or_filename;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/** Blok instruksi kanvas yang boleh ditulis AI di dalam jawabannya. */
const CANVAS_FENCE = /```(update_editor|append_editor)\r?\n/g;

/**
 * Ambil SEMUA blok kanvas dari teks AI — termasuk blok terakhir yang belum
 * ditutup (masih streaming) supaya tulisan mengalir langsung ke dokumen.
 * Laporan panjang biasanya dikirim sebagai beberapa blok berurutan; kalau hanya
 * blok pertama yang dibaca, dokumen berhenti di satu bagian saja.
 */
function extractCanvasBlocks(text: string): CanvasBlock[] {
  const blocks: CanvasBlock[] = [];
  const re = new RegExp(CANVAS_FENCE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const rest = text.slice(match.index + match[0].length);
    const closeIdx = rest.search(/\r?\n```/);
    blocks.push({
      kind: match[1] as CanvasBlock["kind"],
      body: closeIdx === -1 ? rest : rest.slice(0, closeIdx),
      closed: closeIdx !== -1,
    });
    if (closeIdx === -1) break;
    re.lastIndex = match.index + match[0].length + closeIdx;
  }
  return blocks;
}

/** Sembunyikan isi blok kanvas dari gelembung chat agar tidak tampil sebagai markdown mentah. */
function chatDisplayText(raw: string): string {
  return raw
    .replace(/```(?:update_editor|append_editor)\n[\s\S]*?\n```/g, "\n\n_Teks ditulis langsung ke kanvas laporan._\n\n")
    .replace(/```(?:update_editor|append_editor)\n[\s\S]*$/, "\n\n_Sedang menulis ke kanvas laporan..._")
    .trim();
}

/** Nama tool agentic dalam bahasa manusia, untuk chip status di panel chat. */
function toolLabel(name: string, running: boolean): string {
  const labels: Record<string, [string, string]> = {
    search_web: ["Mencari di Internet...", "Selesai mencari di Internet"],
    fetch_webpage: ["Membuka halaman sumber...", "Selesai membaca halaman sumber"],
    list_documents: ["Melihat daftar dokumen...", "Selesai melihat daftar dokumen"],
    read_document: ["Membaca Dokumen...", "Selesai membaca dokumen"],
    search_in_document: ["Mencari di Dokumen...", "Selesai mencari di dokumen"],
  };
  const pair = labels[name];
  if (!pair) return `Tool: ${name}`;
  return running ? pair[0] : pair[1];
}

/** Buang tag HTML dari konten Tiptap agar bisa dipakai untuk preview & hitung kata. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CatatanPage() {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{
    role: "user" | "ai";
    content: string;
    tools?: AgentStep[];
  }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Drag State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  // Model State
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Rich Text Editor selection state
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [tiptapEditor, setTiptapEditor] = useState<any>(null);
  
  // Syncing state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Word-like editor state
  const [isPreview, setIsPreview] = useState(false);
  const [docStats, setDocStats] = useState({ words: 0, chars: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // Referensi yang dikumpulkan agen dari tool search_web / dokumen
  const [references, setReferences] = useState<SourceRef[]>([]);
  const [expandedRef, setExpandedRef] = useState<number | null>(null);
  // Sumber yang sedang dibuka di panel pratinjau (PDF/halaman web) di dalam aplikasi
  const [previewSource, setPreviewSource] = useState<ViewerSource | null>(null);
  const [isWritingToCanvas, setIsWritingToCanvas] = useState(false);
  // Konteks penulisan langsung ke kanvas selama streaming berlangsung
  const canvasRef = useRef<{
    baseHtml: string;
    prefixHtml: string;
    suffixHtml: string;
    hadSelection: boolean;
    forceAppend: boolean;
    lastTick: number;
  }>({
    baseHtml: "", prefixHtml: "", suffixHtml: "", hadSelection: false, forceAppend: false, lastTick: 0,
  });

  useEffect(() => {
    if (!token) return;
    loadNotebooks();
    loadModels();
  }, [token]);

  async function loadModels() {
    if (!token) return;
    try {
      const data = await settingsApi.getAll(token);
      setModels(data);
      const active = data.find(c => c.is_active);
      if (active) setSelectedModelId(active.id);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadNotebooks() {
    if (!token) return;
    try {
      const data = await notebooksApi.getAll(token);
      setNotebooks(data);
      // Dukungan deep-link `/catatan?nb=<id>` — dipakai tombol "Buka Editor Laporan"
      // di chat beranda supaya laporan yang baru dibuat langsung terbuka di editor.
      if (typeof window !== "undefined") {
        const wanted = new URLSearchParams(window.location.search).get("nb");
        if (wanted) {
          const target = data.find((n) => n.id === wanted);
          if (target) selectNotebook(target);
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function createNotebook() {
    if (!token) return;
    try {
      const newNb = await notebooksApi.create(token, { title: "Catatan Tanpa Judul" });
      setNotebooks((prev) => [newNb, ...prev]);
      selectNotebook(newNb);
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteNotebook(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!token || !confirm("Hapus catatan ini?")) return;
    try {
      await notebooksApi.delete(token, id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (activeNotebook?.id === id) {
        setActiveNotebook(null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function selectNotebook(nb: Notebook) {
    setActiveNotebook(nb);
    setTitle(nb.title);
    setContent(nb.content);
    setSaveStatus("idle");
    setLastSaved(new Date(nb.updated_at));
    // Referensi & percakapan asisten terikat pada satu catatan
    setReferences([]);
    setChatMessages([]);
    setIsPreview(false);
  }

  function backToList() {
    setActiveNotebook(null);
  }

  /**
   * Gambar ulang kanvas dari seluruh blok yang sudah dikirim AI.
   *
   * Rendering-nya idempoten: dokumen selalu disusun ulang dari potret awal
   * (prefix/suffix) + semua blok, sehingga aman dipanggil berkali-kali selama
   * streaming dan blok kedua, ketiga, dst. ikut tertulis — bukan cuma yang pertama.
   */
  async function renderCanvas(blocks: CanvasBlock[]) {
    if (!tiptapEditor || blocks.length === 0) return;
    const { baseHtml, prefixHtml, suffixHtml, hadSelection, forceAppend } = canvasRef.current;

    let generated = "";
    for (const block of blocks) {
      if (!block.body.trim()) continue;
      const html = await marked.parse(block.body);
      // `append_editor` menyambung; `update_editor` menimpa hasil blok sebelumnya.
      generated = block.kind === "append_editor" || generated === "" ? generated + html : html;
    }
    if (!generated) return;

    let doc: string;
    if (hadSelection) {
      doc = `${prefixHtml}${generated}${suffixHtml}`;
    } else if (forceAppend || blocks[0].kind === "append_editor") {
      doc = `${baseHtml}${generated}`;
    } else {
      doc = generated;
    }

    tiptapEditor.commands.setContent(doc);
    setContent(tiptapEditor.getHTML());
  }

  async function handleSendMessage() {
    if (!token || !chatInput.trim() || isSending) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsSending(true);

    const fullDocText = tiptapEditor ? tiptapEditor.getText() : stripHtml(content);
    const targetText = hasSelection && selectedText.trim() ? selectedText : fullDocText;
    const useSelection = hasSelection && !!selectedText.trim();

    // Potret dokumen sebelum agen menulis: dipakai untuk mode append dan
    // untuk menyisipkan hasil tepat di posisi teks yang diblok user.
    let prefixHtml = "";
    let suffixHtml = "";
    if (useSelection && tiptapEditor) {
      const { from, to } = tiptapEditor.state.selection;
      prefixHtml = getHTMLFromFragment(tiptapEditor.state.doc.slice(0, from).content, tiptapEditor.schema);
      suffixHtml = getHTMLFromFragment(tiptapEditor.state.doc.slice(to).content, tiptapEditor.schema);
    }
    canvasRef.current = {
      baseHtml: tiptapEditor ? tiptapEditor.getHTML() : content,
      prefixHtml,
      suffixHtml,
      hadSelection: useSelection,
      forceAppend: false,
      lastTick: 0,
    };

    const systemInstruction = [
      "\n\n(INFO SISTEM UNTUK AI — BACA SEBELUM MENJAWAB)",
      "Kamu adalah agen penulis laporan yang bekerja pada sebuah KANVAS dokumen milik user.",
      "",
      "CARA MENULIS KE KANVAS (wajib):",
      "- Untuk MENULIS ULANG seluruh isi dokumen, bungkus teksnya dalam blok:",
      "```update_editor",
      "[isi laporan dalam markdown]",
      "```",
      "- Untuk MENAMBAH bagian baru di akhir dokumen tanpa menghapus yang sudah ada, gunakan:",
      "```append_editor",
      "[bagian baru dalam markdown]",
      "```",
      "- Isi blok tersebut langsung mengalir ke kanvas saat kamu mengetik, jadi tulis laporannya",
      "  di dalam blok, JANGAN menyalinnya lagi di luar blok.",
      "- Gunakan markdown lengkap: # judul, ## subjudul, **tebal**, daftar, dan tabel.",
      "- Boleh mengirim beberapa blok berurutan; blok `append_editor` berikutnya",
      "  akan menyambung tulisan sebelumnya, bukan menimpanya.",
      "",
      "PANJANG LAPORAN:",
      "- Tulis laporan yang UTUH dan mendalam, bukan ringkasan satu halaman.",
      "- Kecuali user minta ringkas, targetkan minimal 5 bagian bernomor",
      "  (mis. Pendahuluan, Landasan Teori, Pembahasan, Analisis, Kesimpulan)",
      "  dengan 3-6 paragraf berisi per bagian.",
      "- Jangan berhenti di tengah bagian dan jangan menutup dengan kalimat seperti",
      "  'akan dilanjutkan'. Kalau ruang habis, teruskan menulis saat diminta lanjut.",
      "",
      "REFERENSI:",
      "- Kalau butuh data faktual atau user meminta rujukan, panggil tool `search_web` lebih dulu.",
      "- Sitasi di dalam teks memakai nomor kurung siku sesuai urutan sumber: [1], [2], ...",
      "- Akhiri laporan dengan bagian '## Daftar Pustaka' berisi daftar bernomor",
      "  'Judul — URL' untuk tiap sumber yang kamu pakai.",
      "- Jangan mengarang URL. Hanya kutip sumber yang benar-benar dikembalikan tool.",
      "",
      "LAINNYA:",
      "- Jangan panggil `list_documents`/`read_document` kecuali user memang meminta materi yang diunggah.",
      hasSelection && selectedText.trim()
        ? "- User sedang MEMBLOK sebagian teks. Blok `update_editor` akan mengganti BAGIAN YANG DIBLOK saja."
        : "- Tidak ada teks yang diblok, jadi `update_editor` mengganti seluruh dokumen.",
      "",
      targetText.trim() ? `--- ISI KANVAS SAAT INI ---\n${targetText}\n---------------------------)` : "--- KANVAS SAAT INI KOSONG ---)",
    ].join("\n");

    try {
      let turn = await streamAgentTurn(`${userMessage}${systemInstruction}`);

      // Laporan panjang sering terpotong batas token. Selama backend melapor
      // jawaban terputus, minta agen menyambung sendiri (maks. 4 sambungan)
      // sehingga hasilnya bisa jauh lebih dari satu halaman.
      let continuations = 0;
      while (turn.truncated && continuations < MAX_CONTINUATIONS) {
        continuations += 1;
        turn = await continueOnce(continuations);
      }
    } finally {
      setIsWritingToCanvas(false);
      setIsSending(false);
    }
  }

  /** Minta agen menyambung laporan dari bagian terakhir yang ada di kanvas. */
  async function continueOnce(nth: number) {
    const written = tiptapEditor ? tiptapEditor.getText() : stripHtml(content);
    const tail = written.slice(-1200);
    canvasRef.current = {
      ...canvasRef.current,
      baseHtml: tiptapEditor ? tiptapEditor.getHTML() : content,
      hadSelection: false,
      forceAppend: true,
      lastTick: 0,
    };
    return streamAgentTurn(
      [
        `Lanjutkan laporan tadi (sambungan ke-${nth}) sampai tuntas.`,
        "",
        "ATURAN LANJUTAN:",
        "- Bungkus lanjutannya HANYA dalam blok ```append_editor ... ```.",
        "- Jangan mengulang bagian yang sudah ditulis dan jangan menulis ulang judul laporan.",
        "- Sambung mulus dari kalimat terakhir di bawah ini, lalu selesaikan bagian berikutnya.",
        "- Tutup dengan '## Daftar Pustaka' hanya kalau laporannya sudah benar-benar selesai.",
        "",
        "--- BAGIAN AKHIR YANG SUDAH DITULIS ---",
        tail,
        "---------------------------------------",
      ].join("\n"),
      { label: `Melanjutkan laporan (bagian ${nth + 1})...` }
    );
  }

  /** Tombol manual: perpanjang laporan walau giliran sebelumnya sudah selesai. */
  async function handleContinueWriting() {
    if (!token || isSending) return;
    setChatMessages(prev => [...prev, { role: "user", content: "Lanjutkan menulis laporannya." }]);
    setIsSending(true);
    try {
      let turn = await continueOnce(1);
      let extra = 1;
      while (turn.truncated && extra < MAX_CONTINUATIONS) {
        extra += 1;
        turn = await continueOnce(extra);
      }
    } finally {
      setIsWritingToCanvas(false);
      setIsSending(false);
    }
  }

  /**
   * Jalankan satu giliran agen: kirim prompt, stream jawabannya ke chat, dan
   * alirkan blok kanvas ke dokumen. Mengembalikan status terpotong agar
   * pemanggil bisa meminta sambungan.
   */
  async function streamAgentTurn(
    prompt: string,
    opts: { label?: string } = {}
  ): Promise<{ truncated: boolean; text: string }> {
    if (!token) return { truncated: false, text: "" };

    setChatMessages(prev => [...prev, { role: "ai", content: opts.label ?? "", tools: [] }]);

    let aiResponseText = "";
    let truncated = false;
    const currentTools: AgentStep[] = [];

    try {
      const reader = await chatApi.sendStream(token, prompt, null, []);
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Sebuah chunk jaringan bisa memotong baris JSON di tengah; simpan
        // sisanya sampai baris berikutnya lengkap.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let data: any;
          try {
            data = JSON.parse(line);
          } catch (e) {
            console.error("Failed to parse chunk:", line, e);
            continue;
          }

          if (data.event === "text") {
            aiResponseText += data.data;
            const shown = chatDisplayText(aiResponseText);
            setChatMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1].content = shown;
              return newArr;
            });

            // Alirkan isi blok kanvas ke dokumen selagi AI mengetik (maks. ~8x/detik)
            const blocks = extractCanvasBlocks(aiResponseText);
            if (blocks.some(b => b.body.trim())) {
              setIsWritingToCanvas(true);
              const now = Date.now();
              if (now - canvasRef.current.lastTick > 120) {
                canvasRef.current.lastTick = now;
                await renderCanvas(blocks);
              }
            }
          } else if (data.event === "tool_call") {
            currentTools.push({ name: data.name, status: "running", detail: stepDetail(data.args ?? "") });
            setChatMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1].tools = [...currentTools];
              return newArr;
            });
          } else if (data.event === "tool_result") {
            const toolIdx = currentTools.findIndex(t => t.name === data.name && t.status === "running");
            if (toolIdx !== -1) {
              currentTools[toolIdx].status = "done";
              currentTools[toolIdx].found = Array.isArray(data.sources) ? data.sources.length : 0;
              setChatMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].tools = [...currentTools];
                return newArr;
              });
            }
            // Kumpulkan sumber untuk daftar pustaka, tanpa duplikat
            if (Array.isArray(data.sources) && data.sources.length > 0) {
              setReferences(prev => {
                const merged = [...prev];
                for (const src of data.sources as SourceRef[]) {
                  const key = (src.url || src.title).toLowerCase();
                  if (!merged.some(r => (r.url || r.title).toLowerCase() === key)) merged.push(src);
                }
                return merged;
              });
            }
          } else if (data.event === "truncated") {
            truncated = true;
          } else if (data.event === "error") {
            console.error("AI Error:", data.data);
          }
        }
      }

      // Tulis sekali lagi di akhir agar potongan terakhir tidak tertinggal
      const finalBlocks = extractCanvasBlocks(aiResponseText);
      if (finalBlocks.some(b => b.body.trim())) {
        await renderCanvas(finalBlocks);
      }
      setChatMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          chatDisplayText(aiResponseText) || "Selesai menulis ke kanvas.";
        return newArr;
      });
    } catch (err) {
      setChatMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content = "Terjadi kesalahan saat memproses permintaan.";
        return newArr;
      });
      return { truncated: false, text: aiResponseText };
    }

    return { truncated, text: aiResponseText };
  }

  /** Sisipkan bagian "Daftar Pustaka" dari sumber yang dikumpulkan agen. */
  function insertBibliography() {
    if (!tiptapEditor || references.length === 0) return;
    const items = references
      .map(r => (r.url
        ? `<li><a href="${r.url}">${r.title || r.url}</a> — <span>${r.url}</span></li>`
        : `<li>${r.title}</li>`))
      .join("");
    tiptapEditor
      .chain()
      .focus("end")
      .insertContent(`<h2>Daftar Pustaka</h2><ol>${items}</ol>`)
      .run();
    setContent(tiptapEditor.getHTML());
  }

  /** Sisipkan satu sumber sebagai sitasi bernomor di posisi kursor. */
  function insertCitation(ref: SourceRef, index: number) {
    if (!tiptapEditor) return;
    const label = `[${index + 1}]`;
    const html = ref.url
      ? `<a href="${ref.url}" title="${ref.title.replace(/"/g, "&quot;")}">${label}</a>`
      : `<sup>${label}</sup>`;
    tiptapEditor.chain().focus().insertContent(html).run();
    setContent(tiptapEditor.getHTML());
  }

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Ignore if clicking a button (like close or dropdown)
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  async function handleChangeModel(id: string) {
    if (!token) return;
    setSelectedModelId(id);
    setIsModelDropdownOpen(false);
    try {
      await settingsApi.setActive(token, id);
    } catch (err) {
      console.error(err);
    }
  }

  // Auto-save logic (debounced)
  useEffect(() => {
    if (!activeNotebook || !token) return;
    if (title === activeNotebook.title && content === activeNotebook.content) return;

    setSaveStatus("saving");
    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        const updated = await notebooksApi.update(token, activeNotebook.id, { title, content });
        setActiveNotebook(updated);
        setNotebooks((prev) => prev.map((n) => n.id === updated.id ? updated : n));
        setSaveStatus("saved");
        setLastSaved(new Date());
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Auto-save failed", err);
        setSaveStatus("idle");
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [title, content, activeNotebook, token]);

  async function handleExportDocx() {
    if (!token || !activeNotebook) return;
    setIsExporting(true);
    try {
      await notebooksApi.exportDocx(token, title || "Catatan", content, "html");
      toastSuccess("Dokumen Word berhasil diunduh.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal mengekspor dokumen.");
    } finally {
      setIsExporting(false);
    }
  }

  const filteredNotebooks = notebooks.filter(nb => nb.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // Total kata di seluruh catatan (konten disimpan sebagai HTML dari Tiptap)
  const totalWords = notebooks.reduce((sum, nb) => {
    const plain = stripHtml(nb.content);
    return sum + (plain ? plain.split(/\s+/).length : 0);
  }, 0);

  if (activeNotebook) {
    // EDITOR VIEW
    return (
      <div className="flex h-full flex-col bg-transparent">
        <div className="h-16 border-b border-white/20 flex items-center justify-between px-8 shrink-0 bg-transparent">
          <div className="flex items-center gap-4 w-full">
            <button onClick={backToList} className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Catatan..."
              className="text-xl font-bold font-serif text-white bg-transparent outline-none flex-1 placeholder:text-white/30 transition-colors"
            />
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="text-xs font-medium text-white/50">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5"><Save className="h-3.5 w-3.5 animate-pulse" /> Menyimpan...</span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan</span>
              )}
              {saveStatus === "idle" && lastSaved && (
                <span>Tersimpan otomatis</span>
              )}
            </div>

            <button
              onClick={() => setIsPreview(p => !p)}
              title={isPreview ? "Kembali mengedit" : "Pratinjau (hanya baca)"}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isPreview
                  ? "bg-white/20 border-white/40 text-white"
                  : "bg-transparent border-white/25 text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {isPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isPreview ? "Edit" : "Pratinjau"}
            </button>

            <button
              onClick={handleExportDocx}
              disabled={isExporting}
              title="Unduh sebagai berkas Word (.docx)"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-white/25 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Word
            </button>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> Asisten Laporan
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative px-8 pt-4 w-full">
          {isChatOpen && (
            <div 
              className="fixed bottom-10 right-10 w-[400px] h-[550px] flex flex-col bg-[#0011ff] border border-white/30 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? "none" : "transform 0.1s ease-out" }}
            >
              {/* Header */}
              <div 
                className="bg-black/25 border-b border-white/20 text-white px-5 py-4 flex items-center justify-between shrink-0 relative z-10 cursor-move"
                onMouseDown={handleMouseDown}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <WandSparkles className="h-4 w-4 text-emerald-400" /> Asisten Editor Laporan
                  </div>
                  {/* Model Selector */}
                  <div className="relative mt-1">
                    <button 
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                      className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors"
                    >
                      {models.find(m => m.id === selectedModelId)?.name || "Pilih Model"}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {isModelDropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-[#0011ff] border border-white/30 rounded-xl shadow-xl z-50 text-white py-1 overflow-hidden">
                        {models.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleChangeModel(m.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-left hover:bg-white/10 transition-colors"
                          >
                            <span className="truncate font-medium">{m.name}</span>
                            {m.id === selectedModelId && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 bg-black/10 space-y-5">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-white font-bold mb-1">Hai! Saya Asisten Laporanmu.</p>
                    <p className="text-xs text-white/60 leading-relaxed mb-4">
                      Saya menulis <span className="text-white/85 font-semibold">langsung ke kanvas</span> di
                      sebelah kiri, bukan cuma membalas di sini. Blok sebagian teks kalau
                      hanya bagian itu yang ingin diubah.
                    </p>
                    <div className="w-full space-y-1.5">
                      {[
                        "Buatkan draf laporan tentang fotosintesis lengkap dengan referensi",
                        "Rapikan bagian yang saya blok jadi lebih formal",
                        "Tambahkan bab kesimpulan di akhir laporan",
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => setChatInput(s)}
                          className="w-full text-left text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 rounded-lg px-3 py-2 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-[13px] leading-relaxed ${msg.role === "user" ? "bg-white/20 text-white rounded-br-sm" : "bg-black/20 border border-white/20 text-white/90 rounded-bl-sm"}`}>
                        
                        {/* Jejak kerja agen — transparan, langkah demi langkah */}
                        {msg.tools && msg.tools.length > 0 && (
                          <ol className="mb-3 space-y-0 border-l border-white/20 pl-3 ml-1">
                            {msg.tools.map((t, i) => (
                              <li key={i} className="relative py-1">
                                <span className="absolute -left-[19px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0011ff]">
                                  {t.status === "running" ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-crail" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  )}
                                </span>
                                <p className="text-[11px] font-semibold text-white/80">
                                  {toolLabel(t.name, t.status === "running")}
                                </p>
                                {t.detail && (
                                  <p className="text-[10px] text-white/45 truncate max-w-[240px]" title={t.detail}>
                                    {t.detail}
                                  </p>
                                )}
                                {t.status === "done" && typeof t.found === "number" && t.found > 0 && (
                                  <p className="text-[10px] text-emerald-300/80">
                                    {t.found} sumber ditambahkan ke referensi
                                  </p>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}

                        {msg.content || (msg.role === "ai" && isSending && msg.tools?.length === 0 ? <span className="animate-pulse">Berpikir...</span> : "")}
                      </div>
                    </div>
                  ))
                )}
                {isSending && (
                  <div className="flex items-start">
                    <div className="px-4 py-3 rounded-2xl bg-black/20 border border-white/20 rounded-bl-sm flex items-center gap-1.5 text-white/50">
                      <span className="animate-bounce">●</span><span className="animate-bounce delay-75">●</span><span className="animate-bounce delay-150">●</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Referensi hasil pencarian agen */}
              {references.length > 0 && (
                <div className="shrink-0 border-t border-white/20 bg-black/20 max-h-44 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-black/40 backdrop-blur-sm">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
                      <BookMarked className="h-3.5 w-3.5" /> Referensi ({references.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={insertBibliography}
                        className="text-[10px] font-bold px-2 py-1 rounded border border-white/25 text-white/80 hover:bg-white/15 transition-colors"
                      >
                        Sisipkan Daftar Pustaka
                      </button>
                      <button
                        onClick={() => setReferences([])}
                        title="Kosongkan daftar referensi"
                        className="text-[10px] font-bold px-2 py-1 rounded border border-white/25 text-white/50 hover:text-white hover:bg-white/15 transition-colors"
                      >
                        Bersihkan
                      </button>
                    </div>
                  </div>
                  <ol className="px-4 pb-3 space-y-1.5">
                    {references.map((ref, i) => (
                      <li key={`${ref.url || ref.title}-${i}`} className="flex items-start gap-2 text-[11px] leading-snug">
                        <button
                          onClick={() => insertCitation(ref, i)}
                          title="Sisipkan sitasi di posisi kursor"
                          className="shrink-0 mt-px px-1.5 py-0.5 rounded bg-white/15 text-white/80 font-bold hover:bg-crail hover:text-white transition-colors"
                        >
                          [{i + 1}]
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => setExpandedRef(expandedRef === i ? null : i)}
                            className="flex items-start gap-1 text-left w-full group"
                            title="Lihat detail sumber"
                          >
                            <ChevronRight
                              className={`h-3 w-3 mt-0.5 shrink-0 text-white/40 transition-transform ${expandedRef === i ? "rotate-90" : ""}`}
                            />
                            <span className={`text-white/85 font-medium group-hover:text-white ${expandedRef === i ? "" : "truncate"}`}>
                              {ref.title}
                            </span>
                          </button>
                          {ref.url && (
                            <div className="ml-4 flex items-center gap-1.5 min-w-0">
                              <button
                                onClick={() => setPreviewSource(ref)}
                                title="Buka pratinjau di dalam aplikasi"
                                className="min-w-0 flex-1 truncate text-left text-white/45 underline decoration-white/20 transition-colors hover:text-white/85"
                              >
                                {hostOf(ref.url) || ref.url}
                              </button>
                              {isPdfUrl(ref.url) && (
                                <span className="shrink-0 rounded bg-red-500/20 px-1 py-px text-[9px] font-bold uppercase text-red-300">
                                  PDF
                                </span>
                              )}
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Buka di tab baru"
                                className="shrink-0 text-white/35 transition-colors hover:text-white"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {expandedRef === i && ref.snippet && (
                            <p className="ml-4 mt-1 text-white/60 italic border-l border-white/20 pl-2 leading-relaxed">
                              {ref.snippet}
                            </p>
                          )}
                          {expandedRef === i && !ref.snippet && (
                            <p className="ml-4 mt-1 text-white/40 italic">Tidak ada cuplikan untuk sumber ini.</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Chat Input */}
              <div className="bg-black/25 border-t border-white/20 p-4 shrink-0 relative z-10">
                <div className="flex flex-col gap-2 relative">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasSelection && (
                      <div className="text-[10px] font-bold text-crail bg-crail/10 px-2 py-1 rounded w-fit uppercase tracking-wider">
                        Target: Teks Terpilih
                      </div>
                    )}
                    {docStats.words > 0 && !isSending && (
                      <button
                        onClick={handleContinueWriting}
                        title="Minta agen menyambung laporan dari bagian terakhir"
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-white/25 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                      >
                        <PenLine className="h-3 w-3" /> Lanjutkan Menulis
                      </button>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={hasSelection ? "Instruksi untuk teks yang dipilih..." : "Instruksi untuk seluruh laporan..."}
                      className="flex-1 max-h-32 min-h-[44px] resize-none outline-none text-[13px] py-3 px-1 text-white placeholder:text-white/40 bg-transparent"
                      rows={1}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isSending || !chatInput.trim()}
                      className="p-3 bg-crail text-white rounded-xl hover:bg-crail/90 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

            <RichTextEditor
              content={content}
              onChange={setContent}
              editable={!isPreview}
              onStats={setDocStats}
              onSelectionChange={(hasSel, text, ed) => {
                setHasSelection(hasSel);
                setSelectedText(text);
                setTiptapEditor(ed);
              }}
              placeholder="Mulai menulis draf laporan Anda di sini... Blok teks dan klik Asisten Laporan untuk menyempurnakan tulisan."
            />
        </div>

        {/* Status bar ala Word */}
        <div className="h-8 shrink-0 border-t border-white/20 px-8 flex items-center justify-between text-[11px] font-medium text-white/50">
          <span className="flex items-center gap-2">
            {isWritingToCanvas ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <PenLine className="h-3.5 w-3.5 animate-pulse" /> Asisten sedang menulis ke kanvas...
              </span>
            ) : (
              <span>{isPreview ? "Mode pratinjau — hanya baca" : "Mode edit"}</span>
            )}
          </span>
          <div className="flex items-center gap-4">
            {references.length > 0 && (
              <span className="flex items-center gap-1.5 text-white/60">
                <BookMarked className="h-3.5 w-3.5" /> {references.length} referensi
              </span>
            )}
            <span>{docStats.words.toLocaleString("id-ID")} kata</span>
            <span>{docStats.chars.toLocaleString("id-ID")} karakter</span>
            {hasSelection && <span className="text-crail">Teks terpilih aktif</span>}
          </div>
        </div>

        {/* Pratinjau sumber di dalam aplikasi (halaman web / PDF) */}
        <ReferenceViewer source={previewSource} onClose={() => setPreviewSource(null)} />
      </div>
    );
  }

  // DASHBOARD VIEW (Like DeepTutor's "Books" list)
  return (
    <div className="flex h-full flex-col bg-transparent p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-5 w-5 text-white/50" />
              <h1 className="text-2xl font-bold text-white font-sans">Catatan</h1>
            </div>
            <p className="text-sm text-white/60">
              Buat, jelajahi, dan pelajari catatan yang dihasilkan oleh Anda dan AI.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Cari catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-lg border border-white/25 bg-transparent text-sm text-white placeholder:text-white/40 outline-none w-64 focus:border-white/50"
              />
            </div>
            <button
              onClick={createNotebook}
              className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4" /> Buat Catatan
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-white/25 bg-transparent p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
              <BookOpen className="h-4 w-4" /> TOTAL CATATAN
            </div>
            <div className="text-3xl font-bold text-white">{notebooks.length}</div>
          </div>
          <div className="rounded-xl border border-white/25 bg-transparent p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">
              <CheckCircle2 className="h-4 w-4" /> SELESAI
            </div>
            <div className="text-3xl font-bold text-emerald-400">0</div>
          </div>
          <div className="rounded-xl border border-white/25 bg-transparent p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crail mb-4">
              <Clock className="h-4 w-4" /> DRAF
            </div>
            <div className="text-3xl font-bold text-crail">{notebooks.length}</div>
          </div>
          <div className="rounded-xl border border-white/25 bg-transparent p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300 mb-4">
              <FileText className="h-4 w-4" /> KATA
            </div>
            <div className="text-3xl font-bold text-sky-300">{totalWords.toLocaleString("id-ID")}</div>
          </div>
        </div>

        {/* List Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">
            PERPUSTAKAAN SAYA ({filteredNotebooks.length} dari {notebooks.length} catatan)
          </h3>

          {filteredNotebooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/25 py-24 text-center">
              <BookOpen className="h-10 w-10 text-white/30 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Belum ada catatan</h3>
              <p className="text-sm text-white/60 mb-6 max-w-sm">
                Buat catatan pertama Anda dari sumber materi, seleksi chat, atau mulai dari topik kosong.
              </p>
              <button
                onClick={createNotebook}
                className="flex items-center gap-2 bg-transparent border border-white/30 hover:bg-white/10 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                <Plus className="h-4 w-4 text-crail" /> Buat Catatan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotebooks.map(nb => (
                <div 
                  key={nb.id}
                  onClick={() => selectNotebook(nb)}
                  className="group relative flex flex-col justify-between rounded-xl border border-white/25 bg-transparent p-5 cursor-pointer transition-all hover:border-white/50 hover:bg-white/5"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/60 group-hover:text-crail transition-colors">
                        <File className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => deleteNotebook(nb.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-white mb-1">{nb.title || "Tanpa Judul"}</h4>
                    <p className="text-xs text-white/60 line-clamp-2">
                      {stripHtml(nb.content) || "Belum ada konten..."}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-white/50">
                    <span>Diperbarui {new Date(nb.updated_at).toLocaleDateString("id-ID")}</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/70">Draf</span>
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
