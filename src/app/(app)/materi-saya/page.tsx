"use client";

import { useEffect, useState, useRef } from "react";
import { UploadCloud, FileText, Trash2, Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { documentsApi, ApiError } from "@/lib/api";
import type { Document } from "@/lib/types";

export default function MateriSayaPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    if (!token) return;
    setIsLoading(true);
    try {
      const docs = await documentsApi.getAll(token);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [token]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    setError(null);

    try {
      await documentsApi.upload(token, file);
      // Panggil loadDocuments lagi untuk mengambil status terbaru
      loadDocuments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Yakin ingin menghapus dokumen ini beserta seluruh isi indeksnya?")) return;
    
    try {
      await documentsApi.delete(token, id);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      alert("Gagal menghapus dokumen.");
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center justify-between border-b border-cloudy/10 px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold font-serif text-white">Materi Saya</h1>
          <p className="mt-1 text-sm text-cloudy">Kelola dokumen PDF/TXT untuk dijadikan konteks AI.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          
          {/* Upload Area */}
          <div 
            className="flex flex-col items-center justify-center rounded-none border-2 border-dashed border-cloudy/30 bg-pampas py-12 transition-colors hover:bg-cloudy/5"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.txt,.md"
            />
            {isUploading ? (
              <div className="flex flex-col items-center text-white">
                <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                <p className="text-sm font-semibold">Mengunggah & Mengindeks...</p>
                <p className="text-xs text-cloudy mt-1">Jangan tutup halaman ini.</p>
              </div>
            ) : (
              <div className="flex cursor-pointer flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-transparent shadow-none">
                  <UploadCloud className="h-6 w-6 text-white" />
                </div>
                <p className="text-sm font-bold text-white">Klik untuk mengunggah dokumen baru</p>
                <p className="mt-1 text-xs text-cloudy">Mendukung file PDF, TXT, MD (Maks 50MB)</p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-none bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Document List */}
          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-cloudy">Daftar Materi</h2>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cloudy" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-none border border-cloudy/20 bg-transparent p-8 text-center shadow-none">
                <p className="text-sm text-cloudy">Belum ada dokumen yang diunggah.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents.map(doc => (
                  <div key={doc.id} className="group flex flex-col justify-between rounded-none border border-cloudy/20 bg-transparent p-4 shadow-none transition-shadow hover:shadow-none">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-pampas">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {doc.status === "indexed" ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Terindeks
                            </span>
                          ) : doc.status === "failed" ? (
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertCircle className="h-3.5 w-3.5" /> Gagal
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between border-t border-cloudy/10 pt-3">
                      <span className="text-[10px] text-cloudy uppercase font-semibold tracking-wider">
                        {new Date(doc.created_at).toLocaleDateString("id-ID")}
                      </span>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="rounded p-1.5 text-cloudy opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        title="Hapus dokumen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
