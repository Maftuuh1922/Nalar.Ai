'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type JournalResearchMode =
  'question' | 'drafting' | 'critique' | 'planning' | 'methodology' | 'literature'

export interface JournalWorkflowPreset {
  id: string
  label: string
  description: string
  mode: JournalResearchMode
  prompt: string
}

export const JOURNAL_WORKFLOW_PRESETS: JournalWorkflowPreset[] = [
  {
    id: 'problem',
    label: 'Rumusan masalah & tujuan',
    description: 'Selaraskan masalah, pertanyaan, tujuan, dan kontribusi.',
    mode: 'planning',
    prompt:
      'Bantu saya menyusun rumusan masalah, pertanyaan penelitian, tujuan, dan kontribusi penelitian yang saling selaras. Gunakan hanya konteks dan sumber yang tersedia. Tunjukkan asumsi atau data yang masih kurang, lalu berikan versi yang siap dimasukkan ke naskah.',
  },
  {
    id: 'novelty',
    label: 'Gap riset & novelty',
    description: 'Petakan celah literatur dan kebaruan yang dapat dipertahankan.',
    mode: 'literature',
    prompt:
      'Petakan gap riset dan novelty penelitian ini berdasarkan sumber yang tersedia. Bedakan dengan tegas: temuan literatur, inferensi, dan usulan kontribusi. Jangan mengarang klaim atau sitasi; sebutkan bukti tambahan yang diperlukan agar novelty dapat dipertahankan.',
  },
  {
    id: 'literature',
    label: 'Sintesis tinjauan pustaka',
    description: 'Kelompokkan tema, perbedaan, metode, hasil, dan celah.',
    mode: 'literature',
    prompt:
      'Susun sintesis tinjauan pustaka berbasis tema, bukan ringkasan sumber satu per satu. Bandingkan tujuan, metode, data, hasil, keterbatasan, dan hubungan antarsumber. Gunakan hanya nomor sitasi yang benar-benar tersedia dan tandai bagian yang masih membutuhkan sumber.',
  },
  {
    id: 'outline',
    label: 'Outline jurnal IMRaD',
    description: 'Buat struktur artikel beserta isi yang wajib ada per bagian.',
    mode: 'planning',
    prompt:
      'Buat outline artikel jurnal yang mengikuti IMRaD: judul, abstrak, kata kunci, pendahuluan, metode, hasil, pembahasan, kesimpulan, keterbatasan, dan daftar pustaka. Untuk setiap bagian, jelaskan argumen, data, tabel/gambar, dan sitasi yang harus disiapkan.',
  },
  {
    id: 'method',
    label: 'Audit metodologi',
    description: 'Periksa keselarasan desain, data, sampel, instrumen, dan analisis.',
    mode: 'methodology',
    prompt:
      'Audit metodologi penelitian ini. Periksa keselarasan pertanyaan penelitian, desain, populasi/sampel, variabel, instrumen, prosedur, validitas, etika, dan teknik analisis. Urutkan masalah berdasarkan dampak dan berikan revisi konkret tanpa mengarang data.',
  },
  {
    id: 'abstract',
    label: 'Abstrak & kata kunci',
    description: 'Susun abstrak terstruktur tanpa menambah hasil yang tidak ada.',
    mode: 'drafting',
    prompt:
      'Tulis abstrak jurnal yang padat dan siap diedit, mencakup latar belakang, tujuan, metode, hasil utama, dan kesimpulan. Jangan menambah angka atau hasil yang tidak tersedia. Jika hasil belum lengkap, beri penanda eksplisit. Tambahkan 4–6 kata kunci yang spesifik.',
  },
  {
    id: 'discussion',
    label: 'Kritik hasil & pembahasan',
    description: 'Uji apakah interpretasi didukung hasil dan literatur.',
    mode: 'critique',
    prompt:
      'Kritik bagian hasil dan pembahasan seperti editor jurnal. Periksa apakah interpretasi didukung data, apakah perbandingan dengan literatur memadai, apakah ada overclaim, dan apakah keterbatasan sudah dijelaskan. Berikan revisi terurut dari yang paling penting.',
  },
  {
    id: 'reviewer',
    label: 'Simulasi reviewer & siap submit',
    description: 'Tinjau kontribusi, bukti, struktur, bahasa, dan risiko penolakan.',
    mode: 'critique',
    prompt:
      'Bertindak sebagai reviewer jurnal yang ketat tetapi konstruktif. Nilai novelty, relevansi, metodologi, validitas bukti, kualitas pembahasan, sitasi, struktur, bahasa, tabel/gambar, dan kelengkapan etika. Beri keputusan sementara, major issues, minor issues, dan checklist sebelum submit.',
  },
]

export default function JournalWorkflowMenu({
  onSelect,
  placement = 'top',
  compact = false,
}: {
  onSelect: (preset: JournalWorkflowPreset) => void
  placement?: 'top' | 'bottom'
  compact?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={t('Alur kerja jurnal')}
        aria-expanded={open}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition-colors ${
          open
            ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)]'
        }`}
      >
        <BookOpenCheck size={15} />
        {!compact ? <span>{t('Jurnal')}</span> : null}
        <ChevronDown size={11} className={open ? 'rotate-180' : ''} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('Asisten Pembuatan Jurnal')}
          className={`absolute left-0 z-50 flex max-h-[min(460px,calc(100dvh-6rem))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:bottom-20 max-sm:left-auto max-sm:top-auto max-sm:mb-0 max-sm:mt-0 max-sm:w-auto ${
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-semibold text-[var(--foreground)]">
                {t('Asisten Pembuatan Jurnal')}
              </div>
              <div className="text-[10.5px] leading-snug text-[var(--muted-foreground)]">
                {t('Pilih pekerjaan, lalu sesuaikan instruksinya sebelum dikirim.')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('Tutup')}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X size={14} />
            </button>
          </div>
          <div className="min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto p-1.5 [scrollbar-gutter:stable]">
            {JOURNAL_WORKFLOW_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelect(preset)
                  setOpen(false)
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--muted)]/55"
              >
                <span className="block text-[11.5px] font-medium text-[var(--foreground)]">
                  {t(preset.label)}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--muted-foreground)]">
                  {t(preset.description)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
