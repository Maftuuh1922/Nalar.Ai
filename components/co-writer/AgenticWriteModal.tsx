"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  Quote,
  Sparkles,
  Wand2,
} from "lucide-react";

import {
  getLearningSpaceData,
  type LearningSpaceData,
} from "@/lib/co-writer-api";
import { listCitationFormats, type CitationFormat } from "@/lib/journal-api";

/**
 * Modal "Tulis dengan AI (Agentic)" di Co-Writer.
 *
 * Alur (sesuai PRD): user memberi perintah → AI membaca semua referensi grup
 * (Learning Space) → menulis DRAF dengan sitasi → user diminta konfirmasi
 * ("mau langsung dituliskan ke dokumen atau tidak?") → bila setuju, draf
 * diterapkan ke dokumen via onApply.
 */

/** Preset bab jurnal — sekali klik langsung mengisi instruksi. */
const SECTION_PRESETS: Array<{ label: string; instruction: string }> = [
  {
    label: "Pendahuluan",
    instruction:
      "Tulis Bab Pendahuluan: latar belakang, rumusan masalah, tujuan, dan cakupan penelitian, dengan sitasi dari jurnal grup ini.",
  },
  {
    label: "Tinjauan Pustaka",
    instruction:
      "Tulis Bab Tinjauan Pustaka: teori, konsep, dan penelitian terdahulu yang relevan, dengan sitasi dari jurnal grup ini.",
  },
  {
    label: "Metodologi",
    instruction:
      "Tulis Bab Metodologi: desain penelitian, populasi/sampel, instrumen, teknik pengumpulan data, dan analisis, dengan sitasi dari jurnal grup ini.",
  },
  {
    label: "Hasil & Pembahasan",
    instruction:
      "Tulis Bab Hasil dan Pembahasan: paparkan temuan dan bahas dengan membandingkan jurnal grup ini, sertakan sitasi.",
  },
  {
    label: "Kesimpulan",
    instruction:
      "Tulis Bab Kesimpulan: ringkas temuan utama, keterbatasan, dan saran penelitian lanjutan, dengan sitasi dari jurnal grup ini.",
  },
];

interface AgenticWriteModalProps {
  open: boolean;
  onClose: () => void;
  /** Terapkan draf ke dokumen (dipanggil setelah user konfirmasi). */
  onApply: (draft: string) => void;
}

export default function AgenticWriteModal({
  open,
  onClose,
  onApply,
}: AgenticWriteModalProps) {
  const { t } = useTranslation();
  const [learningSpace, setLearningSpace] = useState<LearningSpaceData | null>(null);
  const [formats, setFormats] = useState<CitationFormat[]>([]);
  const [groupIds, setGroupIds] = useState<Record<string, string>>({});

  const [instruction, setInstruction] = useState("");
  const [groupId, setGroupId] = useState("");
  const [format, setFormat] = useState("ieee");
  const [useRag, setUseRag] = useState(true);

  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [stage, setStage] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [draft, setDraft] = useState("");
  const [citationCount, setCitationCount] = useState(0);
  const [usedReferences, setUsedReferences] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ls, fmts] = await Promise.all([
        getLearningSpaceData(),
        listCitationFormats(),
      ]);
      setLearningSpace(ls);
      setFormats(fmts);
      if (ls.groups.length > 0 && !groupId) {
        setGroupId(ls.groups[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [groupId]);

  useEffect(() => {
    if (open) {
      setDraft("");
      setCitationCount(0);
      setUsedReferences([]);
      setError("");
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groupRefCount = useMemo(() => {
    if (!learningSpace) return 0;
    return learningSpace.references.filter((r) => r.group_id === groupId).length;
  }, [learningSpace, groupId]);

  const runWrite = async () => {
    if (!instruction.trim() || !groupId) return;
    setWriting(true);
    setError("");
    setDraft("");
    setStage("Membaca jurnal…");
    setStreamingText("");
    try {
      const response = await fetch("/api/v1/co_writer/agent-write/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          group_id: groupId,
          format,
          use_rag: useRag,
        }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullRaw = "";

      const handleEvent = (eventName: string, dataText: string) => {
        try {
          const data = JSON.parse(dataText) as Record<string, unknown>;
          if (eventName === "stage" && typeof data.label === "string") {
            setStage(data.label);
          } else if (eventName === "content" && typeof data.delta === "string") {
            fullRaw += data.delta;
            setStreamingText(fullRaw);
          } else if (eventName === "result") {
            setDraft(String(data.draft ?? ""));
            setCitationCount(Number(data.citation_count ?? 0));
            setUsedReferences(Array.isArray(data.references) ? (data.references as string[]) : []);
          } else if (eventName === "error") {
            setError(String(data.detail ?? "Gagal menulis."));
          }
        } catch {
          // abaikan event yang tidak bisa di-parse
        }
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE: event dipisahkan blank line
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length > 0) handleEvent(eventName, dataLines.join("\n"));
        }
      }
      // Sisa buffer
      if (buffer.trim()) {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of buffer.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length > 0) handleEvent(eventName, dataLines.join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWriting(false);
      setStage("");
    }
  };

  const apply = () => {
    if (!draft.trim()) return;
    onApply(draft);
    onClose();
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("Copy failed."));
    }
  };

  if (!open) return null;

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !writing) onClose();
      }}
    >
      <div className="animate-in zoom-in-95 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Wand2 size={15} />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
                {t("Tulis dengan AI (Agentic)")}
              </h2>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {t("AI membaca seluruh jurnal di grup, menulis draf + sitasi otomatis.")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={writing}
            className="rounded-md px-2 py-1 text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {t("Close")}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[var(--muted-foreground)]">
              <Loader2 size={15} className="animate-spin" />
              {t("Membaca Learning Space…")}
            </div>
          ) : learningSpace && learningSpace.groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12.5px] text-[var(--muted-foreground)]">
              {t("Belum ada grup laporan. Buat grup & upload jurnal di menu Referensi Jurnal dulu.")}
            </div>
          ) : (
            <>
              {/* Preset bab jurnal — sekali klik */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("Preset bab jurnal")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setInstruction(preset.instruction);
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                        instruction === preset.instruction
                          ? "border-[var(--primary)]/50 bg-[var(--primary)]/[0.08] text-[var(--primary)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Perintah */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("Perintah menulis")}
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  placeholder={t('Misal: "Tulis Bab 2 Tinjauan Pustaka tentang RAG untuk tutoring dari jurnal grup ini"')}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                />
              </div>

              {/* Grup + format + RAG */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t("Grup laporan")}
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-[12.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  >
                    {learningSpace?.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10.5px] text-[var(--muted-foreground)]">
                    {groupRefCount} {t("jurnal")}
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t("Format sitasi")}
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-[12.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  >
                    {formats.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t("Konteks isi (RAG)")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseRag((v) => !v)}
                    className={`w-full rounded-lg border px-2 py-2 text-[12.5px] font-medium transition-colors ${
                      useRag
                        ? "border-[var(--primary)]/50 bg-[var(--primary)]/[0.07] text-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
                    }`}
                  >
                    {useRag ? t("Aktif") : t("Nonaktif")}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void runWrite()}
                disabled={writing || !instruction.trim() || !groupId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {writing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {writing ? t("AI sedang menulis…") : t("Tulis draf dengan AI")}
              </button>

              {/* Indikator AI mengetik real-time */}
              {writing ? (
                <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/[0.05] px-3 py-2.5">
                  <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-medium text-[var(--primary)]">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-[var(--primary)]" />
                    </span>
                    {stage || t("Menulis…")}
                  </div>
                  {streamingText ? (
                    <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--muted)]/30 p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
                      {streamingText}
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[var(--primary)] align-middle" />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-rose-300/30 bg-rose-50/40 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {error}
                </div>
              ) : null}

              {/* Hasil draf */}
              {draft ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
                  <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-[11.5px] font-medium text-[var(--foreground)]">
                      <Bot size={13} className="text-[var(--primary)]" />
                      {t("Draf hasil AI")}
                      <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10.5px] text-[var(--primary)]">
                        {citationCount} {t("sitasi")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyDraft()}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    >
                      {copied ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {t("Copy")}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
                    {draft}
                  </div>
                  {usedReferences.length > 0 ? (
                    <div className="border-t border-[var(--border)]/60 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        <Quote size={10} />
                        {t("Sitasi yang dipakai")}
                      </div>
                      <ol className="space-y-0.5 pl-4 text-[11px] text-[var(--muted-foreground)]">
                        {usedReferences.map((ref, i) => (
                          <li key={i} className="list-decimal">
                            {ref}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer — konfirmasi sebelum diterapkan ke dokumen */}
        {draft ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
            <p className="text-[11.5px] text-[var(--muted-foreground)]">
              {t("Mau langsung dituliskan ke dokumen?")}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                {t("Nanti")}
              </button>
              <button
                type="button"
                onClick={apply}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                <Check size={13} />
                {t("Ya, tulis ke dokumen")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
