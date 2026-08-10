"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";

import {
  listJournalReferences,
  type JournalReference,
} from "@/lib/journal-api";

/**
 * Quick-insert sitasi via trigger `[[` (PRD v2.4 §4).
 *
 * Saat user mengetik `[[` di editor, popup muncul dengan search box + daftar
 * referensi grup aktif. Pilih → sitasi tersisip di kursor, `[[` dihapus.
 */

interface QuickCitePopupProps {
  /** Grup laporan aktif (untuk ambil referensi). */
  groupId: string | null;
  /** Posisi kursor (untuk menempatkan popup). */
  anchor: { top: number; left: number } | null;
  /** Terpilih: sisipkan teks sitasi. */
  onSelect: (citation: string) => void;
  /** Batal (Esc / klik luar). */
  onClose: () => void;
}

type NumberedReference = JournalReference & { citationNumber: number };

export default function QuickCitePopup({
  groupId,
  anchor,
  onSelect,
  onClose,
}: QuickCitePopupProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [referenceState, setReferenceState] = useState<{
    groupId: string | null;
    refs: NumberedReference[];
  }>({ groupId: null, refs: [] });
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void Promise.all([listJournalReferences(groupId), listJournalReferences()])
      .then(([groupRefs, allRefs]) => {
        const ordered = [...allRefs].sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
        );
        const numberById = new Map(ordered.map((ref, index) => [ref.id, index + 1]));
        const refs = groupRefs.map((ref) => ({
          ...ref,
          citationNumber: numberById.get(ref.id) ?? 0,
        }));
        if (!cancelled) setReferenceState({ groupId, refs });
      })
      .catch(() => {
        if (!cancelled) setReferenceState({ groupId, refs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refs = useMemo(
    () => (referenceState.groupId === groupId ? referenceState.refs : []),
    [groupId, referenceState],
  );
  const loading = Boolean(groupId && referenceState.groupId !== groupId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return refs;
    return refs.filter(
      (r) =>
        `${r.title} ${(r.authors ?? []).join(" ")} ${r.year ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [refs, query]);
  const resolvedActiveIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1));
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const popupLeft = Math.max(
    8,
    Math.min((anchor?.left ?? 0) - 16, viewportWidth - 328),
  );
  const popupTop = Math.max(
    8,
    Math.min((anchor?.top ?? 0) + 8, viewportHeight - 352),
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[resolvedActiveIdx];
        if (item) onSelect(formatCitation(item));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, resolvedActiveIdx, onSelect, onClose],
  );

  return (
    <div
      className="dt-popup-up fixed z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--popover)] shadow-xl backdrop-blur-md"
      style={{
        top: popupTop,
        left: popupLeft,
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Search size={13} className="shrink-0 text-[var(--muted-foreground)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("Cari referensi (judul/penulis)…")}
          className="w-full bg-transparent text-[12.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      {/* Daftar referensi */}
      <div className="max-h-64 overflow-y-auto p-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-[var(--muted-foreground)]">
            <Loader2 size={13} className="animate-spin" />
            {t("Memuat…")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11.5px] text-[var(--muted-foreground)]">
            {groupId
              ? t("Tidak ada referensi cocok.")
              : t("Pilih grup laporan dulu di panel Referensi.")}
          </div>
        ) : (
          filtered.map((ref, idx) => (
            <button
              key={ref.id}
              type="button"
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => onSelect(formatCitation(ref))}
              className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                idx === resolvedActiveIdx
                  ? "bg-[var(--primary)]/[0.1] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-[var(--foreground)]">
                  {ref.citationNumber > 0 ? `[${ref.citationNumber}] ` : ""}
                  {ref.title || ref.filename}
                </div>
                <div className="truncate text-[10.5px]">
                  {ref.authors?.[0] ?? ""}
                  {ref.year ? ` (${ref.year})` : ""}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)]/70">
        {t("Use arrow keys to choose, Enter to insert, or Escape to cancel")}
      </div>
    </div>
  );
}

/** Format sitasi cepat: [n] judul (tahun) — format lengkap via panel. */
function formatCitation(ref: NumberedReference): string {
  if (ref.citationNumber > 0) return `[${ref.citationNumber}]`;
  return `[${ref.title ?? ref.filename}]`;
}
