'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Bold,
  Bot,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Eraser,
  FileDown,
  FileText,
  Focus,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Loader2,
  MessagesSquare,
  MoreHorizontal,
  Minus,
  NotebookPen,
  PanelLeftOpen,
  PanelRightClose,
  Quote,
  Redo2,
  SearchCheck,
  Strikethrough,
  Table2,
  Undo2,
  X,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch, apiUrl } from '@/lib/api'
import { listKnowledgeBases } from '@/lib/knowledge-api'
import {
  convertDocxToMarkdown,
  createCoWriterCheckpoint,
  deleteCoWriterFile,
  exportLatexFromMarkdown,
  getCoWriterFile,
  getCoWriterDocument,
  getCoWriterOutline,
  getCoWriterSource,
  getWorkingDocx,
  listCoWriterFiles,
  renameCoWriterFile,
  saveCoWriterFile,
  saveWorkingDocx,
  splitCoWriterDocument,
  updateCoWriterDocument,
  type CoWriterFile,
  type CoWriterOutlineHeading,
} from '@/lib/co-writer-api'
import { notifyCoWriterChanged } from '@/lib/co-writer-events'
import { getSession } from '@/lib/session-api'
import { useAppShell } from '@/context/AppShellContext'
import AgenticRunPanel, { type FeToolResult } from '@/components/co-writer/AgenticRunPanel'
import ReferenceSidebar from '@/components/co-writer/ReferenceSidebar'
import CoWriterChatPanel from '@/components/co-writer/CoWriterChatPanel'
import HistorySessionPicker, {
  type SelectedHistorySession,
} from '@/components/chat/HistorySessionPicker'
import QuickCitePopup from '@/components/co-writer/QuickCitePopup'
import SaveToNotebookModal, {
  type NotebookSavePayload,
} from '@/components/notebook/SaveToNotebookModal'
import LatexCodeEditor, { type TextareaLikeHandle } from '@/components/co-writer/LatexCodeEditor'
import type { SuperDocEditorHandle } from '@/components/co-writer/SuperDocEditor'
// SuperDoc (AGPL, open source) — editor DOCX in-browser tanpa server.
const SuperDocEditor = dynamic(
  () => import('@/components/co-writer/SuperDocEditor'),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Memuat editor…</div> },
)

import FileTree from '@/components/co-writer/FileTree'
import OutlineSidebar from '@/components/co-writer/OutlineSidebar'
import VersionHistory from '@/components/co-writer/VersionHistory'
// iframe + DOM hanya jalan di browser; import dinamis mencegah galat saat SSR.
const TypesetHtmlPreview = dynamic(
  () => import('@/components/co-writer/TypesetHtmlPreview'),
  { ssr: false }
)
import { CO_WRITER_SAMPLE_TEMPLATE } from '../sampleTemplate'

const MarkdownRenderer = dynamic(() => import('@/components/common/MarkdownRenderer'), {
  ssr: false,
})

type EditAction = 'rewrite' | 'shorten' | 'expand'
type SelectionMode = EditAction | 'none'
type SourceOption = 'none' | 'rag' | 'web'
type ConfirmAction = 'clear' | 'template'
// Only retrieval tools the backend actually wires into the selection edit.
type ToolName = 'rag' | 'web'

interface KnowledgeBase {
  name: string
  is_default?: boolean
}

const SPLIT_RATIO_KEY = 'nalar-ai.co_writer.split_ratio'
const FOCUS_MODE_KEY = 'nalar-ai.co_writer.focus_mode'
const FILE_TREE_OPEN_KEY = 'nalar-ai.co_writer.file_tree_open'
const RIGHT_PANEL_OPEN_KEY = 'nalar-ai.co_writer.right_panel_open'

const CHAT_PANEL_OPEN_KEY = 'nalar-ai.co_writer.chat_panel_open'
const LOCAL_DRAFT_PREFIX = 'nalar-ai.co_writer.draft.'
const AUTOSAVE_DEBOUNCE_MS = 1500
const MIN_PANEL_RATIO = 0.18
const MAX_PANEL_RATIO = 0.82

/**
 * State layout yang dipertahankan antar sesi (panel kiri/kanan/chat, mode
 * fokus). Dipersist ke localStorage — toggling panel tidak boleh hilang
 * setiap kali halaman dibuka ulang (PRD v2.8 §5, kenyamanan menulis).
 */
function usePersistedState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      /* nilai rusak → pakai bawaan */
    }
    return initial
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* localStorage penuh/diblokir — abaikan */
    }
  }, [key, value])
  return [value, setValue]
}

/**
 * Buffer draf lokal: jaring pengaman kalau halaman dimuat ulang sebelum
 * autosave sempat jalan. Penanda waktunya wajib — tanpa itu tidak ada cara
 * membandingkannya dengan isi peladen, dan menebak "lokal selalu menang" pernah
 * menimpa draf LaTeX hasil konversi dengan buffer Markdown yang sudah basi.
 */
type LocalDraft = { content: string; savedAt: number }

function bacaDrafLokal(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as LocalDraft).content === 'string' &&
      typeof (parsed as LocalDraft).savedAt === 'number'
    ) {
      return parsed as LocalDraft
    }
  } catch {
    // Buffer versi lama berupa teks polos, jadi JSON.parse-nya gagal — dan itu
    // memang yang kita mau: buffer tanpa penanda waktu dibuang, bukan dipercaya.
  }
  return null
}

function tulisDrafLokal(key: string, content: string): void {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ content, savedAt: Date.now() } satisfies LocalDraft)
    )
  } catch {
    /* kuota penuh — buffer ini cadangan, bukan sumber kebenaran */
  }
}

function hapusDrafLokal(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

type DiffLineKind = 'same' | 'removed' | 'added'
interface DiffLine {
  kind: DiffLineKind
  text: string
}

// Diff baris-per-baris (LCS) — hasilnya serupa unified diff GitHub:
// baris tak berubah netral, baris dihapus merah, baris ditambah hijau.
function diffLines(original: string, edited: string): DiffLine[] {
  const a = original.split('\n')
  const b = edited.split('\n')
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i] })
      i++
    } else {
      out.push({ kind: 'added', text: b[j] })
      j++
    }
  }
  while (i < n) {
    out.push({ kind: 'removed', text: a[i] })
    i++
  }
  while (j < m) {
    out.push({ kind: 'added', text: b[j] })
    j++
  }
  return out
}

type WordSegKind = 'same' | 'removed' | 'added'
interface WordSeg {
  kind: WordSegKind
  text: string
}

// Diff kata-per-kata (LCS token) untuk highlight GitHub-style di dalam baris
// yang berubah: kata yang sama tampil polos, kata yang dihapus/ditambah diberi
// latar tebal. Tokenisasi mempertahankan spasi supaya baris tidak menyempit.
function diffWords(a: string, b: string): WordSeg[] {
  const token = (s: string): string[] => s.match(/\S+\s*|\s+/g) ?? []
  const at = token(a)
  const bt = token(b)
  const n = at.length
  const m = bt.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = at[i] === bt[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: WordSeg[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      out.push({ kind: 'same', text: at[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'removed', text: at[i] })
      i++
    } else {
      out.push({ kind: 'added', text: bt[j] })
      j++
    }
  }
  while (i < n) {
    out.push({ kind: 'removed', text: at[i] })
    i++
  }
  while (j < m) {
    out.push({ kind: 'added', text: bt[j] })
    j++
  }
  return out
}

function DiffView({ original, edited }: { original: string; edited: string }) {
  const lines = diffLines(original, edited)
  const added = lines.filter(l => l.kind === 'added').length
  const removed = lines.filter(l => l.kind === 'removed').length

  // Pasangkan baris dihapus+ditambah yang berdekatan untuk diff kata bersama.
  const pairs = new Map<number, WordSeg[]>()
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].kind === 'removed' && lines[i + 1].kind === 'added') {
      const segs = diffWords(lines[i].text, lines[i + 1].text)
      pairs.set(i, segs)
      pairs.set(i + 1, segs)
    }
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/60">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)]/95 px-3.5 py-2 backdrop-blur">
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
          +{added}
        </span>
        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-300">
          −{removed}
        </span>
      </div>
      {lines.map((line, idx) => {
        const segs = pairs.get(idx)
        return (
          <div
            key={idx}
            className={`flex items-start gap-2.5 px-3.5 py-[3px] font-mono text-[11.5px] leading-[1.7] ${
              line.kind === 'removed'
                ? 'bg-rose-500/[0.09] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                : line.kind === 'added'
                  ? 'bg-emerald-500/[0.09] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'text-[var(--muted-foreground)]'
            }`}
          >
            <span
              className={`w-5 shrink-0 select-none text-right ${
                line.kind === 'removed'
                  ? 'text-rose-500'
                  : line.kind === 'added'
                    ? 'text-emerald-500'
                    : 'text-[var(--muted-foreground)]/30'
              }`}
            >
              {line.kind === 'removed' ? '−' : line.kind === 'added' ? '+' : '·'}
            </span>
            <span className="min-w-0 whitespace-pre-wrap break-words">
              {segs
                ? segs
                    .filter(s =>
                      line.kind === 'removed' ? s.kind !== 'added' : s.kind !== 'removed'
                    )
                    .map((s, si) =>
                      s.kind === 'same' ? (
                        s.text
                      ) : (
                        <span
                          key={si}
                          className={
                            line.kind === 'removed'
                              ? 'rounded bg-rose-500/25 px-[1px] line-through decoration-rose-500/80'
                              : 'rounded bg-emerald-500/25 px-[1px] font-semibold'
                          }
                        >
                          {s.text}
                        </span>
                      )
                    )
                : line.text || ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const ACTION_LABELS: Record<EditAction, string> = {
  rewrite: 'Rewrite',
  shorten: 'Shorten',
  expand: 'Expand',
}

const TOOL_OPTIONS: Array<{ name: ToolName; label: string }> = [
  { name: 'rag', label: 'Knowledge Base' },
  { name: 'web', label: 'Web Search' },
]

const MODE_OPTIONS: Array<{ value: SelectionMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'shorten', label: 'Shorten' },
  { value: 'expand', label: 'Expand' },
  { value: 'rewrite', label: 'Rewrite' },
]

interface ToolbarItem {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  snippet?: string
  type?: 'separator'
  action?: () => void
}

interface SelectedRange {
  start: number
  end: number
  text: string
  snapshot: string
}

interface SelectionPopoverState {
  visible: boolean
  top: number
  left: number
}

interface SelectionToolTrace {
  kind?: 'tool_call' | 'tool_result'
  name: string
  arguments: Record<string, unknown>
  result: string
  success: boolean
  sources: Array<Record<string, unknown>>
  metadata: Record<string, unknown>
}

interface SelectionTraceData {
  toolTraces: SelectionToolTrace[]
  response: string
}

interface StreamTraceEvent {
  type: string
  stage?: string
  content?: string
  metadata?: Record<string, unknown>
}

interface StreamEditResult {
  edited_text?: string
}

export default function CoWriterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  // Tema "glass" ikut memasang kelas .dark di <html>, jadi editornya harus
  // gelap juga — kalau tidak, kode LaTeX tampil hitam-di-hitam.
  const { theme } = useAppShell()
  const editorDark = theme === 'dark' || theme === 'glass'
  const params = useParams<{ docId?: string | string[] }>()
  const docId = useMemo(() => {
    const raw = params?.docId
    if (!raw) return ''
    return Array.isArray(raw) ? (raw[0] ?? '') : raw
  }, [params])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const activeFileRef = useRef<string | null>(null)
  const fileLoadRequestRef = useRef(0)
  const draftStorageKey = useMemo(() => (docId ? `${LOCAL_DRAFT_PREFIX}${docId}` : null), [docId])
  const activeDraftStorageKey = useMemo(() => {
    if (!draftStorageKey) return null
    return activeFile
      ? `${draftStorageKey}.file.${encodeURIComponent(activeFile)}`
      : draftStorageKey
  }, [activeFile, draftStorageKey])
  const lastSavedContentRef = useRef<string>('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUnmountedRef = useRef(false)
  const [docTitle, setDocTitle] = useState<string>('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState<string>('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [docNotFound, setDocNotFound] = useState(false)
  const [isLoadingDoc, setIsLoadingDoc] = useState(true)
  const [isSavingDoc, setIsSavingDoc] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isFileActionBusy, setIsFileActionBusy] = useState(false)
  const [projectFiles, setProjectFiles] = useState<CoWriterFile[]>([])
  const [leftPanelTab, setLeftPanelTab] = useState<'files' | 'outline'>('files')
  const [outlineHeadings, setOutlineHeadings] = useState<CoWriterOutlineHeading[]>([])
  const [isLoadingOutline, setIsLoadingOutline] = useState(false)
  const [outlineGroupName, setOutlineGroupName] = useState<string | null>(null)
  const [outlineReferenceCount, setOutlineReferenceCount] = useState<number | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  // Editor kini CodeMirror, tapi handle-nya meniru API textarea supaya semua
  // pemakai lama (sisip sitasi, lompat heading, sinkron gulir) tetap jalan.
  const textareaRef = useRef<TextareaLikeHandle>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const selectionPopoverRef = useRef<HTMLDivElement>(null)
  const preserveSelectionTraceRef = useRef(false)
  const selectionRequestAbortRef = useRef<AbortController | null>(null)
  const selectionDragStateRef = useRef<{
    offsetX: number
    offsetY: number
  } | null>(null)
  const [markdown, setMarkdown] = useState('')
  // ── Mode edit: Sync (Syncfusion Document Editor) = bawaan; Sumber (LaTeX)
  // hanya untuk ekspor/typeset. Editor markdown lama sudah dihapus.
  // UI utama selalu editor Word. LaTeX hanya format internal untuk ekspor.
  const [editMode, setEditMode] = useState<'sync' | 'source'>('sync')
  const syncMode = editMode === 'sync'
  // Mode Word (SuperDoc): dokumen kerja = DOCX kerja di server. Editor memuat
  // berkas itu (`initialSyncFile`) dan mengekspornya kembali saat autosave —
  // tidak ada representasi string perantara.
  const sfdtDirtyRef = useRef(false)
  const sfdtSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cegah dua autosave menimpa satu sama lain: serialisasi OOXML dokumen besar
  // butuh waktu, jadi bila satu simpan masih jalan, tandai ulang kotor dan
  // biarkan yang berjalan sekarang selesai lebih dulu.
  const savingRef = useRef(false)
  const [sfdtLoadKey, setSfdtLoadKey] = useState(0)
  const [initialSyncFile, setInitialSyncFile] = useState<File | null>(null)
  const syncEditorRef = useRef<SuperDocEditorHandle | null>(null)
  const [externalChatPrompt, setExternalChatPrompt] = useState<string | null>(null)
  // Async edits (full-draft edit, auto-mark, selection edit) must verify the
  // draft hasn't changed while the request was in flight before replacing
  // content. State captured in their closures is stale by then; this ref
  // always holds the latest value.
  const markdownRef = useRef('')
  const [instruction, setInstruction] = useState('')
  const [action, setAction] = useState<EditAction>('rewrite')
  const [source, setSource] = useState<SourceOption>('none')
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [kbName, setKbName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isAutoMarking, setIsAutoMarking] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showChatImportPicker, setShowChatImportPicker] = useState(false)
  const [importedConversation, setImportedConversation] = useState<{
    title: string
    messages: { role: 'user' | 'assistant'; content: string }[]
  } | null>(null)
  // ── PRD v2.3: layout 3 kolom ──
  // Layout panel dipersist antar sesi (kecuali lebar file tree yang tetap
  // default). Mode fokus = tulis tanpa gangguan: panel samping disembunyikan.
  const [fileTreeOpen, setFileTreeOpen] = usePersistedState(FILE_TREE_OPEN_KEY, true)
  const [fileTreeWidth, setFileTreeWidth] = useState(220)
  const [isResizingFileTree, setIsResizingFileTree] = useState(false)
  const [chatPanelOpen, setChatPanelOpen] = usePersistedState(CHAT_PANEL_OPEN_KEY, false)
  const [capturedChatImage, setCapturedChatImage] = useState<string | null>(null)
  const [rightPanelOpen, setRightPanelOpen] = usePersistedState(RIGHT_PANEL_OPEN_KEY, false)
  const [focusMode, setFocusMode] = usePersistedState(FOCUS_MODE_KEY, false)
  const [rightPanelTab, setRightPanelTab] = useState<'referensi' | 'agentic'>('referensi')
  const [previewJumpText, setPreviewJumpText] = useState<string | null>(null)
  // ── PRD v2.3: Daftar Isi (TOC) overlay ──
  const [tocOpen, setTocOpen] = useState(false)
  // ── PRD v2.4 §4: Quick-insert sitasi via trigger [[ ──
  const [quickCiteOpen, setQuickCiteOpen] = useState(false)
  const [quickCiteAnchor, setQuickCiteAnchor] = useState<{ top: number; left: number } | null>(null)
  const [activeGroupIdForQuickCite, setActiveGroupIdForQuickCite] = useState<string | null>(null)
  // ── PRD 9.1: status referensi untuk OutlineSidebar ──
  // ── PRD v2.5 §8: Pratinjau Rapi (typeset) — mode "Draft" vs "Rapi" ──
  // ── PRD v2.4 §2,3,5: Gap analysis & AI checks ──
  const [gapResult, setGapResult] = useState<{
    sections: Array<{ section: string; present: boolean; status: string }>
    total_present: number
  } | null>(null)
  const [aiChecksResult, setAiChecksResult] = useState<{
    claims_without_citation: string[]
    claim_count: number
    terminology: Array<{
      term: string
      count: number
      variants?: string[]
      suggest?: string | null
    }>
  } | null>(null)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ConfirmAction | null>(null)
  const [notebookSavePayload, setNotebookSavePayload] = useState<NotebookSavePayload | null>(null)
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null)
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState>({
    visible: false,
    top: 0,
    left: 0,
  })
  const [selectionInstruction, setSelectionInstruction] = useState('')
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('rewrite')
  const [selectionTools, setSelectionTools] = useState<ToolName[]>([])
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
  const [selectionTrace, setSelectionTrace] = useState<SelectionTraceData | null>(null)
  const [isTraceExpanded, setIsTraceExpanded] = useState(true)
  const [selectionPopoverPinned, setSelectionPopoverPinned] = useState(false)
  // ── PRD 9.2: Diff inline AI edit (Accept/Reject per chunk) ──
  const [pendingDiff, setPendingDiff] = useState<{
    original: string
    edited: string
    start: number
    end: number
    snapshot: string
    path: string | null
    /** 'md' = mode Word (mdText); 'latex' = mode Sumber. */
    format: 'md' | 'latex'
  } | null>(null)
  const [isApplyingDiff, setIsApplyingDiff] = useState(false)
  const [isDraggingSelectionPopover, setIsDraggingSelectionPopover] = useState(false)

  const [editorCollapsed, setEditorCollapsed] = useState(false)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [editorRatio, setEditorRatio] = useState(0.5)
  const [isResizingSplit, setIsResizingSplit] = useState(false)
  const showEditor = !editorCollapsed
  const showPreview = !previewCollapsed

  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUndoSnapshotRef = useRef<string | null>(null)
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setFileTreeOpen(false)
    }
    const savedRatio = window.localStorage.getItem(SPLIT_RATIO_KEY)
    if (savedRatio) {
      const parsed = Number.parseFloat(savedRatio)
      if (Number.isFinite(parsed)) {
        setEditorRatio(Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, parsed)))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode fokus: sembunyikan semua panel samping agar layar penuh untuk menulis.
  useEffect(() => {
    if (focusMode) {
      setFileTreeOpen(false)
      setRightPanelOpen(false)
      setChatPanelOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode])

  // Toast status (bawah, auto-dismiss 4 detik) — menggantikan status yang dulu
  // hanya disimpan tanpa pernah dirender.
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!status) return
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => setStatus(''), 4000)
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    }
  }, [status])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])

  // ── PRD 9.1: muat status referensi grup laporan untuk OutlineSidebar ──
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/v1/journal/groups', { cache: 'no-store' })
        if (!res.ok) return
        const groups = (await res.json()) as Array<{
          id: string
          name: string
          reference_count?: number
        }>
        if (cancelled || groups.length === 0) return
        const first = groups[0]
        setActiveGroupIdForQuickCite(first.id)
        setOutlineGroupName(first.name)
        setOutlineReferenceCount(first.reference_count ?? 0)
      } catch {
        /* abaikan */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!docId || !hasLoadedDraft) return
    let cancelled = false
    setIsLoadingOutline(true)
    void getCoWriterOutline(docId)
      .then(headings => {
        if (cancelled) return
        setOutlineHeadings(headings)
        const importKey = `nalar-ai.co_writer.imported.${docId}`
        if (window.sessionStorage.getItem(importKey) === '1') {
          const chapters = headings.filter(heading => heading.level === 1).length
          const subchapters = headings.filter(heading => heading.level > 1).length
          setStatus(
            t('Struktur dokumen terdeteksi: {{chapters}} bab, {{subchapters}} sub-bab', {
              chapters,
              subchapters,
            })
          )
          setLeftPanelTab('outline')
          window.sessionStorage.removeItem(importKey)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOutline(false)
      })
    return () => {
      cancelled = true
    }
  }, [docId, hasLoadedDraft, lastSavedAt, projectFiles, t])

  // Load document content from server when docId is available.
  useEffect(() => {
    if (!docId) return
    let cancelled = false
    setIsLoadingDoc(true)
    setDocNotFound(false)
    setHasLoadedDraft(false)
    setActiveFile(null)
    activeFileRef.current = null
    ;(async () => {
      try {
        const [document, files] = await Promise.all([
          getCoWriterDocument(docId),
          listCoWriterFiles(docId),
        ])
        if (cancelled) return
        // Isi peladen yang menang secara bawaan. Buffer lokal hanya dipakai
        // bila penanda waktunya benar-benar lebih baru daripada `updated_at`
        // peladen — bukan sekadar "berbeda". Jam peladen dan peramban bisa
        // meleset sedikit; kalau meleset, yang menang isi peladen, dan itu arah
        // yang aman: paling buruk kehilangan beberapa detik ketikan terakhir,
        // bukan menimpa seluruh naskah dengan versi basi.
        let content = document.content ?? ''
        const disimpanPeladenPada = document.updated_at ? document.updated_at * 1000 : 0
        if (draftStorageKey) {
          const lokal = bacaDrafLokal(draftStorageKey)
          if (lokal && lokal.savedAt > disimpanPeladenPada) {
            content = lokal.content
          } else {
            // Buffer yang kalah — basi atau format lama tanpa penanda waktu —
            // dibuang di sini; kalau tidak, ia menetap di localStorage selamanya.
            hapusDrafLokal(draftStorageKey)
          }
        }
        setMarkdown(content)
        setProjectFiles(files)
        setDocTitle(document.title || '')
        lastSavedContentRef.current = document.content ?? ''
        setLastSavedAt(document.updated_at ? document.updated_at * 1000 : Date.now())
        // Markdown-first: dokumen markdown terbuka langsung di editor markdown
        // (mode 'source'); editor Word tetap tersedia lewat toggle dan dihormati
        // bila pengguna sudah memilihnya (tersimpan di localStorage). Tanpa
        // pilihan tersimpan, draf lama non-markdown tetap default ke Word.
        let modePref: string | null = null
        try {
          modePref = window.localStorage.getItem('nalar-ai.co_writer.edit_mode')
        } catch {
          /* localStorage diblokir — abaikan */
        }
        if (modePref === 'sync' || modePref === 'source') {
          setEditMode(modePref)
        } else if (document.content_format === 'markdown') {
          setEditMode('source')
        }
        setHasLoadedDraft(true)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404')) {
          setDocNotFound(true)
        } else {
          setError(msg)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDoc(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [docId, draftStorageKey])

  // Mirror the in-flight content to localStorage so an accidental reload
  // doesn't lose unsaved characters before autosave fires.
  useEffect(() => {
    if (!hasLoadedDraft || !activeDraftStorageKey) return
    // Hanya isi yang belum tersimpan yang dicerminkan. Menulis buffer untuk isi
    // yang sama persis dengan peladen membuat penanda waktunya selalu lebih
    // baru, sehingga buffer basi akan menang atas perubahan peladen dari tab
    // lain — persis cacat yang sedang diperbaiki.
    if (markdown === lastSavedContentRef.current) {
      hapusDrafLokal(activeDraftStorageKey)
      return
    }
    tulisDrafLokal(activeDraftStorageKey, markdown)
  }, [hasLoadedDraft, activeDraftStorageKey, markdown])

  // Debounced autosave to the server.
  useEffect(() => {
    if (!hasLoadedDraft || !docId) return
    if (markdown === lastSavedContentRef.current) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    const targetFile = activeFile
    const targetContent = markdown
    const targetStorageKey = activeDraftStorageKey
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSavingDoc(true)
        const updated = targetFile
          ? await saveCoWriterFile(docId, targetFile, targetContent)
          : await updateCoWriterDocument(docId, { content: targetContent })
        if (isUnmountedRef.current) return
        if (activeFileRef.current === targetFile) {
          lastSavedContentRef.current = targetContent
          setLastSavedAt(updated.updated_at ? updated.updated_at * 1000 : Date.now())
          if (!targetFile && 'title' in updated) {
            setDocTitle(updated.title || '')
          }
        }
        if (targetStorageKey) {
          hapusDrafLokal(targetStorageKey)
        }
        notifyCoWriterChanged()
      } catch (err) {
        if (isUnmountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      } finally {
        if (!isUnmountedRef.current) {
          setIsSavingDoc(false)
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [activeDraftStorageKey, activeFile, docId, hasLoadedDraft, markdown])

  useEffect(() => {
    window.localStorage.setItem(SPLIT_RATIO_KEY, String(editorRatio))
  }, [editorRatio])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await listKnowledgeBases()
        setKnowledgeBases(list)
        const defaultKb = list.find((k: KnowledgeBase) => k.is_default)?.name || list[0]?.name || ''
        setKbName(prev => prev || defaultKb)
      } catch {
        setKnowledgeBases([])
      }
    })()
  }, [])

  const pushUndo = useCallback((prev: string) => {
    setUndoStack(s => [...s.slice(-50), prev])
    setRedoStack([])
  }, [])

  const commitPendingTypingUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    const snapshot = pendingUndoSnapshotRef.current
    pendingUndoSnapshotRef.current = null
    if (snapshot !== null && snapshot !== markdown) {
      pushUndo(snapshot)
    }
  }, [markdown, pushUndo])

  const handleMarkdownChange = useCallback(
    (value: string) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      if (pendingUndoSnapshotRef.current === null) {
        pendingUndoSnapshotRef.current = markdown
      }
      const snapshot = pendingUndoSnapshotRef.current
      undoTimerRef.current = setTimeout(() => {
        pendingUndoSnapshotRef.current = null
        undoTimerRef.current = null
        if (snapshot !== null && snapshot !== value) {
          pushUndo(snapshot)
        }
      }, 400)
      setMarkdown(value)
    },
    [markdown, pushUndo]
  )

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    const pendingSnapshot = pendingUndoSnapshotRef.current
    pendingUndoSnapshotRef.current = null
    if (pendingSnapshot !== null && pendingSnapshot !== markdown) {
      setRedoStack(s => [...s, markdown])
      setMarkdown(pendingSnapshot)
      return
    }

    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack(s => [...s, markdown])
    setUndoStack(s => s.slice(0, -1))
    setMarkdown(prev)
  }, [undoStack, markdown])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack(s => [...s, markdown])
    setRedoStack(s => s.slice(0, -1))
    setMarkdown(next)
  }, [redoStack, markdown])

  const refreshProjectFiles = useCallback(async () => {
    if (!docId) return []
    const files = await listCoWriterFiles(docId)
    setProjectFiles(files)
    return files
  }, [docId])

  const saveActiveBufferNow = useCallback(async () => {
    if (!docId || !hasLoadedDraft) return
    const targetFile = activeFileRef.current
    const targetContent = markdownRef.current
    if (targetContent === lastSavedContentRef.current) return
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const targetStorageKey = draftStorageKey
      ? targetFile
        ? `${draftStorageKey}.file.${encodeURIComponent(targetFile)}`
        : draftStorageKey
      : null
    setIsSavingDoc(true)
    try {
      const updated = targetFile
        ? await saveCoWriterFile(docId, targetFile, targetContent)
        : await updateCoWriterDocument(docId, { content: targetContent })
      if (activeFileRef.current === targetFile) {
        lastSavedContentRef.current = targetContent
        setLastSavedAt(updated.updated_at ? updated.updated_at * 1000 : Date.now())
        if (!targetFile && 'title' in updated) {
          setDocTitle(updated.title || '')
        }
      }
      if (targetStorageKey) hapusDrafLokal(targetStorageKey)
      notifyCoWriterChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      if (!isUnmountedRef.current) setIsSavingDoc(false)
    }
  }, [docId, draftStorageKey, hasLoadedDraft])

  // ── Mode Word (SuperDoc): dokumen kerja = DOCX kerja di server ──
  // Sumber kebenaran tunggal: editor mengekspor DOCX, DOCX itu yang disimpan,
  // dan DOCX itu pula yang diunduh/dicetak saat ekspor. Tidak ada buffer
  // markdown/LaTeX perantara — dulu yang tersimpan malah cap waktu, bukan
  // dokumen, sehingga tiap suntingan hilang saat refresh.
  const simpanDocxKerja = useCallback(async () => {
    if (!docId || !sfdtDirtyRef.current) return
    // Serialisasi OOXML dokumen besar butuh waktu; jangan menumpuk simpan.
    if (savingRef.current) return
    const editor = syncEditorRef.current
    if (!editor) return
    savingRef.current = true
    sfdtDirtyRef.current = false
    setIsSavingDoc(true)
    try {
      const blob = await editor.exportDocx()
      // exportDocx melempar bila instance belum siap; blob kosong tak akan
      // sampai ke sini. Backend juga menolak non-DOCX (422) sebagai jaring.
      await saveWorkingDocx(docId, blob)
      notifyCoWriterChanged()
    } catch (err) {
      // Tandai ulang kotor supaya perubahan yang gagal tersimpan dicoba lagi.
      sfdtDirtyRef.current = true
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      savingRef.current = false
      if (!isUnmountedRef.current) setIsSavingDoc(false)
    }
  }, [docId])

  const scheduleSfdtSave = useCallback(() => {
    if (sfdtSaveTimerRef.current) clearTimeout(sfdtSaveTimerRef.current)
    // Debounce 3 dtk: ekspor DOCX 64 halaman menghasilkan ~5 MB per simpan,
    // jadi jangan sesering autosave teks biasa.
    sfdtSaveTimerRef.current = setTimeout(() => {
      sfdtSaveTimerRef.current = null
      void simpanDocxKerja().catch(() => undefined)
    }, 3000)
  }, [simpanDocxKerja])

  const loadSfdt = useCallback(async () => {
    if (!docId) return
    try {
      // DOCX kerja NATIVE (hasil pipeline pdf2docx/postprocess, atau salinan
      // DOCX asli, atau hasil template markdown untuk draf dari nol) dibuka
      // langsung agar style, margin, tabel, heading, dan gambar tetap terjaga.
      // Backend selalu menyiapkannya di `_prepare_onlyoffice_docx`, jadi tak
      // ada lagi jalur markdown perantara yang membuat sintaks Pandoc bocor.
      const blob = await getWorkingDocx(docId)
      const importedFile =
        blob && blob.size > 0
          ? new File([blob], 'dokumen.docx', {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
          : null
      sfdtDirtyRef.current = false
      setInitialSyncFile(importedFile)
      setSfdtLoadKey(k => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [docId])

  // Panel kanan hanya dipakai mode Sumber (pratinjau hasil typeset). Mode Word
  // adalah satu panel penuh — editor SuperDoc sudah menampilkan hasil apa adanya.
  const panelKananTampil = syncMode ? false : showPreview
  const bukaPanelKanan = useCallback(() => {
    setPreviewCollapsed(false)
  }, [])
  const tutupPanelKanan = useCallback(() => {
    setPreviewCollapsed(true)
  }, [])

  // Muat SFDT saat masuk/ganti berkas dalam mode Sync.
  useEffect(() => {
    if (!hasLoadedDraft || !docId || editMode !== 'sync') return
    if (sfdtDirtyRef.current) return
    void loadSfdt()
  }, [activeFile, editMode, hasLoadedDraft, docId, loadSfdt])

  // Flush buffer aktif sesuai mode: Sync → simpan SFDT, Sumber → simpan LaTeX.
  // Wajib dipakai sebelum ganti berkas/ekspor, kalau tidak edit yang belum
  // tersimpan tertinggal atau tersimpan ke berkas salah.
  const flushCurrentBuffer = useCallback(async () => {
    if (syncMode) await simpanDocxKerja()
    else await saveActiveBufferNow()
  }, [saveActiveBufferNow, simpanDocxKerja, syncMode])

  // Jaring pengaman saat halaman berpindah (navigasi client-side): DOCX kerja
  // yang belum sempat disimpan (debounce 3 dtk) dikirim terakhir kali.
  useEffect(() => {
    return () => {
      if (sfdtDirtyRef.current) {
        void simpanDocxKerja().catch(() => undefined)
      }
    }
  }, [simpanDocxKerja])

  const reloadLatexFromServer = useCallback(async () => {
    const targetFile = activeFileRef.current
    try {
      const loaded = targetFile
        ? await getCoWriterFile(docId, targetFile)
        : await getCoWriterDocument(docId)
      markdownRef.current = loaded.content || ''
      setMarkdown(loaded.content || '')
      lastSavedContentRef.current = loaded.content || ''
      setLastSavedAt(loaded.updated_at ? loaded.updated_at * 1000 : Date.now())
      if (!targetFile && 'title' in loaded) setDocTitle(loaded.title || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [docId])

  const downloadBlob = useCallback((blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const safeTitle = (docTitle || 'co-writer')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .slice(0, 80)
    anchor.download = `${safeTitle || 'co-writer'}${extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [docTitle])

  const toggleEditMode = useCallback(async () => {
    const next = editMode === 'sync' ? 'source' : 'sync'
    if (next === 'source') {
      // Export DOCX DULU sebelum state berubah: begitu editMode 'source',
      // editor Sync di-unmount dan syncEditorRef jadi null; saveAsBlob yang
      // masih berjalan saat unmount membuat ZipArchive gagal.
      let docx: Blob | null = null
      const ed = syncEditorRef.current
      if (ed) {
        try {
          const blob = await ed.exportDocx()
          if (blob && blob.size > 0) docx = blob
        } catch {
          docx = null
        }
      }
      setEditMode(next)
      try {
        window.localStorage.setItem('nalar-ai.co_writer.edit_mode', next)
      } catch {
        /* abaikan */
      }
      void flushCurrentBuffer()
        .catch(() => undefined)
        .then(async () => {
          try {
            // Markdown-first: mode Sumber kini = MARKDOWN yang diregenerasi dari
            // DOCX kerja (SFDT → DOCX → Markdown). Dulu ini menghasilkan LaTeX,
            // sehingga toggle Word→Sumber lalu balik mengotori buffer markdown
            // bersih dengan LaTeX — persis korupsi yang dihindari pivot ini.
            if (!docx) throw new Error('Editor Sync belum siap.')
            const result = await convertDocxToMarkdown(docId, docx, { to: 'markdown' })
            if (!('markdown' in result)) throw new Error('Respons konversi tidak sah.')
            const md = result.markdown
            markdownRef.current = md
            setMarkdown(md)
            lastSavedContentRef.current = md
            setLastSavedAt(Date.now())
          } catch {
            await reloadLatexFromServer()
          }
        })
    } else {
      setEditMode(next)
      try {
        window.localStorage.setItem('nalar-ai.co_writer.edit_mode', next)
      } catch {
        /* abaikan */
      }
      void saveActiveBufferNow()
        .catch(() => undefined)
        .then(() => loadSfdt())
    }
  }, [docId, editMode, flushCurrentBuffer, loadSfdt, reloadLatexFromServer, saveActiveBufferNow])

  const insertIntoEditor = useCallback(
    (text: string) => {
      if (editMode === 'sync') {
        syncEditorRef.current?.insertText(text)
        return
      }
      const textarea = textareaRef.current
      if (!textarea) {
        setMarkdown(prev => `${prev}\n${text}`)
        return
      }
      const start = textarea.selectionStart ?? markdown.length
      const end = textarea.selectionEnd ?? markdown.length
      const snapshot = markdown
      pushUndo(snapshot)
      const next = snapshot.slice(0, start) + text + snapshot.slice(end)
      setMarkdown(next)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(start + text.length, start + text.length)
      })
    },
    [editMode, markdown, pushUndo]
  )

  // Jembatan eksekusi tool tulis agentic (Fase A / L2). Backend memancarkan
  // tool_call {fe:true}; di sini kita jalankan ke editor SuperDoc (L0) dan
  // kembalikan hasil NYATA supaya panel bisa menyusun ringkasan yang jujur.
  //
  // Di mode Sumber (bukan Word), editor SuperDoc tak aktif → jatuh ke buffer
  // markdown sebagai penampung, tetap melaporkan sukses/gagal apa adanya.
  const executeAgenticFeTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<FeToolResult> => {
      const handle = syncEditorRef.current
      // Mode Sumber: SuperDoc tak dipasang; sisipkan ke buffer markdown.
      if (editMode !== 'sync' || !handle) {
        if (name === 'doc_insert') {
          const md = String(args.markdown ?? '')
          pushUndo(markdown)
          setMarkdown(prev => (prev ? `${prev}\n\n${md}` : md))
          return { ok: true, summary: t('Ditambahkan ke draf (mode Sumber).') }
        }
        if (name === 'doc_replace') {
          const find = String(args.find ?? '')
          const replace = String(args.replace ?? '')
          const all = Boolean(args.all)
          if (!find || !markdown.includes(find)) {
            return { ok: false, error: t('Teks tidak ditemukan di draf.') }
          }
          pushUndo(markdown)
          setMarkdown(prev =>
            all ? prev.split(find).join(replace) : prev.replace(find, replace)
          )
          return { ok: true, summary: t('Teks diganti (mode Sumber).') }
        }
        return { ok: false, error: t('Sitasi hidup hanya tersedia di mode Word.') }
      }

      try {
        if (name === 'doc_insert') {
          const md = String(args.markdown ?? '')
          const anchor = args.anchor_text ? String(args.anchor_text) : undefined
          const placement = args.placement === 'before' ? 'before' : 'after'
          const r = await handle.insertMarkdown(md, anchor ? { anchorText: anchor, placement } : undefined)
          return { ok: r.ok, error: r.error, summary: r.ok ? t('Teks disisipkan.') : undefined }
        }
        if (name === 'doc_replace') {
          const find = String(args.find ?? '')
          const replace = String(args.replace ?? '')
          const all = Boolean(args.all)
          const r = await handle.replaceText(find, replace, { all })
          return {
            ok: r.ok,
            error: r.error,
            summary: r.ok ? t('{{n}} kemunculan diganti.', { n: r.replaced }) : undefined,
          }
        }
        if (name === 'cite_insert') {
          const anchor = String(args.anchor_text ?? '')
          const title = String(args.title ?? '')
          const authorsRaw = Array.isArray(args.authors) ? (args.authors as unknown[]) : []
          if (!anchor || !title || authorsRaw.length === 0) {
            return { ok: false, error: t('Sitasi ditolak: metadata sumber tak lengkap.') }
          }
          // "Depan Belakang" → {first,last} untuk skema OOXML.
          const authors = authorsRaw.map(a => {
            const parts = String(a).trim().split(/\s+/)
            const last = parts.length > 1 ? parts.pop()! : parts[0]
            return { first: parts.join(' ') || undefined, last }
          })
          const src = await handle.insertCitationSource(
            (args.source_type as never) || 'journalArticle',
            {
              title,
              authors,
              year: args.year ? String(args.year) : undefined,
              doi: args.doi ? String(args.doi) : undefined,
              journalName: args.journal ? String(args.journal) : undefined,
            }
          )
          if (!src.ok || !src.sourceId) {
            return { ok: false, error: src.error || t('Gagal membuat sumber sitasi.') }
          }
          const at = await handle.insertCitationAtAnchor(anchor, [src.sourceId])
          return { ok: at.ok, error: at.error, summary: at.ok ? t('Sitasi disisipkan.') : undefined }
        }
        return { ok: false, error: t('Tool tak dikenal: {{name}}', { name }) }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    [editMode, markdown, pushUndo, t]
  )

  // Potret dokumen untuk perencanaan agentic. Di mode Word pakai getOutline
  // (cepat: peta heading tanpa serialisasi penuh yang memblok worker); di mode
  // Sumber pakai buffer markdown apa adanya. Bila kosong, backend jatuh ke
  // sumber proyek di server.
  const getAgenticDocContext = useCallback(async (): Promise<string> => {
    if (editMode === 'sync' && syncEditorRef.current) {
      try {
        const outline = await syncEditorRef.current.getOutline()
        if (outline.length > 0) {
          return outline.map(h => `${'#'.repeat(Math.min(h.level, 6))} ${h.text}`).join('\n')
        }
      } catch {
        /* jatuh ke server */
      }
      return ''
    }
    return markdown
  }, [editMode, markdown])

  // Impor percakapan dari chat utama ke Asisten Agentic: ambil pesan tiap sesi
  // terpilih, gabung, lalu suntikkan sebagai riwayat konteks di panel chat.
  const handleApplyChatImport = useCallback(
    async (sessions: SelectedHistorySession[]) => {
      setShowChatImportPicker(false)
      if (!sessions.length) return
      try {
        const details = await Promise.all(
          sessions.map(session => getSession(session.sessionId).catch(() => null))
        )
        const messages: { role: 'user' | 'assistant'; content: string }[] = []
        details.forEach((detail, index) => {
          if (!detail) return
          if (sessions.length > 1) {
            messages.push({ role: 'assistant', content: `— ${sessions[index].title} —` })
          }
          for (const message of detail.messages) {
            if ((message.role === 'user' || message.role === 'assistant') && message.content?.trim()) {
              messages.push({ role: message.role, content: message.content })
            }
          }
        })
        if (!messages.length) {
          setStatus(t('Percakapan yang dipilih tidak berisi pesan.'))
          return
        }
        const title =
          sessions.length === 1 ? sessions[0].title : `${sessions.length} ${t('percakapan')}`
        // Ambil ~24 pesan terakhir agar konteks relevan tanpa membanjiri panel.
        setImportedConversation({ title, messages: messages.slice(-24) })
        setChatPanelOpen(true)
        setStatus(t('Percakapan diimpor ke Asisten Agentic.'))
      } catch {
        setStatus(t('Gagal mengimpor percakapan dari chat utama.'))
      }
    },
    [setChatPanelOpen, t]
  )

  const openProjectFile = useCallback(
    async (path: string) => {
      const targetFile = path === 'main.tex' ? null : path
      if (targetFile === activeFileRef.current) return

      commitPendingTypingUndo()
      try {
        await flushCurrentBuffer()
      } catch {
        return
      }

      const previousFile = activeFileRef.current
      const requestId = ++fileLoadRequestRef.current
      setHasLoadedDraft(false)
      setIsLoadingFile(true)
      setUndoStack([])
      setRedoStack([])
      setActiveFile(targetFile)
      activeFileRef.current = targetFile

      try {
        const loaded = targetFile
          ? await getCoWriterFile(docId, targetFile)
          : await getCoWriterDocument(docId)
        if (requestId !== fileLoadRequestRef.current) return

        const serverContent = loaded.content || ''
        const storageKey = draftStorageKey
          ? targetFile
            ? `${draftStorageKey}.file.${encodeURIComponent(targetFile)}`
            : draftStorageKey
          : null
        const serverSavedAt = loaded.updated_at ? loaded.updated_at * 1000 : 0
        const local = storageKey ? bacaDrafLokal(storageKey) : null
        const content = local && local.savedAt > serverSavedAt ? local.content : serverContent
        if (storageKey && (!local || local.savedAt <= serverSavedAt)) {
          hapusDrafLokal(storageKey)
        }

        markdownRef.current = content
        setMarkdown(content)
        lastSavedContentRef.current = serverContent
        setLastSavedAt(serverSavedAt || Date.now())
        if (!targetFile && 'title' in loaded) {
          setDocTitle(loaded.title || '')
        }
        setHasLoadedDraft(true)
      } catch (err) {
        if (requestId !== fileLoadRequestRef.current) return
        activeFileRef.current = previousFile
        setActiveFile(previousFile)
        setHasLoadedDraft(true)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (requestId === fileLoadRequestRef.current) setIsLoadingFile(false)
      }
    },
    [commitPendingTypingUndo, docId, draftStorageKey, flushCurrentBuffer]
  )

  const createProjectFile = useCallback(
    async (path: string) => {
      const target = path.trim().replace(/\\/g, '/')
      if (!target || target === 'main.tex' || target.startsWith('gambar/')) {
        setError(t('Jalur berkas tidak dapat digunakan.'))
        throw new Error('invalid path')
      }
      setIsFileActionBusy(true)
      setError('')
      try {
        await saveCoWriterFile(docId, target, '')
        await refreshProjectFiles()
        await openProjectFile(target)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      } finally {
        setIsFileActionBusy(false)
      }
    },
    [docId, openProjectFile, refreshProjectFiles, t]
  )

  const renameProjectFile = useCallback(
    async (from: string, to: string) => {
      const target = to.trim().replace(/\\/g, '/')
      if (!target || target === 'main.tex' || target.startsWith('gambar/')) {
        setError(t('Jalur berkas tidak dapat digunakan.'))
        throw new Error('invalid path')
      }
      setIsFileActionBusy(true)
      setError('')
      try {
        await flushCurrentBuffer()
        await renameCoWriterFile(docId, from, target)
        if (activeFileRef.current === from) {
          activeFileRef.current = target
          setActiveFile(target)
        }
        await refreshProjectFiles()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      } finally {
        setIsFileActionBusy(false)
      }
    },
    [docId, refreshProjectFiles, flushCurrentBuffer, t]
  )

  const deleteProjectFile = useCallback(
    async (path: string) => {
      setIsFileActionBusy(true)
      setError('')
      try {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current)
          autosaveTimerRef.current = null
        }
        await deleteCoWriterFile(docId, path)
        await refreshProjectFiles()
        if (activeFileRef.current === path) {
          lastSavedContentRef.current = markdownRef.current
          await openProjectFile('main.tex')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      } finally {
        setIsFileActionBusy(false)
      }
    },
    [docId, openProjectFile, refreshProjectFiles]
  )

  const splitProjectDocument = useCallback(async () => {
    setIsFileActionBusy(true)
    setError('')
    try {
      await flushCurrentBuffer()
      const result = await splitCoWriterDocument(docId)
      await refreshProjectFiles()
      if (activeFileRef.current === null) {
        markdownRef.current = result.content
        setMarkdown(result.content)
        lastSavedContentRef.current = result.content
        setLastSavedAt(Date.now())
      }
      setStatus(t('Dokumen berhasil dipecah per bab.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      setIsFileActionBusy(false)
    }
  }, [docId, refreshProjectFiles, flushCurrentBuffer, t])

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // ── Quick-insert sitasi: trigger `[[` (PRD v2.4 §4) ──
      // Peristiwa ini terpasang di pembungkus editor, jadi targetnya bukan
      // area teks — ambil handle-nya lewat ref.
      const ta = textareaRef.current
      if (!ta) return
      if (event.key === '[' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        // Cek karakter sebelumnya juga `[` → buka popup
        const before = ta.value.slice(0, ta.selectionStart ?? 0)
        if (before.endsWith('[')) {
          event.preventDefault()
          // Hapus `[[` yang diketik
          const pos = (ta.selectionStart ?? 0) - 1
          const next = ta.value.slice(0, pos) + ta.value.slice(ta.selectionEnd ?? 0)
          const snapshot = markdown
          pushUndo(snapshot)
          setMarkdown(next)
          requestAnimationFrame(() => {
            ta.focus()
            ta.setSelectionRange(pos, pos)
          })
          setQuickCiteOpen(true)
          setQuickCiteAnchor(ta.coordsAtPos(pos))
          return
        }
      }

      // Esc menutup popup quick-cite
      if (event.key === 'Escape' && quickCiteOpen) {
        setQuickCiteOpen(false)
        return
      }

      const key = event.key.toLowerCase()
      const hasUndoModifier = event.metaKey || event.ctrlKey
      if (!hasUndoModifier || event.altKey) return

      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      if (key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    },
    [handleRedo, handleUndo, markdown, pushUndo, quickCiteOpen]
  )

  const startEditingTitle = useCallback(() => {
    if (isLoadingDoc) return
    setTitleDraft(docTitle)
    setIsEditingTitle(true)
  }, [docTitle, isLoadingDoc])

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false)
    setTitleDraft('')
  }, [])

  const commitTitle = useCallback(async () => {
    if (!docId) {
      setIsEditingTitle(false)
      return
    }
    const next = titleDraft.trim()
    const current = (docTitle || '').trim()
    setIsEditingTitle(false)
    if (next === current) return
    try {
      setError('')
      setIsSavingDoc(true)
      const updated = await updateCoWriterDocument(docId, { title: next })
      if (isUnmountedRef.current) return
      setDocTitle(updated.title || '')
      setLastSavedAt(updated.updated_at ? updated.updated_at * 1000 : Date.now())
      notifyCoWriterChanged()
    } catch (err) {
      if (isUnmountedRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!isUnmountedRef.current) setIsSavingDoc(false)
    }
  }, [docId, docTitle, titleDraft])

  useEffect(() => {
    if (!isEditingTitle) return
    const input = titleInputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [isEditingTitle])

  const wordCount = useMemo(() => {
    const trimmed = markdown.trim()
    if (!trimmed) return 0
    // CJK has no word-delimiting spaces: count each CJK char as one word,
    // then whitespace-split whatever remains.
    const cjkPattern = /[一-鿿㐀-䶿぀-ヿ가-힯]/g
    const cjkCount = trimmed.match(cjkPattern)?.length ?? 0
    const latinWords = trimmed.replace(cjkPattern, ' ').split(/\s+/).filter(Boolean).length
    return cjkCount + latinWords
  }, [markdown])

  const charCount = markdown.length

  const hideSelectionPopover = useCallback(() => {
    selectionRequestAbortRef.current?.abort()
    selectionRequestAbortRef.current = null
    selectionDragStateRef.current = null
    setSelectionPopoverPinned(false)
    setIsDraggingSelectionPopover(false)
    setSelectionPopover(prev => ({ ...prev, visible: false }))
    setSelectedRange(null)
    setSelectionInstruction('')
    setIsToolMenuOpen(false)
    setIsModeMenuOpen(false)
    setSelectionTrace(null)
    setIsTraceExpanded(true)
  }, [])

  const updateSelectionPopover = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      hideSelectionPopover()
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start === end) {
      hideSelectionPopover()
      return
    }

    const text = textarea.value.slice(start, end)
    if (!text.trim()) {
      hideSelectionPopover()
      return
    }

    const anchor = textarea.coordsAtPos(end)
    const width = 360
    const left = Math.min(Math.max(anchor.left - width / 2, 12), window.innerWidth - width - 12)
    const top = Math.max(anchor.top - 98, 12)

    setSelectedRange(prev => {
      const changed =
        !prev ||
        prev.start !== start ||
        prev.end !== end ||
        prev.text !== text ||
        prev.snapshot !== markdown
      if (changed) {
        setSelectionPopoverPinned(false)
        if (preserveSelectionTraceRef.current) {
          preserveSelectionTraceRef.current = false
        } else {
          setSelectionTrace(null)
        }
        setIsTraceExpanded(true)
      }
      return { start, end, text, snapshot: markdown }
    })
    setSelectionPopover(prev => ({
      visible: true,
      top: selectionPopoverPinned ? prev.top : top,
      left: selectionPopoverPinned ? prev.left : left,
    }))
  }, [hideSelectionPopover, markdown, selectionPopoverPinned])

  const insertSnippet = useCallback(
    (snippet: string) => {
      commitPendingTypingUndo()
      pushUndo(markdown)
      const textarea = textareaRef.current
      if (!textarea) {
        setMarkdown(prev => `${prev}\n${snippet}`)
        return
      }
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const next = `${markdown.slice(0, start)}${snippet}${markdown.slice(end)}`
      setMarkdown(next)
      requestAnimationFrame(() => {
        textarea.focus()
        const cursor = start + snippet.length
        textarea.setSelectionRange(cursor, cursor)
      })
    },
    [commitPendingTypingUndo, markdown, pushUndo]
  )

  const clearDocument = useCallback(() => {
    if (!markdown) {
      setStatus(t('Draft is already empty.'))
      setError('')
      return
    }
    commitPendingTypingUndo()
    pushUndo(markdown)
    setMarkdown('')
    setStatus(t('Draft cleared. Press Ctrl/Cmd+Z or use Undo to restore it.'))
    setError('')
  }, [commitPendingTypingUndo, markdown, pushUndo, t])

  const loadExampleTemplate = useCallback(() => {
    if (markdown === CO_WRITER_SAMPLE_TEMPLATE) {
      setStatus(t('Example template is already loaded.'))
      setError('')
      return
    }

    commitPendingTypingUndo()
    pushUndo(markdown)
    setMarkdown(CO_WRITER_SAMPLE_TEMPLATE)
    setStatus(t('Loaded example template. Press Ctrl/Cmd+Z or use Undo to restore it.'))
    setError('')
  }, [commitPendingTypingUndo, markdown, pushUndo, t])

  const requestClearDocument = useCallback(() => {
    if (!markdown) {
      clearDocument()
      return
    }
    setPendingConfirmAction('clear')
  }, [clearDocument, markdown])

  const requestLoadExampleTemplate = useCallback(() => {
    if (markdown === CO_WRITER_SAMPLE_TEMPLATE) {
      loadExampleTemplate()
      return
    }
    setPendingConfirmAction('template')
  }, [loadExampleTemplate, markdown])

  const confirmActionCopy = useMemo(() => {
    if (pendingConfirmAction === 'clear') {
      return {
        title: t('Clear this draft?'),
        description: t(
          'This will empty the editor. The previous content is kept in Undo until you leave this draft.'
        ),
        confirmLabel: t('Clear draft'),
        tone: 'danger' as const,
        onConfirm: clearDocument,
      }
    }

    if (pendingConfirmAction === 'template') {
      return {
        title: t('Replace with the example template?'),
        description: t(
          'This will replace the current editor content. The previous content is kept in Undo until you leave this draft.'
        ),
        confirmLabel: t('Load template'),
        tone: 'warning' as const,
        onConfirm: loadExampleTemplate,
      }
    }

    return null
  }, [clearDocument, loadExampleTemplate, pendingConfirmAction, t])

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'application/x-tex;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const safeTitle = (docTitle || 'co-writer')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .slice(0, 80)
    anchor.download = `${safeTitle || 'co-writer'}.tex`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportDocx = async () => {
    // Gerbang LaTeX hanya untuk mode Sumber — di mode Word `markdown` tidak
    // dipakai (dokumen ada di DOCX kerja), jadi jangan menghalangi ekspor.
    if (!syncMode && !markdown.trim()) {
      setError(t('Add some content before exporting.'))
      return
    }
    try {
      await flushCurrentBuffer()
      if (editMode === 'sync') {
        // Persis seperti di layar: unduh DOCX kerja apa adanya (yang barusan
        // disimpan oleh flushCurrentBuffer), bukan dibangun ulang dari markdown.
        const blob = await getWorkingDocx(docId)
        downloadBlob(blob, '.docx')
      } else {
        const res = await apiFetch(
          apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/export-docx`),
          { cache: 'no-store' }
        )
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { detail?: string } | null
          throw new Error(body?.detail || `HTTP ${res.status}`)
        }
        downloadBlob(await res.blob(), '.docx')
      }
      setStatus(t('DOCX dengan sitasi aktif berhasil diunduh.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Gagal mengekspor DOCX.'))
      throw err
    }
  }

  const handleExportPdf = async () => {
    if (!syncMode && !markdown.trim()) {
      setError(t('Add some content before exporting.'))
      return
    }
    try {
      await flushCurrentBuffer()
      let blob: Blob
      let fallbackNotice: string | null = null
      if (editMode === 'sync') {
        // Persis seperti di layar: cetak DOCX kerja lewat LibreOffice
        // (POST /export-pdf) — bukan jalur LaTeX/tectonic bertemplat kampus.
        const res = await apiFetch(
          apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/export-pdf`),
          { method: 'POST', cache: 'no-store' }
        )
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { detail?: string } | null
          throw new Error(body?.detail || `HTTP ${res.status}`)
        }
        blob = await res.blob()
      } else {
        // Markdown-first: PDF mode Sumber dirender lewat jalur typeset
        // (Chromium) — HTML yang SAMA dengan panel pratinjau, jadi hasil unduhan
        // persis yang di layar. Bukan `export-latex` (tectonic) yang dulu
        // membuat "yang diinput beda dengan yang keluar".
        const res = await apiFetch(
          apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/export?format=pdf`),
          { cache: 'no-store' }
        )
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { detail?: string } | null
          throw new Error(body?.detail || `HTTP ${res.status}`)
        }
        // PRD v2.8 §4.3: bila jalur render gagal, backend bisa mengirim DOCX/PDF
        // cadangan + header notifikasi — sesuaikan nama file dan pesannya.
        fallbackNotice = res.headers.get('X-Fallback-Notice')
        blob = await res.blob()
      }
      const isDocx = blob.type.includes('officedocument')
      downloadBlob(blob, isDocx ? '.docx' : '.pdf')
      setStatus(fallbackNotice ?? t('PDF rapi berhasil diunduh.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Gagal mengekspor PDF.'))
      throw err
    }
  }

  // ── PRD v2.4 §2: Gap analysis (cek kelengkapan struktur) ──
  const runGapAnalysis = useCallback(async () => {
    if (!markdown.trim()) return
    setError('')
    try {
      const res = await apiFetch(
        apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/gap-analysis`),
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setGapResult(
        (await res.json()) as {
          sections: Array<{ section: string; present: boolean; status: string }>
          total_present: number
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [docId, markdown, apiFetch, apiUrl, setGapResult, setError, t])

  // ── PRD v2.4 §3,5: AI checks (klaim tanpa sitasi + konsistensi istilah) ──
  const runAiChecks = useCallback(async () => {
    if (!markdown.trim()) return
    setError('')
    try {
      const res = await apiFetch(
        apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/ai-checks`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          cache: 'no-store',
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAiChecksResult(
        (await res.json()) as {
          claims_without_citation: string[]
          claim_count: number
          terminology: Array<{
            term: string
            count: number
            variants?: string[]
            suggest?: string | null
          }>
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [docId, markdown, apiFetch, apiUrl, setAiChecksResult, setError, t])

  const replaceTermAcrossProject = useCallback(
    async (from: string, to: string) => {
      setError('')
      try {
        await flushCurrentBuffer()
        const res = await apiFetch(
          apiUrl(`/api/v1/co_writer/documents/${encodeURIComponent(docId)}/replace-term`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to }),
          }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const result = (await res.json()) as { replaced: number }
        const target = activeFileRef.current ?? 'main.tex'
        activeFileRef.current = '__normalized__'
        await openProjectFile(target)
        await runAiChecks()
        setStatus(
          t('{{count}} istilah diseragamkan menjadi {{term}}.', {
            count: result.replaced,
            term: to,
          })
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [docId, openProjectFile, runAiChecks, flushCurrentBuffer, t]
  )

  const handleOpenSaveToNotebook = useCallback(() => {
    if (!markdown.trim()) {
      setError(t('Add some content before saving to a notebook.'))
      return
    }
    const fallbackTitle = t('Untitled Co-Writer Document')
    const titleForRecord = (docTitle || fallbackTitle).trim() || fallbackTitle
    setNotebookSavePayload({
      recordType: 'co_writer',
      title: titleForRecord,
      userQuery: titleForRecord,
      output: markdown,
      metadata: {
        source: 'co_writer',
        doc_id: docId,
      },
      kbName: kbName || null,
    })
  }, [docId, docTitle, kbName, markdown, t])

  const replaceSelectedText = useCallback(
    (range: SelectedRange, replacement: string) => {
      pushUndo(range.snapshot)
      const next = `${range.snapshot.slice(0, range.start)}${replacement}${range.snapshot.slice(range.end)}`
      preserveSelectionTraceRef.current = true
      setMarkdown(next)
      setSelectedRange({
        start: range.start,
        end: range.start + replacement.length,
        text: replacement,
        snapshot: next,
      })

      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (!textarea) return
        textarea.focus()
        textarea.setSelectionRange(range.start, range.start + replacement.length)
        updateSelectionPopover()
      })
    },
    [pushUndo, updateSelectionPopover]
  )

  const toggleSelectionTool = useCallback((tool: ToolName) => {
    setSelectionTools(prev =>
      prev.includes(tool) ? prev.filter(item => item !== tool) : [...prev, tool]
    )
  }, [])

  const handleSelectionPopoverDragStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, button, select, option, a, [data-no-drag='true']")) {
        return
      }
      event.preventDefault()
      selectionDragStateRef.current = {
        offsetX: event.clientX - selectionPopover.left,
        offsetY: event.clientY - selectionPopover.top,
      }
      setSelectionPopoverPinned(true)
      setIsDraggingSelectionPopover(true)
      setIsToolMenuOpen(false)
      setIsModeMenuOpen(false)
    },
    [selectionPopover.left, selectionPopover.top]
  )

  const updateSelectionTraceFromEvent = useCallback((event: StreamTraceEvent) => {
    setSelectionTrace(prev => {
      const current = prev ?? { toolTraces: [], response: '' }
      if (event.type === 'tool_call') {
        return {
          ...current,
          toolTraces: [
            ...current.toolTraces,
            {
              kind: 'tool_call',
              name: String(event.content || ''),
              arguments:
                event.metadata && typeof event.metadata.args === 'object'
                  ? (event.metadata.args as Record<string, unknown>)
                  : {},
              result: '',
              success: true,
              sources: [],
              metadata: event.metadata || {},
            },
          ],
        }
      }
      if (event.type === 'tool_result') {
        return {
          ...current,
          toolTraces: [
            ...current.toolTraces,
            {
              kind: 'tool_result',
              name: String(event.metadata?.tool || 'result'),
              arguments: {},
              result: String(event.content || ''),
              success: true,
              sources: [],
              metadata: event.metadata || {},
            },
          ],
        }
      }
      if (event.type === 'content' && event.stage === 'responding') {
        return {
          ...current,
          response: `${current.response}${event.content || ''}`,
        }
      }
      return current
    })
  }, [])

  const applyReactSelectionEdit = useCallback(async () => {
    if (!selectedRange) {
      setError(t('Please select a text passage first.'))
      return
    }

    if (selectionMode === 'none' && !selectionInstruction.trim()) {
      setError(t('Please enter an instruction or choose a mode.'))
      return
    }

    setIsEditing(true)
    setError('')
    setStatus('')
    setSelectionTrace({ toolTraces: [], response: '' })
    setIsTraceExpanded(true)
    selectionRequestAbortRef.current?.abort()
    const controller = new AbortController()
    selectionRequestAbortRef.current = controller

    try {
      const response = await apiFetch(apiUrl('/api/v1/co_writer/edit_react/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          selected_text: selectedRange.text,
          instruction: selectionInstruction.trim(),
          mode: selectionMode,
          tools: selectionTools,
          kb_name: selectionTools.includes('rag') ? kbName || null : null,
        }),
      })
      if (!response.ok) {
        throw new Error((await response.text()) || t('Failed to edit selected text.'))
      }
      if (!response.body) {
        throw new Error(t('Streaming response body is missing.'))
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: StreamEditResult | undefined

      const processSseChunk = (chunk: string) => {
        const lines = chunk.split(/\r?\n/)
        let eventName = 'message'
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }
        if (dataLines.length === 0) return
        const payload = JSON.parse(dataLines.join('\n'))
        if (eventName === 'stream') {
          updateSelectionTraceFromEvent(payload as StreamTraceEvent)
          return
        }
        if (eventName === 'result') {
          finalResult = payload as StreamEditResult
          return
        }
        if (eventName === 'error') {
          throw new Error(String(payload?.detail || t('Failed to edit selected text.')))
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        while (true) {
          const delimiterIndex = buffer.indexOf('\n\n')
          if (delimiterIndex === -1) break
          const rawEvent = buffer.slice(0, delimiterIndex)
          buffer = buffer.slice(delimiterIndex + 2)
          processSseChunk(rawEvent)
        }
      }
      buffer += decoder.decode()
      if (buffer.trim()) {
        processSseChunk(buffer.trim())
      }
      if (finalResult === undefined) {
        throw new Error(t('Did not receive a final edit result.'))
      }
      const editedText = finalResult.edited_text ?? ''

      // Snapshot seleksi merujuk markdown (LaTeX) — hanya mode Sumber.
      const currentSnap = markdownRef.current
      // Izinkan drift kecil: bila user tidak menyentuh draf, snapshot tetap cocok.
      // Bila draf berubah total, minta seleksi ulang.
      if (
        currentSnap !== selectedRange.snapshot &&
        // Masih aman bila potongan terpilih masih ada di posisi yang sama.
        currentSnap.slice(selectedRange.start, selectedRange.end) !== selectedRange.text
      ) {
        throw new Error(
          t('The draft changed before AI edit finished. Please reselect the text and try again.'),
        )
      }

      // PRD 9.2: tampilkan diff inline dulu (Accept/Reject) — jangan langsung terapkan.
      setPendingDiff({
        original: selectedRange.text,
        edited: editedText,
        start: selectedRange.start,
        end: selectedRange.end,
        snapshot: selectedRange.snapshot,
        path: activeFileRef.current,
        format: 'latex',
      })
      setStatus(t('AI selesai mengedit. Periksa diff lalu Terima/Tolak.'))
      hideSelectionPopover()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : t('Failed to edit selected text.'))
    } finally {
      selectionRequestAbortRef.current = null
      setIsEditing(false)
    }
  }, [
    editMode,
    hideSelectionPopover,
    kbName,
    replaceSelectedText,
    selectedRange,
    selectionInstruction,
    selectionMode,
    selectionTools,
    t,
    updateSelectionTraceFromEvent,
  ])

  const applyEdit = async () => {
    if (!instruction.trim()) {
      setError(t('Please enter an editing instruction first.'))
      return
    }
    const snapshot = markdown
    setIsEditing(true)
    setError('')
    setStatus('')
    try {
      const response = await apiFetch(apiUrl('/api/v1/co_writer/edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: snapshot,
          instruction: instruction.trim(),
          action,
          source: source === 'none' ? null : source,
          kb_name: source === 'rag' ? kbName || null : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || t('Failed to edit document.'))
      if (markdownRef.current !== snapshot) {
        throw new Error(t('The draft changed while AI edit was running. Please try again.'))
      }
      pushUndo(snapshot)
      setMarkdown(data.edited_text || '')
      setStatus(
        t('Applied {{action}} to the full draft.', {
          action: t(ACTION_LABELS[action]).toLowerCase(),
        })
      )
      setIsEditModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to edit document.'))
    } finally {
      setIsEditing(false)
    }
  }

  const applyAutoMark = async () => {
    if (!markdown.trim()) {
      setError(t('Add some content before running auto-mark.'))
      return
    }
    const snapshot = markdown
    setIsAutoMarking(true)
    setError('')
    setStatus('')
    try {
      const response = await apiFetch(apiUrl('/api/v1/co_writer/automark'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: snapshot }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || t('Failed to auto-mark document.'))
      if (markdownRef.current !== snapshot) {
        throw new Error(t('The draft changed while AI edit was running. Please try again.'))
      }
      pushUndo(snapshot)
      setMarkdown(data.marked_text || '')
      setStatus(t('Applied auto-mark annotations.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to auto-mark document.'))
    } finally {
      setIsAutoMarking(false)
    }
  }

  const TOOLBAR: ToolbarItem[] = useMemo(
    () => [
      { id: 'undo', icon: Undo2, title: 'Undo', action: handleUndo },
      { id: 'redo', icon: Redo2, title: 'Redo', action: handleRedo },
      { id: 'sep-1', icon: Minus, title: '', type: 'separator' },
      { id: 'h1', icon: Heading1, title: 'Bab (chapter)', snippet: '\n\\chapter{Judul}\n' },
      { id: 'h2', icon: Heading2, title: 'Section', snippet: '\n\\section{Judul}\n' },
      { id: 'h3', icon: Heading3, title: 'Subsection', snippet: '\n\\subsection{Judul}\n' },
      {
        id: 'h4',
        icon: Heading4,
        title: 'Subsubsection',
        snippet: '\n\\subsubsection{Judul}\n',
      },
      { id: 'sep-2', icon: Minus, title: '', type: 'separator' },
      { id: 'bold', icon: Bold, title: 'Tebal', snippet: '\\textbf{tebal}' },
      { id: 'italic', icon: Italic, title: 'Miring', snippet: '\\textit{miring}' },
      {
        id: 'underline',
        icon: Strikethrough,
        title: 'Garis bawah',
        snippet: '\\underline{teks}',
      },
      { id: 'code', icon: Braces, title: 'Kode inline', snippet: '\\texttt{kode}' },
      { id: 'sep-3', icon: Minus, title: '', type: 'separator' },
      {
        id: 'quote',
        icon: Quote,
        title: 'Kutipan',
        snippet: '\n\\begin{quote}\nKutipan.\n\\end{quote}\n',
      },
      {
        id: 'ul',
        icon: List,
        title: 'Daftar butir',
        snippet: '\n\\begin{itemize}\n  \\item Butir\n  \\item Butir\n\\end{itemize}\n',
      },
      {
        id: 'ol',
        icon: ListOrdered,
        title: 'Daftar bernomor',
        snippet: '\n\\begin{enumerate}\n  \\item Butir\n  \\item Butir\n\\end{enumerate}\n',
      },
      { id: 'sep-4', icon: Minus, title: '', type: 'separator' },
      {
        id: 'table',
        icon: Table2,
        title: 'Tabel',
        snippet:
          '\n\\begin{table}[H]\n\\centering\n\\caption{Judul tabel}\n' +
          '\\begin{tabular}{ll}\n\\toprule\nKolom & Kolom \\\\\n\\midrule\n' +
          'Isi & Isi \\\\\n\\bottomrule\n\\end{tabular}\n\\end{table}\n',
      },
      {
        id: 'image',
        icon: ImageIcon,
        title: 'Gambar',
        snippet:
          '\n\\begin{figure}[H]\n\\centering\n' +
          '\\includegraphics[width=0.8\\textwidth]{path/gambar.png}\n' +
          '\\caption{Keterangan gambar}\n\\end{figure}\n',
      },
      {
        id: 'cite',
        icon: LinkIcon,
        title: 'Sitasi',
        snippet: '\\cite{kunci}',
      },
      { id: 'sep-5', icon: Minus, title: '', type: 'separator' },
      {
        id: 'codeblock',
        icon: Code2,
        title: 'Blok kode',
        snippet: '\n\\begin{verbatim}\nprint("hello")\n\\end{verbatim}\n',
      },
      {
        id: 'math',
        icon: () => <span className="text-[11px] font-semibold leading-none">&Sigma;</span>,
        title: 'Rumus',
        snippet: '\n\\begin{equation}\n  a^2 + b^2 = c^2\n\\end{equation}\n',
      },
    ],
    [handleUndo, handleRedo]
  )

  useEffect(() => {
    // Sinkron posisi popover hanya di mode Sumber (CodeMirror/textarea).
    if (!selectionPopover.visible || editMode !== 'source') return
    const handleViewportChange = () => updateSelectionPopover()
    window.addEventListener('resize', handleViewportChange)
    return () => window.removeEventListener('resize', handleViewportChange)
  }, [editMode, selectionPopover.visible, updateSelectionPopover])

  useEffect(() => {
    if (!selectionPopover.visible) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (selectionPopoverRef.current?.contains(target)) return
      if (textareaRef.current?.contains(target)) return
      hideSelectionPopover()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [hideSelectionPopover, selectionPopover.visible])

  useEffect(() => {
    if (!isDraggingSelectionPopover) return
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = selectionDragStateRef.current
      const popover = selectionPopoverRef.current
      if (!dragState || !popover) return
      const width = popover.offsetWidth || 360
      const height = popover.offsetHeight || 200
      const nextLeft = Math.min(
        Math.max(event.clientX - dragState.offsetX, 12),
        window.innerWidth - width - 12
      )
      const nextTop = Math.min(
        Math.max(event.clientY - dragState.offsetY, 12),
        window.innerHeight - height - 12
      )
      setSelectionPopover(prev => ({
        ...prev,
        visible: true,
        top: nextTop,
        left: nextLeft,
      }))
    }
    const handleMouseUp = () => {
      selectionDragStateRef.current = null
      setIsDraggingSelectionPopover(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSelectionPopover])

  useEffect(() => {
    return () => {
      selectionRequestAbortRef.current?.abort()
    }
  }, [])

  const handleSplitterPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!showEditor || !showPreview) return
      event.preventDefault()
      setIsResizingSplit(true)
      try {
        ;(event.target as HTMLDivElement).setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
    },
    [showEditor, showPreview]
  )

  useEffect(() => {
    if (!isResizingSplit) return
    const handleMove = (event: PointerEvent) => {
      const container = splitContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = (event.clientX - rect.left) / rect.width
      setEditorRatio(Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, ratio)))
    }
    const handleEnd = () => setIsResizingSplit(false)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [isResizingSplit])

  // Sinkronisasi gulir editor↔pratinjau dihentikan sejak pratinjau jadi PDF:
  // teknik lamanya mengukur posisi baris lewat cermin textarea dan menandai
  // elemen pratinjau dengan `data-source-line`. PDF tidak punya keduanya.
  // Handler dipertahankan supaya pemanggilnya tidak perlu diubah.
  const handleEditorScrollSync = useCallback(() => {
    updateSelectionPopover()
  }, [updateSelectionPopover])

  if (docNotFound) {
    return (
      <div className="flex h-full min-h-full flex-col items-center justify-center gap-4 bg-[var(--background)] p-10 text-center">
        <p className="text-lg font-medium text-[var(--foreground)]">{t('Document not found')}</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t('This document may have been deleted, or the link is incorrect.')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/co-writer')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <ChevronLeft size={14} />
          {t('Back to Co-Writer')}
        </button>
      </div>
    )
  }

  if (isLoadingDoc && !hasLoadedDraft) {
    return (
      <div className="flex h-full min-h-full flex-col items-center justify-center gap-3 bg-[var(--background)] p-10 text-center text-[var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">{t('Loading document…')}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-full flex-col overflow-hidden bg-[var(--background)]">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <button
            type="button"
            onClick={() => router.push('/co-writer')}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            title={t('Back to documents')}
          >
            <ChevronLeft size={14} strokeWidth={1.7} />
            <span>{t('Co-Writer')}</span>
          </button>
          <span className="text-[var(--muted-foreground)]/40">/</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={event => setTitleDraft(event.target.value)}
              onBlur={() => {
                void commitTitle()
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitTitle()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelEditingTitle()
                }
              }}
              maxLength={120}
              spellCheck={false}
              placeholder={t('Untitled draft')}
              aria-label={t('Document title')}
              className="min-w-0 flex-1 max-w-[24rem] rounded-md border border-[var(--primary)]/40 bg-[var(--background)] px-2 py-0.5 font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30"
            />
          ) : (
            <span
              role="button"
              tabIndex={0}
              onDoubleClick={startEditingTitle}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === 'F2') {
                  event.preventDefault()
                  startEditingTitle()
                }
              }}
              title={t('Double-click to rename')}
              className="min-w-0 truncate cursor-text rounded-md border border-transparent px-2 py-0.5 font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
            >
              {docTitle || t('Untitled draft')}
            </span>
          )}
          <span className="hidden shrink-0 text-xs sm:inline">
            {wordCount} {t('words')} &middot; {charCount} {t('chars')}
          </span>
          {isSavingDoc ? (
            <span className="hidden shrink-0 items-center gap-1 text-[10px] text-[var(--muted-foreground)]/70 sm:inline-flex">
              <Loader2 size={10} className="animate-spin" />
              {t('Saving…')}
            </span>
          ) : lastSavedAt ? (
            <span className="hidden shrink-0 text-[10px] text-[var(--muted-foreground)]/60 sm:inline">
              {t('Saved')}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VersionHistory
            docId={docId}
            onRestored={async () => {
              const target = activeFileRef.current ?? 'main.tex'
              // Paksa pemuatan ulang berkas aktif setelah restore proyek.
              activeFileRef.current = '__restored__'
              await openProjectFile(target)
              await refreshProjectFiles()
              setStatus(t('Versi berhasil dipulihkan.'))
            }}
          />
          <HeaderActionMenu
            label={t('Lainnya')}
            items={[
              {
                label: t('Ekspor DOCX (sitasi aktif)'),
                icon: FileDown,
                onClick: handleExportDocx,
                disabled: !markdown.trim(),
              },
              {
                label: t('Ekspor PDF'),
                icon: FileDown,
                onClick: handleExportPdf,
                disabled: !markdown.trim(),
              },
              {
                label: t('Unduh LaTeX'),
                icon: Download,
                onClick: handleDownload,
                disabled: !markdown.trim(),
              },
              {
                label: t('Simpan ke Notebook'),
                icon: NotebookPen,
                onClick: handleOpenSaveToNotebook,
                disabled: !markdown.trim(),
              },
              ...(!markdown.trim()
                ? [
                    {
                      label: t('Muat template contoh'),
                      icon: FileText,
                      onClick: requestLoadExampleTemplate,
                      tone: 'warning' as const,
                    },
                  ]
                : []),
              ...(markdown.trim()
                ? [
                    {
                      label: t('Hapus isi draf'),
                      icon: Eraser,
                      onClick: requestClearDocument,
                      tone: 'danger' as const,
                      dividerBefore: true,
                    },
                  ]
                : []),
            ]}
          />
          <div className="mx-0.5 h-5 w-px bg-[var(--border)]" />
          {editMode === 'sync' && (
            <button
              type="button"
              onClick={toggleEditMode}
              title={t('Beralih ke editor Markdown')}
              className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Code2 size={12} />
              <span className="hidden md:inline">{t('Markdown')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setFocusMode(v => !v)}
            title={focusMode ? t('Keluar mode fokus (tampilkan panel)') : t('Mode fokus: tulis tanpa panel samping')}
            aria-pressed={focusMode}
            className={`inline-flex h-6 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
              focusMode
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Focus size={12} />
            <span className="hidden md:inline">{focusMode ? t('Fokus') : t('Mode fokus')}</span>
          </button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      {/* Baris toolbar TIDAK boleh memakai overflow-x-auto: menurut spesifikasi CSS,
          nilai overflow-y `visible` ikut dihitung menjadi `auto` bila salah satu
          sumbu bukan visible, sehingga baris ini menjadi kotak pemotong dan
          popover ber-`top-full` (Daftar Isi, Cek Struktur, Cek Sitasi) terpotong
          habis — hanya tersisa beberapa piksel di bawah toolbar. Penggeseran
          horizontal dipindahkan ke wadah tombol pemformatan saja, yang memang
          tidak memuat popover. */}
      {editMode === 'source' && (
      <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] px-3 py-1">
        {/* Tombol Daftar Isi (TOC) — PRD v2.3 */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setTocOpen(v => !v)}
            title={t('Daftar Isi')}
            className={`shrink-0 rounded-md p-1.5 transition-colors hover:bg-[var(--muted)]/55 ${
              tocOpen
                ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <ListTree size={16} />
          </button>
          {tocOpen && (
            <div className="dt-popup-up absolute left-0 top-full z-30 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1.5 shadow-lg backdrop-blur-md">
              <div className="mb-1 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t('Daftar Isi')}
              </div>
              {(() => {
                const headings = outlineHeadings
                if (headings.length === 0) {
                  return (
                    <div className="px-2 py-4 text-center text-[11.5px] text-[var(--muted-foreground)]">
                      {t('Belum ada bab. Tambahkan \\section pada dokumen.')}
                    </div>
                  )
                }
                return headings.map(heading => (
                  <button
                    key={`${heading.path}-${heading.offset}-${heading.title}`}
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await openProjectFile(heading.path)
                        requestAnimationFrame(() => {
                          const editor = textareaRef.current
                          if (!editor) return
                          editor.focus()
                          editor.setSelectionRange(heading.offset, heading.offset)
                          editor.scrollTop =
                            markdownRef.current.slice(0, heading.offset).split('\n').length * 20
                        })
                      })()
                      setPreviewJumpText(heading.title)
                      setTocOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/45"
                    style={{ paddingLeft: 8 + (heading.level - 1) * 14 }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{heading.title}</span>
                      <span className="block truncate text-[9.5px] text-[var(--muted-foreground)]">
                        {heading.path}
                      </span>
                    </span>
                  </button>
                ))
              })()}
            </div>
          )}
        </div>
        <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />
        {/* Hanya deretan tombol pemformatan yang boleh menggeser mendatar;
            kelompok ini tidak memuat popover sehingga aman dijadikan kotak
            pemotong saat lebar layar sempit. */}
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {TOOLBAR.map(item => {
            if (item.type === 'separator') {
              return <div key={item.id} className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />
            }
            const Icon = item.icon
            return (
              <button
                key={item.id}
                title={t(item.title)}
                onClick={() => (item.action ? item.action() : insertSnippet(item.snippet || ''))}
                className="shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)] active:scale-[0.97]"
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-3 text-[10.5px] text-[var(--muted-foreground)]">
          {/* ── Cek Struktur (Gap Analysis) — PRD v2.4 §2 ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => void runGapAnalysis()}
              title={t('Cek kelengkapan struktur vs template')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-[var(--muted)]/55"
            >
              <ListChecks size={12} />
              <span className="hidden md:inline">{t('Cek Struktur')}</span>
            </button>
            {gapResult && (
              <div className="dt-popup-up absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-lg backdrop-blur-md">
                <div className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t('Kelengkapan struktur')} — {gapResult.total_present}/
                  {gapResult.sections.length}
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {gapResult.sections.map(s => (
                    <div
                      key={s.section}
                      className="flex items-center justify-between rounded-md px-1.5 py-1 text-[11.5px]"
                    >
                      <span className="text-[var(--foreground)]">{s.section}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.present ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setGapResult(null)}
                  className="mt-1 w-full rounded-md px-2 py-1 text-center text-[10.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
                >
                  {t('Tutup')}
                </button>
              </div>
            )}
          </div>

          {/* ── Cek Sitasi & Konsistensi (AI Checks) — PRD v2.4 §3,5 ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => void runAiChecks()}
              title={t('Cek kalimat klaim tanpa sitasi & konsistensi istilah')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-[var(--muted)]/55"
            >
              <SearchCheck size={12} />
              <span className="hidden md:inline">{t('Cek Sitasi')}</span>
            </button>
            {aiChecksResult && (
              <div className="dt-popup-up absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-lg backdrop-blur-md">
                <div className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t('Hasil pemeriksaan')}
                </div>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  <div className="px-1 text-[11px] font-medium text-[var(--foreground)]">
                    {t('Kalimat klaim tanpa sitasi')}: {aiChecksResult.claim_count}
                  </div>
                  {aiChecksResult.claims_without_citation.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="rounded-md bg-amber-500/10 px-1.5 py-1 text-[10.5px] leading-snug text-amber-700 dark:text-amber-300"
                    >
                      {c.length > 90 ? `${c.slice(0, 90)}…` : c}
                    </div>
                  ))}
                  <div className="mt-2 px-1 text-[11px] font-medium text-[var(--foreground)]">
                    {t('Variasi istilah')}:
                  </div>
                  {aiChecksResult.terminology.map(term => (
                    <div key={term.term} className="rounded-md px-1.5 py-1 text-[10.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--foreground)]">{term.term}</span>
                        <span className="text-[var(--muted-foreground)]">{term.count}x</span>
                      </div>
                      {term.suggest && term.variants && term.variants.length > 1 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {term.variants
                            .filter(variant => variant !== term.suggest)
                            .map(variant => (
                              <button
                                key={variant}
                                type="button"
                                onClick={() =>
                                  void replaceTermAcrossProject(variant, term.suggest as string)
                                }
                                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[9.5px] text-[var(--primary)] hover:bg-[var(--primary)]/10"
                              >
                                {variant} → {term.suggest}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAiChecksResult(null)}
                  className="mt-1 w-full rounded-md px-2 py-1 text-center text-[10.5px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
                >
                  {t('Tutup')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── PRD v2.3: Layout 3 kolom — Chat | Editor+Preview | Referensi/Agentic ── */}
      <div className="relative flex min-h-0 flex-1">
        {editMode === 'source' && !focusMode && fileTreeOpen ? (
          <>
            <button
              type="button"
              aria-label={t('Tutup panel berkas')}
              onClick={() => setFileTreeOpen(false)}
              className="fixed inset-0 z-20 hidden bg-black/25 max-lg:block"
            />
            <div
              className="flex min-h-0 w-[var(--file-tree-width)] shrink-0 flex-col border-r border-[var(--border)] max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[calc(100vw_-_2rem)] max-lg:max-w-[280px] max-lg:shadow-2xl"
              style={
                {
                  '--file-tree-width': `${fileTreeWidth}px`,
                } as React.CSSProperties
              }
            >
              <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setLeftPanelTab('files')}
                  className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    leftPanelTab === 'files'
                      ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]'
                  }`}
                >
                  <FileText size={12} />
                  {t('Berkas')}
                </button>
                <button
                  type="button"
                  onClick={() => setLeftPanelTab('outline')}
                  className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    leftPanelTab === 'outline'
                      ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]'
                  }`}
                >
                  <ListTree size={12} />
                  {t('Outline')}
                  {outlineHeadings.length > 0 ? (
                    <span className="rounded-full bg-[var(--muted)] px-1.5 text-[9px] text-[var(--muted-foreground)]">
                      {outlineHeadings.length}
                    </span>
                  ) : null}
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {leftPanelTab === 'files' ? (
                  <FileTree
                    files={projectFiles}
                    activePath={activeFile ?? 'main.tex'}
                    loading={isLoadingFile}
                    busy={isFileActionBusy || isSavingDoc}
                    onSelect={openProjectFile}
                    onCreate={createProjectFile}
                    onRename={renameProjectFile}
                    onDelete={deleteProjectFile}
                    onSplit={splitProjectDocument}
                    onCollapse={() => setFileTreeOpen(false)}
                  />
                ) : (
                  <OutlineSidebar
                    headings={outlineHeadings}
                    activePath={activeFile ?? 'main.tex'}
                    loading={isLoadingOutline}
                    groupName={outlineGroupName}
                    referenceCount={outlineReferenceCount}
                    onJumpTo={async (path, offset, title) => {
                      await openProjectFile(path)
                      requestAnimationFrame(() => {
                        const editor = textareaRef.current
                        if (!editor) return
                        editor.focus()
                        editor.setSelectionRange(offset, offset)
                        const source = markdownRef.current.slice(0, offset)
                        editor.scrollTop = source.split('\n').length * 20
                      })
                      setPreviewJumpText(title)
                    }}
                  />
                )}
              </div>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={event => {
                event.preventDefault()
                setIsResizingFileTree(true)
                const startX = event.clientX
                const startWidth = fileTreeWidth
                const onMove = (moveEvent: PointerEvent) => {
                  setFileTreeWidth(
                    Math.min(320, Math.max(180, startWidth + moveEvent.clientX - startX))
                  )
                }
                const onUp = () => {
                  setIsResizingFileTree(false)
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
              className={`group relative z-40 flex w-1 shrink-0 cursor-col-resize items-stretch border-r border-[var(--border)] max-lg:hidden ${
                isResizingFileTree
                  ? 'bg-[var(--primary)]/40'
                  : 'bg-transparent hover:bg-[var(--primary)]/30'
              }`}
              title={t('Drag untuk mengubah lebar panel berkas')}
            >
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
          </>
        ) : (
          editMode === 'source' && !focusMode && (
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(max-width: 1023px)').matches) {
                  setChatPanelOpen(false)
                }
                setFileTreeOpen(true)
              }}
              title={t('Buka panel berkas')}
              className="flex w-7 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <PanelLeftOpen size={14} />
            </button>
          )
        )}
        {/* Panel kiri: Chat (research partner) — resizable, collapsible */}
        {/* Editor + Preview (tengah) */}
        <div
          ref={splitContainerRef}
          className={`relative flex min-h-0 flex-1 ${isResizingSplit ? 'select-none' : ''}`}
        >
          {/* Editor panel */}
          {showEditor && (
            <div
              className="flex min-h-0 flex-col"
              style={{
                // Mode Word: satu panel penuh. Mode Sumber: berbagi lebar dengan
                // panel pratinjau saat panel itu terbuka.
                width: panelKananTampil ? `${editorRatio * 100}%` : '100%',
              }}
            >
              {editMode === 'source' && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1">
                <span className="min-w-0 truncate text-xs font-medium text-[var(--muted-foreground)]">
                  {t('Editor')} · {activeFile ?? (docTitle || t('Markdown'))}
                  {isLoadingFile || isSavingDoc ? (
                    <Loader2 size={11} className="ml-1 inline animate-spin" />
                  ) : null}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleEditMode}
                    title={t('Kembali ke editor ala Word')}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <FileText size={12} />
                    {t('Word')}
                  </button>
                  <button
                    title={t('Collapse editor')}
                    onClick={() => setEditorCollapsed(true)}
                    className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
              )}
              {editMode === 'sync' ? (
                <SuperDocEditor
                  key={sfdtLoadKey}
                  ref={syncEditorRef}
                  initialFile={initialSyncFile}
                  onChange={() => {
                    sfdtDirtyRef.current = true
                    scheduleSfdtSave()
                  }}
                />
              ) : (
                <LatexCodeEditor
                  ref={textareaRef}
                  value={markdown}
                  onChange={handleMarkdownChange}
                  onSelectionChange={updateSelectionPopover}
                  onKeyDown={handleEditorKeyDown}
                  onScroll={handleEditorScrollSync}
                  dark={editorDark}
                  placeholder={t('Mulai menulis dengan Markdown...')}
                />
              )}
            </div>
          )}

          {/* Draggable splitter (only when both panes are visible) */}
          {showEditor && panelKananTampil && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('Resize editor and preview')}
              onPointerDown={handleSplitterPointerDown}
              onDoubleClick={() => setEditorRatio(0.5)}
              className={`group relative z-10 flex w-1 shrink-0 cursor-col-resize items-stretch border-x border-[var(--border)] transition-colors ${
                isResizingSplit
                  ? 'bg-[var(--primary)]/40'
                  : 'bg-transparent hover:bg-[var(--primary)]/30'
              }`}
              title={t('Drag to resize, double-click to reset')}
            >
              {/* Wider invisible hit-area so the handle is easy to grab */}
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 h-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity ${
                  isResizingSplit
                    ? 'bg-[var(--primary)] opacity-100'
                    : 'bg-[var(--muted-foreground)]/40 opacity-0 group-hover:opacity-100'
                }`}
              />
            </div>
          )}

          {/* Collapse gutter / expand buttons */}
          {editorCollapsed && (
            <button
              onClick={() => setEditorCollapsed(false)}
              title={t('Expand editor')}
              className="flex w-7 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <ChevronRight size={14} />
            </button>
          )}

          {/* Buka panel kanan: pratinjau hasil typeset (mode Sumber) */}
          {!panelKananTampil && editMode === 'source' && (
            <button
              onClick={bukaPanelKanan}
              title={t('Expand preview')}
              className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          {/* Panel kanan — pratinjau hasil kompilasi LaTeX (mode Sumber) */}
          {panelKananTampil && (
            <div
              className="flex min-h-0 flex-col"
              style={{
                width: showEditor ? `${(1 - editorRatio) * 100}%` : '100%',
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1">
                <span className="min-w-0 truncate text-xs font-medium text-[var(--muted-foreground)]">
                  {t('Pratinjau')}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    title={t('Collapse preview')}
                    onClick={tutupPanelKanan}
                    className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <TypesetHtmlPreview
                docId={docId}
                documentTitle={docTitle}
                content={markdown}
                jumpToText={previewJumpText}
                onJumpToTextHandled={() => setPreviewJumpText(null)}
                onCapture={image => {
                  setCapturedChatImage(image)
                  setChatPanelOpen(true)
                  setStatus(t('Halaman pratinjau dilampirkan ke asisten.'))
                }}
              />
            </div>
          )}

          {/* ── Tutup split container (editor+preview) sebelum panel kanan ── */}
        </div>

        {/* Panel kanan: tab Referensi / Agentic Write (PRD v2.3) */}
        {!focusMode && rightPanelOpen && (
          <div
            className="flex min-h-0 flex-col border-l border-[var(--border)]"
            style={{ width: 300 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-2 py-1.5">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('referensi')}
                  className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors ${
                    rightPanelTab === 'referensi'
                      ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {t('Referensi')}
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('agentic')}
                  className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors ${
                    rightPanelTab === 'agentic'
                      ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {t('Kerjakan otomatis')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRightPanelOpen(false)}
                title={t('Tutup panel')}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <PanelRightClose size={14} />
              </button>
            </div>
            {rightPanelTab === 'referensi' ? (
              <ReferenceSidebar
                open
                onClose={() => setRightPanelOpen(false)}
                onInsert={insertIntoEditor}
              />
            ) : (
              <AgenticRunPanel
                docId={docId}
                executeFeTool={executeAgenticFeTool}
                getDocContext={getAgenticDocContext}
                selectionText={selectedRange ? markdown.slice(selectedRange.start, selectedRange.end) : null}
              />
            )}
          </div>
        )}
        {!focusMode && !rightPanelOpen && (
          <button
            type="button"
            onClick={() => setRightPanelOpen(true)}
            title={t('Buka panel referensi')}
            className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <PanelRightClose size={14} className="rotate-180" />
          </button>
        )}
      </div>

      <div
        className={`fixed bottom-20 right-5 z-50 flex h-[min(620px,calc(100vh-7rem))] w-[380px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-2xl transition-[opacity,transform,visibility] duration-150 max-sm:inset-x-3 max-sm:bottom-16 max-sm:h-[min(560px,calc(100vh-5rem))] max-sm:w-auto ${
          chatPanelOpen && !focusMode
            ? 'visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible translate-y-2 opacity-0'
        }`}
        aria-hidden={!chatPanelOpen || focusMode}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary)]/12 text-[var(--primary)]">
            <Bot size={14} />
          </div>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--foreground)]">
            {t('Asisten Agentic')}
          </span>
          <button
            type="button"
            onClick={() => setShowChatImportPicker(true)}
            title={t('Impor percakapan dari chat utama')}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <MessagesSquare size={14} />
          </button>
          <button
            type="button"
            onClick={() => setChatPanelOpen(false)}
            title={t('Tutup asisten')}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
        <CoWriterChatPanel
          docId={docId}
          onOpenReferences={() => {
            setRightPanelTab('referensi')
            setRightPanelOpen(true)
          }}
          onOpenAgentic={() => {
            setRightPanelTab('agentic')
            setRightPanelOpen(true)
          }}
          onOpenFullEdit={() => setIsEditModalOpen(true)}
          onImportChat={() => setShowChatImportPicker(true)}
          importedConversation={importedConversation}
          onImportedConversationConsumed={() => setImportedConversation(null)}
          onExportPdf={handleExportPdf}
          onExportDocx={handleExportDocx}
          externalImage={capturedChatImage}
          onExternalImageConsumed={() => setCapturedChatImage(null)}
          externalPrompt={externalChatPrompt}
          onExternalPromptConsumed={() => setExternalChatPrompt(null)}
          onInsert={insertIntoEditor}
        />
      </div>

      {!focusMode && !chatPanelOpen ? (
        <button
          type="button"
          onClick={() => {
            if (window.matchMedia('(max-width: 1023px)').matches) {
              setFileTreeOpen(false)
            }
            setChatPanelOpen(true)
          }}
          title={t('Buka asisten agentic')}
          aria-label={t('Buka asisten agentic')}
          className="fixed bottom-20 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--primary)]/30 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg transition-[transform,opacity] hover:scale-105 hover:opacity-95 active:scale-95 max-sm:bottom-16 max-sm:right-3"
        >
          <Bot size={19} />
        </button>
      ) : null}

      {selectionPopover.visible && selectedRange && (
        <div
          ref={selectionPopoverRef}
          onMouseDown={handleSelectionPopoverDragStart}
          className={`dt-popup-up fixed z-50 rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-2.5 shadow-lg backdrop-blur-md ${
            isDraggingSelectionPopover ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            top: selectionPopover.top,
            left: selectionPopover.left,
            width: 360,
          }}
        >
          <div className="mb-2 flex justify-center" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-[var(--border)]/80" />
          </div>

          <div className="relative">
            <input
              value={selectionInstruction}
              onChange={e => setSelectionInstruction(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void applyReactSelectionEdit()
                }
              }}
              className="h-10 w-full rounded-xl bg-transparent pl-3 pr-10 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
              placeholder={t('Tell AI what to do with the selection...')}
            />
            <button
              onClick={() => void applyReactSelectionEdit()}
              disabled={isEditing || isAutoMarking}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--primary)]/90 active:scale-95 disabled:opacity-25"
              title={t('Apply AI edit')}
            >
              {isEditing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArrowRight size={13} />
              )}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setIsToolMenuOpen(prev => !prev)
                  setIsModeMenuOpen(false)
                }}
                className="flex h-8 w-full items-center justify-between rounded-lg border border-[var(--border)] px-2.5 text-[12.5px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
              >
                <span className="truncate">
                  {selectionTools.length === 0
                    ? t('Tools')
                    : selectionTools.length === 1
                      ? t(
                          TOOL_OPTIONS.find(item => item.name === selectionTools[0])?.label ||
                            'Tools'
                        )
                      : t('{{count}} tools', { count: selectionTools.length })}
                </span>
                <ChevronDown
                  size={13}
                  className={`shrink-0 transition-transform ${isToolMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isToolMenuOpen && (
                <div className="dt-popup-up absolute left-0 top-full z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg backdrop-blur-md">
                  {TOOL_OPTIONS.map(tool => {
                    const active = selectionTools.includes(tool.name)
                    return (
                      <button
                        key={tool.name}
                        onClick={() => toggleSelectionTool(tool.name)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/45"
                      >
                        <span>{t(tool.label)}</span>
                        {active ? <Check size={12} /> : <span className="w-3" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setIsModeMenuOpen(prev => !prev)
                  setIsToolMenuOpen(false)
                }}
                className="flex h-8 w-full items-center justify-between rounded-lg border border-[var(--border)] px-2.5 text-[12.5px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
              >
                <span>
                  {t(MODE_OPTIONS.find(item => item.value === selectionMode)?.label || 'Mode')}
                </span>
                <ChevronDown
                  size={13}
                  className={`shrink-0 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isModeMenuOpen && (
                <div className="dt-popup-up absolute left-0 top-full z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg backdrop-blur-md">
                  {MODE_OPTIONS.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        setSelectionMode(mode.value)
                        setIsModeMenuOpen(false)
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                    >
                      <span>{t(mode.label)}</span>
                      {selectionMode === mode.value ? (
                        <Check size={12} />
                      ) : (
                        <span className="w-3" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectionTools.includes('rag') && (
            <select
              value={kbName}
              onChange={e => setKbName(e.target.value)}
              aria-label={t('Knowledge Base')}
              className="mt-2 h-8 w-full rounded-lg border border-[var(--border)] bg-transparent px-2.5 text-[12.5px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/35"
            >
              <option value="">{t('Select a knowledge base...')}</option>
              {knowledgeBases.map(k => (
                <option key={k.name} value={k.name}>
                  {k.name}
                </option>
              ))}
            </select>
          )}

          {(isEditing || selectionTrace) && (
            <div className="mt-2 rounded-xl border border-[var(--border)]/70 bg-[var(--muted)]/18">
              <button
                onClick={() => setIsTraceExpanded(prev => !prev)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform ${isTraceExpanded ? 'rotate-180' : ''}`}
                />
                <span className="font-medium text-[var(--foreground)]">{t('Trace')}</span>
                {isEditing ? <Loader2 size={12} className="ml-auto animate-spin" /> : null}
              </button>

              {isTraceExpanded && (
                <div
                  data-no-drag="true"
                  className="max-h-[280px] overflow-y-auto border-t border-[var(--border)]/60 px-3 py-2 text-[12px] leading-[1.7] text-[var(--muted-foreground)]"
                >
                  {selectionTrace && selectionTrace.toolTraces.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/60">
                        {t('Tool')}
                      </div>
                      <div className="space-y-2">
                        {selectionTrace.toolTraces.map((trace, index) => (
                          <div key={`${trace.name}-${index}`} className="space-y-1">
                            <div>
                              <span className="opacity-50">
                                {trace.kind === 'tool_result' ? '✓ ' : '→ '}
                              </span>
                              <span className="text-[var(--foreground)]">
                                {t(
                                  TOOL_OPTIONS.find(item => item.name === trace.name)?.label ||
                                    trace.name
                                )}
                              </span>
                            </div>
                            {trace.arguments && Object.keys(trace.arguments).length > 0 ? (
                              <pre className="ml-3 whitespace-pre-wrap break-words rounded-md bg-[var(--muted)]/45 px-2 py-1 font-mono text-[11px] leading-[1.55] text-[var(--muted-foreground)]/78">
                                {JSON.stringify(trace.arguments, null, 2)}
                              </pre>
                            ) : null}
                            {trace.result ? (
                              <div className="ml-3">
                                <MarkdownRenderer content={trace.result} variant="trace" />
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectionTrace?.response ? (
                    <div
                      className={`space-y-1.5 ${
                        selectionTrace.toolTraces.length > 0 ? 'mt-3' : ''
                      }`}
                    >
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/60">
                        {t('Response')}
                      </div>
                      <MarkdownRenderer content={selectionTrace.response} variant="trace" />
                    </div>
                  ) : null}

                  {isEditing &&
                  selectionTrace &&
                  selectionTrace.toolTraces.length === 0 &&
                  !selectionTrace.response ? (
                    <div className="opacity-70">
                      {t('Running tools and preparing the final edit...')}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Status bar: error tetap sebagai bar; status info jadi toast auto-dismiss ── */}
      {error && (
        <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-1.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {status && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div
            role="status"
            className="animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex max-w-[min(560px,calc(100vw-2rem))] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--popover)]/95 px-4 py-2.5 text-[12.5px] font-medium text-[var(--foreground)] shadow-xl backdrop-blur-md"
          >
            <Check size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{status}</span>
          </div>
        </div>
      )}

      {/* ── AI Edit modal ── */}
      {isEditModalOpen && (
        <div
          className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false)
          }}
        >
          <div className="animate-in zoom-in-95 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {t('Full Draft AI Edit')}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {t('Close')}
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <div className="flex gap-1.5">
                {(Object.keys(ACTION_LABELS) as EditAction[]).map(a => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      action === a
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/55'
                    }`}
                  >
                    {t(ACTION_LABELS[a])}
                  </button>
                ))}
              </div>

              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                placeholder={t('Describe how you want the text edited...')}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t('Source')}
                  </label>
                  <select
                    value={source}
                    onChange={e => setSource(e.target.value as SourceOption)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                  >
                    <option value="none">{t('None')}</option>
                    <option value="rag">{t('Knowledge Base')}</option>
                    <option value="web">{t('Web Search')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t('Knowledge Base')}
                  </label>
                  <select
                    value={kbName}
                    onChange={e => setKbName(e.target.value)}
                    disabled={source !== 'rag'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="">{t('Select...')}</option>
                    {knowledgeBases.map(k => (
                      <option key={k.name} value={k.name}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                onClick={applyAutoMark}
                disabled={isEditing || isAutoMarking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55 disabled:opacity-50"
              >
                {isAutoMarking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Highlighter size={13} />
                )}
                {t('Rapikan Struktur')}
              </button>
              <button
                onClick={applyEdit}
                disabled={isEditing || isAutoMarking}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isEditing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowRight size={13} />
                )}
                {t('Apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      <HistorySessionPicker
        open={showChatImportPicker}
        onClose={() => setShowChatImportPicker(false)}
        onApply={handleApplyChatImport}
      />

      {/* ── PRD 9.2: Diff inline AI edit — Accept/Reject per chunk ── */}
      {pendingDiff && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl">
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-semibold text-[var(--foreground)]">
                {t('Proposed Changes')}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPendingDiff(null)}
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50"
                >
                  {t('Undo All')}
                </button>
                <button
                  type="button"
                  disabled={isApplyingDiff}
                  onClick={async () => {
                    if (!pendingDiff) return
                    const diff = pendingDiff
                    const currentSnap = markdownRef.current
                    if (
                      activeFileRef.current !== diff.path ||
                      (currentSnap !== diff.snapshot &&
                        currentSnap.slice(diff.start, diff.end) !== diff.original)
                    ) {
                      setPendingDiff(null)
                      setError(
                        t(
                          'The file changed after the AI edit was prepared. Select the text and try again.',
                        ),
                      )
                      return
                    }
                    setIsApplyingDiff(true)
                    try {
                      await flushCurrentBuffer()
                      await createCoWriterCheckpoint(docId, 'Sebelum: edit AI')
                      if (
                        activeFileRef.current !== diff.path ||
                        markdownRef.current !== diff.snapshot
                      ) {
                        throw new Error(
                          t(
                            'The file changed while the checkpoint was being saved. The AI edit was not applied.',
                          ),
                        )
                      }
                      pushUndo(diff.snapshot)
                      const next =
                        diff.snapshot.slice(0, diff.start) +
                        diff.edited +
                        diff.snapshot.slice(diff.end)
                      setMarkdown(next)
                      setPendingDiff(null)
                      setStatus(t('Perubahan diterapkan + checkpoint tersimpan.'))
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setIsApplyingDiff(false)
                    }
                  }}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1 text-[11px] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('Keep All')}
                </button>
              </div>
            </div>
            {/* Diff: baris dihapus merah, baris ditambah hijau, sisanya netral */}
            <DiffView original={pendingDiff.original} edited={pendingDiff.edited} />
          </div>
        </div>
      )}

      {/* ── Quick-insert sitasi popup (PRD v2.4 §4) ── */}
      {quickCiteOpen && (
        <QuickCitePopup
          groupId={activeGroupIdForQuickCite}
          anchor={quickCiteAnchor}
          onSelect={citation => {
            const ta = textareaRef.current
            if (ta) {
              const pos = ta.selectionStart ?? markdown.length
              const snapshot = markdown
              pushUndo(snapshot)
              const next = snapshot.slice(0, pos) + citation + snapshot.slice(pos)
              setMarkdown(next)
              requestAnimationFrame(() => {
                ta.focus()
                ta.setSelectionRange(pos + citation.length, pos + citation.length)
              })
            }
            setQuickCiteOpen(false)
          }}
          onClose={() => setQuickCiteOpen(false)}
        />
      )}

      {confirmActionCopy && (
        <div
          className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) setPendingConfirmAction(null)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="co-writer-confirm-title"
            aria-describedby="co-writer-confirm-description"
            className="animate-in zoom-in-95 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          >
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2
                id="co-writer-confirm-title"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                {confirmActionCopy.title}
              </h2>
              <p
                id="co-writer-confirm-description"
                className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]"
              >
                {confirmActionCopy.description}
              </p>
            </div>

            <div className="px-4 py-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                {t('Undo is available with Ctrl/Cmd+Z or the toolbar Undo button.')}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/55"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmActionCopy.onConfirm
                  setPendingConfirmAction(null)
                  onConfirm()
                }}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 ${
                  confirmActionCopy.tone === 'danger' ? 'bg-rose-600' : 'bg-amber-600'
                }`}
              >
                {confirmActionCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveToNotebookModal
        open={notebookSavePayload !== null}
        payload={notebookSavePayload}
        onClose={() => setNotebookSavePayload(null)}
        onSaved={() => {
          setStatus(t('Saved to notebook.'))
          setError('')
        }}
      />
    </div>
  )
}

interface HeaderActionItem {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  onClick: () => void | Promise<void>
  disabled?: boolean
  tone?: 'default' | 'danger' | 'warning'
  dividerBefore?: boolean
}

function HeaderActionMenu({ label, items }: { label: string; items: HeaderActionItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium transition-colors ${
          open
            ? 'bg-[var(--muted)] text-[var(--foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/55 hover:text-[var(--foreground)]'
        }`}
      >
        <MoreHorizontal size={16} />
        <span className="hidden 2xl:inline">{label}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1.5 shadow-xl backdrop-blur-md"
        >
          {items.map(item => {
            const Icon = item.icon
            const toneClass =
              item.tone === 'danger'
                ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-400'
                : item.tone === 'warning'
                  ? 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
                  : 'text-[var(--foreground)] hover:bg-[var(--muted)]/55'
            return (
              <div
                key={item.label}
                className={item.dividerBefore ? 'mt-1 border-t border-[var(--border)] pt-1' : ''}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    void item.onClick()
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
