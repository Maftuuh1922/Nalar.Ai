"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, History, Loader2, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  createCoWriterCheckpoint,
  getCoWriterCheckpoint,
  listCoWriterCheckpoints,
  restoreCoWriterCheckpoint,
  type CoWriterCheckpoint,
} from "@/lib/co-writer-api";

interface VersionHistoryProps {
  docId: string;
  onRestored: () => void | Promise<void>;
}

function formatDate(epoch: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(epoch * 1000));
}

export default function VersionHistory({ docId, onRestored }: VersionHistoryProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkpoints, setCheckpoints] = useState<CoWriterCheckpoint[]>([]);
  const [selected, setSelected] = useState<{ id: string; content: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setCheckpoints(await listCoWriterCheckpoints(docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [docId]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const createManual = async () => {
    setBusy(true);
    try {
      await createCoWriterCheckpoint(docId, "Checkpoint manual");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const inspect = async (checkpoint: CoWriterCheckpoint) => {
    setBusy(true);
    try {
      const detail = await getCoWriterCheckpoint(docId, checkpoint.id);
      setSelected({ id: checkpoint.id, content: detail.content, label: detail.label });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!selected || !window.confirm(t("Pulihkan versi ini? Isi saat ini akan disimpan sebagai checkpoint baru."))) return;
    setBusy(true);
    setError("");
    try {
      await restoreCoWriterCheckpoint(docId, selected.id);
      setSelected(null);
      await load();
      await onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t("Riwayat versi")}
        aria-label={t("Riwayat versi")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)] ${open ? "bg-[var(--primary)]/12 text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
      >
        <History size={15} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-1 pb-2">
            <div>
              <div className="text-xs font-semibold text-[var(--foreground)]">{t("Riwayat versi")}</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">{t("Perubahan besar AI dan snapshot manual")}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} title={t("Tutup")} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
              <X size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void createManual()}
            disabled={busy}
            className="my-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <History size={12} />}
            {t("Simpan checkpoint sekarang")}
          </button>
          {error ? <div className="mb-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-[10.5px] text-rose-600">{error}</div> : null}
          {selected ? (
            <div className="space-y-2">
              <button type="button" onClick={() => setSelected(null)} className="text-[10.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">← {t("Kembali ke daftar")}</button>
              <div className="rounded-md border border-[var(--border)] p-2">
                <div className="text-[11px] font-medium text-[var(--foreground)]">{selected.label}</div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[var(--muted-foreground)]">{selected.content.slice(0, 5000)}</pre>
              </div>
              <button type="button" onClick={() => void restore()} disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--primary)] px-2 py-1.5 text-[11px] font-medium text-[var(--primary-foreground)] disabled:opacity-50">
                <RotateCcw size={12} />
                {t("Pulihkan versi ini")}
              </button>
            </div>
          ) : checkpoints.length === 0 && !busy ? (
            <div className="px-2 py-4 text-center text-[11px] text-[var(--muted-foreground)]">{t("Belum ada checkpoint")}</div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {checkpoints.map((checkpoint) => (
                <button key={checkpoint.id} type="button" onClick={() => void inspect(checkpoint)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--muted)]/60">
                  <Eye size={13} className="shrink-0 text-[var(--muted-foreground)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-[var(--foreground)]">{checkpoint.label}</span>
                    <span className="block text-[9.5px] text-[var(--muted-foreground)]">{formatDate(checkpoint.created_at)} · {checkpoint.content_length} {t("karakter")}{checkpoint.file_count ? ` · ${checkpoint.file_count} ${t("berkas")}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
