"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { notebooksApi, chatApi, settingsApi } from "@/lib/api";
import { marked } from "marked";
import type { Notebook, ModelConfig } from "@/lib/types";
import { Plus, Trash2, Edit3, Save, CheckCircle2, FileText, Search, ArrowLeft, BookOpen, Clock, File, WandSparkles, Loader2, X, Sparkles, MessageCircle, Send, ChevronDown, Check, Download } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";

export default function CatatanPage() {
  const { token } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: "user" | "ai"; content: string; tools?: {name: string; status: "running"|"done"}[]}[]>([]);
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
  }

  function backToList() {
    setActiveNotebook(null);
  }

  async function handleSendMessage() {
    if (!token || !chatInput.trim() || isSending) return;
    
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsSending(true);

    let targetText = "";
    if (hasSelection && selectedText.trim()) {
      targetText = selectedText;
    } else if (tiptapEditor) {
      targetText = tiptapEditor.getText();
    } else {
      targetText = content; // Fallback to HTML if tiptap instance isn't ready
    }

    const systemInstruction = targetText.trim() 
      ? `\n\n(INFO SISTEM UNTUK AI: Berikut adalah isi draf laporan yang SEDANG DITULIS oleh user di editor.\nATURAN PENTING:\n1. JANGAN memanggil tool \`list_documents\` atau \`read_document\` kecuali user secara EKSPLISIT meminta mencari referensi dari dokumen yang diunggah. Fokus utamamu adalah membantu user memproses teks editor ini.\n2. Jika kamu ingin MENGUBAH isi editor secara OTOMATIS, kamu WAJIB membungkus teks barumu di dalam blok markdown berikut:\n\`\`\`update_editor\n[Tulis teks baru di sini]\n\`\`\`\n\n--- ISI EDITOR ---\n${targetText}\n------------------)`
      : `\n\n(INFO SISTEM UNTUK AI: Editor pengguna saat ini kosong. Jika kamu ingin MENGISI editor secara otomatis, gunakan format:\n\`\`\`update_editor\n[Tulis teks di sini]\n\`\`\`)`;

    const fullPrompt = `${userMessage}${systemInstruction}`;

    // Buat placeholder untuk pesan AI
    setChatMessages(prev => [...prev, { role: "ai", content: "", tools: [] }]);

    try {
      const reader = await chatApi.sendStream(token, fullPrompt, null, []);
      const decoder = new TextDecoder("utf-8");
      
      let aiResponseText = "";
      let currentTools: {name: string; status: "running"|"done"}[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split("\n").filter(l => l.trim() !== "");
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.event === "text") {
              aiResponseText += data.data;
              setChatMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].content = aiResponseText;
                return newArr;
              });
            } else if (data.event === "tool_call") {
              currentTools.push({ name: data.name, status: "running" });
              setChatMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].tools = [...currentTools];
                return newArr;
              });
            } else if (data.event === "tool_result") {
              const toolIdx = currentTools.findIndex(t => t.name === data.name && t.status === "running");
              if (toolIdx !== -1) {
                currentTools[toolIdx].status = "done";
                setChatMessages(prev => {
                  const newArr = [...prev];
                  newArr[newArr.length - 1].tools = [...currentTools];
                  return newArr;
                });
              }
            } else if (data.event === "error") {
              console.error("AI Error:", data.data);
            }
          } catch (e) {
            console.error("Failed to parse chunk:", line, e);
          }
        }
      }
      
      // Auto-apply logic jika AI menyertakan blok update_editor
      const updateMatch = aiResponseText.match(/```update_editor\n([\s\S]*?)\n```/);
      if (updateMatch) {
        const textToApply = updateMatch[1];
        await handleApplyAiText(textToApply);
        
        const modifiedAnswer = aiResponseText.replace(/```update_editor\n[\s\S]*?\n```/, "\n\n*(Sistem: Perubahan telah diterapkan secara otomatis ke editor!)*\n\n");
        setChatMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1].content = modifiedAnswer;
          return newArr;
        });
      }
      
    } catch (err) {
      setChatMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content = "Terjadi kesalahan saat memproses permintaan.";
        return newArr;
      });
    } finally {
      setIsSending(false);
    }
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

  async function handleApplyAiText(text: string) {
    if (!tiptapEditor) return;
    
    // Parse markdown to HTML so Tiptap renders headings, bold, and line breaks properly
    const htmlContent = await marked.parse(text);
    
    if (hasSelection) {
      tiptapEditor.chain().focus().insertContent(htmlContent).run();
    } else {
      tiptapEditor.chain().focus().setContent(htmlContent).run();
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

  const filteredNotebooks = notebooks.filter(nb => nb.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (activeNotebook) {
    // EDITOR VIEW
    return (
      <div className="flex h-full flex-col bg-transparent">
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-8 shrink-0 bg-white">
          <div className="flex items-center gap-4 w-full">
            <button onClick={backToList} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Catatan..."
              className="text-xl font-bold font-serif text-gray-900 bg-transparent outline-none flex-1 placeholder:text-gray-300 transition-colors"
            />
          </div>
          
          <div className="shrink-0 flex items-center gap-3">
            <div className="text-xs font-medium text-gray-400">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5"><Save className="h-3.5 w-3.5 animate-pulse" /> Menyimpan...</span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-gray-900"><CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan</span>
              )}
              {saveStatus === "idle" && lastSaved && (
                <span>Tersimpan otomatis</span>
              )}
            </div>
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> Asisten Laporan
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-y-auto px-10 py-10 max-w-4xl mx-auto w-full">
          {isChatOpen && (
            <div 
              className="fixed bottom-10 right-10 w-[400px] h-[550px] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? "none" : "transform 0.1s ease-out" }}
            >
              {/* Header */}
              <div 
                className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm relative z-10 cursor-move"
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
                      className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-white transition-colors"
                    >
                      {models.find(m => m.id === selectedModelId)?.name || "Pilih Model"}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {isModelDropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 text-gray-900 py-1 overflow-hidden">
                        {models.map(m => (
                          <button 
                            key={m.id}
                            onClick={() => handleChangeModel(m.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="truncate font-medium">{m.name}</span>
                            {m.id === selectedModelId && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 bg-gray-50/50 space-y-5">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-gray-900 font-bold mb-1">Hai! Saya Asisten Laporanmu.</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Tulis instruksi untuk merapikan, mengedit, atau meringkas teks.<br/>
                      Teks yang kamu blok di editor akan otomatis disertakan sebagai konteks.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-[13px] leading-relaxed shadow-sm ${msg.role === "user" ? "bg-gray-900 text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"}`}>
                        
                        {/* Agentic Tools UI */}
                        {msg.tools && msg.tools.length > 0 && (
                          <div className="mb-3 space-y-1">
                            {msg.tools.map((t, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-100">
                                {t.status === "running" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-crail" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                )}
                                <span>{t.name === "search_web" ? "Mencari di Internet..." : t.name === "read_document" ? "Membaca Dokumen..." : t.name === "search_in_document" ? "Mencari di Dokumen..." : `Tool: ${t.name}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {msg.content || (msg.role === "ai" && isSending && msg.tools?.length === 0 ? <span className="animate-pulse">Berpikir...</span> : "")}
                      </div>
                      {msg.role === "ai" && msg.content.trim() && (
                        <button 
                          onClick={() => handleApplyAiText(msg.content)}
                          className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-crail bg-white border border-gray-200 hover:border-crail/30 rounded-full px-3 py-1.5 shadow-sm transition-all"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Terapkan ke Editor
                        </button>
                      )}
                    </div>
                  ))
                )}
                {isSending && (
                  <div className="flex items-start">
                    <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 rounded-bl-sm shadow-sm flex items-center gap-1.5 text-gray-400">
                      <span className="animate-bounce">●</span><span className="animate-bounce delay-75">●</span><span className="animate-bounce delay-150">●</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-sm relative z-10">
                <div className="flex flex-col gap-2 relative">
                  {hasSelection && (
                    <div className="text-[10px] font-bold text-crail bg-crail/10 px-2 py-1 rounded w-fit uppercase tracking-wider">
                      Target: Teks Terpilih
                    </div>
                  )}
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
                      className="flex-1 max-h-32 min-h-[44px] resize-none outline-none text-[13px] py-3 px-1 placeholder:text-gray-400 bg-transparent"
                      rows={1}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isSending || !chatInput.trim()}
                      className="p-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
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
              onSelectionChange={(hasSel, text, ed) => {
                setHasSelection(hasSel);
                setSelectedText(text);
                setTiptapEditor(ed);
              }}
              placeholder="Mulai menulis draf laporan Anda di sini... Blok teks dan klik Asisten Laporan untuk menyempurnakan tulisan."
            />
        </div>
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
              <BookOpen className="h-5 w-5 text-gray-400" />
              <h1 className="text-2xl font-bold text-gray-900 font-sans">Catatan</h1>
            </div>
            <p className="text-sm text-gray-500">
              Buat, jelajahi, dan pelajari catatan yang dihasilkan oleh Anda dan AI.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none w-64 focus:border-gray-300"
              />
            </div>
            <button 
              onClick={createNotebook}
              className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" /> Buat Catatan
            </button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
              <BookOpen className="h-4 w-4" /> TOTAL CATATAN
            </div>
            <div className="text-3xl font-bold text-gray-900">{notebooks.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4">
              <CheckCircle2 className="h-4 w-4" /> SELESAI
            </div>
            <div className="text-3xl font-bold text-emerald-600">0</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crail mb-4">
              <Clock className="h-4 w-4" /> DRAF
            </div>
            <div className="text-3xl font-bold text-crail">{notebooks.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500 mb-4">
              <FileText className="h-4 w-4" /> KATA
            </div>
            <div className="text-3xl font-bold text-blue-600">0</div>
          </div>
        </div>

        {/* List Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            PERPUSTAKAAN SAYA ({filteredNotebooks.length} dari {notebooks.length} catatan)
          </h3>
          
          {filteredNotebooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
              <BookOpen className="h-10 w-10 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Belum ada catatan</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm">
                Buat catatan pertama Anda dari sumber materi, seleksi chat, atau mulai dari topik kosong.
              </p>
              <button 
                onClick={createNotebook}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
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
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 cursor-pointer hover:shadow-md transition-all hover:border-gray-300"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-400 group-hover:text-crail transition-colors">
                        <File className="h-5 w-5" />
                      </div>
                      <button 
                        onClick={(e) => deleteNotebook(nb.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">{nb.title || "Tanpa Judul"}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {nb.content || "Belum ada konten..."}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-gray-400">
                    <span>Diperbarui {new Date(nb.updated_at).toLocaleDateString()}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">Draf</span>
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
