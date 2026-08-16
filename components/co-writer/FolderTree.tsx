"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers,
  MoreHorizontal,
  PenLine,
  Palette,
  Trash2,
} from "lucide-react";
import type { CoWriterFolder } from "@/lib/co-writer-api";

/** `null` = semua draf, `"root"` = draf yang belum dikelompokkan. */
export type FolderSelection = string | null;

export const ROOT_SELECTION = "root";

/** Preset warna aksen folder. */
const COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

interface FolderTreeProps {
  folders: CoWriterFolder[];
  selectedId: FolderSelection;
  /** Jumlah seluruh draf. */
  totalCount: number;
  /** Jumlah draf yang belum masuk folder mana pun. */
  rootCount: number;
  onSelect: (id: FolderSelection) => void;
  onCreate: (name: string, parentId: string | null) => Promise<unknown>;
  onUpdate: (
    id: string,
    patch: { name?: string; color?: string | null },
  ) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  /** Dipanggil saat kartu draf dilepas di atas sebuah baris. */
  onDropDocument: (docId: string, folderId: string | null) => void;
  className?: string;
}

export default function FolderTree({
  folders,
  selectedId,
  totalCount,
  rootCount,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onDropDocument,
  className = "",
}: FolderTreeProps) {
  const { t } = useTranslation();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Induk untuk folder yang sedang dibuat: `undefined` = form tertutup,
  // `null` = folder akar baru.
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(
    undefined,
  );
  const [newName, setNewName] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(
    undefined,
  );

  /** Anak per induk, sekali hitung — menghindari filter berulang saat rekursi. */
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, CoWriterFolder[]>();
    for (const f of folders) {
      const key = f.parent_id ?? null;
      const list = map.get(key);
      if (list) list.push(f);
      else map.set(key, [f]);
    }
    return map;
  }, [folders]);

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    const parent = creatingUnder;
    if (!name || parent === undefined) {
      setCreatingUnder(undefined);
      setNewName("");
      return;
    }
    setCreatingUnder(undefined);
    setNewName("");
    await onCreate(name, parent);
    // Induknya dibuka supaya folder baru langsung terlihat.
    if (parent) setOpenIds((prev) => new Set(prev).add(parent));
  }, [creatingUnder, newName, onCreate]);

  const submitRename = useCallback(
    async (id: string) => {
      const name = renameValue.trim();
      setRenamingId(null);
      if (name) await onUpdate(id, { name });
    },
    [onUpdate, renameValue],
  );

  /** Baris "Semua dokumen" / "Tanpa folder" — target drop juga. */
  const renderFixedRow = (
    key: FolderSelection,
    icon: React.ReactNode,
    label: string,
    count: number,
  ) => {
    const active = selectedId === key;
    const hovered = dropTarget === (key ?? null) && key !== null;
    return (
      <button
        type="button"
        onClick={() => onSelect(key)}
        onDragOver={
          key === ROOT_SELECTION
            ? (e) => {
                // Tanpa preventDefault browser menolak drop.
                e.preventDefault();
                setDropTarget(ROOT_SELECTION);
              }
            : undefined
        }
        onDragLeave={key === ROOT_SELECTION ? () => setDropTarget(undefined) : undefined}
        onDrop={
          key === ROOT_SELECTION
            ? (e) => {
                e.preventDefault();
                setDropTarget(undefined);
                const docId = e.dataTransfer.getData("text/plain");
                if (docId) onDropDocument(docId, null);
              }
            : undefined
        }
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${
          active
            ? "bg-[var(--muted)] font-medium text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
        } ${hovered ? "ring-1 ring-[var(--primary)]" : ""}`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--muted-foreground)]/70">
          {count}
        </span>
      </button>
    );
  };
  const renderFolder = (folder: CoWriterFolder, depth: number): React.ReactNode => {
    const kids = childrenOf.get(folder.id) ?? [];
    const open = openIds.has(folder.id);
    const active = selectedId === folder.id;
    const hovered = dropTarget === folder.id;
    const isRenaming = renamingId === folder.id;
    const menuOpen = menuId === folder.id;
    const accent = folder.color || undefined;

    return (
      <div key={folder.id}>
        <div
          className={`group/row relative flex items-center gap-1 rounded-lg pr-1 transition-colors ${
            active
              ? "bg-[var(--muted)]"
              : hovered
                ? "bg-[var(--muted)]/40"
                : "hover:bg-[var(--muted)]/50"
          } ${hovered ? "ring-1 ring-[var(--primary)]" : ""}`}
          style={{ paddingLeft: `${depth * 12}px` }}
          onDragOver={(e) => {
            // preventDefault wajib: tanpa ini drop tidak pernah diterima.
            e.preventDefault();
            setDropTarget(folder.id);
          }}
          onDragLeave={() => setDropTarget((prev) => (prev === folder.id ? undefined : prev))}
          onDrop={(e) => {
            e.preventDefault();
            setDropTarget(undefined);
            const docId = e.dataTransfer.getData("text/plain");
            if (docId) onDropDocument(docId, folder.id);
          }}
        >
          <button
            type="button"
            onClick={() => kids.length > 0 && toggle(folder.id)}
            aria-label={open ? t("Tutup folder") : t("Buka folder")}
            className={`shrink-0 rounded p-0.5 text-[var(--muted-foreground)] ${
              kids.length > 0 ? "hover:text-[var(--foreground)]" : "invisible"
            }`}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void submitRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename(folder.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="my-1 min-w-0 flex-1 rounded border border-[var(--ring)] bg-transparent px-1 py-0.5 text-[12px] text-[var(--foreground)] outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelect(folder.id)}
              title={folder.name}
              className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[12px] ${
                active
                  ? "font-medium text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {open && kids.length > 0 ? (
                <FolderOpen size={13} className="shrink-0" style={{ color: accent }} />
              ) : (
                <Folder size={13} className="shrink-0" style={{ color: accent }} />
              )}
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--muted-foreground)]/70">
                {folder.document_count}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuId(menuOpen ? null : folder.id);
              setPaletteId(null);
              setPendingDeleteId(null);
            }}
            title={t("Aksi")}
            className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)]/60 opacity-0 transition-opacity hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus:opacity-100 group-hover/row:opacity-100"
          >
            <MoreHorizontal size={13} />
          </button>

          {menuOpen ? (
            <div
              className="absolute right-1 top-full z-30 mt-0.5 w-44 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setRenamingId(folder.id);
                  setRenameValue(folder.name);
                  setMenuId(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <PenLine size={12} /> {t("Rename")}
              </button>
              <button
                type="button"
                onClick={() => setPaletteId(paletteId === folder.id ? null : folder.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <Palette size={12} /> {t("Ubah warna")}
              </button>
              {paletteId === folder.id ? (
                <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => {
                        void onUpdate(folder.id, { color: c });
                        setMenuId(null);
                        setPaletteId(null);
                      }}
                      className="h-4 w-4 rounded-full ring-offset-1 ring-offset-[var(--popover)] hover:ring-1 hover:ring-[var(--ring)]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      void onUpdate(folder.id, { color: null });
                      setMenuId(null);
                      setPaletteId(null);
                    }}
                    className="rounded px-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {t("Reset")}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCreatingUnder(folder.id);
                  setNewName("");
                  setOpenIds((prev) => new Set(prev).add(folder.id));
                  setMenuId(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]/40"
              >
                <FolderPlus size={12} /> {t("Folder baru di dalam")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDeleteId === folder.id) {
                    void onDelete(folder.id);
                    setMenuId(null);
                    setPendingDeleteId(null);
                  } else {
                    setPendingDeleteId(folder.id);
                  }
                }}
                title={t("Isi folder dipindahkan ke folder induk, tidak ikut terhapus.")}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-rose-500 hover:bg-[var(--muted)]/40 hover:text-rose-600"
              >
                <Trash2 size={12} />
                {pendingDeleteId === folder.id ? t("Konfirmasi hapus") : t("Hapus folder")}
              </button>
            </div>
          ) : null}
        </div>

        {creatingUnder === folder.id ? (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }} className="py-1 pr-1">
            <input
              autoFocus
              value={newName}
              placeholder={t("Nama folder")}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => void submitCreate()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCreate();
                if (e.key === "Escape") {
                  setCreatingUnder(undefined);
                  setNewName("");
                }
              }}
              className="w-full rounded border border-[var(--ring)] bg-transparent px-1.5 py-1 text-[12px] text-[var(--foreground)] outline-none"
            />
          </div>
        ) : null}

        {open && kids.length > 0
          ? kids.map((child) => renderFolder(child, depth + 1))
          : null}
      </div>
    );
  };

  const roots = childrenOf.get(null) ?? [];

  return (
    <aside
      className={`flex flex-col gap-1 ${className}`}
      onClick={() => {
        if (menuId) {
          setMenuId(null);
          setPaletteId(null);
          setPendingDeleteId(null);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/80">
          {t("Folder")}
        </span>
        <button
          type="button"
          onClick={() => {
            setCreatingUnder(null);
            setNewName("");
          }}
          title={t("Folder baru")}
          className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <FolderPlus size={13} />
        </button>
      </div>

      {renderFixedRow(null, <Layers size={13} />, t("Semua dokumen"), totalCount)}
      {renderFixedRow(ROOT_SELECTION, <Inbox size={13} />, t("Tanpa folder"), rootCount)}

      <div className="my-1 h-px bg-[var(--border)]" />

      {creatingUnder === null ? (
        <div className="px-1 pb-1">
          <input
            autoFocus
            value={newName}
            placeholder={t("Nama folder")}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void submitCreate()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitCreate();
              if (e.key === "Escape") {
                setCreatingUnder(undefined);
                setNewName("");
              }
            }}
            className="w-full rounded border border-[var(--ring)] bg-transparent px-1.5 py-1 text-[12px] text-[var(--foreground)] outline-none"
          />
        </div>
      ) : null}

      {roots.length === 0 && creatingUnder === undefined ? (
        <p className="px-2 py-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]/70">
          {t("Belum ada folder. Buat folder untuk mengelompokkan draf.")}
        </p>
      ) : (
        roots.map((folder) => renderFolder(folder, 0))
      )}
    </aside>
  );
}
