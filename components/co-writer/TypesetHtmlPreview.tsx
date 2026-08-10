'use client'

/**
 * Panel pratinjau HTML dari Lapis 2 (PRD v2.8 §3).
 *
 * Mengirim isi editor ke `POST /typeset`, lalu menampilkan HTML hasil render
 * AST di iframe `srcdoc`. Tidak ada kompiler LaTeX di jalur ini — pratinjau
 * selalu bisa tampil walau dokumen belum lengkap (PRV01).
 *
 * Keputusan desain:
 *
 * 1. **HTML terakhir yang berhasil dipertahankan saat permintaan gagal.**
 *    Saat mengetik, dokumen setengah jadi adalah keadaan normal; mengosongkan
 *    panel setiap kali itu terjadi membuat layar berkedip.
 * 2. **Permintaan lama dibatalkan lewat AbortController.** Balasan yang datang
 *    tidak berurutan bisa menimpa hasil yang lebih baru.
 * 3. **PDF asli tetap tersedia** untuk dokumen yang diimpor dari PDF (tab
 *    "Asli"), ditampilkan lewat penampil PDF bawaan browser.
 */

import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Heading1,
  Loader2,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DEBOUNCE_MS = 1000

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[{}\\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('id-ID')
}

interface Props {
  docId: string
  documentTitle?: string
  content: string
  sourceFormat?: string | null
  /** Judul outline yang perlu ditemukan pada pratinjau aktif. */
  jumpToText?: string | null
  onJumpToTextHandled?: () => void
  /** Naikkan angkanya untuk memaksa render ulang segera. */
  compileNonce?: number
  onCapture?: (imageDataUrl: string) => void
}

export default function TypesetHtmlPreview({
  docId,
  documentTitle = 'dokumen',
  content,
  sourceFormat = null,
  jumpToText = null,
  onJumpToTextHandled,
  compileNonce = 0,
  onCapture,
}: Props) {
  const { t } = useTranslation()
  const [html, setHtml] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'original' | 'edited'>(
    sourceFormat === 'pdf' ? 'original' : 'edited'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [locatingHeading, setLocatingHeading] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [activeHeading, setActiveHeading] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const onJumpHandledRef = useRef(onJumpToTextHandled)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const headingObserverRef = useRef<IntersectionObserver | null>(null)
  const hasOriginalPdf = sourceFormat === 'pdf'

  // Perkiraan lebar halaman A4 pada 96 DPI (pixels).
  const A4_WIDTH_PX = 794

  const attachActiveHeadingObserver = useCallback((): boolean => {
    headingObserverRef.current?.disconnect()
    if (previewMode !== 'edited') {
      setActiveHeading('')
      return false
    }
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!doc) return false
    const headings = Array.from(doc.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
    if (headings.length === 0) {
      setActiveHeading('')
      return false
    }
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const top = visible[0]?.target as HTMLElement | undefined
        if (top) setActiveHeading((top.textContent || '').trim().slice(0, 60))
      },
      { root: doc.documentElement, rootMargin: '0px 0px -70% 0px' }
    )
    headings.forEach(h => observer.observe(h))
    headingObserverRef.current = observer
    return true
  }, [previewMode])

  useEffect(() => {
    // srcdoc dimuat secara async — observer perlu retry sampai iframe siap.
    // Catatan: onLoad React tidak memicu untuk iframe (event-nya tidak bubble).
    const id = window.setInterval(() => {
      if (attachActiveHeadingObserver()) window.clearInterval(id)
    }, 200)
    return () => {
      window.clearInterval(id)
      headingObserverRef.current?.disconnect()
    }
  }, [html, previewMode, attachActiveHeadingObserver])

  // Zoom "sesuai lebar": lebar halaman A4 disamakan dengan lebar kotak pratinjau.
  const fitToWidth = () => {
    const box = previewBoxRef.current
    if (!box) return
    const next = (box.clientWidth - 48) / A4_WIDTH_PX
    setZoom(Math.min(2.5, Math.max(0.5, Number(next.toFixed(2)))))
  }

  useEffect(() => {
    onJumpHandledRef.current = onJumpToTextHandled
  }, [onJumpToTextHandled])

  useEffect(() => {
    setPreviewMode(sourceFormat === 'pdf' ? 'original' : 'edited')
  }, [docId, sourceFormat])

  const render = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const res = await fetch(
        `/api/v1/co_writer/documents/${encodeURIComponent(docId)}/typeset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: ctrl.signal,
          cache: 'no-store',
        }
      )
      if (!res.ok) {
        let log = `HTTP ${res.status}`
        try {
          const data = await res.json()
          const detail = data?.detail
          log = typeof detail === 'string' ? detail : detail?.message || log
        } catch {
          /* balasan bukan JSON — pakai status apa adanya */
        }
        setError(log)
        return // HTML lama sengaja dibiarkan di layar
      }
      const data = (await res.json()) as { html?: string }
      if (typeof data.html === 'string') {
        setHtml(data.html)
        setError('')
      } else {
        setError(t('Balasan pratinjau tidak memiliki HTML.'))
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError((e as Error)?.message || t('Gagal menghubungi peladen.'))
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }, [content, docId, t])

  // Debounce: AST dibangun ulang pada setiap ketikan, tapi tidak tanpa jeda.
  useEffect(() => {
    const timer = setTimeout(() => void render(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [render])

  // Render ulang manual — langsung, tanpa menunggu debounce.
  useEffect(() => {
    if (compileNonce > 0) void render()
    // render sengaja tidak jadi dependensi: hanya nonce yang memicu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileNonce])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Lompat ke heading: cari teksnya di DOM pratinjau HTML dan gulirkan.
  useEffect(() => {
    const needle = normalizeSearchText(jumpToText || '')
    const frame = frameRef.current
    if (previewMode !== 'edited' || !frame || !needle) {
      if (needle) onJumpHandledRef.current?.()
      return
    }
    let cancelled = false
    setLocatingHeading(true)
    const doc = frame.contentDocument
    if (!doc) {
      onJumpHandledRef.current?.()
      setLocatingHeading(false)
      return
    }
    const target = Array.from(
      doc.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p')
    ).find(el => normalizeSearchText(el.textContent || '').includes(needle))
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        if (!cancelled) setLocatingHeading(false)
        onJumpHandledRef.current?.()
      }, 300)
      return
    }
    setLocatingHeading(false)
    onJumpHandledRef.current?.()
    return () => {
      cancelled = true
    }
  }, [previewMode, jumpToText, html])

  const capturePage = () => {
    if (!onCapture) return
    const frame = frameRef.current
    const source = frame?.contentDocument?.documentElement
    if (!source) return
    try {
      const width = source.scrollWidth
      const height = source.scrollHeight
      const maxDimension = 1600
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${source.outerHTML}</foreignObject></svg>`
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const output = document.createElement('canvas')
        output.width = Math.max(1, Math.round(width * scale))
        output.height = Math.max(1, Math.round(height * scale))
        const context = output.getContext('2d')
        if (context) {
          context.drawImage(img, 0, 0, output.width, output.height)
          onCapture(output.toDataURL('image/jpeg', 0.86))
        }
        URL.revokeObjectURL(url)
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    } catch {
      /* dokumen iframe tidak bisa diakses — tangkapan dibatalkan */
    }
  }

  const downloadPdf = async () => {
    if (!html) return
    const safeTitle =
      documentTitle
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .slice(0, 80) || 'dokumen'
    try {
      const res = await fetch(
        `/api/v1/co_writer/documents/${encodeURIComponent(docId)}/export-latex?format=pdf`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null
        throw new Error(body?.detail || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const isDocx = blob.type.includes('officedocument')
      anchor.download = `${safeTitle}${isDocx ? '.docx' : '.pdf'}`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error)?.message || t('Gagal mengekspor PDF.'))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Kontrol */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <div className="flex items-center gap-1">
          {hasOriginalPdf ? (
            <div className="mr-1 flex rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
              <button
                type="button"
                onClick={() => setPreviewMode('original')}
                className={`h-6 rounded px-2 text-[10.5px] font-medium transition-colors ${
                  previewMode === 'original'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t('Asli')}
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('edited')}
                title={t('Pratinjau hasil edit dari dokumen aktif — tata letak disusun ulang')}
                className={`h-6 rounded px-2 text-[10.5px] font-medium transition-colors ${
                  previewMode === 'edited'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t('Hasil edit')}
              </button>
            </div>
          ) : null}
          <span className="text-[10.5px] text-[var(--muted-foreground)]">
            {previewMode === 'edited' ? t('Pratinjau HTML') : t('PDF asli')}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          {activeHeading ? (
            <span
              title={activeHeading}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[10.5px] text-[var(--muted-foreground)]"
            >
              <Heading1 size={11} className="shrink-0 text-[var(--primary)]" />
              <span className="truncate">{activeHeading}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {loading && previewMode === 'edited' && (
            <span className="mr-1 flex items-center gap-1 text-[10.5px] text-[var(--muted-foreground)]">
              <Loader2 size={11} className="animate-spin" />
              {t('Memperbarui pratinjau...')}
            </span>
          )}
          {locatingHeading ? (
            <span className="mr-1 flex items-center gap-1 text-[10.5px] text-[var(--muted-foreground)]">
              <Loader2 size={11} className="animate-spin" />
              {t('Mencari bagian...')}
            </span>
          ) : null}
          {error && previewMode === 'edited' && (
            <span className="mr-1 flex max-w-[220px] items-center gap-1 truncate text-[10.5px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={12} className="shrink-0" />
              <span className="truncate">{error}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={!html}
            title={t('Unduh PDF')}
            aria-label={t('Unduh PDF')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={capturePage}
            disabled={!html || !onCapture || previewMode !== 'edited'}
            title={t('Send this page to the assistant')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <Camera size={13} />
          </button>
          <button
            type="button"
            onClick={() => void render()}
            disabled={previewMode === 'original'}
            title={t('Render ulang')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            onClick={fitToWidth}
            title={t('Sesuaikan lebar halaman')}
            aria-label={t('Sesuaikan lebar halaman')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            title={t('Zoom out')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ZoomOut size={13} />
          </button>
          <span className="w-9 text-center text-[10px] tabular-nums text-[var(--muted-foreground)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}
            title={t('Zoom in')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>

      {/* Pratinjau */}
      <div
        ref={previewBoxRef}
        className="min-h-0 flex-1 overflow-auto bg-[var(--muted)]/30 p-6"
      >
        {previewMode === 'edited' ? (
          html ? (
            <div
              className="origin-top transition-transform"
              style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
            >
              <iframe
                ref={frameRef}
                title={t('Pratinjau dokumen')}
                sandbox="allow-same-origin"
                srcDoc={html}
                className="h-[calc(100vh-160px)] w-full border-0 bg-white shadow-lg"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              {loading ? (
                <p className="text-center text-[12px] text-[var(--muted-foreground)]">
                  {t('Menyusun pratinjau...')}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  {error ? (
                    <>
                      <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                      <p className="max-w-xs text-[12px] text-[var(--foreground)]">{error}</p>
                    </>
                  ) : (
                    <p className="text-[12px] text-[var(--muted-foreground)]">
                      {t('Belum ada hasil pratinjau.')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void render()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
                  >
                    <RefreshCw size={11} />
                    {t('Coba lagi')}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <iframe
            title={t('PDF asli')}
            src={`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/source`}
            onLoad={() => setSourceError(null)}
            onError={() => setSourceError(t('PDF asli gagal dimuat.'))}
            className="h-[calc(100vh-160px)] w-full border-0 bg-white shadow-lg"
          />
        )}
        {sourceError && previewMode === 'original' && (
          <p className="mt-2 text-center text-[11px] text-amber-600 dark:text-amber-400">
            {sourceError}
          </p>
        )}
      </div>
    </div>
  )
}
