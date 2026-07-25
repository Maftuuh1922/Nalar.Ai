"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import {
  Check,
  Copy,
  RotateCcw,
  Highlighter,
  Pencil,
  Clock,
  Timer,
  History,
  Zap,
  FileText,
  Bot,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Paperclip,
  Download,
  Sparkles,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { useAuth } from "@/components/auth-provider";

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

export interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  thinkingProcess?: string;
  sources?: Source[];
  agentName?: string;
  usage?: TokenUsage;
  timestamp?: string;
  responseTimeMs?: number;
  attachedDocs?: { id: string; filename: string }[];
  attachedImages?: string[];
  suggestions?: string[];
}

interface ChatMessageProps {
  msg: DisplayMessage;
  index: number;
  textAlign: "left" | "justify";
  onRegenerate: () => void;
  onSaveEditPrompt: (index: number, text: string) => void;
  isSubmitting: boolean;
}

/**
 * Single chat message component — isolated with React.memo so it does NOT re-render
 * when other messages change, preventing scroll/hover lag.
 */
export const ChatMessage = React.memo(function ChatMessage({
  msg,
  index,
  textAlign,
  onRegenerate,
  onSaveEditPrompt,
  isSubmitting,
}: ChatMessageProps) {
  // All interactive state lives INSIDE this component so only THIS message re-renders
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const { token } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedSource && selectedSource.filename.toLowerCase().endsWith('.pdf') && token) {
      setPdfLoading(true);
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      fetch(`${API_BASE_URL}/api/v1/documents/view?filename=${encodeURIComponent(selectedSource.filename)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
         if (!res.ok) throw new Error("Failed");
         return res.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setPdfLoading(false);
      })
      .catch(() => {
        setPdfLoading(false);
      });
    } else {
      setPdfUrl(null);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedSource, token]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [msg.content]);

  const handleToggleHighlight = useCallback(() => {
    setHighlighted((v) => !v);
  }, []);

  const handleStartEdit = useCallback(() => {
    setEditText(msg.content);
    setEditing(true);
  }, [msg.content]);

  const handleSave = useCallback(() => {
    setEditing(false);
    onSaveEditPrompt(index, editText);
  }, [editText, index, onSaveEditPrompt]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setEditText(msg.content);
  }, [msg.content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([msg.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NalarAI_Response_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [msg.content]);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="w-full flex justify-end">
          {editing ? (
            <div className="flex flex-col gap-2.5 min-w-[300px] max-w-[82%]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-[1.5rem] bg-black/5 backdrop-blur-md text-gray-800 p-4 text-sm outline-none resize-none border border-gray-200/50 focus:border-gray-400/50 shadow-sm"
              />
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg px-3 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="rounded-xl px-3.5 py-1.5 bg-gray-800 text-white/90 font-bold hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  Simpan & Kirim Ulang
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1.5 max-w-[82%] group">
              {/* User Bubble */}
              <div className="bg-secondary text-secondary-foreground rounded-3xl px-5 py-3.5 text-[15px] leading-relaxed">
                {msg.attachedImages && msg.attachedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.attachedImages.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt={`Attached ${idx}`} 
                        className="max-h-48 rounded-xl object-contain border border-white/20 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity" 
                        onClick={() => setZoomedImage(img)}
                      />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Attached document links (No Cards) */}
              {msg.attachedDocs && msg.attachedDocs.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end px-2 mt-1">
                  {(showAllFiles ? msg.attachedDocs : msg.attachedDocs.slice(0, 2)).map((doc, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedSource({ filename: doc.filename, page: "", excerpt: "Dokumen ini dilampirkan oleh pengguna." })}
                      className="flex items-center gap-1.5 cursor-pointer text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="truncate text-[12px] font-medium max-w-[180px]">{doc.filename}</span>
                    </div>
                  ))}
                  {msg.attachedDocs.length > 2 && !showAllFiles && (
                    <div 
                      className="flex items-center gap-1 text-gray-400 cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => setShowAllFiles(true)}
                    >
                      <span className="text-[12px] font-medium hover:underline">+{msg.attachedDocs.length - 2} file lainnya</span>
                    </div>
                  )}
                  {msg.attachedDocs.length > 2 && showAllFiles && (
                    <div 
                      className="flex items-center gap-1 text-gray-400 cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => setShowAllFiles(false)}
                    >
                      <span className="text-[12px] font-medium hover:underline">Sembunyikan</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hover action bar */}
              <div className="flex items-center gap-2.5 text-gray-500 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-1">
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock className="h-3 w-3" />
                  {msg.timestamp ?? ""}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 p-1 rounded hover:text-gray-900 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-gray-600" />
                      <span className="text-gray-700 font-bold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 p-1 rounded hover:text-gray-900 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === ASSISTANT MESSAGE ===
  return (
    <div className="flex justify-start w-full">
      <div className="w-full text-gray-900 py-3 px-1 group">
        {/* Agent badge */}
        {msg.agentName && (
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{msg.agentName}</span>
          </div>
        )}

        {/* CoT Thinking block */}
        {msg.thinkingProcess && (
          <details className="mb-4 text-xs font-sans group/think">
            <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700 select-none text-xs flex items-center gap-1.5 py-1 mb-1">
              <span>Proses berpikir</span>
              <ChevronDown className="h-3 w-3 transition-transform group-open/think:rotate-180" />
            </summary>
            
            <div className="relative mt-2 pl-7 text-gray-600 text-[11.5px] font-sans leading-relaxed space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {/* Left timeline line */}
              <div className="absolute left-[18px] top-6 bottom-5 w-[1.5px] bg-gray-200"></div>
              
              {/* Top icon (History/Clock) */}
              <div className="absolute left-3 top-3 bg-transparent">
                <History className="h-4 w-4 text-gray-400" />
              </div>
              
              <MarkdownContent content={msg.thinkingProcess} textAlign={textAlign} />
              
              {/* Bottom icon (Done) */}
              <div className="absolute left-3 bottom-2.5 bg-transparent">
                <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-transparent">
                  <Check className="h-2.5 w-2.5 text-gray-400" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium pt-1">
                <span>Selesai</span>
              </div>
            </div>
          </details>
        )}

        {/* Sources / Attachment Pill at the top */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200/60 rounded-xl px-2.5 py-1.5 shadow-sm">
              <FileText className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-[11px] font-semibold text-gray-700 tracking-wide">
                {msg.sources[0].filename.toUpperCase().replace(/\.[^/.]+$/, "")}
                {msg.sources.length > 1 ? ` +${msg.sources.length - 1}` : ""}
              </span>
            </div>
          </div>
        )}

        {/* Main markdown answer */}
        <MarkdownContent content={msg.content} enableHighlight={highlighted} textAlign={textAlign} />

        {/* Prepared using... text */}
        <div className="mt-5 border-t border-gray-100 pt-3">
          <p className="text-[13px] font-medium text-gray-500">
            Disiapkan menggunakan Nalar AI
          </p>
        </div>

        {/* Footer action bar */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-none border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-xl transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-bold text-blue-600">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                  <span>Salin</span>
                </>
              )}
            </button>

            {/* Regenerate */}
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-none border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-xl transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
              <span>Ulangi</span>
            </button>

            {/* Export / Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-none border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-xl transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-gray-500" />
              <span>Ekspor</span>
            </button>

            {/* Stabilo */}
            <button
              type="button"
              onClick={handleToggleHighlight}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                highlighted
                  ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                  : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <Highlighter className={`h-3.5 w-3.5 ${highlighted ? "text-amber-600 fill-amber-400" : "text-gray-500"}`} />
              <span>{highlighted ? "Stabilo Aktif" : "Stabilo Kuning"}</span>
            </button>
          </div>
          
          {/* Sisi kanan baris aksi (untuk tombol yang lain jika ada) */}
          <div className="flex items-center">
            {/* Ruang kosong jika diperlukan untuk tombol tambahan di ujung kanan */}
          </div>
        </div>
        
        {/* Saran Pertanyaan (Suggestions) */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="mt-4 pt-4 flex flex-col gap-2 border-t border-gray-100 border-dashed">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Saran Lanjutan
            </span>
            <div className="flex flex-wrap gap-2">
              {msg.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const input = document.querySelector('textarea[name="chat-input"]') as HTMLTextAreaElement;
                    if (input) {
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                      nativeInputValueSetter?.call(input, suggestion);
                      input.dispatchEvent(new Event("input", { bubbles: true }));
                      input.focus();
                    }
                  }}
                  className="px-3.5 py-1.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-200 text-xs rounded-full transition-colors font-medium shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sumber Rujukan Dropdown Button (Pindah ke bawah jika diinginkan, atau biarkan di atas. Kita biarkan di posisinya) */}
            {msg.sources && msg.sources.length > 0 && (
              <Popover {...({ placement: "top-start", showArrow: true, offset: 8, backdrop: "transparent" } as any)}>
                <PopoverTrigger>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <div className="flex -space-x-1.5 mr-0.5">
                      <div className="w-[20px] h-[20px] rounded-full bg-blue-50 flex items-center justify-center border-2 border-white z-20"><FileText className="h-[9px] w-[9px] text-blue-600" /></div>
                      <div className="w-[20px] h-[20px] rounded-full bg-emerald-50 flex items-center justify-center border-2 border-white z-10"><FileText className="h-[9px] w-[9px] text-emerald-600" /></div>
                    </div>
                    <span className="font-bold">{msg.sources.length} sumber</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[340px] bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 w-full bg-gray-50/80 backdrop-blur-sm">
                    <span className="text-[13px] font-extrabold text-gray-800">Sumber-sumber</span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex flex-col w-full max-h-[380px] overflow-y-auto scrollbar-thin bg-[#FAF9F5]">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 hover:bg-white transition-colors cursor-pointer group">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        <span className="text-[13px] font-bold text-gray-600 group-hover:text-gray-900 transition-colors">File Dokumen</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{msg.sources.length}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" />
                      </div>
                    </div>
                    <div className="px-1.5 py-1.5 flex flex-col gap-1">
                      {msg.sources.map((src, j) => (
                        <div key={j} onClick={() => setSelectedSource(src)} className="px-3 py-2.5 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all cursor-pointer group flex items-start gap-3">
                          <div className="mt-0.5 bg-gray-100 p-1.5 rounded-lg shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <FileText className="h-3.5 w-3.5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors block leading-snug break-words">{src.filename}</span>
                            <p className="mt-1 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">"{src.excerpt}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

          {/* Time & token info */}
          <div className="flex items-center gap-2.5 text-[11px] font-medium text-gray-500">
            {msg.timestamp && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                {msg.timestamp}
              </span>
            )}
            {msg.responseTimeMs && (
              <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 font-bold text-[10px]">
                <Timer className="h-3 w-3 text-emerald-600" />
                {(msg.responseTimeMs / 1000).toFixed(1)}s
              </span>
            )}
            {msg.usage && (
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
                {msg.usage.total_tokens} tokens
              </span>
            )}
          </div>
        </div>

      {/* Floating Source Detail Panel */}
      {selectedSource && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99]"
            onClick={() => setSelectedSource(null)}
          />
          {/* Side Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] lg:w-[650px] bg-[#FAF9F5] border-l border-gray-200 z-[100] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white">
              <button onClick={() => setSelectedSource(null)} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
                <X className="h-5 w-5" />
              </button>
              <div className="h-4 w-px bg-gray-200 mx-1"></div>
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-[13px] font-bold text-gray-700 truncate pr-4">{selectedSource.filename}</span>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-[#323639]">
              {selectedSource.filename.toLowerCase().endsWith('.pdf') ? (
                pdfLoading ? (
                  <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center text-gray-400 bg-[#323639]">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    <span className="text-sm font-medium">Memuat PDF...</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe 
                    src={`${pdfUrl}#page=${selectedSource.page || 1}`} 
                    className="w-full h-full border-0"
                    title={selectedSource.filename}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-[#323639]">Gagal memuat dokumen PDF.</div>
                )
              ) : (
                /* The text extraction view for non-PDFs */
                <div className="flex-1 overflow-y-auto relative bg-[#FAF9F5] h-full">
                  <div className="relative z-10 max-w-2xl mx-auto p-6 md:p-8 mt-4">
                    <div className="bg-white p-8 md:p-10 rounded-3xl border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-gray-900 leading-tight mb-2">{selectedSource.filename}</h3>
                          {selectedSource.page && (
                            <div className="inline-block px-3 py-1 rounded-lg bg-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                              Halaman {selectedSource.page}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="w-full h-px bg-gray-100 my-6"></div>
                      
                      <div className="mb-4 text-[11px] font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        Bagian yang diekstrak oleh AI
                      </div>

                      <div className="relative text-gray-800 text-[14.5px] leading-relaxed font-serif text-justify bg-yellow-50/80 p-5 rounded-2xl border border-yellow-200/60 shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400 rounded-l-2xl"></div>
                        {selectedSource.excerpt.split('\n').map((para, i) => (
                          para.trim() ? (
                            <p key={i} className="mb-3 last:mb-0">
                              {para}
                            </p>
                          ) : null
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
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
            alt="Zoomed attachment" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});
