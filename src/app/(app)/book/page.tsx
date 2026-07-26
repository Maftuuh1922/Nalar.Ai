"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";
import { ApiError, preferencesApi, researchApi } from "@/lib/api";
import type { ResearchReport } from "@/lib/types";

/** Selama masih ada riset yang berjalan, daftar disegarkan berkala. */
const POLL_INTERVAL_MS = 3000;

const DEPTH_OPTIONS = [
  { value: "ringkas", label: "Ringkas", hint: "4 bagian, ± 3 sumber. Paling cepat." },
  { value: "standar", label: "Standar", hint: "6 bagian, ± 7 sumber. Pilihan seimbang." },
  { value: "mendalam", label: "Mendalam", hint: "8 bagian, ± 12 sumber. Paling lama." },
] as const;

type Depth = (typeof DEPTH_OPTIONS)[number]["value"];

const isRunning = (r: ResearchReport) => r.status === "pending" || r.status === "running";

/**
 * Gaya render laporan. Komponen Markdown bawaan aplikasi dirancang untuk latar
 * terang, sedangkan halaman ini berlatar biru gelap, jadi dipakai peta gaya
 * tersendiri agar teksnya tetap terbaca.
 */
const REPORT_MARKDOWN = {
  h1: ({ children }: any) => (
    <h1 className="mt-8 mb-4 text-3xl font-serif font-bold text-white border-b border-white/20 pb-3">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mt-8 mb-3 text-xl font-serif font-bold text-white">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mt-5 mb-2 text-base font-serif font-bold text-white/90">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="my-3 font-serif text-[15.5px] leading-relaxed text-white/85 text-justify">{children}</p>
  ),
  ul: ({ children }: any) => <ul className="my-3 space-y-1.5 pl-6 list-disc text-white/85">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-3 space-y-1.5 pl-6 list-decimal text-white/85">{children}</ol>,
  li: ({ children }: any) => <li className="font-serif text-[15.5px] leading-relaxed">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="my-5 border-l-2 border-white/30 pl-5 italic text-white/70 font-serif">{children}</blockquote>
  ),
  strong: ({ children }: any) => <strong className="font-bold text-white">{children}</strong>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white hover:text-white/70">
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-t border-white/20" />,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-left border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border-b border-white/30 px-3 py-2 font-bold text-white">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border-b border-white/10 px-3 py-2 text-white/80 align-top">{children}</td>
  ),
  code: ({ children }: any) => (
    <code className="bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white">{children}</code>
  ),
};

export default function RisetMendalamPage() {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Form riset baru
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [depth, setDepth] = useState<Depth>("standar");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReports = useCallback(
    async (showSpinner = true) => {
      if (!token) return;
      if (showSpinner) setIsLoading(true);
      try {
        setReports(await researchApi.getAll(token));
      } catch (err) {
        console.error(err);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Kedalaman awal mengikuti Pengaturan > Memori & Instruksi.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    preferencesApi
      .get(token)
      .then((pref) => {
        const preferred = pref.research_default_depth as Depth;
        if (!cancelled && DEPTH_OPTIONS.some((opt) => opt.value === preferred)) {
          setDepth(preferred);
        }
      })
      .catch(() => {
        /* pakai nilai bawaan bila preferensi gagal dimuat */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Penulisan laporan berjalan di latar belakang; progresnya ditarik berkala
  // supaya user tidak perlu memuat ulang halaman.
  const hasRunning = reports.some(isRunning);
  useEffect(() => {
    if (!hasRunning || !token) return;
    const timer = setInterval(() => loadReports(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasRunning, token, loadReports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => r.topic.toLowerCase().includes(q));
  }, [reports, query]);

  const stats = useMemo(
    () => ({
      total: reports.length,
      selesai: reports.filter((r) => r.status === "completed").length,
      berjalan: reports.filter(isRunning).length,
      kata: reports.reduce((sum, r) => sum + (r.word_count || 0), 0),
    }),
    [reports],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !topic.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await researchApi.create(token, {
        topic: topic.trim(),
        instructions: instructions.trim() || null,
        depth,
      });
      setReports((prev) => [created, ...prev]);
      setTopic("");
      setInstructions("");
      setShowForm(false);
      toastSuccess("Riset dimulai. Prosesnya berjalan di latar belakang.");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal memulai riset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(report: ResearchReport) {
    if (!token || !confirm(`Hapus riset "${report.topic}"?`)) return;
    try {
      await researchApi.delete(token, report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      if (openId === report.id) setOpenId(null);
      toastSuccess("Riset dihapus.");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus riset.");
    }
  }

  if (openId) {
    return (
      <ReportDetail
        reportId={openId}
        onBack={() => {
          setOpenId(null);
          loadReports(false);
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent min-h-full">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <BookOpen className="h-7 w-7 text-white/60 mt-1" />
            <div>
              <h1 className="text-3xl font-serif font-bold text-white mb-1">Riset Mendalam</h1>
              <p className="text-sm text-white/50 max-w-xl">
                Ketik satu topik, biarkan AI mencari sumber di internet, membacanya, lalu menulis
                laporan lengkap beserta daftar pustaka.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 border border-white/30 bg-white text-[#0011ff] px-4 py-2 text-sm font-bold hover:bg-white/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Riset Baru
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-10 border border-white/30 bg-transparent p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                Topik riset
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Penerapan AI generatif di pendidikan tinggi Indonesia"
                maxLength={500}
                className="w-full bg-transparent border border-white/30 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                Arahan tambahan <span className="font-normal normal-case tracking-normal">(opsional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Contoh: fokus ke data 5 tahun terakhir dan sertakan contoh kasus di Indonesia."
                className="w-full bg-transparent border border-white/30 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                Kedalaman
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDepth(opt.value)}
                    className={`border px-4 py-3 text-left transition-colors ${
                      depth === opt.value
                        ? "border-white bg-white/10"
                        : "border-white/30 hover:border-white/60"
                    }`}
                  >
                    <div className="text-sm font-bold text-white">{opt.label}</div>
                    <div className="text-xs text-white/50 mt-1">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !topic.trim()}
                className="flex items-center gap-2 border border-white/30 bg-white text-[#0011ff] px-5 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Mulai Riset
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                Batal
              </button>
            </div>
            <p className="text-xs text-white/40">
              Penulisan bisa memakan waktu beberapa menit tergantung kecepatan model AI Anda.
              Halaman ini boleh ditinggalkan; prosesnya tetap berjalan.
            </p>
          </form>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Riset" value={stats.total} />
          <StatCard label="Selesai" value={stats.selesai} />
          <StatCard label="Sedang Berjalan" value={stats.berjalan} />
          <StatCard label="Total Kata" value={stats.kata.toLocaleString("id-ID")} />
        </div>

        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest">
            Laporan Saya · {filtered.length} dari {reports.length}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari topik"
              className="pl-9 pr-4 py-2 bg-transparent border border-white/30 text-sm text-white placeholder:text-white/40 w-56 outline-none focus:border-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/50 py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat riset…
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-white/30 p-16 flex flex-col items-center text-center">
            <BookOpen className="h-10 w-10 text-white/30 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              {reports.length === 0 ? "Belum ada riset" : "Tidak ada yang cocok"}
            </h3>
            <p className="text-sm text-white/50 max-w-md mb-6">
              {reports.length === 0
                ? "Mulai riset pertama Anda — cukup ketik topiknya, sisanya dikerjakan AI."
                : "Coba kata kunci lain."}
            </p>
            {reports.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 border border-white/30 bg-white text-[#0011ff] px-5 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> Riset Baru
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onOpen={() => setOpenId(report.id)}
                onDelete={() => handleDelete(report)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-white/30 bg-transparent p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">{label}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ report }: { report: ResearchReport }) {
  if (report.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
      </span>
    );
  }
  if (report.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-300">
        <AlertCircle className="h-3.5 w-3.5" /> Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {report.progress_percent}%
    </span>
  );
}

function ReportRow({
  report,
  onOpen,
  onDelete,
}: {
  report: ResearchReport;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-white/30 bg-transparent p-5 hover:border-white/60 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <button onClick={onOpen} className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-base font-bold text-white truncate">{report.topic}</h3>
            <StatusBadge report={report} />
          </div>
          <p className="text-xs text-white/50">
            {report.depth} · {report.word_count.toLocaleString("id-ID")} kata ·{" "}
            {new Date(report.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </button>
        <button
          onClick={onDelete}
          title="Hapus riset"
          className="p-2 text-white/40 hover:text-red-300 transition-colors shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isRunning(report) && (
        <div className="mt-4">
          <div className="h-1 w-full bg-white/15">
            <div
              className="h-1 bg-white transition-all duration-500"
              style={{ width: `${Math.max(report.progress_percent, 3)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/60">{report.progress_step}</p>
        </div>
      )}

      {report.status === "failed" && report.error_message && (
        <p className="mt-3 text-xs text-red-300 break-words">{report.error_message}</p>
      )}
    </div>
  );
}

function ReportDetail({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!token) return;
      if (showSpinner) setIsLoading(true);
      try {
        setReport(await researchApi.getById(token, reportId));
      } catch (err) {
        console.error(err);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [token, reportId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const running = report ? isRunning(report) : false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  async function handleDownload() {
    if (!token || !report) return;
    setIsBusy(true);
    try {
      await researchApi.downloadDocx(token, report.id, report.topic);
      toastSuccess("Laporan diunduh sebagai .docx");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal mengunduh laporan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToNotebook() {
    if (!token || !report) return;
    setIsBusy(true);
    try {
      await researchApi.toNotebook(token, report.id);
      toastSuccess("Laporan disalin ke menu Catatan.");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyalin laporan.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat laporan…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm text-white/60">
        Riset tidak ditemukan.
        <button onClick={onBack} className="underline">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent min-h-full">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar riset
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-3xl font-serif font-bold text-white mb-2 break-words">{report.topic}</h1>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <StatusBadge report={report} />
              <span>·</span>
              <span>{report.depth}</span>
              <span>·</span>
              <span>{report.word_count.toLocaleString("id-ID")} kata</span>
            </div>
          </div>

          {report.status === "completed" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={isBusy}
                className="flex items-center gap-2 border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Unduh .docx
              </button>
              <button
                onClick={handleToNotebook}
                disabled={isBusy}
                className="flex items-center gap-2 border border-white/30 bg-white text-[#0011ff] px-4 py-2 text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-40"
              >
                <FileText className="h-4 w-4" /> Kirim ke Catatan
              </button>
            </div>
          )}
        </div>

        {report.instructions && (
          <p className="mb-6 border-l-2 border-white/30 pl-4 text-sm text-white/60">
            Arahan: {report.instructions}
          </p>
        )}

        {running && (
          <div className="mb-8 border border-white/30 p-5">
            <div className="flex items-center gap-2 text-sm text-white mb-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              {report.progress_step}
            </div>
            <div className="h-1 w-full bg-white/15">
              <div
                className="h-1 bg-white transition-all duration-500"
                style={{ width: `${Math.max(report.progress_percent, 3)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-white/40">
              Halaman ini menyegarkan sendiri setiap beberapa detik.
            </p>
          </div>
        )}

        {report.status === "failed" && (
          <div className="mb-8 border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-bold mb-1">Riset gagal diselesaikan</div>
            {report.error_message || "Penyebab tidak diketahui."}
          </div>
        )}

        {report.outline && report.outline.length > 0 && (
          <div className="mb-8 border border-white/30 p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">
              Kerangka Laporan
            </h2>
            <ol className="space-y-1.5 text-sm text-white/80 list-decimal list-inside">
              {report.outline.map((item, i) => (
                <li key={i}>{item.judul}</li>
              ))}
            </ol>
          </div>
        )}

        {report.content_markdown ? (
          <article>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={REPORT_MARKDOWN}>
              {report.content_markdown}
            </ReactMarkdown>
          </article>
        ) : null}

        {report.sources && report.sources.length > 0 && (
          <div className="mt-10 border-t border-white/20 pt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">
              Sumber ({report.sources.length})
            </h2>
            <ul className="space-y-2">
              {report.sources.map((src, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 text-white/70 hover:text-white transition-colors"
                  >
                    <span className="text-white/40 shrink-0">[{i + 1}]</span>
                    <span className="underline underline-offset-2 break-all">{src.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
