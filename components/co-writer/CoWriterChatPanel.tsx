'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  FileDown,
  GripVertical,
  History,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  SearchCheck,
  SendHorizonal,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'

import ModelSelector from '@/components/chat/home/ModelSelector'
import JournalWorkflowMenu, {
  type JournalWorkflowPreset,
} from '@/components/chat/JournalWorkflowMenu'
import { apiFetch, apiUrl } from '@/lib/api'
import { listLLMOptions, type LLMOption } from '@/lib/llm-options'
import type { LLMSelection } from '@/lib/unified-ws'

/**
 * Panel Chat Riset di dalam Co-Writer (PRD v2.3 §3.3).
 *
 * Research partner: tanya isi PDF / referensi, minta kerangka bab, kritik
 * draf. Setiap balasan AI punya tombol "Sisipkan ke draf" → onInsert(text)
 * menaruh teks ke posisi kursor editor.
 */

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
  /** Hanya jawaban substantif AI yang boleh ditawarkan untuk masuk ke editor. */
  insertable?: boolean
  image?: string
  mode?: ResearchMode
  model?: { name: string; profile?: string }
  evidence?: {
    document_sections: string[]
    reference_numbers: number[]
    web_used: boolean
    invalid_citations_removed: number[]
  }
}

type ResearchMode =
  'auto' | 'question' | 'drafting' | 'critique' | 'planning' | 'methodology' | 'literature'

type WebMode = 'auto' | 'on' | 'off'

/** Hasil insert-media: preview posisi sebelum diterapkan. */
interface MediaPreview {
  target_heading: string | null
  preview: string
  insert_after_line: number
  confirm_required: boolean
}

interface CoWriterChatPanelProps {
  docId: string
  /** Sisipkan teks ke posisi kursor editor. */
  onInsert: (text: string) => void
  onOpenReferences?: () => void
  onOpenAgentic?: () => void
  onExportPdf?: () => void | Promise<void>
  onExportDocx?: () => void | Promise<void>
  externalImage?: string | null
  onExternalImageConsumed?: () => void
  /** Prompt luar (mis. teks terpilih di editor Word) untuk mengisi input. */
  externalPrompt?: string | null
  onExternalPromptConsumed?: () => void
}

type WorkspaceAction =
  'structure' | 'checks' | 'checkpoint' | 'references' | 'agentic' | 'review' | 'pdf' | 'docx'

const API = '/api/v1/co_writer'

export default function CoWriterChatPanel({
  docId,
  onInsert,
  onOpenReferences,
  onOpenAgentic,
  onExportPdf,
  onExportDocx,
  externalImage,
  onExternalImageConsumed,
  externalPrompt,
  onExternalPromptConsumed,
}: CoWriterChatPanelProps) {
  const { t } = useTranslation()
  const [turns, setTurns] = useState<ChatTurn[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem(`nalar-ai.co-writer.chat.${docId}`)
      const parsed = stored ? (JSON.parse(stored) as unknown) : []
      return Array.isArray(parsed) ? (parsed as ChatTurn[]).slice(-40) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  // ── Review AI (ai-review stage 3+4) ──
  const [aiReviewResult, setAiReviewResult] = useState<{
    findings: Array<{
      location: { chapter?: string; paragraph?: number; anchor_text?: string }
      level: string
      issue: string
      suggested_action?: string
      tool_to_call?: string | null
    }>
    candidates_reviewed: number
    total_findings: number
    meta: { total_candidates: number; failed_candidates: number; partial: boolean }
  } | null>(null)
  const [aiReviewLoading, setAiReviewLoading] = useState(false)
  const [llmOptions, setLLMOptions] = useState<LLMOption[]>([])
  const [activeLLMDefault, setActiveLLMDefault] = useState<LLMSelection | null>(null)
  const [llmSelection, setLLMSelection] = useState<LLMSelection | null>(null)
  const [llmOptionsLoading, setLLMOptionsLoading] = useState(true)
  const [llmOptionsError, setLLMOptionsError] = useState(false)
  const [researchMode, setResearchMode] = useState<ResearchMode>('auto')
  const [includeDocument, setIncludeDocument] = useState(true)
  const [includeReferences, setIncludeReferences] = useState(true)
  const [webMode, setWebMode] = useState<WebMode>('auto')
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuOffset, setContextMenuOffset] = useState({ x: 0, y: 0 })
  const [contextMenuDragging, setContextMenuDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const contextDragRef = useRef<{
    startX: number
    startY: number
    startOffset: { x: number; y: number }
    startRect: DOMRect
  } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `nalar-ai.co-writer.chat.${docId}`,
        JSON.stringify(turns.slice(-40))
      )
    } catch {
      // Riwayat lokal adalah kenyamanan, bukan sumber kebenaran.
    }
  }, [docId, turns])

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
    if (!externalImage) return
    setAttachedImage(externalImage)
    onExternalImageConsumed?.()
  }, [externalImage, onExternalImageConsumed])

  useEffect(() => {
    if (!externalPrompt) return
    setInput(externalPrompt)
    onExternalPromptConsumed?.()
  }, [externalPrompt, onExternalPromptConsumed])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  useEffect(() => {
    if (!contextMenuDragging) return
    const handlePointerMove = (event: PointerEvent) => {
      const drag = contextDragRef.current
      const popup = contextMenuRef.current
      if (!drag || !popup) return
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      const minLeft = 8
      const minTop = 8
      const maxLeft = Math.max(minLeft, window.innerWidth - drag.startRect.width - 8)
      const maxTop = Math.max(minTop, window.innerHeight - drag.startRect.height - 8)
      const left = Math.min(maxLeft, Math.max(minLeft, drag.startRect.left + deltaX))
      const top = Math.min(maxTop, Math.max(minTop, drag.startRect.top + deltaY))
      setContextMenuOffset({
        x: drag.startOffset.x + left - drag.startRect.left,
        y: drag.startOffset.y + top - drag.startRect.top,
      })
    }
    const handlePointerUp = () => {
      contextDragRef.current = null
      setContextMenuDragging(false)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [contextMenuDragging])

  useEffect(() => {
    if (!contextMenuOpen) return
    const clampToViewport = () => {
      const popup = contextMenuRef.current
      if (!popup) return
      const rect = popup.getBoundingClientRect()
      const margin = 8
      let correctionX = 0
      let correctionY = 0
      if (rect.left < margin) correctionX = margin - rect.left
      else if (rect.right > window.innerWidth - margin) {
        correctionX = window.innerWidth - margin - rect.right
      }
      if (rect.top < margin) correctionY = margin - rect.top
      else if (rect.bottom > window.innerHeight - margin) {
        correctionY = window.innerHeight - margin - rect.bottom
      }
      if (correctionX || correctionY) {
        setContextMenuOffset(current => ({
          x: current.x + correctionX,
          y: current.y + correctionY,
        }))
      }
    }
    const frame = window.requestAnimationFrame(clampToViewport)
    window.addEventListener('resize', clampToViewport)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', clampToViewport)
    }
  }, [contextMenuOpen])

  const startContextMenuDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const popup = contextMenuRef.current
      if (!popup) return
      event.preventDefault()
      contextDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startOffset: contextMenuOffset,
        startRect: popup.getBoundingClientRect(),
      }
      setContextMenuDragging(true)
    },
    [contextMenuOffset]
  )

  const addAssistantTurn = useCallback((content: string) => {
    setTurns(prev => [...prev, { role: 'assistant', content, insertable: false }])
  }, [])

  const handleJournalPreset = useCallback((preset: JournalWorkflowPreset) => {
    setResearchMode(preset.mode)
    setInput(preset.prompt)
  }, [])

  const runWorkspaceAction = useCallback(
    async (action: WorkspaceAction) => {
      setBusy(true)
      setError('')
      try {
        if (action === 'references') {
          onOpenReferences?.()
          addAssistantTurn(
            'Panel referensi dibuka. Pilih grup sumber atau sisipkan sitasi dari sana.'
          )
          return
        }
        if (action === 'agentic') {
          onOpenAgentic?.()
          addAssistantTurn(
            'Agentic Write dibuka. Pilih grup referensi dan jenis bab yang ingin ditulis.'
          )
          return
        }
        if (action === 'docx') {
          await onExportDocx?.()
          addAssistantTurn('Ekspor Word telah diproses.')
          return
        }
        if (action === 'pdf') {
          await onExportPdf?.()
          addAssistantTurn('PDF rapi sedang dibuat dan dibuka di tab baru.')
          return
        }
        if (action === 'checkpoint') {
          const res = await apiFetch(
            apiUrl(`${API}/documents/${encodeURIComponent(docId)}/checkpoints`),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label: 'Checkpoint dari chat agentic' }),
            }
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          addAssistantTurn('Checkpoint proyek berhasil disimpan, termasuk seluruh berkas bab.')
          return
        }
        if (action === 'structure') {
          const res = await apiFetch(
            apiUrl(`${API}/documents/${encodeURIComponent(docId)}/gap-analysis`),
            { cache: 'no-store' }
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = (await res.json()) as {
            sections: Array<{ section: string; present: boolean; status: string }>
            total_present: number
          }
          const lines = data.sections.map(
            item => `${item.present ? '[OK]' : '[BELUM]'} ${item.section}: ${item.status}`
          )
          addAssistantTurn(
            `Hasil cek struktur (${data.total_present}/${data.sections.length} bagian tersedia):\n\n${lines.join('\n')}`
          )
          return
        }
        if (action === 'review') {
          setAiReviewLoading(true)
          setAiReviewResult(null)
          try {
            const res = await apiFetch(
              apiUrl(`${API}/documents/${encodeURIComponent(docId)}/ai-review`),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_items: 8 }),
                cache: 'no-store',
              }
            )
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = (await res.json()) as {
              findings: Array<{
                location: { chapter?: string; paragraph?: number; anchor_text?: string }
                level: string
                issue: string
                suggested_action?: string
                tool_to_call?: string | null
              }>
              candidates_reviewed: number
              total_findings: number
              meta: { total_candidates: number; failed_candidates: number; partial: boolean }
            }
            setAiReviewResult(data)
            if (data.total_findings === 0) {
              addAssistantTurn(
                data.meta?.partial
                  ? `Review AI selesai, tapi ${data.meta.failed_candidates} bagian tidak berhasil dianalisis penuh — coba jalankan ulang untuk hasil lebih lengkap.`
                  : 'Tidak ada masalah signifikan yang terdeteksi di draf ini.'
              )
            } else {
              const grouped = data.findings.reduce(
                (acc, f) => {
                  (acc[f.level] = acc[f.level] || []).push(f)
                  return acc
                },
                {} as Record<string, typeof data.findings>
              )
              const lv = {
                serious: 'Serius',
                moderate: 'Perlu Diperhatikan',
                minor: 'Kecil',
              }
              const parts = (['serious', 'moderate', 'minor'] as const)
                .filter(k => grouped[k]?.length)
                .map(
                  k =>
                    `${lv[k]} (${grouped[k].length}): ${grouped[k]
                      .map(f => `- [${f.location?.chapter || '?'}] ${f.issue}`)
                      .join('\n')}`
                )
              addAssistantTurn(`Review AI menemukan ${data.total_findings} temuan:\n\n${parts.join('\n\n')}`)
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          } finally {
            setAiReviewLoading(false)
          }
          return
        }
        const res = await apiFetch(
          apiUrl(`${API}/documents/${encodeURIComponent(docId)}/ai-checks`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            cache: 'no-store',
          }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as {
          claims_without_citation: string[]
          claim_count: number
          terminology: Array<{ term: string; count: number }>
        }
        const claims = data.claims_without_citation
          .slice(0, 8)
          .map((claim, index) => `${index + 1}. ${claim}`)
        const terms = data.terminology.slice(0, 8).map(item => `- ${item.term}: ${item.count}x`)
        addAssistantTurn(
          [
            `Ditemukan ${data.claim_count} klaim yang mungkin memerlukan sitasi.`,
            claims.length ? `\nKlaim utama:\n${claims.join('\n')}` : '',
            terms.length ? `\nIstilah yang perlu diperiksa:\n${terms.join('\n')}` : '',
          ].join('\n')
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [addAssistantTurn, docId, onExportDocx, onExportPdf, onOpenAgentic, onOpenReferences]
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setError('')
    const imageForTurn = attachedImage
    setTurns(prev => [...prev, { role: 'user', content: text, image: imageForTurn ?? undefined }])
    const normalized = text.toLowerCase()
    const directAction: WorkspaceAction | null = /cek.*struktur|kelengkapan.*bab/.test(normalized)
      ? 'structure'
      : /cek.*sitasi|klaim.*sitasi|konsistensi.*istilah/.test(normalized)
        ? 'checks'
        : /simpan.*checkpoint|buat.*checkpoint|simpan.*versi/.test(normalized)
          ? 'checkpoint'
          : /buka.*referensi|lihat.*referensi/.test(normalized)
            ? 'references'
            : /buka.*agentic|agentic write/.test(normalized)
              ? 'agentic'
              : /ekspor|export|unduh|download/.test(normalized) && /pdf/.test(normalized)
                ? 'pdf'
                : /ekspor|export|unduh|download/.test(normalized) && /word|docx/.test(normalized)
                  ? 'docx'
                  : null
    if (directAction) {
      await runWorkspaceAction(directAction)
      return
    }
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await apiFetch(apiUrl(`${API}/documents/${encodeURIComponent(docId)}/chat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          images: imageForTurn ? [imageForTurn] : [],
          llm: llmSelection,
          mode: researchMode,
          context: {
            document: includeDocument,
            references: includeReferences,
            web: webMode,
          },
          history: turns.slice(-8).map(turn => ({
            role: turn.role,
            content: turn.content,
          })),
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null
        throw new Error(body?.detail || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        reply: string
        mode?: ResearchMode
        model?: { name: string; profile?: string }
        evidence?: ChatTurn['evidence']
      }
      setTurns(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          insertable: true,
          evidence: data.evidence,
          mode: data.mode,
          model: data.model,
        },
      ])
      setAttachedImage(null)

      // Deteksi permintaan diagram → generate mermaid + preview posisi
      const wantsDiagram =
        /(buat(kan)?|gambar(kan)?|generate).*(diagram|flowchart|mermaid|alur|fishbone)|diagram.*(buat|minta)/i.test(
          text
        )
      if (wantsDiagram) {
        setBusy(true)
        try {
          const dg = await apiFetch(
            apiUrl(
              `${API}/documents/${encodeURIComponent(docId)}/generate-diagram?instruction=${encodeURIComponent(text)}`
            ),
            { method: 'POST' }
          )
          if (dg.ok) {
            const { mermaid } = (await dg.json()) as { mermaid: string }
            setTurns(prev => [
              ...prev,
              {
                role: 'assistant',
                content: `\`\`\`mermaid\n${mermaid}\n\`\`\``,
                insertable: false,
              },
            ])
          }
        } catch {
          // diagram gagal — balasan chat sudah cukup
        } finally {
          setBusy(false)
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }, [
    attachedImage,
    busy,
    docId,
    includeDocument,
    includeReferences,
    input,
    llmSelection,
    researchMode,
    runWorkspaceAction,
    turns,
    webMode,
  ])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Pesan */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {turns.length === 0 && !busy ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <MessageSquare size={22} className="text-[var(--muted-foreground)]/50" />
            <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              {t('Tanya isi referensi, minta kerangka bab, atau kritik draf di sini.')}
            </p>
            <div className="mt-2 grid w-full max-w-[260px] grid-cols-2 gap-1.5">
              {(
                [
                  ['structure', ListChecks, t('Cek struktur')],
                  ['checks', SearchCheck, t('Cek Sitasi')],
                  ['review', Sparkles, t('Review AI')],
                  ['references', BookOpen, t('Referensi')],
                  ['agentic', Bot, t('Tulis bab')],
                  ['checkpoint', History, t('Simpan versi')],
                  ['pdf', FileDown, t('Ekspor PDF')],
                  ['docx', FileDown, t('Ekspor Word')],
                ] as const
              ).map(([action, Icon, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void runWorkspaceAction(action)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-[10.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/60"
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            {aiReviewLoading && !aiReviewResult ? (
              <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[var(--muted-foreground)]">
                <Loader2 size={14} className="animate-spin" />
                <span>{t('Menganalisis draf — butuh 20-40 detik…')}</span>
              </div>
            ) : null}
            {aiReviewResult && (
              <div className="mt-2 space-y-1.5">
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t('Hasil Review AI')}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {aiReviewResult.total_findings} {t('temuan')}
                  </span>
                </div>
                {aiReviewResult.meta?.partial ? (
                  <div className="rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] leading-snug text-amber-700 dark:text-amber-300">
                    {t('Review selesai, tapi')} {aiReviewResult.meta.failed_candidates}{' '}
                    {t('bagian tidak berhasil dianalisis penuh — coba jalankan ulang.')}
                  </div>
                ) : null}
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {aiReviewResult.findings.length === 0 ? (
                    <div className="px-1 py-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
                      {t('Tidak ada masalah signifikan yang terdeteksi di draf ini.')}
                    </div>
                  ) : (
                    (['serious', 'moderate', 'minor'] as const).map(level => {
                      const items = aiReviewResult.findings.filter(f => f.level === level)
                      if (!items.length) return null
                      const label =
                        level === 'serious'
                          ? t('Serius')
                          : level === 'moderate'
                            ? t('Perlu Diperhatikan')
                            : t('Kecil')
                      const color =
                        level === 'serious'
                          ? 'text-red-600 dark:text-red-400'
                          : level === 'moderate'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-sky-600 dark:text-sky-400'
                      return (
                        <details
                          key={level}
                          className="rounded-lg border border-[var(--border)]/60"
                          open={level === 'serious'}
                        >
                          <summary className="flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 text-[10.5px] font-semibold hover:bg-[var(--muted)]/40">
                            <span className={color}>{label}</span>
                            <span className="rounded-full bg-[var(--muted)]/60 px-1.5 text-[9.5px] text-[var(--muted-foreground)]">
                              {items.length}
                            </span>
                          </summary>
                          <div className="space-y-1 px-1 pb-1 pt-0.5">
                            {items.map((f, i) => (
                              <div
                                key={i}
                                className="rounded-md border border-[var(--border)]/50 px-1.5 py-1 text-[10.5px] leading-snug"
                              >
                                <div className="mb-0.5 flex items-center justify-between gap-1">
                                  <span className="truncate text-[9.5px] italic text-[var(--muted-foreground)]">
                                    {f.location?.chapter ? `Bab ${f.location.chapter}` : ''}
                                    {f.location?.anchor_text
                                      ? ` — “${f.location.anchor_text.slice(0, 40)}…”`
                                      : ''}
                                  </span>
                                  {f.tool_to_call ? (
                                    <span className="inline-block rounded bg-[var(--primary)]/10 px-1 py-0.5 text-[9px] font-medium text-[var(--primary)]">
                                      {f.tool_to_call}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-[var(--foreground)]">{f.issue}</div>
                                {f.suggested_action ? (
                                  <div className="mt-0.5 text-[9.5px] text-[var(--muted-foreground)]">
                                    💡 {f.suggested_action.slice(0, 120)}
                                    {f.suggested_action.length > 120 ? '…' : ''}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          turns.map((turn, idx) => (
            <div
              key={idx}
              className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--muted)]/60 text-[var(--foreground)]'
                }`}
              >
                <div className="whitespace-pre-wrap">{turn.content}</div>
                {turn.role === 'assistant' && turn.evidence ? (
                  <div
                    className="mt-2 flex flex-wrap gap-1 border-t border-[var(--border)]/60 pt-1.5 text-[9.5px] text-[var(--muted-foreground)]"
                    title={turn.evidence.document_sections.join('\n')}
                  >
                    <span className="rounded bg-[var(--background)]/70 px-1.5 py-0.5">
                      {turn.evidence.document_sections.length} {t('bagian dokumen')}
                    </span>
                    <span className="rounded bg-[var(--background)]/70 px-1.5 py-0.5">
                      {turn.evidence.reference_numbers.length} {t('referensi')}
                    </span>
                    {turn.evidence.web_used ? (
                      <span className="rounded bg-[var(--background)]/70 px-1.5 py-0.5">
                        {t('web digunakan')}
                      </span>
                    ) : null}
                    {turn.evidence.invalid_citations_removed.length ? (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                        {t('sitasi tidak valid dibersihkan')}
                      </span>
                    ) : null}
                    {turn.mode ? (
                      <span className="rounded bg-[var(--background)]/70 px-1.5 py-0.5">
                        {turn.mode}
                      </span>
                    ) : null}
                    {turn.model?.name ? (
                      <span
                        className="max-w-full truncate rounded bg-[var(--background)]/70 px-1.5 py-0.5"
                        title={`${turn.model.profile || 'LLM'} · ${turn.model.name}`}
                      >
                        {turn.model.name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {turn.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={turn.image}
                    alt={t('Gambar konteks')}
                    className="mt-2 max-h-44 w-auto rounded-md border border-[var(--border)]"
                  />
                ) : null}
                {/* PRD: render gambar markdown di balasan chat */}
                {/!\[[^\]]*\]\([^)]+\)/.test(turn.content) ? (
                  <div className="mt-1.5 space-y-1.5">
                    {turn.content
                      .split(/\n/)
                      .filter(ln => /!\[[^\]]*\]\([^)]+\)/.test(ln))
                      .map((ln, gi) => {
                        const m = ln.match(/!\[([^\]]*)\]\(([^)]+)\)/)
                        if (!m) return null
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={gi}
                            src={m[2]}
                            alt={m[1] || 'gambar'}
                            className="max-h-40 w-auto rounded-lg border border-[var(--border)]"
                          />
                        )
                      })}
                  </div>
                ) : null}
                {turn.role === 'assistant' ? (
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(turn.content)}
                      title={t('Salin jawaban')}
                      className="rounded-md px-1.5 py-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const previousUser = [...turns.slice(0, idx)]
                          .reverse()
                          .find(item => item.role === 'user')
                        if (previousUser) setInput(previousUser.content)
                      }}
                      title={t('Tanyakan ulang')}
                      className="rounded-md px-1.5 py-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <RotateCcw size={11} />
                    </button>
                    {/```mermaid/.test(turn.content) ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Insert-media: AI petakan posisi heading → preview dulu
                          const mermaidRaw = turn.content
                            .replace(/```mermaid\n/, '')
                            .replace(/\n```/, '')
                            .trim()
                          void (async () => {
                            setBusy(true)
                            setError('')
                            try {
                              const res = await apiFetch(
                                apiUrl(
                                  `${API}/documents/${encodeURIComponent(docId)}/insert-media`
                                ),
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    instruction: 'Sisipkan diagram ini di bagian yang sesuai',
                                    mermaid: mermaidRaw,
                                  }),
                                }
                              )
                              if (!res.ok) throw new Error(`HTTP ${res.status}`)
                              setMediaPreview((await res.json()) as MediaPreview)
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err))
                            } finally {
                              setBusy(false)
                            }
                          })()
                        }}
                        className="rounded-md bg-[var(--primary)]/[0.12] px-2 py-0.5 text-[10.5px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/[0.2]"
                      >
                        {t('Sisipkan diagram')} →
                      </button>
                    ) : null}
                    {turn.insertable === true ? (
                      <button
                        type="button"
                        onClick={() => onInsert(turn.content)}
                        className="rounded-md bg-[var(--primary)]/[0.12] px-2 py-0.5 text-[10.5px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/[0.2]"
                      >
                        {t('Sisipkan ke draf')} →
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex items-center gap-2 px-1 text-[11.5px] text-[var(--muted-foreground)]">
            <Loader2 size={12} className="animate-spin" />
            {t('AI sedang berpikir…')}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-50/40 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}
      </div>

      {/* Dialog preview posisi diagram — Terima/Tolak (PRD v2.3 §3.6) */}
      {mediaPreview ? (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-sm">
          <div className="animate-in zoom-in-95 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {t('Preview posisi diagram')}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--muted-foreground)]">
                {t('AI akan menyisipkan diagram ') +
                  (mediaPreview.target_heading ?? t('di posisi yang dipetakan'))}
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto px-4 py-3">
              <pre className="whitespace-pre-wrap rounded-lg bg-[var(--muted)]/40 p-3 font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                {mediaPreview.preview}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setMediaPreview(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
              >
                {t('Tolak')}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Terima → sisipkan blok mermaid ke kursor
                  onInsert(mediaPreview.preview)
                  setMediaPreview(null)
                }}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                {t('Terima')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] p-2">
        <div className="mb-1.5 flex items-center gap-1">
          <JournalWorkflowMenu onSelect={handleJournalPreset} compact />
          <ModelSelector
            options={llmOptions}
            activeDefault={activeLLMDefault}
            value={llmSelection}
            loading={llmOptionsLoading}
            error={llmOptionsError}
            allowSystemDefault
            systemDefaultLabel={t('Model aktif')}
            helperText={t('Model ini hanya dipakai untuk chat Co-Writer.')}
            placement="top"
            onChange={setLLMSelection}
          />
          <select
            value={researchMode}
            onChange={event => setResearchMode(event.target.value as ResearchMode)}
            aria-label={t('Mode kerja AI')}
            title={t('Mode kerja AI')}
            className="h-8 min-w-0 max-w-[132px] rounded-lg border border-transparent bg-transparent px-1.5 text-[11px] font-medium text-[var(--muted-foreground)] outline-none hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)] focus:border-[var(--primary)]/35"
          >
            <option value="auto">{t('Mode otomatis')}</option>
            <option value="question">{t('Tanya jawab')}</option>
            <option value="drafting">{t('Tulis akademik')}</option>
            <option value="critique">{t('Kritik draf')}</option>
            <option value="planning">{t('Susun struktur')}</option>
            <option value="methodology">{t('Metodologi')}</option>
            <option value="literature">{t('Tinjauan pustaka')}</option>
          </select>
          <div className="relative">
            <button
              type="button"
              onClick={() => setContextMenuOpen(value => !value)}
              aria-label={t('Atur sumber konteks')}
              aria-expanded={contextMenuOpen}
              title={t('Atur sumber konteks')}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors ${
                contextMenuOpen
                  ? 'bg-[var(--muted)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)]'
              }`}
            >
              <Settings2 size={14} />
              <span className="hidden min-[390px]:inline">{t('Sumber')}</span>
            </button>
            {contextMenuOpen ? (
              <div
                ref={contextMenuRef}
                data-testid="co-writer-context-popup"
                className={`absolute bottom-full left-0 z-50 mb-1.5 w-[min(280px,calc(100vw-1rem))] max-h-[min(70vh,320px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-xl ${contextMenuDragging ? 'cursor-grabbing select-none' : ''}`}
                style={{
                  transform: `translate(${contextMenuOffset.x}px, ${contextMenuOffset.y}px)`,
                }}
              >
                <div
                  data-context-drag-handle
                  onPointerDown={startContextMenuDrag}
                  className="mb-1.5 flex cursor-grab touch-none items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] active:cursor-grabbing"
                  title={t('Geser panel konteks')}
                >
                  <GripVertical size={12} />
                  <span>{t('Konteks jawaban')}</span>
                </div>
                {[
                  ['document', t('Draf dan semua bab'), includeDocument, setIncludeDocument],
                  [
                    'references',
                    t('Referensi penelitian'),
                    includeReferences,
                    setIncludeReferences,
                  ],
                ].map(([key, label, checked, setter]) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() =>
                      (setter as React.Dispatch<React.SetStateAction<boolean>>)(!checked)
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-[var(--foreground)] hover:bg-[var(--muted)]/55"
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)]'}`}
                    >
                      {checked ? <Check size={11} /> : null}
                    </span>
                    {String(label)}
                  </button>
                ))}
                <div className="mt-1 border-t border-[var(--border)] pt-2">
                  <p className="mb-1 px-1 text-[10.5px] text-[var(--muted-foreground)]">
                    {t('Pencarian web')}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['auto', 'on', 'off'] as const).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setWebMode(value)}
                        className={`rounded-md px-1.5 py-1 text-[10.5px] font-medium ${
                          webMode === value
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'bg-[var(--muted)]/55 text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {value === 'auto' ? t('Otomatis') : value === 'on' ? t('Aktif') : t('Mati')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setTurns([])
              setError('')
            }}
            disabled={!turns.length || busy}
            title={t('Percakapan baru')}
            aria-label={t('Percakapan baru')}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-30"
          >
            <Trash2 size={13} />
          </button>
        </div>
        {attachedImage ? (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/35 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachedImage}
              alt={t('Gambar terlampir')}
              className="h-12 w-16 rounded object-cover"
            />
            <span className="min-w-0 flex-1 text-[10.5px] text-[var(--muted-foreground)]">
              {t('Gambar siap dianalisis')}
            </span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              title={t('Hapus lampiran')}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (file.size > 4 * 1024 * 1024) {
              setError(t('Gambar maksimal 4 MB.'))
              return
            }
            const reader = new FileReader()
            reader.onload = () => setAttachedImage(String(reader.result || ''))
            reader.onerror = () => setError(t('Gambar tidak dapat dibaca.'))
            reader.readAsDataURL(file)
          }}
        />
        <div className="flex items-end gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 focus-within:border-[var(--primary)]/50">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            title={t('Lampirkan gambar')}
          >
            {attachedImage ? <ImageIcon size={13} /> : <Paperclip size={13} />}
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder={t('Tanya AI tentang referensi atau draf…')}
            className="min-h-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-[12.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <button
            type="button"
            onClick={() => {
              if (busy) abortRef.current?.abort()
              else void send()
            }}
            disabled={!busy && !input.trim()}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-30 ${busy ? 'bg-rose-600' : 'bg-[var(--primary)]'}`}
            title={busy ? t('Hentikan') : t('Kirim')}
          >
            {busy ? <Square size={11} fill="currentColor" /> : <SendHorizonal size={13} />}
          </button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-[var(--muted-foreground)]/70">
          <Sparkles size={9} className="mr-0.5 inline" />
          {t('Balasan bisa disisipkan ke draf dengan satu klik.')}
        </p>
      </div>
    </div>
  )
}
