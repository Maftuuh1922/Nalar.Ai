/**
 * Persistensi riwayat run Asisten Agentic — per dokumen, di localStorage.
 *
 * Panel agentic menyimpan riwayatnya di `useState` saja, sehingga setiap muat
 * ulang halaman (atau pindah dokumen lalu kembali) menghapus seluruh riwayat:
 * rencana kerja, langkah tool, dan ringkasan akhir lenyap padahal itulah catatan
 * apa yang sudah diubah AI di dokumen. Untuk laporan yang dikerjakan berhari-hari
 * kehilangan itu terasa seperti pekerjaan yang tidak tercatat.
 *
 * localStorage dipilih, bukan tabel di backend, karena riwayat ini murni catatan
 * antarmuka: sumber kebenaran perubahan dokumen tetap dokumen itu sendiri. Tanpa
 * tabel baru, tidak ada migrasi skema dan tidak ada risiko data pengguna rusak.
 */

/** Satu run yang disimpan. Bentuknya cermin `ChatRun` di AgenticRunPanel. */
export interface RunTersimpan {
  id: number
  instruction: string
  tasks: Array<{
    index: number
    title: string
    status: 'pending' | 'running' | 'done' | 'failed'
    note?: string
  }>
  steps: Array<{
    id: string
    name: string
    fe: boolean
    args: Record<string, unknown>
    status: 'running' | 'ok' | 'error'
    detail?: string
  }>
  summary: string
  reasoning: string
  error: string
  finished: boolean
  ledgerOk: number
  ledgerFailed: Array<{ name: string; error: string }>
  /** Kapan run ini dimulai (epoch ms) — dipakai mengurut & melabeli riwayat. */
  startedAt?: number
}

const PREFIX = 'nalar.agentic.runs.'
const VERSI = 'v1'

/**
 * Batas jumlah run per dokumen. Riwayat lama dibuang lebih dulu.
 * Bukan soal estetika: localStorage per-origin hanya ~5 MB, dan satu run bisa
 * memuat beberapa `doc_insert` berisi ribuan aksara markdown.
 */
const MAKS_RUN = 30

/** Argumen tool dipotong sebelum disimpan; isi utuhnya sudah ada di dokumen. */
const MAKS_AKSARA_ARG = 400
const MAKS_AKSARA_TEKS = 4000

function kunci(docId: string): string {
  return `${PREFIX}${VERSI}.${docId}`
}

function potong(nilai: string, batas: number): string {
  if (nilai.length <= batas) return nilai
  return `${nilai.slice(0, batas)}…`
}

/**
 * Kecilkan satu run agar hemat kuota: argumen tool yang panjang (markdown satu
 * sub-bab bisa ribuan aksara) tidak perlu disimpan utuh — panel hanya
 * menampilkan cuplikannya, dan isi sebenarnya sudah tertulis di dokumen.
 */
function ringkas(run: RunTersimpan): RunTersimpan {
  return {
    ...run,
    summary: potong(run.summary, MAKS_AKSARA_TEKS),
    // Alur pikir paling boros dan paling tidak berguna untuk dibaca ulang.
    reasoning: '',
    steps: run.steps.map(step => ({
      ...step,
      args: Object.fromEntries(
        Object.entries(step.args).map(([k, v]) => [
          k,
          typeof v === 'string' ? potong(v, MAKS_AKSARA_ARG) : v,
        ])
      ),
    })),
  }
}

/** Baca riwayat run satu dokumen. Data rusak diabaikan, bukan melempar error. */
export function bacaRiwayat(docId: string): RunTersimpan[] {
  if (!docId || typeof window === 'undefined') return []
  try {
    const mentah = window.localStorage.getItem(kunci(docId))
    if (!mentah) return []
    const data = JSON.parse(mentah)
    if (!Array.isArray(data)) return []
    // Run yang masih 'running' saat halaman ditutup tidak akan pernah selesai;
    // tandai selesai supaya tidak tampil sebagai spinner yang menggantung.
    return data
      .filter((r): r is RunTersimpan => Boolean(r) && typeof r.instruction === 'string')
      .map(r => ({
        ...r,
        finished: true,
        tasks: (r.tasks || []).map(t =>
          t.status === 'running' ? { ...t, status: 'failed' as const } : t
        ),
        steps: (r.steps || []).map(s =>
          s.status === 'running' ? { ...s, status: 'error' as const } : s
        ),
      }))
  } catch {
    return []
  }
}

/**
 * Simpan riwayat satu dokumen. Bila kuota penuh, riwayat dipangkas separuh dan
 * dicoba lagi — kehilangan run tertua jauh lebih baik daripada gagal menyimpan
 * seluruhnya dan kembali kehilangan semua.
 */
export function simpanRiwayat(docId: string, runs: RunTersimpan[]): void {
  if (!docId || typeof window === 'undefined') return
  let simpan = runs.slice(-MAKS_RUN).map(ringkas)
  for (let percobaan = 0; percobaan < 4; percobaan += 1) {
    try {
      window.localStorage.setItem(kunci(docId), JSON.stringify(simpan))
      return
    } catch {
      if (simpan.length <= 1) break
      simpan = simpan.slice(Math.ceil(simpan.length / 2))
    }
  }
  try {
    window.localStorage.removeItem(kunci(docId))
  } catch {
    // Penyimpanan tidak tersedia (mode privat/kuota nol) — riwayat sesi ini
    // tetap jalan di memori, hanya tidak bertahan. Bukan alasan menggagalkan UI.
  }
}

/** Hapus riwayat satu dokumen (tombol "Bersihkan riwayat"). */
export function hapusRiwayat(docId: string): void {
  if (!docId || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(kunci(docId))
  } catch {
    /* diabaikan */
  }
}
