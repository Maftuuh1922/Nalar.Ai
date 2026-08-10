'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, PenLine } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { importChatToCoWriter } from '@/lib/co-writer-api'
import { notifyCoWriterChanged } from '@/lib/co-writer-events'

/**
 * Tombol "Buat Draf Jurnal" di bawah pesan AI.
 *
 * Memanggil POST /api/v1/co_writer/import-chat dengan session_id pesan ini →
 * seluruh sesi chat diubah menjadi bahan naskah jurnal LaTeX baru di
 * Co-Writer, lalu pindah ke halaman draf tersebut.
 */
export default function ExportToCoWriterButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    if (loading || done) return
    setLoading(true)
    setError('')
    try {
      const doc = await importChatToCoWriter({ session_id: sessionId })
      notifyCoWriterChanged()
      setDone(true)
      setTimeout(() => router.push(`/co-writer/${doc.id}`), 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={loading || done}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)]/70 px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : done ? (
          <Check size={12} className="text-emerald-500" />
        ) : (
          <PenLine size={12} />
        )}
        {done ? t('Draf jurnal dibuka…') : t('Buat Draf Jurnal')}
      </button>
      {error ? <span className="text-[11px] text-rose-600 dark:text-rose-400">{error}</span> : null}
    </div>
  )
}
