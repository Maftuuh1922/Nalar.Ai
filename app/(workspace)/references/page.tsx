"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookMarked,
  Check,
  Copy,
  FileText,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Quote,
  Save,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  createCitationCategory,
  createJournalGroup,
  deleteCitationCategory,
  deleteJournalGroup,
  deleteJournalReference,
  generateBibliography,
  generateCitation,
  listCitationCategories,
  listCitationFormats,
  listJournalGroups,
  listJournalReferences,
  saveCitation,
  saveReferenceFromUrl,
  searchJournals,
  updateJournalReference,
  uploadJournalReference,
  type CitationCategory,
  type CitationFormat,
  type JournalGroup,
  type JournalReference,
  type JournalSearchResult,
} from "@/lib/journal-api";

/**
 * Halaman Referensi Jurnal — upload PDF jurnal, ekstrak metadata (AI),
 * generate sitasi (7 format), simpan ke kategori, dan buat daftar pustaka
 * per grup laporan.
 */

const CONTROL_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--ring)]";

function formatAuthors(authors: string[] | null): string {
  if (!authors || authors.length === 0) return "—";
  if (authors.length === 1) return authors[0];
  return `${authors[0]} et al.`;
}

export default function ReferencesPage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<JournalGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [references, setReferences] = useState<JournalReference[]>([]);
  const [formats, setFormats] = useState<CitationFormat[]>([]);
  const [categories, setCategories] = useState<CitationCategory[]>([]);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Dialog buat grup
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Generate sitasi
  const [citationFormat, setCitationFormat] = useState("ieee");
  const [citationByRef, setCitationByRef] = useState<Record<string, string>>({});
  const [bibliography, setBibliography] = useState("");
  const [showBibliography, setShowBibliography] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit metadata
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<JournalReference>>({});

  // Simpan sitasi ke kategori
  const [savingCitationId, setSavingCitationId] = useState<string | null>(null);
  const [saveCategoryId, setSaveCategoryId] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Pencarian jurnal di internet
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("all");
  const [searchResults, setSearchResults] = useState<JournalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingSearchUrl, setSavingSearchUrl] = useState<string | null>(null);
  const [savedSearchUrls, setSavedSearchUrls] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  // ── Gaya Zotero: filter pustaka + urutan kolom (client-side) ──
  const [libQuery, setLibQuery] = useState("");
  const [sortBy, setSortBy] = useState<"year" | "title" | "authors">("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshGroups = useCallback(async () => {
    try {
      const data = await listJournalGroups();
      setGroups(data);
      setActiveGroupId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const refreshReferences = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setReferences([]);
      return;
    }
    setLoadingRefs(true);
    try {
      setReferences(await listJournalReferences(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    void refreshGroups();
    void listCitationFormats().then(setFormats).catch(() => setFormats([]));
    void listCitationCategories().then(setCategories).catch(() => setCategories([]));
  }, [refreshGroups]);

  useEffect(() => {
    void refreshReferences(activeGroupId);
  }, [activeGroupId, refreshReferences]);

  const visibleRefs = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    const filtered = references.filter((ref) => {
      if (!q) return true;
      const haystack = [
        ref.title ?? "",
        (ref.authors ?? []).join(" "),
        ref.journal_name ?? "",
        String(ref.year ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortBy === "title") return (a.title ?? "").localeCompare(b.title ?? "") * dir;
      if (sortBy === "authors")
        return (a.authors?.[0] ?? "").localeCompare(b.authors?.[0] ?? "") * dir;
      return ((a.year ?? 0) - (b.year ?? 0)) * dir;
    });
  }, [libQuery, references, sortBy, sortDir]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const showError = (msg: string) => {
    setError(msg);
    setNotice("");
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setError("");
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const created = await createJournalGroup(name);
      setGroups((prev) => [...prev, created]);
      setActiveGroupId(created.id);
      setNewGroupName("");
      setShowNewGroup(false);
      showNotice(t("Group created."));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearching(true);
    setError("");
    try {
      setSearchResults(await searchJournals({ query, source: searchSource, max_results: 5 }));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearchResult = async (result: JournalSearchResult) => {
    if (!activeGroupId) {
      showError(t("Pilih atau buat grup laporan dulu."));
      return;
    }
    setSavingSearchUrl(result.url);
    setError("");
    try {
      await saveReferenceFromUrl({
        url: result.url,
        group_id: activeGroupId,
        title_hint: result.title,
      });
      setSavedSearchUrls((prev) => new Set(prev).add(result.url));
      await refreshReferences(activeGroupId);
      await refreshGroups();
      showNotice(t("Jurnal disimpan ke referensi. AI mengekstrak metadata…"));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSearchUrl(null);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeGroupId) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        await uploadJournalReference(activeGroupId, file);
      }
      await refreshReferences(activeGroupId);
      await refreshGroups();
      showNotice(t("File uploaded. AI is extracting metadata…"));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm(t("Delete this group and all its references?"))) return;
    try {
      await deleteJournalGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (activeGroupId === groupId) setActiveGroupId(null);
      showNotice(t("Group deleted."));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteReference = async (refId: string) => {
    if (!window.confirm(t("Delete this reference?"))) return;
    try {
      await deleteJournalReference(refId);
      setReferences((prev) => prev.filter((r) => r.id !== refId));
      await refreshGroups();
      showNotice(t("Reference deleted."));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const startEdit = (ref: JournalReference) => {
    setEditingId(ref.id);
    setEditDraft({
      title: ref.title,
      authors: ref.authors ?? [],
      year: ref.year,
      journal_name: ref.journal_name,
      volume: ref.volume,
      issue: ref.issue,
      pages: ref.pages,
      doi: ref.doi,
      publisher: ref.publisher,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await updateJournalReference(editingId, editDraft);
      setReferences((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      setEditingId(null);
      showNotice(t("Metadata updated."));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleGenerateCitation = async (ref: JournalReference) => {
    try {
      const result = await generateCitation(ref.id, citationFormat);
      setCitationByRef((prev) => ({ ...prev, [ref.id]: result.citation }));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showError(t("Copy failed."));
    }
  };

  const handleBibliography = async () => {
    if (!activeGroupId) return;
    try {
      const result = await generateBibliography(activeGroupId, citationFormat);
      setBibliography(result.bibliography);
      setShowBibliography(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveCitation = async (ref: JournalReference) => {
    const citation = citationByRef[ref.id];
    if (!citation || !saveCategoryId) return;
    setSavingCitationId(ref.id);
    try {
      await saveCitation({
        category_id: saveCategoryId,
        reference_id: ref.id,
        format: citationFormat,
        citation_text: citation,
      });
      const cats = await listCitationCategories();
      setCategories(cats);
      showNotice(t("Citation saved to category."));
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCitationId(null);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const created = await createCitationCategory(name);
      setCategories((prev) => [...prev, created]);
      setSaveCategoryId(created.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm(t("Delete this category and its saved citations?"))) return;
    try {
      await deleteCitationCategory(categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      if (saveCategoryId === categoryId) setSaveCategoryId("");
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
              {t("Referensi Jurnal")}
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
              {t("Upload jurnal, ekstrak metadata otomatis, dan generate sitasi (IEEE/APA/dll).")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <Search size={14} />
            {t("Cari Jurnal")}
          </button>
          <button
            type="button"
            onClick={() => setShowNewGroup(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            <FolderPlus size={14} />
            {t("New group")}
          </button>
        </header>

        {showSearch ? (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearch();
                }}
                placeholder={t("Cari jurnal di internet (mis. intelligent tutoring system RAG)…")}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
              />
              <select
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-2 text-[12px] text-[var(--foreground)] outline-none"
              >
                <option value="all">{t("Web + arXiv")}</option>
                <option value="web">{t("Web")}</option>
                <option value="arxiv">{t("arXiv")}</option>
              </select>
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching || !searchQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {searching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {t("Search")}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((result) => {
                  const saved = savedSearchUrls.has(result.url);
                  return (
                    <div
                      key={result.url}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)]/60 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                            {result.source === "arxiv" ? "arXiv" : "Web"}
                          </span>
                          <span className="truncate text-[12.5px] font-medium text-[var(--foreground)]">
                            {result.title}
                          </span>
                        </div>
                        {result.snippet ? (
                          <p className="mt-1 line-clamp-2 text-[11.5px] text-[var(--muted-foreground)]">
                            {result.snippet}
                          </p>
                        ) : null}
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block truncate text-[11px] text-[var(--primary)] hover:underline"
                        >
                          {result.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSaveSearchResult(result)}
                        disabled={savingSearchUrl === result.url || saved}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                      >
                        {savingSearchUrl === result.url ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : saved ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <BookMarked size={12} />
                        )}
                        {saved ? t("Tersimpan") : t("Simpan ke grup")}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : !searching && searchQuery.trim() ? (
              <div className="py-4 text-center text-[12px] text-[var(--muted-foreground)]">
                {t("Belum ada hasil. Coba kata kunci lain atau sumber berbeda.")}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-300/30 bg-rose-50/40 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4 rounded-lg border border-emerald-300/30 bg-emerald-50/40 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            {notice}
          </div>
        ) : null}

        {/* Grup laporan */}
        <section className="mb-6">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            {t("Grup Laporan")}
          </div>
          {loadingGroups ? (
            <div className="flex items-center gap-2 py-4 text-[12.5px] text-[var(--muted-foreground)]">
              <Loader2 size={15} className="animate-spin" />
              {t("Loading groups…")}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[12.5px] text-[var(--muted-foreground)]">
              {t("Belum ada grup laporan. Buat grup pertama (mis. Laporan A).")}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] transition-colors ${
                    activeGroupId === group.id
                      ? "border-[var(--primary)]/50 bg-[var(--primary)]/[0.07] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveGroupId(group.id)}
                    className="flex items-center gap-2"
                  >
                    <BookMarked size={14} className="text-[var(--primary)]" />
                    <span className="font-medium">{group.name}</span>
                    <span className="rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[10.5px]">
                      {group.reference_count}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="text-[var(--muted-foreground)]/50 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                    title={t("Delete group")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {showNewGroup ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateGroup();
              }}
              placeholder={t("Nama grup (mis. Laporan A)")}
              className={CONTROL_CLASS}
            />
            <button
              type="button"
              onClick={() => void handleCreateGroup()}
              disabled={!newGroupName.trim()}
              className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {t("Create")}
            </button>
            <button
              type="button"
              onClick={() => setShowNewGroup(false)}
              className="shrink-0 rounded-lg px-3 py-2 text-[12.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              {t("Cancel")}
            </button>
          </div>
        ) : null}

        {/* Referensi grup aktif */}
        {activeGroup ? (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  {t("Jurnal")} — {activeGroup.name}
                </div>
                <select
                  value={citationFormat}
                  onChange={(e) => setCitationFormat(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none"
                >
                  {formats.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleBibliography()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <Quote size={13} />
                  {t("Daftar Pustaka")}
                </button>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UploadCloud size={14} />
                  )}
                  {uploading ? t("Uploading…") : t("Upload PDF Jurnal")}
                </button>
              </div>
            </div>

            {showBibliography ? (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[12.5px] font-medium text-[var(--foreground)]">
                    {t("Daftar Pustaka")} ({citationFormat.toUpperCase()})
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(bibliography, "biblio")}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  >
                    {copiedId === "biblio" ? (
                      <Check size={12} className="text-emerald-500" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {t("Copy")}
                  </button>
                </div>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--muted)]/40 p-3 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
                  {bibliography}
                </pre>
              </div>
            ) : null}

            {loadingRefs ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-[var(--muted-foreground)]">
                <Loader2 size={16} className="animate-spin" />
                {t("Loading references…")}
              </div>
            ) : references.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
                <FileText size={26} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--muted-foreground)]" />
                <p className="text-[13px] font-medium text-[var(--foreground)]">
                  {t("Belum ada jurnal di grup ini")}
                </p>
                <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                  {t("Upload PDF jurnal — AI akan mengekstrak metadata dan siap disitasi.")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <input
                      value={libQuery}
                      onChange={(e) => setLibQuery(e.target.value)}
                      placeholder={t("Cari di pustaka (judul, penulis, jurnal, tahun)…")}
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent py-1.5 pl-8 pr-2 text-[12px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--ring)]"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "year" | "title" | "authors")}
                    aria-label={t("Urutkan pustaka")}
                    className="h-8 rounded-lg border border-[var(--border)] bg-transparent px-2 text-[11.5px] font-medium text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
                  >
                    <option value="year">{t("Tahun")}</option>
                    <option value="title">{t("Judul")}</option>
                    <option value="authors">{t("Penulis")}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    title={t("Arah urutan")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {sortDir === "desc" ? "↓" : "↑"}
                  </button>
                  <span className="ml-auto text-[10.5px] text-[var(--muted-foreground)]/70">
                    {t("{{count}} dari {{total}}", {
                      count: visibleRefs.length,
                      total: references.length,
                    })}
                  </span>
                </div>

                {visibleRefs.length === 0 && references.length > 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12px] text-[var(--muted-foreground)]">
                    {t("Tidak ada jurnal yang cocok dengan pencarian.")}
                  </div>
                ) : (
                  <div className="space-y-3">
                {visibleRefs.map((ref) => {
                  const citation = citationByRef[ref.id];
                  const isEditing = editingId === ref.id;
                  return (
                    <div
                      key={ref.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            value={editDraft.title ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                            placeholder={t("Judul")}
                            className={CONTROL_CLASS}
                          />
                          <input
                            value={(editDraft.authors ?? []).join(", ")}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                authors: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                              }))
                            }
                            placeholder={t("Penulis (pisahkan koma)")}
                            className={CONTROL_CLASS}
                          />
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <input
                              type="number"
                              value={editDraft.year ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, year: e.target.value ? Number(e.target.value) : null }))}
                              placeholder={t("Tahun")}
                              className={CONTROL_CLASS}
                            />
                            <input
                              value={editDraft.volume ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, volume: e.target.value }))}
                              placeholder={t("Volume")}
                              className={CONTROL_CLASS}
                            />
                            <input
                              value={editDraft.issue ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, issue: e.target.value }))}
                              placeholder={t("Issue")}
                              className={CONTROL_CLASS}
                            />
                            <input
                              value={editDraft.pages ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, pages: e.target.value }))}
                              placeholder={t("Halaman")}
                              className={CONTROL_CLASS}
                            />
                          </div>
                          <input
                            value={editDraft.journal_name ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, journal_name: e.target.value }))}
                            placeholder={t("Nama jurnal")}
                            className={CONTROL_CLASS}
                          />
                          <input
                            value={editDraft.doi ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, doi: e.target.value }))}
                            placeholder={t("DOI")}
                            className={CONTROL_CLASS}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEdit()}
                              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)]"
                            >
                              {t("Save")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                            >
                              {t("Cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--muted-foreground)]">
                                {ref.status === "extracted"
                                  ? t("Metadata siap")
                                  : ref.status === "extracting"
                                    ? t("Mengekstrak…")
                                    : ref.status === "failed"
                                      ? t("Gagal ekstrak")
                                      : t("Menunggu…")}
                              </span>
                              {ref.year ? (
                                <span className="text-[11px] text-[var(--muted-foreground)]">{ref.year}</span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[14px] font-medium leading-snug text-[var(--foreground)]">
                              {ref.title || ref.filename}
                            </div>
                            <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                              {formatAuthors(ref.authors)}
                              {ref.journal_name ? ` — ${ref.journal_name}` : ""}
                            </div>
                            {ref.error_message ? (
                              <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                {ref.error_message}
                              </div>
                            ) : null}

                            {citation ? (
                              <div className="mt-3 rounded-lg border border-[var(--border)]/60 bg-[var(--muted)]/25 p-3">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                    {citationFormat.toUpperCase()}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={saveCategoryId}
                                      onChange={(e) => setSaveCategoryId(e.target.value)}
                                      className="rounded-md border border-[var(--border)] bg-transparent px-1.5 py-1 text-[11px] text-[var(--foreground)] outline-none"
                                    >
                                      <option value="">{t("Simpan ke kategori…")}</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setShowNewCategory((v) => !v)}
                                      className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                      title={t("Kategori baru")}
                                    >
                                      <Plus size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleSaveCitation(ref)}
                                      disabled={!saveCategoryId || savingCitationId === ref.id}
                                      className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)]/10 px-2 py-1 text-[11px] font-medium text-[var(--primary)] disabled:opacity-50"
                                    >
                                      {savingCitationId === ref.id ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : (
                                        <Save size={11} />
                                      )}
                                      {t("Simpan")}
                                    </button>
                                  </div>
                                </div>
                                {showNewCategory ? (
                                  <div className="mb-2 flex items-center gap-1.5">
                                    <input
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") void handleCreateCategory();
                                      }}
                                      placeholder={t("Nama kategori (mis. Sitasi Bab 2)")}
                                      className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-[11.5px] text-[var(--foreground)] outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void handleCreateCategory()}
                                      disabled={!newCategoryName.trim()}
                                      className="rounded-md bg-[var(--primary)] px-2 py-1 text-[11px] font-medium text-[var(--primary-foreground)] disabled:opacity-50"
                                    >
                                      {t("Buat")}
                                    </button>
                                  </div>
                                ) : null}
                                <p className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
                                  {citation}
                                </p>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleGenerateCitation(ref)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--muted)]"
                              title={t("Generate sitasi")}
                            >
                              <Quote size={12} />
                              {citation ? t("Regenerate") : t("Sitasi")}
                            </button>
                            {citation ? (
                              <button
                                type="button"
                                onClick={() => void copyText(citation, ref.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--muted)]"
                              >
                                {copiedId === ref.id ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                                {t("Copy")}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => startEdit(ref)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--muted)]"
                            >
                              <Pencil size={12} />
                              {t("Edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteReference(ref.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11.5px] text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-[12.5px] text-[var(--muted-foreground)]">
            {t("Pilih atau buat grup laporan untuk mulai upload jurnal.")}
          </div>
        )}

        {/* Kategori sitasi (Learning Space) */}
        {categories.length > 0 ? (
          <section className="mt-10">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              {t("Kategori Sitasi (Learning Space)")}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px]"
                >
                  <Quote size={12} className="text-[var(--primary)]" />
                  <span className="font-medium text-[var(--foreground)]">{category.name}</span>
                  <span className="rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--muted-foreground)]">
                    {category.citation_count}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCategory(category.id)}
                    className="text-[var(--muted-foreground)]/50 hover:text-rose-500"
                    title={t("Delete category")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
