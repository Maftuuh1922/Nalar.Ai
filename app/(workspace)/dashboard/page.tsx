"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookMarked,
  FileText,
  Loader2,
  PenLine,
  TrendingUp,
} from "lucide-react";

import { apiFetch, apiUrl } from "@/lib/api";

interface SectionStatus {
  heading: string;
  status: string;
  chars: number;
}

interface DashboardData {
  active_doc: { id: string; title: string; updated_at: number } | null;
  sections: SectionStatus[];
  group_summaries: Array<{ id: string; name: string; count: number }>;
  total_references: number;
}

const STATUS_STYLES: Record<string, string> = {
  Kosong: "bg-[var(--muted)]/60 text-[var(--muted-foreground)]",
  Draft: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Review: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  Final: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(apiUrl("/api/v1/dashboard"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[var(--muted-foreground)]">
        <Loader2 size={16} className="animate-spin" />
        {t("Memuat dashboard…")}
      </div>
    );
  }

  const activeDoc = data?.active_doc ?? null;
  const sections = data?.sections ?? [];
  const groups = data?.group_summaries ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ── Hero branding (PRD branding: logo NALAR AI) ── */}
        <div className="relative mb-7 h-[180px] overflow-hidden rounded-2xl border border-[var(--border)] md:h-[210px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/nalar-ai-hero.jpg"
            alt="NALAR AI"
            className="h-full w-full object-cover object-center"
          />
          {/* Gradient overlay halus ke background agar transisi mulus */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/20 to-transparent" />
        </div>

        <header className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            {t("Dashboard")}
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
            {t("Progres penulisan jurnal, referensi, dan pintasan lanjut menulis.")}
          </p>
        </header>

        {error ? (
          <div className="mb-5 rounded-lg border border-rose-300/30 bg-rose-50/40 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* Shortcut lanjut menulis */}
        <div className="mb-6">
          {activeDoc ? (
            <button
              type="button"
              onClick={() => router.push(`/co-writer/${activeDoc.id}`)}
              className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/[0.07] to-transparent px-5 py-4 text-left transition-colors hover:border-[var(--primary)]/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                  <PenLine size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[var(--foreground)]">
                    {t("Lanjutkan menulis")}
                  </div>
                  <div className="truncate text-[12px] text-[var(--muted-foreground)]">
                    {activeDoc.title}
                  </div>
                </div>
              </div>
              <ArrowRight
                size={16}
                className="shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/co-writer")}
              className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--border)] px-5 py-4 text-left transition-colors hover:border-[var(--primary)]/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)]">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--foreground)]">
                    {t("Mulai draf pertama")}
                  </div>
                  <div className="text-[12px] text-[var(--muted-foreground)]">
                    {t("Buka Co-Writer dan buat draf jurnal baru.")}
                  </div>
                </div>
              </div>
              <ArrowRight size={16} className="text-[var(--muted-foreground)]" />
            </button>
          )}
        </div>

        {/* Ringkasan referensi */}
        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-foreground)]">
              <BookMarked size={14} className="text-[var(--primary)]" />
              {t("Referensi")}
            </div>
            <div className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--foreground)]">
              {data?.total_references ?? 0}
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--muted-foreground)]">
              {t("jurnal dari semua grup laporan")}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-foreground)]">
              <TrendingUp size={14} className="text-emerald-500" />
              {t("Grup laporan")}
            </div>
            <div className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--foreground)]">
              {groups.length}
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--muted-foreground)]">
              {groups.length > 0
                ? groups.map((g) => `${g.name} (${g.count})`).join(" · ")
                : t("Belum ada grup")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/space?tab=referensi")}
            className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-left transition-colors hover:border-[var(--primary)]/40"
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-foreground)]">
              <BookMarked size={14} className="text-[var(--primary)]" />
              {t("Kelola referensi")}
            </div>
            <div className="mt-2 flex items-center gap-1 text-[13px] font-medium text-[var(--primary)]">
              {t("Buka Learning Space")}
              <ArrowRight size={13} />
            </div>
          </button>
        </div>

        {/* Progres bab */}
        <div>
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--foreground)]">
            {t("Progres bab")}
            {activeDoc ? ` — ${activeDoc.title}` : ""}
          </h2>
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12.5px] text-[var(--muted-foreground)]">
              {t("Dokumen aktif belum punya heading. Mulai tulis dengan struktur bab di Co-Writer.")}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              {sections.map((section, idx) => (
                <div
                  key={`${section.heading}-${idx}`}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    idx > 0 ? "border-t border-[var(--border)]/70" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                      {section.heading.replace(/^#{1,3}\s*/, "")}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {section.chars.toLocaleString()} {t("karakter")}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLES[section.status] ?? STATUS_STYLES.Kosong
                    }`}
                  >
                    {section.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
