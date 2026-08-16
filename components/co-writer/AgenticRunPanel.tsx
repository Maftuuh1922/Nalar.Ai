'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  ListChecks,
  Pencil,
  Quote,
  Search,
  Sparkles,
  Square,
  XCircle,
} from 'lucide-react'

import ModelSelector from '@/components/chat/home/ModelSelector'
import { apiFetch, apiUrl } from '@/lib/api'
import { listLLMOptions, type LLMOption } from '@/lib/llm-options'
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
  onClose,
}: AgenticRunPanelProps) {
  const { t } = useTranslation()

  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<RunMode>('seimbang')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [steps, setSteps] = useState<ActivityStep[]>([])
  const [summary, setSummary] = useState('')
  const [finished, setFinished] = useState(false)

  const [llmOptions, setLLMOptions] = useState<LLMOption[]>([])
  const [activeLLMDefault, setActiveLLMDefault] = useState<LLMSelection | null>(null)
  const [llmSelection, setLLMSelection] = useState<LLMSelection | null>(null)
  const [llmOptionsLoading, setLLMOptionsLoading] = useState(true)
  const [llmOptionsError, setLLMOptionsError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Hasil eksekusi FE nyata (untuk ringkasan jujur), tak perlu memicu render.
  const feLedgerRef = useRef<{ ok: number; failed: Array<{ name: string; error: string }> }>({
    ok: 0,
    failed: [],
  })

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [steps, summary, tasks])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setRunning(false)
  }, [])

  // Terapkan satu tool tulis ke editor; catat hasil nyata di ledger + langkah.
  const applyFeTool = useCallback(
    async (id: string, name: string, args: Record<string, unknown>) => {
      const result = await executeFeTool(name, args)
      const ledger = feLedgerRef.current
      if (result.ok) ledger.ok += 1
      else ledger.failed.push({ name, error: result.error || t('Gagal.') })
      setSteps(prev =>
        prev.map(s =>
          s.id === id
            ? {
                ...s,
                status: result.ok ? 'ok' : 'error',
                detail: result.ok ? result.summary : result.error,
              }
            : s
        )
      )
    },
    [executeFeTool, t]
  )

  const run = useCallback(async () => {
    const text = instruction.trim()
    if (!text || running) return

    // Reset state untuk run baru.
    setRunning(true)
    setError('')
    setTasks([])
    setSteps([])
    setSummary('')
    setFinished(false)
    feLedgerRef.current = { ok: 0, failed: [] }

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

    // Handler tiap event SSE. Untuk tool tulis (fe), eksekusi di sini &
    // di-await SEBELUM lanjut baca event berikutnya → urutan tulis terjaga
    // (insert selesai sebelum replace atas hasilnya).
    const handleEvent = async (name: string, data: Record<string, unknown>) => {
      switch (name) {
        case 'plan': {
          const raw = Array.isArray(data.tasks) ? (data.tasks as PlanTask[]) : []
          setTasks(
            raw.map((task, i) => ({
              index: typeof task.index === 'number' ? task.index : i,
              title: String(task.title ?? ''),
              status: 'pending',
            }))
          )
          break
        }
        case 'task_status': {
          const index = Number(data.index)
          const status = String(data.status) as PlanTask['status']
          const note = data.note ? String(data.note) : undefined
          setTasks(prev =>
            prev.map(task => (task.index === index ? { ...task, status, note } : task))
          )
          break
        }
        case 'tool_call': {
          const id = String(data.id ?? '')
          const toolName = String(data.name ?? '')
          const fe = Boolean(data.fe)
          const args = (data.args as Record<string, unknown>) || {}
          setSteps(prev => [...prev, { id, name: toolName, fe, args, status: 'running' }])
          if (fe) await applyFeTool(id, toolName, args)
          break
        }
        case 'tool_result': {
          // Hanya untuk tool NON-fe (server yang mengeksekusi). Tool fe pakai
          // hasil nyata dari applyFeTool, abaikan hasil optimistik server.
          const id = String(data.id ?? '')
          const ok = data.ok !== false
          const detail = data.summary ? String(data.summary) : undefined
          setSteps(prev =>
            prev.map(s =>
              s.id === id && s.fe === false
                ? { ...s, status: ok ? 'ok' : 'error', detail }
                : s
            )
          )
          break
        }
        case 'text': {
          const delta = typeof data.value === 'string' ? data.value : ''
          if (delta) setSummary(prev => prev + delta)
          break
        }
        case 'error': {
          const detail =
            (typeof data.detail === 'string' && data.detail) ||
            (typeof data.value === 'string' && data.value) ||
            t('Terjadi kesalahan.')
          setError(String(detail))
          break
        }
        // reasoning / usage / end: tak perlu ditampilkan khusus.
        default:
          break
      }
    }

    try {
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

      const flushBlock = async (block: string) => {
        let eventName = 'message'
        const dataLines: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (!dataLines.length) return
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
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setRunning(false)
      setFinished(true)
    }
  }, [applyFeTool, docId, getDocContext, instruction, llmSelection, mode, running, selectionText, t])

  const doneCount = useMemo(() => tasks.filter(task => task.status === 'done').length, [tasks])
  const ledger = feLedgerRef.current
  const hasActivity = tasks.length > 0 || steps.length > 0 || summary || error

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header instruksi */}
      <div className="shrink-0 space-y-2.5 border-b border-[var(--border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Bot size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
              {t('Kerjakan otomatis')}
            </h2>
            <p className="text-[10.5px] leading-snug text-[var(--muted-foreground)]">
              {t('Beri satu perintah — AI menyusun rencana lalu menulis & merapikan langsung ke dokumen.')}
            </p>
          </div>
        </div>

        {/* Preset sekali klik */}
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
          rows={3}
          disabled={running}
          placeholder={t('Misal: "Rapikan Bab 2 dan tambahkan paragraf pembuka di tiap sub-bab"')}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[12.5px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] disabled:opacity-60"
        />

        {/* Mode + model */}
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>

        <button
          type="button"
          onClick={() => (running ? stop() : void run())}
          disabled={!running && !instruction.trim()}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 ${
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
              <Sparkles size={14} />
              {t('Kerjakan')}
            </>
          )}
        </button>
      </div>

      {/* Timeline: rencana + aktivitas + ringkasan */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!hasActivity && !running ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ListChecks size={22} className="text-[var(--muted-foreground)]/50" />
            <p className="text-[11.5px] leading-relaxed text-[var(--muted-foreground)]">
              {t('Perintah kamu akan diubah jadi rencana kerja, lalu dieksekusi langsung ke dokumen dengan status real-time.')}
            </p>
          </div>
        ) : null}

        {/* Rencana */}
        {tasks.length > 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
            <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--foreground)]">
                <ListChecks size={13} className="text-[var(--primary)]" />
                {t('Rencana kerja')}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {doneCount}/{tasks.length} {t('selesai')}
              </span>
            </div>
            <ol className="space-y-0.5 px-2 py-2">
              {tasks.map(task => {
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
        {steps.length > 0 ? (
          <div className="space-y-1">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {t('Aktivitas')}
            </div>
            {steps.map(step => {
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

        {/* Ringkasan akhir dari model */}
        {summary ? (
          <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/[0.04] px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--primary)]">
              <Sparkles size={12} />
              {t('Ringkasan')}
            </div>
            <div className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-[var(--foreground)]">
              {summary}
              {running ? (
                <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-[var(--primary)] align-middle" />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Ledger eksekusi NYATA — kebenaran hasil tulis ke editor */}
        {finished && (ledger.ok > 0 || ledger.failed.length > 0) ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-[10.5px]">
            <div className="mb-1 font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {t('Hasil nyata di editor')}
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} /> {ledger.ok} {t('berhasil')}
              </span>
              {ledger.failed.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <XCircle size={12} /> {ledger.failed.length} {t('gagal')}
                </span>
              ) : null}
            </div>
            {ledger.failed.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-rose-600 dark:text-rose-400">
                {ledger.failed.map((f, i) => (
                  <li key={i}>
                    • {toolLabel(f.name, t)}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-50/40 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {running && !summary ? (
          <div className="flex items-center gap-2 px-1 text-[11px] text-[var(--muted-foreground)]">
            <Loader2 size={12} className="animate-spin" />
            {tasks.length === 0 ? t('Menyusun rencana…') : t('Mengeksekusi…')}
          </div>
        ) : null}
      </div>

      {onClose ? (
        <div className="shrink-0 border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {t('Tutup')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
