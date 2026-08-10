"use client";

import {
  Braces,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CoWriterFile } from "@/lib/co-writer-api";

interface FileTreeProps {
  files: CoWriterFile[];
  activePath: string;
  loading?: boolean;
  busy?: boolean;
  onSelect: (path: string) => void | Promise<void>;
  onCreate: (path: string) => void | Promise<void>;
  onRename: (from: string, to: string) => void | Promise<void>;
  onDelete: (path: string) => void | Promise<void>;
  onSplit: () => void | Promise<void>;
  onCollapse: () => void;
}

type DialogState =
  | { mode: "create"; value: string }
  | { mode: "rename"; path: string; value: string }
  | { mode: "delete"; path: string }
  | { mode: "split" }
  | null;

type ContextState = {
  path: string;
  x: number;
  y: number;
  readOnly: boolean;
} | null;

const MAIN_FILE = "main.tex";
const REFERENCES_FILE = "references.bib";

function namaBerkas(path: string): string {
  return path.split("/").pop() || path;
}

function FileIcon({ path, size = 14 }: { path: string; size?: number }) {
  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/.test(lower)) {
    return <ImageIcon size={size} className="shrink-0 text-emerald-500" />;
  }
  if (lower.endsWith(".bib")) {
    return <Braces size={size} className="shrink-0 text-amber-500" />;
  }
  if (lower.endsWith(".tex")) {
    return <FileCode2 size={size} className="shrink-0 text-sky-500" />;
  }
  return <FileText size={size} className="shrink-0 text-[var(--muted-foreground)]" />;
}

export default function FileTree({
  files,
  activePath,
  loading = false,
  busy = false,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSplit,
  onCollapse,
}: FileTreeProps) {
  const { t } = useTranslation();
  const [openFolders, setOpenFolders] = useState(() => new Set(["bab", "gambar"]));
  const [context, setContext] = useState<ContextState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [submitting, setSubmitting] = useState(false);

  const bab = useMemo(
    () => files.filter((file) => file.path.startsWith("bab/")),
    [files],
  );
  const gambar = useMemo(
    () => files.filter((file) => file.path.startsWith("gambar/")),
    [files],
  );
  const references = files.find((file) => file.path === REFERENCES_FILE);
  const akarLain = useMemo(
    () =>
      files.filter(
        (file) =>
          !file.path.includes("/") && file.path !== REFERENCES_FILE,
      ),
    [files],
  );
  const canSplit = bab.length === 0;

  useEffect(() => {
    const close = () => setContext(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const toggleFolder = (folder: string) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const openContext = (
    event: React.MouseEvent,
    file: Pick<CoWriterFile, "path" | "read_only">,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContext({
      path: file.path,
      x: Math.min(event.clientX, window.innerWidth - 176),
      y: Math.min(event.clientY, window.innerHeight - 120),
      readOnly: Boolean(file.read_only || file.path.startsWith("gambar/")),
    });
  };

  const selectFile = (file: CoWriterFile) => {
    if (file.read_only || file.path.startsWith("gambar/")) {
      if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }
    void onSelect(file.path);
  };

  const runDialogAction = async () => {
    if (!dialog || submitting) return;
    setSubmitting(true);
    try {
      if (dialog.mode === "create") {
        const path = dialog.value.trim();
        if (!path) return;
        await onCreate(path);
      } else if (dialog.mode === "rename") {
        const path = dialog.value.trim();
        if (!path) return;
        await onRename(dialog.path, path);
      } else if (dialog.mode === "delete") {
        await onDelete(dialog.path);
      } else {
        await onSplit();
      }
      setDialog(null);
    } catch {
      // Parent menampilkan galat API pada bar status Co-Writer.
    } finally {
      setSubmitting(false);
    }
  };

  const renderFile = (file: CoWriterFile, nested = false) => {
    const active = activePath === file.path;
    const readOnly = Boolean(file.read_only || file.path.startsWith("gambar/"));
    return (
      <div
        key={file.path}
        onContextMenu={(event) => openContext(event, file)}
        className="group relative"
      >
        <button
          type="button"
          onClick={() => selectFile(file)}
          className={`flex h-7 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-[11.5px] transition-colors ${
            nested ? "pl-7" : "pl-2"
          } ${
            active
              ? "bg-[var(--primary)]/12 text-[var(--primary)]"
              : "text-[var(--foreground)] hover:bg-[var(--muted)]/55"
          }`}
          title={file.path}
        >
          <FileIcon path={file.path} />
          <span className="min-w-0 flex-1 truncate">{namaBerkas(file.path)}</span>
          {readOnly ? (
            <span className="text-[9px] uppercase text-[var(--muted-foreground)]">
              {t("Read only")}
            </span>
          ) : null}
        </button>
        {!readOnly ? (
          <button
            type="button"
            onClick={(event) => openContext(event, file)}
            title={t("File actions")}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--muted)] group-hover:opacity-100 focus:opacity-100"
          >
            <MoreHorizontal size={13} />
          </button>
        ) : null}
      </div>
    );
  };

  const renderFolder = (name: "bab" | "gambar", entries: CoWriterFile[]) => {
    const open = openFolders.has(name);
    return (
      <div key={name}>
        <button
          type="button"
          onClick={() => toggleFolder(name)}
          className="flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-left text-[11.5px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]/55"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {open ? (
            <FolderOpen size={14} className="text-amber-500" />
          ) : (
            <Folder size={14} className="text-amber-500" />
          )}
          <span className="min-w-0 flex-1 truncate">{name}/</span>
          <span className="text-[10px] font-normal text-[var(--muted-foreground)]">
            {entries.length}
          </span>
        </button>
        {open ? entries.map((file) => renderFile(file, true)) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[var(--foreground)]">
          {t("Berkas")}
        </span>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create", value: "bab/bab-baru.tex" })}
          disabled={busy}
          title={t("Berkas baru")}
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          title={t("Tutup panel berkas")}
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {canSplit ? (
        <div className="shrink-0 border-b border-[var(--border)] p-2">
          <button
            type="button"
            onClick={() => setDialog({ mode: "split" })}
            disabled={busy || loading}
            className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded border border-[var(--border)] bg-[var(--muted)]/25 px-2 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/60 disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
            {t("Pecah per Bab")}
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <button
          type="button"
          onClick={() => void onSelect(MAIN_FILE)}
          className={`flex h-7 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-[11.5px] transition-colors ${
            activePath === MAIN_FILE
              ? "bg-[var(--primary)]/12 text-[var(--primary)]"
              : "text-[var(--foreground)] hover:bg-[var(--muted)]/55"
          }`}
        >
          <FileCode2 size={14} className="shrink-0 text-sky-500" />
          <span className="truncate">{MAIN_FILE}</span>
        </button>

        {renderFolder("bab", bab)}
        {renderFolder("gambar", gambar)}
        {akarLain.map((file) => renderFile(file))}

        {references ? (
          renderFile(references)
        ) : (
          <button
            type="button"
            onClick={() => {
              void Promise.resolve(onCreate(REFERENCES_FILE)).catch(() => {});
            }}
            className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[11.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)]"
          >
            <Braces size={14} className="text-amber-500" />
            <span className="truncate">{REFERENCES_FILE}</span>
          </button>
        )}

        {loading ? (
          <div className="flex items-center gap-2 px-2 py-2 text-[10.5px] text-[var(--muted-foreground)]">
            <Loader2 size={12} className="animate-spin" />
            {t("Memuat berkas...")}
          </div>
        ) : null}
      </div>

      {context ? (
        <>
          <button
            type="button"
            aria-label={t("Close menu")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setContext(null)}
          />
          <div
            className="fixed z-50 w-40 rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg"
            style={{ left: context.x, top: context.y }}
          >
            {!context.readOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDialog({
                      mode: "rename",
                      path: context.path,
                      value: context.path,
                    });
                    setContext(null);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <FileText size={13} />
                  {t("Ganti nama")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDialog({ mode: "delete", path: context.path });
                    setContext(null);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                >
                  <Trash2 size={13} />
                  {t("Hapus")}
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {dialog ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--popover)] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {dialog.mode === "create"
                  ? t("Berkas baru")
                  : dialog.mode === "rename"
                    ? t("Ganti nama berkas")
                    : dialog.mode === "delete"
                      ? t("Hapus berkas")
                      : t("Pecah per Bab")}
              </h2>
              <button
                type="button"
                onClick={() => setDialog(null)}
                title={t("Tutup")}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <X size={14} />
              </button>
            </div>

            {dialog.mode === "create" || dialog.mode === "rename" ? (
              <input
                autoFocus
                value={dialog.value}
                onChange={(event) =>
                  setDialog({ ...dialog, value: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runDialogAction();
                  if (event.key === "Escape") setDialog(null);
                }}
                spellCheck={false}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
            ) : (
              <p className="text-[12.5px] leading-5 text-[var(--muted-foreground)]">
                {dialog.mode === "delete"
                  ? t("Berkas {{name}} akan dihapus dari proyek.", {
                      name: namaBerkas(dialog.path),
                    })
                  : t(
                      "Main.tex akan diganti menjadi preamble dan daftar input. Isi saat ini disimpan sebagai checkpoint terlebih dahulu.",
                    )}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="h-8 rounded-md px-3 text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                {t("Batal")}
              </button>
              <button
                type="button"
                onClick={() => void runDialogAction()}
                disabled={submitting}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-50 ${
                  dialog.mode === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[var(--primary)] hover:opacity-90"
                }`}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
                {dialog.mode === "create"
                  ? t("Buat")
                  : dialog.mode === "rename"
                    ? t("Simpan")
                    : dialog.mode === "delete"
                      ? t("Hapus")
                      : t("Pecah")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
