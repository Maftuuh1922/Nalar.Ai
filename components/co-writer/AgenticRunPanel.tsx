'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  History,
  Loader2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Quote,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'

import ModelSelector from '@/components/chat/home/ModelSelector'
import HistorySessionPicker, {
  type SelectedHistorySession,
} from '@/components/chat/HistorySessionPicker'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'
import {
  bacaRiwayat,
  hapusRiwayat,
  simpanRiwayat,
  type RunTersimpan,
} from '@/lib/agentic-run-history'
import { apiFetch, apiUrl } from '@/lib/api'
import { listLLMOptions, type LLMOption } from '@/lib/llm-options'
import { getSession } from '@/lib/session-api'
import type { LLMSelection } from '@/lib/unified-ws'

/**
 * Panel eksekusi agentic (Fase A / Layer 2) di dalam Co-Writer.
 *
 * Satu instruksi → backend menyusun rencana → mengeksekusi tiap tugas dengan
 * status real-time → SATU ringkasan. Tool tulis (`fe:true`) dijalankan DI SINI
 * lewat handle editor SuperDoc (Layer 0), lalu hasil NYATA-nya (bukan optimistik
 * server) yang ditampilkan di ringkasan eksekusi. Menggantikan alur single-shot
 * `AgenticWriteModal`. Lihat [[nalar-cowriter-agentic-roadmap]] Fase A.
 */

/** Hasil eksekusi satu tool tulis di editor (dikembalikan page.tsx). */
export interface FeToolResult {
  ok: boolean
  error?: string
  summary?: string
}

type RunMode = 'cepat' | 'seimbang' | 'menyeluruh'

interface PlanTask {
  index: number
  title: string
  status: 'pending' | 'running' | 'done' | 'failed'
  note?: string
}

/** Satu langkah aktivitas (pemanggilan tool + hasilnya). */
interface ActivityStep {
  id: string
  name: string
  fe: boolean
  args: Record<string, unknown>
  status: 'running' | 'ok' | 'error'
  detail?: string
}

/** Satu sesi chat: instruksi user + respons AI (progress live). */
interface ChatRun {
  id: number
  instruction: string
  tasks: PlanTask[]
  steps: ActivityStep[]
  summary: string
  reasoning: string
  error: string
  finished: boolean
  ledgerOk: number
  ledgerFailed: Array<{ name: string; error: string }>
  /** Kapan run dimulai (epoch ms) — dipakai melabeli riwayat yang tersimpan. */
  startedAt?: number
}

interface AgenticRunPanelProps {
  docId: string
  /**
   * Jalankan tool tulis (`doc_insert`/`doc_replace`/`cite_insert`) ke editor.
   * Dikembalikan hasil NYATA — panel memakainya untuk ringkasan yang jujur.
   */
  executeFeTool: (name: string, args: Record<string, unknown>) => Promise<FeToolResult>
  /**
   * Ambil potret dokumen terkini (opsional). Bila tak diberikan, backend
   * memakai sumber proyek di server. Hindari getText penuh pada dokumen besar.
   */
  getDocContext?: () => Promise<string>
  /** Teks yang sedang disorot pengguna di editor (opsional). */
  selectionText?: string | null
  /**
   * Instruksi dari luar (mis. chat panel) yang otomatis menjalankan agentic.
   * Set saat ingin "satu tempat input": ketik di chat → kerjakan di sini.
   */
  externalInstruction?: string | null
  /** Dipanggil setelah externalInstruction dikonsumsi (untuk reset state induk). */
  onExternalInstructionConsumed?: () => void
  onClose?: () => void
}

const API = '/api/v1/co_writer'

const MODES: Array<{ value: RunMode; label: string; hint: string }> = [
  { value: 'cepat', label: 'Cepat', hint: 'Sedikit langkah, tanpa riset web.' },
  { value: 'seimbang', label: 'Seimbang', hint: 'Default — riset bila perlu.' },
  { value: 'menyeluruh', label: 'Menyeluruh', hint: 'Paling teliti, lebih banyak langkah.' },
]

const PRESETS: Array<{ label: string; instruction: string }> = [
  {
    label: 'Rapikan seluruh draf',
    instruction:
      'Baca dokumen, rapikan kalimat yang berantakan, perbaiki ejaan dan tata bahasa, serta buat alurnya lebih runtut tanpa mengubah makna.',
  },
  {
    label: 'Lengkapi bagian kosong',
    instruction:
      'Periksa struktur laporan, temukan bagian yang masih kosong atau terlalu singkat, lalu lengkapi dengan isi yang relevan.',
  },
  {
    label: 'Tulis Latar Belakang',
    instruction: 'Tulis paragraf Latar Belakang di bawah Bab Pendahuluan sesuai topik dokumen.',
  },
  {
    label: 'Periksa konsistensi istilah',
    instruction:
      'Periksa konsistensi istilah dan penulisan di seluruh dokumen, lalu seragamkan yang tidak konsisten.',
  },
]

function toolIcon(name: string) {
  if (name === 'doc_insert') return Pencil
  if (name === 'doc_replace') return Pencil
  if (name === 'cite_insert') return Quote
  if (name === 'find_in_document' || name === 'search_in_document') return Search
  if (name === 'search_web' || name === 'arxiv_search' || name === 'fetch_webpage') return Search
  return Sparkles
}

function toolLabel(name: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    doc_insert: t('Menyisipkan teks'),
    doc_replace: t('Merapikan teks'),
    cite_insert: t('Menyisipkan sitasi'),
    find_in_document: t('Mencari lokasi di dokumen'),
    read_document: t('Membaca dokumen referensi'),
    search_in_document: t('Mencari di dokumen referensi'),
    search_web: t('Mencari di web'),
    arxiv_search: t('Mencari di arXiv'),
    fetch_webpage: t('Membuka halaman web'),
  }
  return map[name] || name
}

export default function AgenticRunPanel({
  docId,
  executeFeTool,
  getDocContext,
  selectionText,
  externalInstruction,
  onExternalInstructionConsumed,
  onClose,
}: AgenticRunPanelProps) {
  const { t } = useTranslation()

  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<RunMode>('seimbang')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  // Riwayat chat: tiap run menjadi satu pesan user + satu kartu respons AI.
  // Dimuat dari localStorage per dokumen supaya tidak lenyap saat halaman
  // dimuat ulang — catatan apa yang sudah diubah AI di dokumen ikut hilang
  // kalau hanya disimpan di memori.
  const [runs, setRuns] = useState<ChatRun[]>([])
  const [riwayatDimuat, setRiwayatDimuat] = useState(false)
  const [activeRunId, setActiveRunId] = useState<number | null>(null)
  const runIdRef = useRef(0)

  // Muat riwayat saat dokumen berganti. Id run dilanjutkan dari yang tertinggi
  // supaya run baru tidak menimpa kartu lama yang kebetulan berid sama.
  useEffect(() => {
    const tersimpan = bacaRiwayat(docId) as unknown as ChatRun[]
    setRuns(tersimpan)
    runIdRef.current = tersimpan.reduce((maks, r) => Math.max(maks, r.id || 0), 0)
    setActiveRunId(tersimpan.length ? tersimpan[tersimpan.length - 1].id : null)
    setRiwayatDimuat(true)
  }, [docId])

  // Tulis balik setiap kali riwayat berubah. Sengaja menunggu pemuatan awal
  // selesai: tanpa penjaga ini, render pertama (runs masih []) akan menimpa
  // riwayat yang tersimpan dengan daftar kosong.
  useEffect(() => {
    if (!riwayatDimuat) return
    simpanRiwayat(docId, runs as unknown as RunTersimpan[])
  }, [docId, runs, riwayatDimuat])

  // Lampiran teks (file .md/.txt yang dibaca via FileReader) & impor chat.
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [importedChat, setImportedChat] = useState<{ title: string; content: string } | null>(null)
  const [showImportPicker, setShowImportPicker] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleApplyChatImport = useCallback(async (sessions: SelectedHistorySession[]) => {
    setShowImportPicker(false)
    if (!sessions.length) return
    setImporting(true)
    try {
      const details = await Promise.all(
        sessions.map(session => getSession(session.sessionId).catch(() => null))
      )
      const parts: string[] = []
      details.forEach((detail, index) => {
        if (!detail) return
        if (sessions.length > 1) {
          parts.push(`— ${sessions[index].title} —`)
        }
        for (const message of detail.messages) {
          if ((message.role === 'user' || message.role === 'assistant') && message.content?.trim()) {
            parts.push(`${message.role === 'user' ? 'Pengguna' : 'AI'}: ${message.content.trim()}`)
          }
        }
      })
      if (!parts.length) {
        setError(t('Percakapan yang dipilih tidak berisi pesan.'))
        return
      }
      const title = sessions.length === 1 ? sessions[0].title : `${sessions.length} ${t('percakapan')}`
      setImportedChat({ title, content: parts.slice(-60).join('\n').slice(0, 6000) })
    } catch {
      setError(t('Gagal mengimpor percakapan.'))
    } finally {
      setImporting(false)
    }
  }, [t])

  const [llmOptions, setLLMOptions] = useState<LLMOption[]>([])
  const [activeLLMDefault, setActiveLLMDefault] = useState<LLMSelection | null>(null)
  const [llmSelection, setLLMSelection] = useState<LLMSelection | null>(null)
  const [llmOptionsLoading, setLLMOptionsLoading] = useState(true)
  const [llmOptionsError, setLLMOptionsError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // ID run yang sedang aktif (untuk updater di dalam stream).
  const activeRunIdRef = useRef<number | null>(null)
  // Hasil eksekusi FE nyata — dibaca dari state run aktif di akhir.

  useEffect(() => {
    let cancelled = false
    void listLLMOptions()
      .then(payload => {
        if (cancelled) return
        setLLMOptions(payload.options)
        setActiveLLMDefault(payload.active)
        setLLMOptionsError(false)
      })
      .catch(() => {
        if (cancelled) return
        setLLMOptions([])
        setActiveLLMDefault(null)
        setLLMOptionsError(true)
      })
      .finally(() => {
        if (!cancelled) setLLMOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!llmSelection && activeLLMDefault) setLLMSelection(activeLLMDefault)
  }, [activeLLMDefault, llmSelection])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Instruksi dari luar (chat panel): isi input & langsung jalankan agentic.
  const externalHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!externalInstruction || running) return
    if (externalHandledRef.current === externalInstruction) return
    if (!llmSelection && llmOptionsLoading) return // tunggu model default siap
    externalHandledRef.current = externalInstruction
    setInstruction(externalInstruction)
    onExternalInstructionConsumed?.()
    // Jalankan setelah state instruction ter-set (microtask berikutnya).
    const id = window.setTimeout(() => {
      setRunning(true)
      // run() membaca state instruction — pakai nilai langsung agar tidak
      // bergantung pada urutan setState.
      void runWithText(externalInstruction)
    }, 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalInstruction, running, llmSelection, llmOptionsLoading])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setRunning(false)
  }, [])

  // Terapkan satu tool tulis ke editor; catat hasil nyata di ledger + langkah.
  const applyFeTool = useCallback(
    async (id: string, name: string, args: Record<string, unknown>) => {
      const result = await executeFeTool(name, args)
      const activeId = activeRunIdRef.current
      setRuns(prev =>
        prev.map(run =>
          run.id === activeId
            ? {
                ...run,
                steps: run.steps.map(s =>
                  s.id === id
                    ? {
                        ...s,
                        status: result.ok ? 'ok' : 'error',
                        detail: result.ok ? result.summary : result.error,
                      }
                    : s
                ),
                ...(result.ok
                  ? { ledgerOk: run.ledgerOk + 1 }
                  : {
                      ledgerFailed: [
                        ...run.ledgerFailed,
                        { name, error: result.error || t('Gagal.') },
                      ],
                    }),
              }
            : run
        )
      )
    },
    [executeFeTool, t]
  )

  // varian run() yang menerima teks eksplisit (dipakai jalur external).
  const runWithText = useCallback(
    async (text: string) => {
      if (!text.trim() || running) return
      const runId = ++runIdRef.current
      activeRunIdRef.current = runId

      // Push sesi chat baru (pesan user + kartu respons kosong).
      const freshRun: ChatRun = {
        id: runId,
        instruction: text,
        tasks: [],
        steps: [],
        summary: '',
        reasoning: '',
        error: '',
        finished: false,
        ledgerOk: 0,
        ledgerFailed: [],
        startedAt: Date.now(),
      }
      setRuns(prev => [...prev, freshRun])
      setActiveRunId(runId)
      setRunning(true)
      setError('')

      // Updater ringan: patchn hanya run dengan id ini.
      const patchRun = (fn: (run: ChatRun) => ChatRun) => {
        setRuns(prev => prev.map(run => (run.id === runId ? fn(run) : run)))
      }

      let docContext = ''
      if (getDocContext) {
        try {
          docContext = await getDocContext()
        } catch {
          docContext = ''
        }
      }

      const controller = new AbortController()
      abortRef.current = controller

      const handleEvent = async (name: string, data: Record<string, unknown>) => {
        switch (name) {
          case 'plan': {
            const raw = Array.isArray(data.tasks) ? (data.tasks as PlanTask[]) : []
            const mapped = raw.map((task, i) => ({
              index: typeof task.index === 'number' ? task.index : i,
              title: String(task.title ?? ''),
              status: 'pending' as const,
            }))
            patchRun(run => ({ ...run, tasks: mapped }))
            break
          }
          case 'task_status': {
            const index = Number(data.index)
            const status = String(data.status) as PlanTask['status']
            const note = data.note ? String(data.note) : undefined
            patchRun(run => ({
              ...run,
              tasks: run.tasks.map(task =>
                task.index === index ? { ...task, status, note } : task
              ),
            }))
            break
          }
          case 'tool_call': {
            const id = String(data.id ?? '')
            const toolName = String(data.name ?? '')
            const fe = Boolean(data.fe)
            const args = (data.args as Record<string, unknown>) || {}
            patchRun(run => ({
              ...run,
              steps: [...run.steps, { id, name: toolName, fe, args, status: 'running' }],
            }))
            if (fe) await applyFeTool(id, toolName, args)
            break
          }
          case 'tool_result': {
            const id = String(data.id ?? '')
            const ok = data.ok !== false
            const detail = data.summary ? String(data.summary) : undefined
            patchRun(run => ({
              ...run,
              steps: run.steps.map(s =>
                s.id === id && s.fe === false ? { ...s, status: ok ? 'ok' : 'error', detail } : s
              ),
            }))
            break
          }
          case 'text': {
            const delta = typeof data.value === 'string' ? data.value : ''
            if (delta) patchRun(run => ({ ...run, summary: run.summary + delta }))
            break
          }
          case 'reasoning': {
            const delta = typeof data.value === 'string' ? data.value : ''
            if (delta) patchRun(run => ({ ...run, reasoning: (run.reasoning + delta).slice(-4000) }))
            break
          }
          case 'error': {
            const detail =
              (typeof data.detail === 'string' && data.detail) ||
              (typeof data.value === 'string' && data.value) ||
              t('Terjadi kesalahan.')
            patchRun(run => ({ ...run, error: String(detail) }))
            break
          }
          default:
            break
        }
      }

      try {
        const extraCtxParts: string[] = []
        if (attachment) {
          extraCtxParts.push(`LAMPIRAN FILE "${attachment.name}":\n${attachment.content.slice(0, 4000)}`)
        }
        if (importedChat) {
          extraCtxParts.push(`IMPOR PERCAKAPAN "${importedChat.title}":\n${importedChat.content.slice(0, 4000)}`)
        }
        const res = await apiFetch(
          apiUrl(`${API}/documents/${encodeURIComponent(docId)}/agent-run/stream`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instruction: text,
              mode,
              doc_context: docContext,
              selection_text: selectionText || null,
              model: llmSelection,
              extra_context: extraCtxParts.length ? extraCtxParts.join('\n\n---\n\n') : null,
            }),
            signal: controller.signal,
          }
        )
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { detail?: string } | null
          throw new Error(body?.detail || `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let receivedAnyEvent = false

        const flushBlock = async (block: string) => {
          let eventName = 'message'
          const dataLines: string[] = []
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          if (!dataLines.length) return
          receivedAnyEvent = true
          try {
            const parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
            await handleEvent(eventName, parsed)
          } catch {
            // event tak ter-parse → abaikan
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            if (part.trim()) await flushBlock(part)
          }
        }
        if (buffer.trim()) await flushBlock(buffer)
        // Stream berakhir TANPA event sama sekali → backend mati di tengah.
        if (!receivedAnyEvent) {
          patchRun(run => ({
            ...run,
            error: t(
              'Koneksi ke server terputus sebelum AI mulai bekerja. Coba lagi — server sedang di-restart.'
            ),
          }))
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : String(err)
          patchRun(run => ({ ...run, error: msg }))
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        patchRun(run => ({ ...run, finished: true }))
        setRunning(false)
      }
    },
    [applyFeTool, attachment, docId, getDocContext, importedChat, llmSelection, mode, running, selectionText, t]
  )

  // run() biasa: jalankan dari state instruction (tombol "Kerjakan").
  const run = useCallback(() => {
    void runWithText(instruction)
  }, [instruction, runWithText])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [runs])

  // Pilih run yang ditampilkan: klik riwayat → run itu; kalau ada run baru
  // dimulai, ikuti run terbaru.
  const currentRun = runs.find(r => r.id === activeRunId) ?? runs[runs.length - 1] ?? null
  const hasActivity = runs.length > 0

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Sidebar riwayat run (kiri) ── */}
      <div className="flex w-[104px] shrink-0 flex-col border-r border-[var(--border)]">
        <div className="flex items-center gap-1.5 px-2 py-2">
          <History size={12} className="shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {t('Riwayat')}
          </span>
          {runs.length > 0 && !running ? (
            <button
              type="button"
              onClick={() => {
                hapusRiwayat(docId)
                setRuns([])
                setActiveRunId(null)
              }}
              title={t('Bersihkan riwayat')}
              aria-label={t('Bersihkan riwayat')}
              className="ml-auto rounded p-0.5 text-[var(--muted-foreground)]/60 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--destructive)]"
            >
              <Trash2 size={11} />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 pb-2">
          {runs.length === 0 ? (
            <p className="px-1 text-[9.5px] leading-snug text-[var(--muted-foreground)]/60">
              {t('Belum ada run.')}
            </p>
          ) : (
            [...runs].reverse().map(run => {
              const aktif = currentRun?.id === run.id
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setActiveRunId(run.id)}
                  className={`w-full rounded-lg border px-1.5 py-1.5 text-left transition-colors ${
                    aktif
                      ? 'border-[var(--primary)]/40 bg-[var(--primary)]/10'
                      : 'border-transparent hover:bg-[var(--muted)]/50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {!run.finished ? (
                      <Loader2 size={9} className="shrink-0 animate-spin text-[var(--primary)]" />
                    ) : run.error ? (
                      <XCircle size={9} className="shrink-0 text-rose-500" />
                    ) : run.ledgerFailed.length > 0 ? (
                      <AlertCircle size={9} className="shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 size={9} className="shrink-0 text-emerald-500" />
                    )}
                    <span
                      className="truncate text-[9.5px] font-medium text-[var(--foreground)]"
                      title={run.instruction}
                    >
                      {run.instruction}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[8.5px] text-[var(--muted-foreground)]/70">
                    {run.tasks.filter(ts => ts.status === 'done').length}/{run.tasks.length} ·{' '}
                    {run.finished ? t('selesai') : t('proses')}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Area chat (kanan) ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Bot size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[12.5px] font-semibold text-[var(--foreground)]">
                {t('Kerjakan otomatis')}
              </h2>
              <p className="truncate text-[10px] leading-snug text-[var(--muted-foreground)]">
                {t('Beri satu perintah — AI menyusun rencana lalu menulis langsung ke dokumen.')}
              </p>
            </div>
          </div>
        </div>

      {/* Timeline chat: tiap run = bubble instruksi user + kartu respons AI */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!hasActivity && !running ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ListChecks size={22} className="text-[var(--muted-foreground)]/50" />
            <p className="text-[11.5px] leading-relaxed text-[var(--muted-foreground)]">
              {t('Perintah kamu akan diubah jadi rencana kerja, lalu dieksekusi langsung ke dokumen dengan status real-time.')}
            </p>
          </div>
        ) : null}

        {runs.map(run => {
          const runTasks = run.tasks ?? []
          const runSteps = run.steps ?? []
          const runLedger = { ok: run.ledgerOk, failed: run.ledgerFailed }
          const runDone = runTasks.filter(task => task.status === 'done').length
          const isCurrent = run.id === currentRun?.id
          return (
            <div key={run.id} className={`space-y-2 ${isCurrent ? '' : 'opacity-80'}`}>
              {/* Bubble instruksi user (kanan) */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)]/12 px-3 py-2 text-[12px] leading-relaxed text-[var(--foreground)]">
                  {run.instruction}
                </div>
              </div>

              {/* Kartu respons AI (kiri) */}
              <div className="flex items-start gap-2">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Bot size={12} />
                </span>
                <div className="min-w-0 flex-1 space-y-2.5">
                  {/* Rencana */}
                  {runTasks.length > 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
                      <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--foreground)]">
                          <ListChecks size={13} className="text-[var(--primary)]" />
                          {t('Rencana kerja')}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {runDone}/{runTasks.length} {t('selesai')}
                        </span>
                      </div>
                      <ol className="space-y-0.5 px-2 py-2">
                        {runTasks.map(task => {
                          const Icon =
                            task.status === 'done'
                              ? CheckCircle2
                              : task.status === 'failed'
                                ? XCircle
                                : task.status === 'running'
                                  ? Loader2
                                  : Circle
                          const color =
                            task.status === 'done'
                              ? 'text-emerald-500'
                              : task.status === 'failed'
                                ? 'text-rose-500'
                                : task.status === 'running'
                                  ? 'text-[var(--primary)]'
                                  : 'text-[var(--muted-foreground)]/50'
                          return (
                            <li key={task.index} className="flex items-start gap-2 rounded-md px-1.5 py-1">
                              <Icon
                                size={14}
                                className={`mt-0.5 shrink-0 ${color} ${task.status === 'running' ? 'animate-spin' : ''}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-[11.5px] leading-snug ${
                                    task.status === 'done'
                                      ? 'text-[var(--muted-foreground)]'
                                      : 'text-[var(--foreground)]'
                                  }`}
                                >
                                  {task.title}
                                </div>
                                {task.note ? (
                                  <div className="mt-0.5 text-[10px] leading-snug text-[var(--muted-foreground)]">
                                    {task.note}
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  ) : null}

                  {/* Aktivitas tool */}
                  {runSteps.length > 0 ? (
                    <div className="space-y-1">
                      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        {t('Aktivitas')}
                      </div>
                      {runSteps.map(step => {
                        const Icon = toolIcon(step.name)
                        const statusColor =
                          step.status === 'ok'
                            ? 'text-emerald-500'
                            : step.status === 'error'
                              ? 'text-rose-500'
                              : 'text-[var(--primary)]'
                        return (
                          <div
                            key={step.id}
                            className="flex items-start gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--background)]/40 px-2 py-1.5"
                          >
                            <Icon size={12} className={`mt-0.5 shrink-0 ${statusColor}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-[var(--foreground)]">
                                  {toolLabel(step.name, t)}
                                </span>
                                {step.fe ? (
                                  <span className="rounded bg-[var(--primary)]/10 px-1 py-0.5 text-[8.5px] font-medium uppercase text-[var(--primary)]">
                                    {t('editor')}
                                  </span>
                                ) : null}
                                {step.status === 'running' ? (
                                  <Loader2 size={10} className="animate-spin text-[var(--primary)]" />
                                ) : step.status === 'ok' ? (
                                  <Check size={11} className="text-emerald-500" />
                                ) : (
                                  <AlertCircle size={11} className="text-rose-500" />
                                )}
                              </div>
                              {step.detail ? (
                                <div
                                  className={`mt-0.5 text-[10px] leading-snug ${
                                    step.status === 'error'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-[var(--muted-foreground)]'
                                  }`}
                                >
                                  {step.detail}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  {/* Ringkasan akhir dari model (markdown) */}
                  {run.summary ? (
                    <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/[0.04] px-3 py-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary)]">
                        <Sparkles size={12} />
                        {t('Ringkasan')}
                      </div>
                      <MarkdownRenderer
                        content={run.summary}
                        className="text-[11.5px] leading-relaxed text-[var(--foreground)] [&_p]:my-1 [&_li]:my-0.5"
                        variant="compact"
                      />
                      {!run.finished ? (
                        <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-[var(--primary)] align-middle" />
                      ) : null}
                    </div>
                  ) : null}

                  {/* Alur pikir AI */}
                  {run.reasoning ? (
                    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--muted)]/15 px-3 py-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">
                        {!run.finished ? (
                          <Loader2 size={11} className="animate-spin text-[var(--primary)]" />
                        ) : (
                          <Sparkles size={11} className="text-[var(--primary)]" />
                        )}
                        {!run.finished ? t('AI sedang berpikir…') : t('Alur pikir AI')}
                      </div>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[10.5px] leading-relaxed text-[var(--muted-foreground)]">
                        {run.reasoning}
                        {!run.finished ? (
                          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-[var(--primary)] align-middle" />
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Ledger eksekusi NYATA */}
                  {run.finished && (runLedger.ok > 0 || runLedger.failed.length > 0) ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-[10.5px]">
                      <div className="mb-1 font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        {t('Hasil nyata di editor')}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={12} /> {runLedger.ok} {t('berhasil')}
                        </span>
                        {runLedger.failed.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <XCircle size={12} /> {runLedger.failed.length} {t('gagal')}
                          </span>
                        ) : null}
                      </div>
                      {runLedger.failed.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-rose-600 dark:text-rose-400">
                          {runLedger.failed.map((f, i) => (
                            <li key={i}>
                              • {toolLabel(f.name, t)}: {f.error}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {run.error ? (
                    <div className="rounded-lg border border-rose-300/30 bg-rose-50/40 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                      {run.error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}

        {running && !runs[runs.length - 1]?.summary ? (
          <div className="flex items-center gap-2 px-1 text-[11px] text-[var(--muted-foreground)]">
            <Loader2 size={12} className="animate-spin" />
            {runs[runs.length - 1]?.tasks.length === 0
              ? t('Menyusun rencana…')
              : t('Mengeksekusi…')}
          </div>
        ) : null}
      </div>

      {/* ── Footer: input + kontrol ── */}
      <div className="shrink-0 space-y-2 border-t border-[var(--border)] px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              disabled={running}
              onClick={() => setInstruction(preset.instruction)}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-[10.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {t(preset.label)}
            </button>
          ))}
        </div>

        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void run()
            }
          }}
          rows={2}
          disabled={running}
          placeholder={t('Misal: "Rapikan Bab 2 dan tambahkan paragraf pembuka di tiap sub-bab"')}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[12.5px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Mode */}
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                disabled={running}
                onClick={() => setMode(m.value)}
                title={t(m.hint)}
                className={`px-2 py-1 text-[10.5px] font-medium transition-colors disabled:opacity-50 ${
                  mode === m.value
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55'
                }`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>

          {/* Lampirkan file */}
          <label
            className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/55 ${
              running ? 'pointer-events-none opacity-50' : ''
            }`}
            title={t('Lampirkan file .md/.txt sebagai konteks')}
          >
            <Paperclip size={11} />
            {attachment ? t('Ganti lampiran') : t('Lampirkan file')}
            <input
              type="file"
              accept=".md,.txt,.tex,.markdown,text/plain"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const content = await file.text()
                setAttachment({ name: file.name, content: content.slice(0, 8000) })
              }}
            />
          </label>
          {attachment ? (
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55"
              title={t('Hapus lampiran')}
            >
              <X size={11} />
              {attachment.name.slice(0, 18)}
            </button>
          ) : null}

          {/* Impor chat */}
          <button
            type="button"
            disabled={running || importing}
            onClick={() => setShowImportPicker(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/55 disabled:opacity-50"
            title={t('Impor percakapan dari chat utama sebagai konteks')}
          >
            {importing ? <Loader2 size={11} className="animate-spin" /> : <MessageSquare size={11} />}
            {importedChat ? t('Ganti impor chat') : t('Impor chat')}
          </button>
          {importedChat ? (
            <button
              type="button"
              onClick={() => setImportedChat(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55"
              title={t('Hapus impor chat')}
            >
              <X size={11} />
              {importedChat.title.slice(0, 18)}
            </button>
          ) : null}

          <ModelSelector
            options={llmOptions}
            activeDefault={activeLLMDefault}
            value={llmSelection}
            loading={llmOptionsLoading}
            error={llmOptionsError}
            allowSystemDefault
            systemDefaultLabel={t('Model aktif')}
            helperText={t('Model ini dipakai untuk menjalankan tugas agentic.')}
            placement="bottom"
            onChange={setLLMSelection}
          />

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => (running ? stop() : void run())}
            disabled={!running && !instruction.trim()}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 ${
              running ? 'bg-rose-600' : 'bg-[var(--primary)]'
            }`}
          >
            {running ? (
              <>
                <Square size={13} fill="currentColor" />
                {t('Hentikan')}
              </>
            ) : (
              <>
                <ArrowUp size={14} />
                {t('Kerjakan')}
              </>
            )}
          </button>
        </div>
      </div>
      </div>

      {onClose ? (
        <div className="shrink-0 border-t border-[var(--border)] px-3 py-1.5">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {t('Tutup')}
          </button>
        </div>
      ) : null}

      <HistorySessionPicker
        open={showImportPicker}
        onClose={() => setShowImportPicker(false)}
        onApply={handleApplyChatImport}
      />
    </div>
  )
}
