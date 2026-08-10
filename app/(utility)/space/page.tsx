"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BookMarked,
  BookOpen,
  ChevronRight,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Search,
  Send,
} from "lucide-react";

import { apiFetch, apiUrl } from "@/lib/api";
import { listJournalGroups, listJournalReferences, type JournalGroup, type JournalReference } from "@/lib/journal-api";
import { listCoWriterDocuments, type CoWriterDocumentSummary } from "@/lib/co-writer-api";
import { listSessions, type SessionSummary } from "@/lib/session-api";
import { useRouter } from "next/navigation";

type TabKey = "chat" | "referensi" | "draf";

const TABS: Array<{ key: TabKey; label: string; icon: typeof History }> = [
  { key: "chat", label: "Chat", icon: History },
  { key: "referensi", label: "Referensi", icon: BookMarked },
  { key: "draf", label: "Draf", icon: FileText },
];

/** Ikon kontekstual per sesi berdasarkan konten (default netral). */
function sessionIcon(session: SessionSummary) {
  const haystack = `${session.title} ${session.last_message ?? ""}`.toLowerCase();
  if (/(jurnal|referensi|paper|arxiv|sitasi|cite|doi|literatur)/.test(haystack)) {
    return <BookOpen size={15} />;
  }
  if (/(cari|search|tentang|apa|bagaimana|jelaskan|ringkas)/.test(haystack)) {
    return <Send size={15} />;
  }
  return <MessageCircle size={15} />;
}

/** Preview 1 baris: pesan terakhir atau judul, potong ~60 karakter. */
function sessionPreview(session: SessionSummary): string {
  const raw = session.last_message?.trim() || session.title;
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
}

/** Waktu relatif: "baru saja", "2 jam lalu", dst. */
function relativeTime(epochSec: number | undefined): string {
  if (!epochSec) return "";
  const diffMs = Date.now() - epochSec * 1000;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "kemarin";
  if (days < 7) return `${days} hari lalu`;
  return new Date(epochSec * 1000).toLocaleDateString();
}

/** Kelompokkan sesi berdasarkan rentang waktu. */
function groupSessions(sessions: SessionSummary[]) {
  const now = Date.now();
  const groups: Array<{ key: string; label: string; sessions: SessionSummary[] }> = [
    { key: "today", label: "Hari ini", sessions: [] },
    { key: "yesterday", label: "Kemarin", sessions: [] },
    { key: "week", label: "7 hari terakhir", sessions: [] },
    { key: "month", label: "30 hari terakhir", sessions: [] },
    { key: "older", label: "Lebih lama", sessions: [] },
  ];
  for (const session of sessions) {
    const t = (session.updated_at ?? session.created_at ?? 0) * 1000;
    const days = (now - t) / 86_400_000;
    if (days < 1) groups[0].sessions.push(session);
    else if (days < 2) groups[1].sessions.push(session);
    else if (days < 7) groups[2].sessions.push(session);
    else if (days < 30) groups[3].sessions.push(session);
    else groups[4].sessions.push(session);
  }
  for (const g of groups) {
    g.sessions.sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
  }
  return groups.filter((g) => g.sessions.length > 0);
}

function SpaceHubInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(
    requestedTab === "referensi" || requestedTab === "draf" ? requestedTab : "chat",
  );

  // Data per tab (load lazily saat tab aktif)
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [chatSearch, setChatSearch] = useState("");
    const [groups, setGroups] = useState<JournalGroup[]>([]);
    const [references, setReferences] = useState<Record<string, JournalReference[]>>({});
    const [drafts, setDrafts] = useState<CoWriterDocumentSummary[]>([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [loadingRef, setLoadingRef] = useState(false);
    const [loadingDraft, setLoadingDraft] = useState(false);

    // Filter sesi chat real-time: judul + pesan terakhir.
    const chatGroups = useMemo(() => {
      const q = chatSearch.trim().toLowerCase();
      const filtered = !q
        ? sessions
        : sessions.filter((s) =>
            `${s.title} ${s.last_message ?? ""}`.toLowerCase().includes(q),
          );
      return groupSessions(filtered);
    }, [sessions, chatSearch]);

  const loadChat = useCallback(async () => {
    setLoadingChat(true);
    try {
      setSessions(await listSessions(50, 0, { force: true }));
    } catch {
      /* abaikan */
    } finally {
      setLoadingChat(false);
    }
  }, []);

  const loadReferences = useCallback(async () => {
    setLoadingRef(true);
    try {
      const gs = await listJournalGroups();
      setGroups(gs);
      const perGroup: Record<string, JournalReference[]> = {};
      for (const g of gs) {
        perGroup[g.id] = await listJournalReferences(g.id);
      }
      setReferences(perGroup);
    } catch {
      /* abaikan */
    } finally {
      setLoadingRef(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setLoadingDraft(true);
    try {
      setDrafts(await listCoWriterDocuments());
    } catch {
      /* abaikan */
    } finally {
      setLoadingDraft(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "chat" && sessions.length === 0) void loadChat();
    if (tab === "referensi" && groups.length === 0) void loadReferences();
    if (tab === "draf" && drafts.length === 0) void loadDrafts();
  }, [tab, sessions.length, groups.length, drafts.length, loadChat, loadReferences, loadDrafts]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] [scrollbar-gutter:stable]">
      <div className="mx-auto max-w-6xl px-6 py-8 pb-16 md:px-10">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            {t("Learning Space")}
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
            {t("Histori chat, referensi jurnal, dan draf dalam satu tempat.")}
          </p>
        </header>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors ${
                tab === key
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={14} />
              {t(label)}
            </button>
          ))}
        </div>

        {/* ── Tab Chat ── */}
                {tab === "chat" && (
                  <div>
                    {/* Search bar */}
                    <div className="relative mb-4">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder={t("Cari percakapan…")}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-[12.5px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                      />
                    </div>

                    {loadingChat ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[var(--muted-foreground)]">
                        <Loader2 size={15} className="animate-spin" />
                        {t("Memuat…")}
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[12.5px] text-[var(--muted-foreground)]">
                        {t("Belum ada sesi chat.")}
                      </div>
                    ) : chatGroups.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[12.5px] text-[var(--muted-foreground)]">
                        {t("Tidak ditemukan percakapan yang cocok.")}
                        <div className="mt-1 text-[11px] opacity-70">
                          {t("Coba kata kunci lain.")}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {chatGroups.map((group) => (
                          <div key={group.key}>
                            <h3 className="mb-2 px-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                              {t(group.label)}
                              <span className="ml-1.5 font-normal text-[var(--muted-foreground)]/60">
                                {group.sessions.length}
                              </span>
                            </h3>
                            <div className="space-y-2">
                              {group.sessions.map((session) => (
                                <button
                                  key={session.session_id}
                                  type="button"
                                  onClick={() => router.push(`/home/${session.session_id}`)}
                                  className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border)]/70 px-4 py-3 text-left transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]/30"
                                >
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/50 text-[var(--muted-foreground)]">
                                    {sessionIcon(session)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                                      {session.title}
                                    </div>
                                    <div className="mt-0.5 truncate text-[11.5px] text-[var(--muted-foreground)]">
                                      {sessionPreview(session)}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-[var(--muted-foreground)]/70">
                                      <span>{session.message_count} {t("pesan")}</span>
                                      <span className="opacity-50">·</span>
                                      <span>{relativeTime(session.updated_at)}</span>
                                    </div>
                                  </div>
                                  <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]/60 transition-transform group-hover:translate-x-0.5" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

        {/* ── Tab Referensi ── */}
        {tab === "referensi" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {t("Jurnal per grup laporan")}
              </h2>
              <button
                type="button"
                onClick={() => router.push("/references")}
                className="text-[12px] font-medium text-[var(--primary)] hover:underline"
              >
                {t("Kelola referensi")} →
              </button>
            </div>
            {loadingRef ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[var(--muted-foreground)]">
                <Loader2 size={15} className="animate-spin" />
                {t("Memuat…")}
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[12.5px] text-[var(--muted-foreground)]">
                {t("Belum ada grup laporan. Buat grup dan upload jurnal di menu Referensi Jurnal.")}
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const refs = references[group.id] ?? [];
                  return (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-[var(--border)]/70 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[13.5px] font-semibold text-[var(--foreground)]">
                          {group.name}
                        </div>
                        <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
                          {refs.length} jurnal
                        </span>
                      </div>
                      {refs.length === 0 ? (
                        <div className="text-[12px] text-[var(--muted-foreground)]">
                          {t("Belum ada jurnal di grup ini.")}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {refs.map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[var(--muted)]/30 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-[12.5px] font-medium text-[var(--foreground)]">
                                  {ref.title || ref.filename}
                                </div>
                                <div className="truncate text-[11px] text-[var(--muted-foreground)]">
                                  {ref.authors?.[0] ?? ""}
                                  {ref.year ? ` (${ref.year})` : ""}
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  ref.status === "extracted"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : ref.status === "failed"
                                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {ref.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Draf ── */}
        {tab === "draf" && (
          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("Dokumen Co-Writer")}
            </h2>
            {loadingDraft ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[var(--muted-foreground)]">
                <Loader2 size={15} className="animate-spin" />
                {t("Memuat…")}
              </div>
            ) : drafts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[12.5px] text-[var(--muted-foreground)]">
                {t("Belum ada draf. Buat draf baru di Co-Writer.")}
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => router.push(`/co-writer/${doc.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)]/70 px-4 py-3 text-left transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-[var(--foreground)]">
                        {doc.title}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted-foreground)]">
                        {doc.preview}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                      {doc.updated_at
                        ? new Date(doc.updated_at * 1000).toLocaleDateString()
                        : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
          </div>
        );
      }

      export default function SpaceHubPage() {
        const { t } = useTranslation();
        return (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                <Loader2 size={16} className="animate-spin" />
                {t("Memuat…")}
              </div>
            }
          >
            <SpaceHubInner />
          </Suspense>
        );
      }
