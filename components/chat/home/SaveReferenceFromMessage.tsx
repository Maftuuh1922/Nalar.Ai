"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, Check, Loader2, X } from "lucide-react";

import {
  listJournalGroups,
  saveReferenceFromUrl,
  type JournalGroup,
} from "@/lib/journal-api";

/**
 * "Simpan ke Referensi" — tombol di bawah pesan AI yang berisi link.
 *
 * Mendeteksi URL jurnal di konten pesan; user bisa menyimpan link tersebut
 * ke grup laporan (default grup pertama). Metadata diekstrak AI di backend,
 * referensi masuk ke halaman Referensi Jurnal ("Referensi Chat" bila belum
 * ada grup).
 */

const URL_RE = /https?:\/\/[^\s<>"']+/g;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(URL_RE) ?? [])).slice(0, 5);
}

export default function SaveReferenceFromMessage({
  content,
}: {
  content: string;
}) {
  const { t } = useTranslation();
  const urls = useMemo(() => extractUrls(content), [content]);
  const [groups, setGroups] = useState<JournalGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (urls.length === 0) return;
    listJournalGroups()
      .then((data) => {
        setGroups(data);
        if (data.length > 0) setGroupId(data[0].id);
      })
      .catch(() => setGroups([]));
  }, [urls.length]);

  if (urls.length === 0 || dismissed) return null;

  const save = async (url: string) => {
    if (!groupId) {
      setError(t("Buat grup laporan dulu di menu Referensi Jurnal."));
      return;
    }
    setSavingUrl(url);
    setError("");
    try {
      await saveReferenceFromUrl({ url, group_id: groupId });
      setSavedUrls((prev) => new Set(prev).add(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUrl(null);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)]/70 bg-[var(--card)]/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
          <BookMarked size={12} className="text-[var(--primary)]" />
          {t("Simpan ke Referensi Jurnal")}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-transparent px-1.5 py-1 text-[11px] text-[var(--foreground)] outline-none"
          >
            {groups.length === 0 ? (
              <option value="">{t("Belum ada grup")}</option>
            ) : (
              groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-[var(--muted-foreground)]/60 hover:bg-[var(--muted)]"
            title={t("Tutup")}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {urls.map((url) => (
          <div
            key={url}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)]/50 px-2 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted-foreground)]">
              {url}
            </span>
            {savedUrls.has(url) ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check size={11} />
                {t("Tersimpan")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void save(url)}
                disabled={savingUrl === url}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--primary)]/10 px-2 py-1 text-[10.5px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 disabled:opacity-50"
              >
                {savingUrl === url ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <BookMarked size={11} />
                )}
                {t("Simpan")}
              </button>
            )}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-2 rounded-md border border-rose-300/30 bg-rose-50/40 px-2 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
