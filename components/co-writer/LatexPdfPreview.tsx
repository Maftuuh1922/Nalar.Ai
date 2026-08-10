'use client'

/**
 * Panel pratinjau PDF untuk editor LaTeX.
 *
 * Mengirim isi editor ke `POST /compile`, lalu merender PDF-nya dengan pdf.js.
 * Dua keputusan yang penting untuk pengalaman mengetik:
 *
 * 1. **PDF terakhir yang berhasil dipertahankan saat kompilasi gagal.** Saat
 *    mengetik, dokumen setengah jadi (`\begin{itemize}` yang belum ditutup)
 *    adalah keadaan normal. Mengosongkan panel setiap kali itu terjadi membuat
 *    layar berkedip dan pengguna kehilangan tempatnya.
 * 2. **Permintaan lama dibatalkan lewat AbortController.** Tanpa itu, balasan
 *    yang datang tidak berurutan bisa menimpa hasil yang lebih baru.
 */

import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Worker dilayani dari public/, bukan CDN, supaya jalan tanpa internet.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const DEBOUNCE_MS = 1500
const PDF_RENDER_PIXEL_RATIO = 2
const PDF_BESAR_BYTES = 4_500_000 // > ~4,5 MB → rasio render diturunkan agar hemat memori

/** Periksa tanda tangan `%PDF-` pada blob agar pdf.js tidak diberi file non-PDF. */
async function blobAdalahPdf(blob: Blob): Promise<boolean> {
  try {
    const kepala = new Uint8Array(await blob.slice(0, 5).arrayBuffer())
    return (
      kepala.length === 5 &&
      kepala[0] === 0x25 &&
      kepala[1] === 0x50 &&
      kepala[2] === 0x44 &&
      kepala[3] === 0x46 &&
      kepala[4] === 0x2d
    )
  } catch {
    return false
  }
}

function normalizePdfSearchText(value: string): string {
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
  path?: string
  sourceFormat?: string | null
  /** Judul outline yang perlu dicari pada teks PDF aktif. */
  jumpToText?: string | null
  onJumpToTextHandled?: () => void
  /** Naikkan angkanya untuk memaksa kompilasi ulang segera (tombol Recompile). */
  compileNonce?: number
  onCapture?: (imageDataUrl: string) => void
}

export default function LatexPdfPreview({
  docId,
  documentTitle = 'dokumen',
  content,
  path = 'main.tex',
  sourceFormat = null,
  jumpToText = null,
  onJumpToTextHandled,
  compileNonce = 0,
  onCapture,
}: Props) {
  const { t } = useTranslation()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [sourcePdfUrl, setSourcePdfUrl] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'original' | 'edited'>(
    sourceFormat === 'pdf' ? 'original' : 'edited'
  )
  const [loadingSource, setLoadingSource] = useState(false)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [compiling, setCompiling] = useState(false)
  const [errorLog, setErrorLog] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [width, setWidth] = useState(600)
  const [pageRendered, setPageRendered] = useState(false)
  const [pdfDocumentVersion, setPdfDocumentVersion] = useState(0)
  const [locatingHeading, setLocatingHeading] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [renderRatio, setRenderRatio] = useState(PDF_RENDER_PIXEL_RATIO)

  const abortRef = useRef<AbortController | null>(null)
  const sourceAbortRef = useRef<AbortController | null>(null)
  const onJumpHandledRef = useRef(onJumpToTextHandled)
  const urlRef = useRef<string | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null)
  const hasOriginalPdf = sourceFormat === 'pdf'
  const activePdfUrl = previewMode === 'original' ? sourcePdfUrl : pdfUrl

  useEffect(() => {
    onJumpHandledRef.current = onJumpToTextHandled
  }, [onJumpToTextHandled])

  // Lebar halaman mengikuti lebar panel supaya PDF tidak terpotong saat
  // splitter digeser.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setWidth(Math.max(240, el.clientWidth - 48))
    })
    obs.observe(el)
    setWidth(Math.max(240, el.clientWidth - 48))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    setPreviewMode(sourceFormat === 'pdf' ? 'original' : 'edited')
  }, [docId, sourceFormat])

  const muatSource = useCallback(async () => {
    sourceAbortRef.current?.abort()
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = null
    }
    setSourcePdfUrl(null)
    setSourceError(null)
    if (!hasOriginalPdf) return

    const ctrl = new AbortController()
    sourceAbortRef.current = ctrl
    setLoadingSource(true)
    try {
      const res = await fetch(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/source`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!(await blobAdalahPdf(blob))) {
        setSourceError(t('Berkas asli bukan PDF yang bisa dibuka pratinjau.'))
        return
      }
      setRenderRatio(blob.size > PDF_BESAR_BYTES ? 1.5 : PDF_RENDER_PIXEL_RATIO)
      const next = URL.createObjectURL(blob)
      sourceUrlRef.current = next
      setSourcePdfUrl(next)
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        setSourceError(t('PDF asli gagal dimuat. Periksa koneksi, lalu coba lagi.'))
      }
    } finally {
      if (sourceAbortRef.current === ctrl) setLoadingSource(false)
    }
  }, [docId, hasOriginalPdf, t])

  useEffect(() => {
    void muatSource()
    return () => sourceAbortRef.current?.abort()
  }, [muatSource])

  const compile = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setCompiling(true)
    try {
      const res = await fetch(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, path }),
        signal: ctrl.signal,
        cache: 'no-store',
      })

      if (!res.ok) {
        let log = `HTTP ${res.status}`
        try {
          const data = await res.json()
          const detail = data?.detail
          log = typeof detail === 'string' ? detail : detail?.log || detail?.message || log
        } catch {
          /* balasan bukan JSON — pakai status apa adanya */
        }
        setErrorLog(log)
        return // PDF lama sengaja dibiarkan di layar
      }

      const blob = await res.blob()
      if (!(await blobAdalahPdf(blob))) {
        setErrorLog(t('Hasil kompilasi bukan PDF. Coba kompilasi ulang.'))
        return
      }
      setRenderRatio(blob.size > PDF_BESAR_BYTES ? 1.5 : PDF_RENDER_PIXEL_RATIO)
      const next = URL.createObjectURL(blob)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = next
      setPdfUrl(next)
      setPageRendered(false)
      setErrorLog('')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setErrorLog((e as Error)?.message || 'Gagal menghubungi peladen.')
    } finally {
      if (abortRef.current === ctrl) setCompiling(false)
    }
  }, [content, docId, path, t])

  // Debounce: tectonic tidak dipanggil pada setiap ketikan.
  useEffect(() => {
    const timer = setTimeout(() => void compile(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [compile])

  // Recompile manual — langsung, tanpa menunggu debounce.
  useEffect(() => {
    if (compileNonce > 0) void compile()
    // compile sengaja tidak jadi dependensi: hanya nonce yang memicu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileNonce])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      sourceAbortRef.current?.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    }
  }, [])

  const clampPage = (n: number) => Math.max(1, Math.min(pageCount || 1, n))

  useEffect(() => {
    setPageRendered(false)
  }, [activePdfUrl, page, zoom, width])

  useEffect(() => {
    pdfDocumentRef.current = null
  }, [activePdfUrl])

  useEffect(() => {
    const pdf = pdfDocumentRef.current
    const needle = normalizePdfSearchText(jumpToText || '')
    if (!pdf || !needle) return
    let cancelled = false
    const requestPdfUrl = activePdfUrl
    setLocatingHeading(true)
    void (async () => {
      let found = false
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const pdfPage = await pdf.getPage(pageNumber)
          const textContent = await pdfPage.getTextContent()
          const haystack = normalizePdfSearchText(
            textContent.items.map(item => ('str' in item ? item.str : '')).join(' ')
          )
          if (haystack.includes(needle)) {
            found = true
            if (!cancelled) setPage(pageNumber)
            return
          }
        }
        // Beri waktu kompilasi baru mengganti object URL ketika outline dibuka
        // pada berkas anak; jangan mengonsumsi permintaan lompat untuk PDF lama.
        await new Promise(resolve => window.setTimeout(resolve, 1800))
      } finally {
        if (!cancelled && (found || requestPdfUrl === activePdfUrl)) {
          setLocatingHeading(false)
          onJumpHandledRef.current?.()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePdfUrl, jumpToText, pdfDocumentVersion])

  const capturePage = () => {
    const source = wrapRef.current?.querySelector('canvas')
    if (!source || !onCapture) return
    const maxDimension = 1600
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
    const output = document.createElement('canvas')
    output.width = Math.max(1, Math.round(source.width * scale))
    output.height = Math.max(1, Math.round(source.height * scale))
    const context = output.getContext('2d')
    if (!context) return
    context.drawImage(source, 0, 0, output.width, output.height)
    onCapture(output.toDataURL('image/jpeg', 0.86))
  }

  const downloadPdf = () => {
    if (!activePdfUrl) return
    const safeTitle =
      documentTitle
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .slice(0, 80) || 'dokumen'
    const suffix = previewMode === 'original' ? '-asli' : ''
    const anchor = document.createElement('a')
    anchor.href = activePdfUrl
    anchor.download = `${safeTitle}${suffix}.pdf`
    anchor.click()
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
                title={t('Kompilasi ulang dari kode editor — tata letak dapat berbeda dari PDF asli')}
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
          <button
            type="button"
            onClick={() => setPage(p => clampPage(p - 1))}
            disabled={page <= 1}
            title={t('Previous page')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[52px] text-center text-[11px] tabular-nums text-[var(--muted-foreground)]">
            {pageCount ? `${page} / ${pageCount}` : '— / —'}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => clampPage(p + 1))}
            disabled={!pageCount || page >= pageCount}
            title={t('Next page')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {compiling && previewMode === 'edited' && (
            <span className="mr-1 flex items-center gap-1 text-[10.5px] text-[var(--muted-foreground)]">
              <Loader2 size={11} className="animate-spin" />
              {t('Compiling...')}
            </span>
          )}
          {locatingHeading ? (
            <span className="mr-1 flex items-center gap-1 text-[10.5px] text-[var(--muted-foreground)]">
              <Loader2 size={11} className="animate-spin" />
              {t('Mencari halaman...')}
            </span>
          ) : null}
          {errorLog && previewMode === 'edited' && (
            <button
              type="button"
              onClick={() => setLogOpen(v => !v)}
              title={t('View compilation error')}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px] font-medium text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            >
              <AlertTriangle size={12} />
              {t('Error')}
            </button>
          )}
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!activePdfUrl}
            title={t('Unduh PDF')}
            aria-label={t('Unduh PDF')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={capturePage}
            disabled={!activePdfUrl || !onCapture || !pageRendered}
            title={t('Send this page to the assistant')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <Camera size={13} />
          </button>
          <button
            type="button"
            onClick={() => void compile()}
            disabled={previewMode === 'original'}
            title={t('Compile again')}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <RefreshCw size={13} />
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

      {/* Log galat — dapat dilipat, PDF terakhir tetap di bawahnya */}
      {errorLog && logOpen && previewMode === 'edited' && (
        <div className="max-h-44 shrink-0 overflow-auto border-b border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
          <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
            {errorLog}
          </pre>
        </div>
      )}

      {/* Kanvas PDF */}
      <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto bg-[var(--muted)]/30 p-6">
        {activePdfUrl ? (
          <Document
            file={activePdfUrl}
            onLoadSuccess={pdf => {
              pdfDocumentRef.current = pdf
              setPdfDocumentVersion(version => version + 1)
              setPageCount(pdf.numPages)
              setPage(p => Math.max(1, Math.min(pdf.numPages, p)))
            }}
            loading={
              <p className="text-center text-[12px] text-[var(--muted-foreground)]">
                {t('Loading PDF...')}
              </p>
            }
            error={
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[12px] font-medium text-[var(--foreground)]">
                  {t('The PDF could not be opened.')}
                </p>
                <p className="max-w-xs text-[10.5px] leading-relaxed text-[var(--muted-foreground)]">
                  {t('PDF besar terkadang gagal dimuat di pratinjau. Unduh dulu untuk membukanya, atau coba muat ulang.')}
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewMode === 'edited') void compile()
                      else void muatSource()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
                  >
                    <RefreshCw size={11} />
                    {t('Coba lagi')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                  >
                    <Download size={11} />
                    {t('Unduh PDF')}
                  </button>
                </div>
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={page}
              width={width * zoom}
              devicePixelRatio={renderRatio}
              renderAnnotationLayer={false}
              onRenderSuccess={() => setPageRendered(true)}
              className="shadow-lg"
            />
          </Document>
        ) : (
          <div className="flex h-full items-center justify-center">
            {sourceError && previewMode === 'original' ? (
              <div className="flex max-w-sm flex-col items-center gap-2 px-6 text-center">
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[12px] font-medium text-[var(--foreground)]">{sourceError}</p>
                <button
                  type="button"
                  onClick={() => void muatSource()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
                >
                  <RefreshCw size={11} />
                  {t('Coba lagi')}
                </button>
              </div>
            ) : (
              <p className="text-center text-[12px] text-[var(--muted-foreground)]">
                {previewMode === 'original' && loadingSource
                  ? t('Loading PDF...')
                  : previewMode === 'edited' && compiling
                    ? t('Compiling...')
                    : t('Belum ada hasil PDF.')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
