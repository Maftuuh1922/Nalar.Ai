"use client";

/**
 * Notifikasi ringan seluruh aplikasi.
 *
 * Sebelumnya sebagian halaman memakai `alert()` bawaan browser yang memblokir
 * halaman dan tampil di luar tema aplikasi. Provider ini menggantikannya dengan
 * toast yang muncul-hilang sendiri di pojok kanan bawah.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "info" | "success" | "error";

type Toast = { id: number; message: string; kind: ToastKind };

type ToastApi = {
  /** Tampilkan pesan biasa. */
  showToast: (message: string, kind?: ToastKind) => void;
  /** Pesan sukses (ikon centang hijau). */
  toastSuccess: (message: string) => void;
  /** Pesan gagal (ikon peringatan merah, bertahan lebih lama). */
  toastError: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS: Record<ToastKind, number> = { info: 3200, success: 3200, error: 5200 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    timers.current.push(setTimeout(() => dismiss(id), VISIBLE_MS[kind]));
  }, [dismiss]);

  const toastSuccess = useCallback((m: string) => showToast(m, "success"), [showToast]);
  const toastError = useCallback((m: string) => showToast(m, "error"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toastSuccess, toastError }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[10000] flex w-[min(92vw,360px)] flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full items-start gap-2.5 border border-gray-800 bg-gray-950 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-400" />
            ) : t.kind === "error" ? (
              <AlertCircle className="mt-px h-4 w-4 shrink-0 text-red-400" />
            ) : (
              <Info className="mt-px h-4 w-4 shrink-0 text-blue-400" />
            )}
            <span className="min-w-0 flex-1 leading-relaxed break-words">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Tutup notifikasi"
              className="shrink-0 text-white/40 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Ambil fungsi notifikasi. Aman dipanggil di komponen mana pun; kalau provider
 * belum terpasang, pesan hanya dicatat ke console alih-alih melempar error.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  const fallback = (message: string) => console.warn("[toast]", message);
  return { showToast: fallback, toastSuccess: fallback, toastError: fallback };
}
