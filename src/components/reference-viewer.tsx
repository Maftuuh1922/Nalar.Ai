"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, Loader2, ShieldAlert, FileText, Globe } from "lucide-react";

export type ViewerSource = {
  type: string;
  title: string;
  url: string;
  snippet?: string;
};

/** Nama situs dari URL, untuk label ringkas di kepala panel. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Tebak apakah tautan mengarah ke berkas PDF agar bisa dibuka dengan penampil bawaan. */
export function isPdfUrl(url: string): boolean {
  try {
    return /\.pdf($|[?#])/i.test(new URL(url).pathname + new URL(url).search);
  } catch {
    return /\.pdf($|[?#])/i.test(url);
  }
}

/**
 * Panel pratinjau sumber yang bisa dibuka-tutup di dalam aplikasi.
 *
 * Banyak situs menolak ditampilkan di dalam iframe (`X-Frame-Options`), dan
 * browser tidak memberi tahu kegagalan itu ke JavaScript. Karena itu panel
 * menampilkan jalan keluar "buka di tab baru" begitu halaman tidak selesai
 * memuat dalam batas waktu wajar, alih-alih membiarkan layar kosong.
 */
export function ReferenceViewer({
  source,
  onClose,
}: {
  source: ViewerSource | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!source) return;
    setLoaded(false);
    setBlocked(false);
    const timer = setTimeout(() => setBlocked(prev => (prev ? prev : true)), 6000);
    return () => clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, onClose]);

  if (!source) return null;

  const pdf = isPdfUrl(source.url);
  const showFallback = blocked && !loaded;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-[2px]">
      {/* Klik area gelap untuk menutup */}
      <div className="flex-1" onClick={onClose} aria-hidden />

      <aside className="flex h-full w-full max-w-[720px] flex-col border-l border-gray-200 bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-gray-200 px-5 py-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            {pdf ? <FileText className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-gray-900">{source.title}</p>
            <p className="truncate text-[11px] text-gray-500">
              {hostOf(source.url) || source.url}
              {pdf && <span className="ml-2 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">PDF</span>}
            </p>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka di tab baru"
            className="flex shrink-0 items-center gap-1 border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-900 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" /> Tab Baru
          </a>
          <button
            onClick={onClose}
            title="Tutup pratinjau (Esc)"
            className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {source.snippet && (
          <p className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-[11px] italic leading-relaxed text-gray-600 line-clamp-3">
            {source.snippet}
          </p>
        )}

        <div className="relative flex-1 bg-gray-50">
          {!loaded && !showFallback && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-[11px]">Memuat {pdf ? "dokumen" : "halaman"}...</p>
            </div>
          )}

          {showFallback && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-50 px-8 text-center">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              <p className="text-[13px] font-bold text-gray-900">Situs ini menolak ditampilkan di dalam aplikasi</p>
              <p className="max-w-sm text-[11px] leading-relaxed text-gray-500">
                Sebagian penerbit memblokir penyematan halaman demi keamanan. Cuplikan
                yang sudah dibaca AI tetap tersimpan di daftar referensi.
              </p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab Baru
              </a>
            </div>
          )}

          <iframe
            key={source.url}
            src={source.url}
            title={source.title}
            onLoad={() => {
              setLoaded(true);
              setBlocked(false);
            }}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
        </div>
      </aside>
    </div>
  );
}
