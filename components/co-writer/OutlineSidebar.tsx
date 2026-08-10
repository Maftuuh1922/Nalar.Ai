'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, ChevronDown, ChevronRight, ListTree, Loader2 } from 'lucide-react'

import type { CoWriterOutlineHeading } from '@/lib/co-writer-api'

/**
 * Panel Outline (PRD 9.1): tree heading H1-H3 dokumen aktif, klik untuk
 * melompat ke bagian terkait di editor. Di bawahnya ditampilkan status
 * ringkas referensi grup laporan aktif.
 */

interface OutlineSidebarProps {
  headings: CoWriterOutlineHeading[]
  activePath: string
  loading?: boolean
  /** Jumlah referensi di grup laporan aktif. */
  referenceCount: number | null
  /** Nama grup laporan aktif. */
  groupName: string | null
  /** Buka berkas, lompat ke offset editor, lalu cari judul yang sama di PDF. */
  onJumpTo: (path: string, offset: number, title: string) => void | Promise<void>
}

export default function OutlineSidebar({
  headings,
  activePath,
  loading = false,
  referenceCount,
  groupName,
  onJumpTo,
}: OutlineSidebarProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggleSummary = (key: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <ListTree size={12} />
          {t('Outline')}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-2 py-4 text-[11px] text-[var(--muted-foreground)]">
            <Loader2 size={12} className="animate-spin" />
            {t('Membaca struktur proyek...')}
          </div>
        ) : headings.length === 0 ? (
          <div className="px-2 py-3 text-center text-[11px] text-[var(--muted-foreground)]">
            {t('Belum ada bab. Tambahkan \\section pada dokumen.')}
          </div>
        ) : (
          <div className="space-y-0.5">
            {headings.map((heading, index) => {
              const key = `${heading.path}:${heading.offset}:${index}`
              const isExpanded = expanded.has(key)
              return (
                <div key={key}>
                  <div
                    className={`group flex items-center rounded-md transition-colors hover:bg-[var(--muted)]/40 ${
                      heading.path === activePath ? 'bg-[var(--primary)]/[0.08]' : ''
                    }`}
                    style={{ paddingLeft: 4 + (heading.level - 1) * 12 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSummary(key)}
                      disabled={!heading.summary}
                      className="inline-flex h-6 w-5 shrink-0 items-center justify-center text-[var(--muted-foreground)] disabled:opacity-20"
                      title={t('Tampilkan ringkasan bagian')}
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onJumpTo(heading.path, heading.offset, heading.title)}
                      className="min-w-0 flex-1 py-1 pr-1.5 text-left text-[11.5px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                    >
                      <span className="block truncate">{heading.title}</span>
                      <span className="block truncate text-[9.5px] opacity-60">
                        {heading.path} · {heading.word_count} {t('kata')}
                      </span>
                    </button>
                  </div>
                  {isExpanded && heading.summary ? (
                    <p
                      className="mb-1.5 border-l border-[var(--border)] py-1 pr-2 text-[10.5px] leading-relaxed text-[var(--muted-foreground)]"
                      style={{ marginLeft: 18 + (heading.level - 1) * 12, paddingLeft: 8 }}
                    >
                      {heading.summary}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status referensi grup aktif */}
      <div className="shrink-0 border-t border-[var(--border)] p-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <BookMarked size={12} />
          {t('Referensi')}
        </div>
        {groupName ? (
          <div className="text-[11.5px] text-[var(--foreground)]">
            {groupName}
            <span className="ml-1.5 rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              {referenceCount ?? 0} {t('sumber')}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-[var(--muted-foreground)]">
            {t('Pilih grup laporan di panel Referensi.')}
          </div>
        )}
      </div>
    </div>
  )
}
