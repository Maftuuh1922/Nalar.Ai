"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Copy,
  FileText,
  FolderInput,
  Loader2,
  MoreHorizontal,
  PenLine,
  Pin,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  createCoWriterDocument,
  deleteCoWriterDocument,
  importFileToCoWriter,
  listCoWriterDocuments,
  updateCoWriterDocument,
  type CoWriterDocumentSummary,
} from "@/lib/co-writer-api";
import { notifyCoWriterChanged } from "@/lib/co-writer-events";
import { CO_WRITER_SAMPLE_TEMPLATE } from "./sampleTemplate";

function relativeTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "";
  const diff = Date.now() / 1000 - seconds;
  if (diff < 60) return "1m";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** Deteksi jenis dokumen dari judul/isi preview. */
function guessDocType(doc: CoWriterDocumentSummary): "Skripsi" | "Jurnal" | "Artikel" | "Laporan" {
  const hay = `${doc.title} ${doc.preview ?? ""}`.toLowerCase();
  if (/(skripsi|tesis|tugas akhir|bab\s*1|pendahuluan)/.test(hay)) return "Skripsi";
  if (/(jurnal|paper|arxiv|doi|abstrak|tinjauan pustaka)/.test(hay)) return "Jurnal";
  if (/(artikel|opini|blog)/.test(hay)) return "Artikel";
  return "Laporan";
}

/** Status draft: kosong / dikerjakan / selesai. */
function draftStatus(doc: CoWriterDocumentSummary): "empty" | "working" | "done" {
  const preview = doc.preview ?? "";
  if (!preview || preview === "Empty draft" || preview.length < 20) return "empty";
  if (/(kesimpulan|daftar pustaka|penutup)/i.test(preview)) return "done";
  return "working";
}

/** Hitung progres: berapa dari 8 bagian standar yang ada di preview. */
function sectionProgress(doc: CoWriterDocumentSummary): { filled: number; total: number } {
  const SECTIONS = [
    "abstrak",
    "pendahuluan",
    "tinjauan pustaka",
    "metodologi",
    "hasil",
    "pembahasan",
    "kesimpulan",
    "daftar pustaka",
  ];
  const hay = `${doc.title} ${doc.preview ?? ""}`.toLowerCase();
  const filled = SECTIONS.filter((s) => hay.includes(s)).length;
  return { filled, total: SECTIONS.length };
}

type SortKey = "updated" | "name" | "created" | "progress";
type TypeFilter = "all" | "Skripsi" | "Jurnal" | "Artikel" | "Laporan";
type StatusFilter = "all" | "empty" | "working" | "done";

export default function CoWriterHomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<CoWriterDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState("");
  const importTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  // PRD 11.4: sort/filter
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // PRD 11.2: menu aksi per kartu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const docs = await listCoWriterDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pastikan interval simulasi progres impor tidak bocor bila pengguna
  // berpindah halaman di tengah impor (finally tidak sempat jalan).
  useEffect(() => {
    return () => {
      if (importTimerRef.current) {
        clearInterval(importTimerRef.current);
        importTimerRef.current = null;
      }
    };
  }, []);

  const handleCreate = useCallback(
    async (withTemplate: boolean) => {
      if (creating) return;
      setCreating(true);
      setError("");
      try {
        const document = await createCoWriterDocument({
          content: withTemplate ? CO_WRITER_SAMPLE_TEMPLATE : "",
        });
        notifyCoWriterChanged();
        router.push(`/co-writer/${document.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setCreating(false);
      }
    },
    [creating, router],
  );

  const handleImportFile = useCallback(
    async (file: File | undefined) => {
      if (!file || importing) return;
      setImporting(true);
      setImportProgress(0);
      setImportFileName(file.name);
      setError("");
      // Impor PDF/DOCX berjalan di satu request yang bisa memakan puluhan
      // detik. Bar progres disimulasikan naik bertahap dan melambat mendekati
      // 95%; begitu respons tiba, meloncat ke 100%.
      if (importTimerRef.current) clearInterval(importTimerRef.current);
      importTimerRef.current = setInterval(() => {
        setImportProgress(prev => {
          const next = prev + Math.max(0.4, (95 - prev) * 0.07);
          return next >= 95 ? 95 : next;
        });
      }, 350);
      try {
        const document = await importFileToCoWriter(file);
        setImportProgress(100);
        window.sessionStorage.setItem(
          `nalar-ai.co_writer.imported.${document.id}`,
          "1",
        );
        notifyCoWriterChanged();
        router.push(`/co-writer/${document.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (importTimerRef.current) {
          clearInterval(importTimerRef.current);
          importTimerRef.current = null;
        }
        setImporting(false);
        if (importFileRef.current) importFileRef.current.value = "";
      }
    },
    [importing, router],
  );

  // Label tahap impor diturunkan dari progres simulasi: PDF besar menghabiskan
  // waktu paling lama di ekstraksi teks/gambar, lalu deteksi tabel & heading.
  const importPhaseLabel = (() => {
    if (importProgress < 12) return t("Mengunggah berkas…");
    if (importProgress < 45) return t("Mengekstrak teks & gambar…");
    if (importProgress < 75) return t("Mendeteksi tabel & heading…");
    if (importProgress < 96) return t("Menyusun draf LaTeX…");
    return t("Menyelesaikan…");
  })();

  const handleDelete = useCallback(
    async (docId: string) => {
      if (deletingId) return;
      setDeletingId(docId);
      setError("");
      try {
        await deleteCoWriterDocument(docId);
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
        setPendingDeleteId(null);
        setMenuOpenId(null);
        notifyCoWriterChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId],
  );

  const handleDuplicate = useCallback(
    async (doc: CoWriterDocumentSummary) => {
      try {
        const copy = await createCoWriterDocument({
          title: `${doc.title || "Untitled"} (salinan)`,
          content: "",
        });
        notifyCoWriterChanged();
        setDocuments((prev) => [
          {
            id: copy.id,
            title: copy.title,
            created_at: copy.created_at,
            updated_at: copy.updated_at,
            preview: "",
          },
          ...prev,
        ]);
        setMenuOpenId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleRename = useCallback(
    async (docId: string) => {
      const name = renameValue.trim();
      if (!name) {
        setRenamingId(null);
        return;
      }
      try {
        const updated = await updateCoWriterDocument(docId, { title: name });
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, title: updated.title } : d)),
        );
        notifyCoWriterChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      setRenamingId(null);
      setMenuOpenId(null);
    },
    [renameValue],
  );

  const togglePin = useCallback((docId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
    setMenuOpenId(null);
  }, []);

  // ── PRD 11.4: sort + filter ──
  const filtered = useMemo(() => {
    let list = documents.filter((doc) => {
      if (typeFilter !== "all" && guessDocType(doc) !== typeFilter) return false;
      if (statusFilter !== "all" && draftStatus(doc) !== statusFilter) return false;
      return true;
    });
    const sorters: Record<SortKey, (a: CoWriterDocumentSummary, b: CoWriterDocumentSummary) => number> = {
      updated: (a, b) => b.updated_at - a.updated_at,
      name: (a, b) => (a.title || "").localeCompare(b.title || ""),
      created: (a, b) => b.created_at - a.created_at,
      progress: (a, b) => sectionProgress(b).filled - sectionProgress(a).filled,
    };
    list = [...list].sort(sorters[sortKey]);
    // Pin ke atas dulu
    return [...list.filter((d) => pinnedIds.has(d.id)), ...list.filter((d) => !pinnedIds.has(d.id))];
  }, [documents, sortKey, typeFilter, statusFilter, pinnedIds]);

  // ── PRD 11.3: grup draft kosong lama (>14 hari) ──
  const { staleEmpty, activeDrafts } = useMemo(() => {
    const STALE_DAYS = 14;
    const now = Date.now() / 1000;
    const stale: CoWriterDocumentSummary[] = [];
    const active: CoWriterDocumentSummary[] = [];
    for (const doc of filtered) {
      const isStaleEmpty =
        draftStatus(doc) === "empty" && now - (doc.updated_at || doc.created_at) > STALE_DAYS * 86400;
      if (isStaleEmpty) stale.push(doc);
      else active.push(doc);
    }
    return { staleEmpty: stale, activeDrafts: active };
  }, [filtered]);

  const renderCard = (doc: CoWriterDocumentSummary, dim: boolean) => {
    const isPendingDelete = pendingDeleteId === doc.id;
    const isDeleting = deletingId === doc.id;
    const isPinned = pinnedIds.has(doc.id);
    const type = guessDocType(doc);
    const status = draftStatus(doc);
    const prog = sectionProgress(doc);
    const menuOpen = menuOpenId === doc.id;
    const isRenaming = renamingId === doc.id;

    return (
      <div
        key={doc.id}
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/co-writer/${doc.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(`/co-writer/${doc.id}`);
          }
        }}
        className={`group relative flex h-44 cursor-pointer flex-col rounded-2xl border p-4 text-left transition-colors ${
          dim
            ? "border-dashed border-[var(--border)] opacity-55 hover:border-[var(--ring)] hover:opacity-80"
            : "border-[var(--border)] hover:border-[var(--ring)]"
        }`}
      >
        {/* Badge jenis + pin */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[9.5px] font-medium text-[var(--muted-foreground)]">
            {type}
          </span>
          {isPinned && <Pin size={11} className="text-[var(--primary)]" />}
        </div>

        <div className="flex items-start justify-between gap-2 pr-16">
          <div className="flex min-w-0 items-start gap-2">
            {/* PRD 11.2: thumbnail mini dari gambar pertama di preview */}
            {doc.preview && /!\[[^\]]*\]\([^)]+\)/.test(doc.preview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.preview.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] ?? ""}
                alt=""
                className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-[var(--border)] object-cover"
              />
            ) : (
              <FileText
                size={15}
                className="mt-0.5 shrink-0 text-[var(--muted-foreground)]"
              />
            )}
            <div className="min-w-0">
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void handleRename(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRename(doc.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded border border-[var(--ring)] bg-transparent px-1 text-[13px] text-[var(--foreground)] outline-none"
                />
              ) : (
                <div
                  className="truncate text-[14px] font-medium text-[var(--foreground)]"
                  title={doc.title || t("Untitled draft")}
                >
                  {doc.title || t("Untitled draft")}
                </div>
              )}
              <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]/70">
                {t("Updated")} {relativeTime(doc.updated_at)} {t("ago")}
              </div>
            </div>
          </div>
        </div>

        {/* Progres ringkas */}
        {status !== "empty" ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${(prog.filled / prog.total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {prog.filled}/{prog.total} {t("bagian")}
            </span>
          </div>
        ) : (
          <span className="mt-1.5 inline-block w-fit rounded-full bg-[var(--muted)]/60 px-2 py-0.5 text-[9.5px] text-[var(--muted-foreground)]">
            {t("Draft kosong")}
          </span>
        )}

        <p className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
          {doc.preview && doc.preview !== "Empty draft" ? doc.preview : t("Empty draft")}
        </p>

        {/* Menu aksi titik-tiga (PRD 11.2) */}
        <div className="absolute bottom-2.5 right-2.5">
          {menuOpen ? (
            <div
              className="dt-popup-up absolute bottom-0 right-0 z-30 w-44 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setRenamingId(doc.id);
                  setRenameValue(doc.title || "");
                  setMenuOpenId(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <PenLine size={12} /> {t("Rename")}
              </button>
              <button
                type="button"
                onClick={() => void handleDuplicate(doc)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <Copy size={12} /> {t("Duplicate")}
              </button>
              <button
                type="button"
                onClick={() => togglePin(doc.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <Pin size={12} /> {isPinned ? t("Unpin") : t("Pin ke atas")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPendingDelete) {
                    void handleDelete(doc.id);
                  } else {
                    setPendingDeleteId(doc.id);
                  }
                }}
                disabled={isDeleting}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-[var(--muted)]/40 ${
                  isPendingDelete
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-rose-500 hover:text-rose-600 dark:hover:text-rose-400"
                }`}
              >
                {isDeleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                {isPendingDelete ? t("Konfirmasi hapus") : t("Delete")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpen ? null : doc.id);
              }}
              title={t("Aksi")}
              className="rounded-md p-1 text-[var(--muted-foreground)]/60 opacity-0 transition-opacity hover:bg-[var(--muted)] hover:text-[var(--foreground)] group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-8 text-center">
      <PenLine size={30} strokeWidth={1.5} className="mb-3 text-[var(--muted-foreground)]" />
      <p className="text-[14px] font-medium text-[var(--foreground)]">
        {t("No drafts yet")}
      </p>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
        {t("Start a new LaTeX draft to begin writing.")}
      </p>
      {/* PRD 11.5: onboarding ringan — 3 tombol */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => importFileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-[11.5px] text-[var(--foreground)] transition-colors hover:border-[var(--ring)] hover:bg-[var(--muted)]/30"
        >
          <FolderInput size={18} className="text-[var(--primary)]" />
          {t("Import Laporan")}
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {t("PDF/DOCX → LaTeX + gambar")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleCreate(true)}
          disabled={creating}
          className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-[11.5px] text-[var(--foreground)] transition-colors hover:border-[var(--ring)] hover:bg-[var(--muted)]/30 disabled:opacity-60"
        >
          <FileText size={18} className="text-[var(--primary)]" />
          {t("From Template")}
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {t("Struktur jurnal standar")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleCreate(false)}
          disabled={creating}
          className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-[11.5px] text-[var(--foreground)] transition-colors hover:border-[var(--ring)] hover:bg-[var(--muted)]/30 disabled:opacity-60"
        >
          {creating ? (
            <Loader2 size={18} className="animate-spin text-[var(--primary)]" />
          ) : (
            <Plus size={18} className="text-[var(--primary)]" />
          )}
          {t("New Draft")}
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {t("Mulai dari kosong")}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]" onClick={() => menuOpenId && setMenuOpenId(null)}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
              {t("Co-Writer")}
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
              {t("Manage your LaTeX drafts and projects.")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".tex,.md,.markdown,.txt,.docx,.pdf"
              className="hidden"
              onChange={(e) => void handleImportFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-60"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />}
              {importing ? t("Importing…") : t("Import Laporan")}
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-60"
            >
              <FileText size={14} />
              {t("From template")}
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("New draft")}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-300/30 bg-rose-50/40 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* PRD 11.4: kontrol sort + filter */}
        {!loading && documents.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[11.5px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            >
              <option value="updated">{t("Terakhir diedit")}</option>
              <option value="name">{t("Nama (A-Z)")}</option>
              <option value="created">{t("Tanggal dibuat")}</option>
              <option value="progress">{t("Progres")}</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[11.5px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            >
              <option value="all">{t("Semua jenis")}</option>
              <option value="Skripsi">{t("Skripsi")}</option>
              <option value="Jurnal">{t("Jurnal")}</option>
              <option value="Artikel">{t("Artikel")}</option>
              <option value="Laporan">{t("Laporan")}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[11.5px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            >
              <option value="all">{t("Semua status")}</option>
              <option value="empty">{t("Draft kosong")}</option>
              <option value="working">{t("Sedang dikerjakan")}</option>
              <option value="done">{t("Selesai")}</option>
            </select>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[12.5px] text-[var(--muted-foreground)]">
            <Loader2 size={16} className="animate-spin" />
            {t("Loading drafts…")}
          </div>
        ) : documents.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {/* Draft aktif */}
            {activeDrafts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeDrafts.map((doc) => renderCard(doc, false))}
              </div>
            ) : null}
            {/* PRD 11.3: grup draft kosong lama */}
            {staleEmpty.length > 0 ? (
              <div className="mt-8">
                <details className="group">
                  <summary className="cursor-pointer select-none text-[12px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t("Draft kosong lama")} ({staleEmpty.length})
                    <RotateCcw size={11} className="ml-1.5 inline" />
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {staleEmpty.map((doc) => renderCard(doc, true))}
                  </div>
                </details>
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-[12.5px] text-[var(--muted-foreground)]">
                {t("Tidak ada draft cocok dengan filter.")}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Overlay progres impor: request tunggal bisa makan puluhan detik,
          jadi bar disimulasikan naik bertahap sampai respons tiba. */}
      {importing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Mengimpor laporan")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-2.5">
              <Loader2 size={18} className="shrink-0 animate-spin text-[var(--primary)]" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                  {t("Mengimpor laporan")}
                </p>
                <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                  {importFileName || t("Berkas")}
                </p>
              </div>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(importProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={importPhaseLabel}
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]/60"
            >
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(importProgress)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                {importPhaseLabel}
              </p>
              <p className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--muted-foreground)]">
                {Math.round(importProgress)}%
              </p>
            </div>
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-[var(--muted-foreground)]/70">
              {t("PDF besar bisa memakan waktu puluhan detik. Jangan tutup halaman ini.")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
