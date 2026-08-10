'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  BookMarked,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Quote,
  Search,
  X,
} from 'lucide-react'

import {
  generateCitation,
  listCitationFormats,
  listJournalGroups,
  listJournalReferences,
  type CitationFormat,
  type JournalGroup,
  type JournalReference,
} from '@/lib/journal-api'

interface ReferenceSidebarProps {
  open: boolean
  onClose: () => void
  onInsert: (text: string) => void
}

type NumberedReference = JournalReference & { citationNumber: number }
type MetadataFilter = 'all' | 'complete' | 'incomplete'

function metadataComplete(reference: JournalReference): boolean {
  return Boolean(
    (reference.title || reference.filename) && reference.authors?.length && reference.year
  )
}

function firstAuthorLabel(reference: JournalReference): string {
  const authors = reference.authors ?? []
  if (!authors.length) return reference.title || reference.filename
  const first = authors[0].trim()
  const surname = first.includes(',')
    ? first.split(',', 1)[0].trim()
    : first.split(/\s+/).at(-1) || first
  return authors.length > 2 ? `${surname} et al.` : surname
}

function inTextCitation(references: NumberedReference[], format: string): string {
  if (format === 'ieee' || format === 'vancouver') {
    const numbers = [...new Set(references.map(item => item.citationNumber).filter(Boolean))].sort(
      (a, b) => a - b
    )
    if (numbers.length) return `[${numbers.join(', ')}]`
  }

  const labels = references.map(reference => {
    const author = firstAuthorLabel(reference)
    return reference.year ? `${author}, ${reference.year}` : author
  })
  return `(${labels.join('; ')})`
}

export default function ReferenceSidebar({ open, onClose, onInsert }: ReferenceSidebarProps) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<JournalGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState('')
  const [references, setReferences] = useState<NumberedReference[]>([])
  const [formats, setFormats] = useState<CitationFormat[]>([])
  const [format, setFormat] = useState('ieee')
  const [query, setQuery] = useState('')
  const [metadataFilter, setMetadataFilter] = useState<MetadataFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [batchCopied, setBatchCopied] = useState(false)

  const refreshGroups = useCallback(async () => {
    try {
      const data = await listJournalGroups()
      setGroups(data)
      setActiveGroupId(previous => previous || data[0]?.id || '')
    } catch {
      setGroups([])
    }
  }, [])

  const refreshReferences = useCallback(async (groupId: string) => {
    if (!groupId) {
      setReferences([])
      return
    }
    setLoading(true)
    setSelectedIds(new Set())
    setExpandedId(null)
    try {
      const [groupReferences, allReferences] = await Promise.all([
        listJournalReferences(groupId),
        listJournalReferences(),
      ])
      const ordered = [...allReferences].sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
      )
      const numberById = new Map(ordered.map((reference, index) => [reference.id, index + 1]))
      setReferences(
        groupReferences.map(reference => ({
          ...reference,
          citationNumber: numberById.get(reference.id) ?? 0,
        }))
      )
    } catch {
      setReferences([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshGroups()
    void listCitationFormats()
      .then(setFormats)
      .catch(() => setFormats([]))
  }, [open, refreshGroups])

  useEffect(() => {
    void refreshReferences(activeGroupId)
  }, [activeGroupId, refreshReferences])

  const activeGroup = useMemo(
    () => groups.find(group => group.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  )

  const filteredReferences = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return references.filter(reference => {
      const complete = metadataComplete(reference)
      if (metadataFilter === 'complete' && !complete) return false
      if (metadataFilter === 'incomplete' && complete) return false
      if (!normalized) return true
      return [
        reference.title,
        reference.filename,
        ...(reference.authors ?? []),
        reference.year,
        reference.journal_name,
        reference.doi,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [metadataFilter, query, references])

  const selectedReferences = useMemo(
    () => references.filter(reference => selectedIds.has(reference.id)),
    [references, selectedIds]
  )

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(current => {
      const next = new Set(current)
      const allSelected = filteredReferences.every(reference => next.has(reference.id))
      for (const reference of filteredReferences) {
        if (allSelected) next.delete(reference.id)
        else next.add(reference.id)
      }
      return next
    })
  }

  const insertReferences = (items: NumberedReference[]) => {
    if (!items.length) return
    onInsert(inTextCitation(items, format))
  }

  const copyFullCitation = async (reference: NumberedReference) => {
    try {
      const data = await generateCitation(reference.id, format)
      await navigator.clipboard.writeText(data.citation)
      setCopiedId(reference.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Metadata yang belum lengkap ditandai pada kartu; tidak menyalin fallback palsu.
    }
  }

  const copySelectedBibliography = async () => {
    if (!selectedReferences.length) return
    setBusy(true)
    try {
      const citations = await Promise.all(
        selectedReferences.map(async reference => {
          try {
            return (await generateCitation(reference.id, format)).citation
          } catch {
            return `${reference.title || reference.filename}${reference.year ? ` (${reference.year})` : ''}`
          }
        })
      )
      await navigator.clipboard.writeText(citations.join('\n'))
      setBatchCopied(true)
      setTimeout(() => setBatchCopied(false), 1500)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--foreground)]">
          <BookMarked size={14} className="text-[var(--primary)]" />
          {t('Referensi')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          aria-label={t('Close')}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 border-b border-[var(--border)] px-3 py-2.5">
        <div>
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {t('Grup laporan')}
          </label>
          <select
            value={activeGroupId}
            onChange={event => setActiveGroupId(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
          >
            {groups.length === 0 ? (
              <option value="">{t('Belum ada grup')}</option>
            ) : (
              groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              {t('Format')}
            </label>
            <select
              value={format}
              onChange={event => setFormat(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[11px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            >
              {formats.map(item => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              {t('Metadata')}
            </label>
            <select
              value={metadataFilter}
              onChange={event => setMetadataFilter(event.target.value as MetadataFilter)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-[11px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            >
              <option value="all">{t('Semua')}</option>
              <option value="complete">{t('Lengkap')}</option>
              <option value="incomplete">{t('Perlu dilengkapi')}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 focus-within:border-[var(--ring)]">
          <Search size={12} className="shrink-0 text-[var(--muted-foreground)]" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('Cari judul, penulis, tahun, DOI…')}
            className="min-w-0 flex-1 bg-transparent text-[11.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Hapus pencarian')}>
              <X size={11} className="text-[var(--muted-foreground)]" />
            </button>
          ) : null}
        </div>

        {filteredReferences.length > 0 ? (
          <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
            <span>
              {filteredReferences.length} {t('sumber')}
            </span>
            <button
              type="button"
              onClick={selectAllVisible}
              className="font-medium text-[var(--primary)] hover:underline"
            >
              {filteredReferences.every(reference => selectedIds.has(reference.id))
                ? t('Batalkan semua')
                : t('Pilih semua')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-[var(--muted-foreground)]">
            <Loader2 size={14} className="animate-spin" />
            {t('Loading…')}
          </div>
        ) : references.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11.5px] text-[var(--muted-foreground)]">
            {activeGroup
              ? t('Belum ada jurnal di grup ini. Upload di menu Referensi Jurnal.')
              : t('Buat grup laporan di menu Referensi Jurnal.')}
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11.5px] text-[var(--muted-foreground)]">
            {t('Tidak ada referensi yang cocok.')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredReferences.map(reference => {
              const selected = selectedIds.has(reference.id)
              const expanded = expandedId === reference.id
              const complete = metadataComplete(reference)
              return (
                <div
                  key={reference.id}
                  className={`rounded-lg border transition-colors ${
                    selected
                      ? 'border-[var(--primary)]/50 bg-[var(--primary)]/[0.05]'
                      : 'border-[var(--border)]/70 hover:border-[var(--primary)]/30'
                  }`}
                >
                  <div className="flex items-start gap-2 p-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(reference.id)}
                      aria-label={`${t('Pilih')} ${reference.title || reference.filename}`}
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : reference.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1 text-[11.5px] font-medium leading-snug text-[var(--foreground)]">
                          {reference.title || reference.filename}
                        </div>
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] text-[var(--muted-foreground)]">
                        {reference.authors?.[0] || t('Penulis belum tersedia')}
                        {reference.year ? ` (${reference.year})` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {reference.citationNumber ? (
                          <span className="rounded bg-[var(--muted)] px-1 py-0.5 text-[9px] font-medium text-[var(--foreground)]">
                            [{reference.citationNumber}]
                          </span>
                        ) : null}
                        {reference.doi ? (
                          <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-300">
                            {t('DOI')}
                          </span>
                        ) : null}
                        {!complete ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-700 dark:text-amber-300">
                            <AlertCircle size={8} /> {t('Metadata kurang')}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => insertReferences([reference])}
                        title={t('Sisipkan sitasi dalam teks')}
                        className="rounded-md p-1 text-[var(--primary)] hover:bg-[var(--primary)]/[0.1]"
                      >
                        <Quote size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyFullCitation(reference)}
                        title={t('Salin entri daftar pustaka')}
                        className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      >
                        {copiedId === reference.id ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="space-y-1.5 border-t border-[var(--border)]/60 px-2.5 py-2 text-[10px] text-[var(--muted-foreground)]">
                      {reference.journal_name ? (
                        <div>
                          <span className="font-medium text-[var(--foreground)]">
                            {t('Jurnal')}:
                          </span>{' '}
                          {reference.journal_name}
                        </div>
                      ) : null}
                      {reference.doi ? (
                        <a
                          href={
                            reference.doi.startsWith('http')
                              ? reference.doi
                              : `https://doi.org/${reference.doi}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 break-all text-[var(--primary)] hover:underline"
                        >
                          {reference.doi} <ExternalLink size={9} />
                        </a>
                      ) : null}
                      {reference.abstract ? (
                        <div className="max-h-24 overflow-y-auto rounded-md bg-[var(--muted)]/40 p-1.5 leading-relaxed">
                          {reference.abstract}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedReferences.length > 0 ? (
        <div className="shrink-0 space-y-1.5 border-t border-[var(--border)] bg-[var(--background)] p-2.5">
          <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
            <span>
              {selectedReferences.length} {t('referensi dipilih')}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="hover:underline"
            >
              {t('Bersihkan')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => insertReferences(selectedReferences)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--primary)] px-2 text-[10.5px] font-medium text-[var(--primary-foreground)]"
            >
              <Quote size={11} /> {t('Sisipkan sitasi')}
            </button>
            <button
              type="button"
              onClick={() => void copySelectedBibliography()}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-[10.5px] font-medium text-[var(--foreground)] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={11} className="animate-spin" />
              ) : batchCopied ? (
                <Check size={11} className="text-emerald-500" />
              ) : (
                <ClipboardList size={11} />
              )}
              {t('Salin daftar')}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
