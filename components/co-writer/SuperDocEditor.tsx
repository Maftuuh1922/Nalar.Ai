"use client";

// Editor dokumen WYSIWYG untuk Co-Writer — SuperDoc (AGPL-3.0, open source,
// tanpa server eksternal / lisensi berbayar). Menggantikan OnlyOffice
// (Docker berat) & Syncfusion (berlisensi).
// SuperDoc merender & mengedit .docx langsung di browser, self-hosted.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import SuperDocEditor, {
  type SuperDocRef,
  type SuperDocEditorProps,
} from "@superdoc-dev/react";
import "@superdoc-dev/react/style.css";
import { Loader2 } from "lucide-react";

// SuperDoc merender wrapper berisi toolbar + editor. Supaya toolbar TETAP
// terlihat saat scroll (sticky) dan hanya area dokumen yang scroll:
//  - superdoc-wrapper: flex column, tinggi penuh, TANPA scroll sendiri
//  - superdoc-toolbar-container: sticky di atas (tidak ikut scroll)
//  - superdoc-editor-container: overflow-y auto (HANYA ini yang scroll)
const SUPERDOC_WRAPPER_CSS = `
  .superdoc-wrapper {
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
  }
  .superdoc-toolbar-container {
    flex-shrink: 0 !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 20 !important;
    background: white !important;
  }
  .superdoc-editor-container {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
`;

// Flatten sebuah SD node (paragraph/heading/dll) → teks polos. SuperDoc
// mengembalikan node ter-hidrasi berbentuk {kind, [kind]:{inlines:[…]}}; kita
// telusuri run→text, tab/lineBreak→spasi, hyperlink→teks-dalam. Dipakai untuk
// getOutline & findText tanpa memanggil getMarkdown (yang lambat di dok besar).
function extractNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  const kind = typeof n.kind === "string" ? n.kind : "";

  if (kind === "run") {
    const run = n.run as { text?: string } | undefined;
    return run?.text ?? "";
  }
  if (kind === "tab" || kind === "lineBreak") return " ";
  if (kind === "hyperlink") {
    const hl = n.hyperlink as { inlines?: unknown[] } | undefined;
    return (hl?.inlines ?? []).map(extractNodeText).join("");
  }
  // paragraph / heading / listItem: inlines ada di bawah properti bernama-kind.
  const container = n[kind] as { inlines?: unknown[] } | undefined;
  if (container?.inlines) return container.inlines.map(extractNodeText).join("");
  // Fallback: sebagian node membawa `text` langsung.
  if (typeof n.text === "string") return n.text;
  return "";
}

// ── Tipe hasil operasi Document API (Layer 0 asisten agentic) ───────────────
// Semua operasi tulis/baca mengembalikan hasil ter-normalisasi {ok, error?}
// supaya pemanggil (executor Fase A) tidak perlu menafsirkan SDMutationReceipt
// mentah maupun menangani lempar-error di tengah loop.

export type SuperDocWriteResult = { ok: boolean; error?: string };

export type SuperDocReplaceResult = {
  ok: boolean;
  /** Berapa kemunculan yang benar-benar diganti. */
  replaced: number;
  error?: string;
};

export type SuperDocFindItem = {
  /** ID blok (paraId/sdBlockId) — dipakai untuk target mutasi lanjutan. */
  blockId: string;
  /** Jenis blok: 'paragraph' | 'heading' | 'listItem' | 'table' | … */
  nodeType: string;
  /** Teks yang cocok. */
  text: string;
  /** Teks + konteks sekelilingnya (untuk ditampilkan ke pengguna). */
  snippet: string;
};

export type SuperDocFindResult = {
  ok: boolean;
  total: number;
  items: SuperDocFindItem[];
  error?: string;
};

export type SuperDocOutlineItem = {
  blockId: string;
  level: number; // 1..6
  text: string;
};

// Sumber sitasi — bentuk mengikuti skema bibliografi OOXML (Sources.xsd).
// Didefinisikan lokal (bukan impor dari `superdoc`) supaya handle mandiri dan
// tidak rapuh terhadap perubahan re-export paket.
export type SuperDocCitationPerson = {
  first?: string;
  middle?: string;
  last: string;
};

export type SuperDocCitationSourceType =
  | "book"
  | "journalArticle"
  | "conferenceProceedings"
  | "report"
  | "website"
  | "patent"
  | "case"
  | "statute"
  | "thesis"
  | "film"
  | "interview"
  | "misc";

export type SuperDocCitationFields = {
  title?: string;
  authors?: SuperDocCitationPerson[];
  year?: string;
  publisher?: string;
  city?: string;
  journalName?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  doi?: string;
  edition?: string;
};

export type SuperDocCitationSourceResult = {
  ok: boolean;
  sourceId?: string;
  error?: string;
};

export type SuperDocEditorHandle = {
  // Legacy fire-and-forget (dipakai insertIntoEditor & AgenticWriteModal lama).
  // Kini benar-benar menyisipkan (markdown) di akhir dokumen, bukan no-op.
  insertText: (text: string) => void;
  appendText: (text: string) => void;
  exportDocx: () => Promise<Blob>;

  // ── Operasi tulis agentic (Fase A) ──
  /**
   * Sisipkan konten Markdown (heading/tebal/daftar dirender jadi struktur asli).
   * Tanpa `anchorText` → ditambahkan di akhir dokumen. Dengan `anchorText` →
   * disisipkan sebelum/sesudah blok yang teksnya cocok.
   */
  insertMarkdown: (
    markdown: string,
    opts?: {
      anchorText?: string;
      placement?: "before" | "after";
      occurrence?: number;
      caseSensitive?: boolean;
    },
  ) => Promise<SuperDocWriteResult>;
  /**
   * Cari `find` lalu ganti dengan `replace`. Default hanya kemunculan pertama;
   * `all: true` mengganti semua. `replace: ''` = menghapus teks.
   */
  replaceText: (
    find: string,
    replace: string,
    opts?: {
      occurrence?: number;
      caseSensitive?: boolean;
      all?: boolean;
      mode?: "contains" | "regex";
    },
  ) => Promise<SuperDocReplaceResult>;

  // ── Operasi baca (Fase B reviewer / Fase E realtime) ──
  /** Cari teks → hasil terstruktur (blok, snippet). Aman untuk dok besar. */
  findText: (
    query: string,
    opts?: { limit?: number; mode?: "contains" | "regex"; caseSensitive?: boolean },
  ) => Promise<SuperDocFindResult>;
  /** Daftar heading (cepat) — peta struktur tanpa serialisasi dokumen penuh. */
  getOutline: () => Promise<SuperDocOutlineItem[]>;
  /**
   * Teks dokumen penuh. PERINGATAN: lambat pada dokumen besar (memblok worker).
   * Untuk Fase E gunakan berdebounce & hanya bila perlu; lebih suka getOutline
   * / findText untuk konteks.
   */
  getText: () => Promise<string>;

  // ── Sitasi hidup (Fase C/D) — field CITATION OOXML yang bertahan saat ekspor ──
  insertCitationSource: (
    type: SuperDocCitationSourceType,
    fields: SuperDocCitationFields,
  ) => Promise<SuperDocCitationSourceResult>;
  insertCitationAtAnchor: (
    anchorText: string,
    sourceIds: string[],
    opts?: { occurrence?: number; placement?: "before" | "after"; caseSensitive?: boolean },
  ) => Promise<SuperDocWriteResult>;
};

type Props = {
  docUrl?: string; // URL DOCX kerja (endpoint backend) — kalau ada, dipakai
  initialFile?: File | null;
  // Dipanggil tiap editor berubah — payload-nya tidak dipakai, hanya penanda
  // "dokumen kotor" untuk memicu autosave. Suntingan sesungguhnya diambil dari
  // `exportDocx()`, bukan dari argumen ini.
  onChange?: () => void;
  dark?: boolean;
};

const SuperDocEditorWrapper = forwardRef<SuperDocEditorHandle, Props>(
  function SuperDocEditorWrapper({ docUrl, initialFile, onChange, dark }, ref) {
    const superDocRef = useRef<SuperDocRef>(null);
    const onChangeRef = useRef(onChange);
    // Update ref di efek, bukan saat render (react-hooks/refs).
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
    // Worker assets SuperDoc v2 — disalin ke /public/superdoc karena
    // Turbopack dev tidak menyajikan worker bawaan node_modules. Penyalinan
    // dilakukan scripts/copy-superdoc-workers.mjs (via `postinstall`) dengan
    // nama stabil, jadi path di bawah tidak ikut berubah saat hash rilis baru.
    const workerUrls = useMemo(
      () => ({
        document: "/superdoc/browser-worker-entry.js",
        collaboration: "/superdoc/collaboration-worker-entry.js",
        reviewIndex: "/superdoc/review-index-worker-entry.js",
      }),
      []
    );
    const [loading, setLoading] = useState(true);
    // Ref sinkron dari state loading — dipakai di setTimeout (closure lama
    // tidak boleh membaca state yang sudah basi).
    const loadingRef = useRef(true);
    const [error, setError] = useState("");
    // Sumber dokumen: derive langsung dari props (docUrl ?? initialFile).
    // Tidak pakai state/effect — SuperDocEditor diremount via key saat ganti
    // dokumen, jadi prop baru cukup.
    const docSource = docUrl ?? initialFile ?? undefined;
    // Guard: cegah instance/worker ganda dibuat bersamaan (race condition saat
    // re-render/retry). Instance lama harus di-destroy dulu sebelum yang baru.
    const initGuardRef = useRef(false);
    const mountedRef = useRef(true);

    // Cleanup eksplisit: destroy instance SuperDoc + worker saat unmount.
    // Tanpa ini, tiap retry/remount menumpuk worker & memory (resource leak).
    useEffect(() => {
      mountedRef.current = true;
      // Tandai inisialisasi sedang berjalan (guard anti-instance-ganda).
      initGuardRef.current = true;
      return () => {
        mountedRef.current = false;
        initGuardRef.current = false;
        try {
          superDocRef.current?.getInstance()?.destroy?.();
        } catch {
          /* abaikan — instance mungkin belum selesai init */
        }
        superDocRef.current = null;
      };
    }, []);

    const handleReady = useCallback(() => {
      if (!mountedRef.current) return;
      loadingRef.current = false;
      setLoading(false);
    }, []);

    const handleException = useCallback((e: unknown) => {
      // Payload SuperDoc: { error, document } untuk exception ekspor/operasi;
      // { message, code } untuk exception inisialisasi. Log detail lengkap
      // supaya error `{}` yang misterius bisa dilacak dari console.
      try {
        console.error(
          "SuperDoc exception:",
          e && typeof e === "object" ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e)
        );
      } catch {
        console.error("SuperDoc exception:", e);
      }
      if (!mountedRef.current) return;
      // Exception saat editor SUDAH ready = error operasi (ekspor/autosave),
      // bukan kegagalan memuat dokumen — jangan tutup editor dengan layar
      // merah; dokumen tetap bisa disunting.
      if (!loading) {
        console.warn("SuperDoc: exception non-fatal (editor sudah siap), dokumen tetap terbuka.");
        return;
      }
      // Exception saat editor BELUM ready: SuperDoc mengirim exception dini
      // (mis. ekspor awal sebelum Y.Doc terhydrate, `ydoc: undefined`) yang
      // sebenarnya non-fatal — dokumen selesai dimuat sesaat kemudian. Beri
      // tenggat 8 detik: kalau onReady datang lebih dulu, abaikan; kalau
      // benar-benar gagal, baru tampilkan layar error.
      console.warn("SuperDoc: exception saat inisialisasi — menunggu onReady hingga 8 detik…");
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (loadingRef.current) {
          setError("SuperDoc gagal memuat dokumen.");
          setLoading(false);
          initGuardRef.current = false;
        }
      }, 8000);
    }, [loading]);

    // ── Helper Document API (Layer 0) ─────────────────────────────────────
    // `superdoc.activeEditor.doc` (BrowserDocumentApi) — worker-backed, jadi
    // SEMUA operasi bisa mengembalikan Promise dan WAJIB di-await.
    const getDoc = useCallback(() => {
      const inst = superDocRef.current?.getInstance();
      return inst?.activeEditor?.doc ?? null;
    }, []);

    // Tandai dokumen "kotor" persis lewat jalur yang sama dengan suntingan
    // manual, sehingga mutasi programatik ikut terpicu autosave DOCX. Mutasi
    // via doc-API mungkin TIDAK men-dispatch transaksi editor, jadi ini dibuat
    // deterministik; debounce di page.tsx yang menyatukan bila onTransaction
    // juga sempat menyala.
    const markDirty = useCallback(() => {
      onChangeRef.current?.();
    }, []);

    // Petakan SDMutationReceipt (atau lemparan) → {ok, error?}.
    const normalizeReceipt = (r: unknown): SuperDocWriteResult => {
      const rec = r as { success?: boolean; failure?: { message?: string; code?: string } } | null;
      if (rec && rec.success) return { ok: true };
      const f = rec?.failure;
      return { ok: false, error: f?.message || f?.code || "Operasi gagal." };
    };

    // Cari SelectionTarget mutation-ready untuk `query` via doc.query.match.
    // Mengembalikan target pada `occurrence` (1-based) atau null bila tak ada.
    const resolveTarget = useCallback(
      async (
        query: string,
        occurrence: number,
        mode: "contains" | "regex",
        caseSensitive: boolean,
      ): Promise<{ target: unknown; total: number } | null> => {
        const doc = getDoc();
        if (!doc?.query?.match) return null;
        const out = await doc.query.match({
          select: { type: "text", pattern: query, mode, caseSensitive },
          limit: Math.max(occurrence, 1),
        });
        const items = (out?.items ?? []) as Array<{
          matchKind?: string;
          target?: unknown;
        }>;
        const textItems = items.filter(it => it.matchKind === "text" && it.target);
        const idx = Math.max(occurrence, 1) - 1;
        const hit = textItems[idx];
        if (!hit?.target) return null;
        return { target: hit.target, total: out?.total ?? textItems.length };
      },
      [getDoc],
    );

    useImperativeHandle(ref, () => {
      // Sisip markdown di akhir dokumen (dipakai insertText/appendText legacy
      // & insertMarkdown tanpa anchor). Fire-and-forget aman: menandai kotor.
      const appendMarkdown = async (markdown: string): Promise<SuperDocWriteResult> => {
        const doc = getDoc();
        if (!doc?.insert) return { ok: false, error: "Editor SuperDoc belum siap." };
        try {
          const r = await doc.insert({ value: markdown, type: "markdown" });
          const res = normalizeReceipt(r);
          if (res.ok) markDirty();
          return res;
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      };

      return {
        // Legacy: kini benar-benar menyisipkan (bukan no-op). Tetap void supaya
        // pemanggil lama (page.tsx:1156, 3076) tak perlu berubah.
        insertText: (text: string) => {
          void appendMarkdown(text);
        },
        appendText: (text: string) => {
          void appendMarkdown(text);
        },
        exportDocx: async () => {
          const inst = superDocRef.current?.getInstance();
          // Jangan kembalikan Blob kosong saat instance belum siap: blob kosong
          // yang tersimpan lewat autosave akan MENGHAPUS dokumen pengguna. Lebih
          // baik gagal terang-terangan supaya pemanggil bisa lewati simpan.
          if (!inst) throw new Error("Editor SuperDoc belum siap.");
          const blob = await inst.export({ exportType: ["docx"], triggerDownload: false });
          return blob;
        },

        insertMarkdown: async (markdown, opts) => {
          if (!opts?.anchorText) return appendMarkdown(markdown);
          const doc = getDoc();
          if (!doc?.insert) return { ok: false, error: "Editor SuperDoc belum siap." };
          const found = await resolveTarget(
            opts.anchorText,
            opts.occurrence ?? 1,
            "contains",
            opts.caseSensitive ?? false,
          );
          if (!found) return { ok: false, error: `Jangkar tidak ditemukan: "${opts.anchorText}"` };
          // Ambil blok jangkar → sisip markdown structural sebelum/sesudah blok.
          const sel = found.target as {
            start?: { blockId?: string; node?: { nodeId?: string } };
          };
          const blockId = sel?.start?.blockId ?? sel?.start?.node?.nodeId;
          if (!blockId) return { ok: false, error: "Alamat blok jangkar tak terbaca." };
          try {
            const r = await doc.insert({
              value: markdown,
              type: "markdown",
              target: {
                kind: "block",
                nodeType: "paragraph",
                nodeId: blockId,
              },
              placement: opts.placement ?? "after",
              // RichContentInsertInput (target blok + placement) valid saat runtime
              // tapi sengaja tak masuk union InsertInput yang diekspor → cast via unknown.
            } as unknown as Parameters<NonNullable<typeof doc.insert>>[0]);
            const res = normalizeReceipt(r);
            if (res.ok) markDirty();
            return res;
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        },

        replaceText: async (find, replace, opts) => {
          const doc = getDoc();
          if (!doc?.replace) return { ok: false, replaced: 0, error: "Editor SuperDoc belum siap." };
          const mode = opts?.mode ?? "contains";
          const caseSensitive = opts?.caseSensitive ?? false;
          const all = opts?.all ?? false;
          try {
            let replaced = 0;
            // Untuk `all`: ganti berulang kemunculan pertama sampai habis. Tiap
            // replace menggeser offset, jadi selalu re-resolve occurrence 1.
            // Batasi iterasi untuk mencegah loop tak henti (mis. replace berisi find).
            const maxIters = all ? 500 : 1;
            for (let i = 0; i < maxIters; i++) {
              const occ = all ? 1 : opts?.occurrence ?? 1;
              const found = await resolveTarget(find, occ, mode, caseSensitive);
              if (!found) break;
              // ReplaceInput = TargetLocator diskriminatif ({target}|{ref}) &
              // {text}. Cast seluruh objek via unknown, bukan hanya `target`.
              const r = await doc.replace({
                target: found.target,
                text: replace,
              } as unknown as Parameters<NonNullable<typeof doc.replace>>[0]);
              const res = normalizeReceipt(r);
              if (!res.ok) {
                if (replaced === 0) return { ok: false, replaced, error: res.error };
                break;
              }
              replaced++;
              if (!all) break;
              // Bila hasil ganti masih memuat `find`, hindari mengganti ulang
              // teks yang baru ditulis: berhenti bila find ⊆ replace.
              if (replace && find && replace.includes(find)) break;
            }
            if (replaced > 0) markDirty();
            return { ok: replaced > 0, replaced, error: replaced === 0 ? `Tidak ditemukan: "${find}"` : undefined };
          } catch (e) {
            return { ok: false, replaced: 0, error: e instanceof Error ? e.message : String(e) };
          }
        },

        findText: async (query, opts) => {
          const doc = getDoc();
          if (!doc?.find) return { ok: false, total: 0, items: [], error: "Editor SuperDoc belum siap." };
          try {
            const out = await doc.find({
              select: {
                type: "text",
                pattern: query,
                mode: opts?.mode ?? "contains",
                caseSensitive: opts?.caseSensitive ?? false,
              },
              limit: opts?.limit ?? 20,
            });
            const items: SuperDocFindItem[] = ((out?.items ?? []) as Array<{
              node?: unknown;
              address?: { nodeId?: string; nodeType?: string };
              context?: { snippet?: string };
            }>).map(it => {
              const addr = it.address ?? {};
              return {
                blockId: addr.nodeId ?? "",
                nodeType: addr.nodeType ?? "paragraph",
                text: extractNodeText(it.node),
                snippet: it.context?.snippet ?? extractNodeText(it.node),
              };
            });
            return { ok: true, total: out?.total ?? items.length, items };
          } catch (e) {
            return { ok: false, total: 0, items: [], error: e instanceof Error ? e.message : String(e) };
          }
        },

        getOutline: async () => {
          const doc = getDoc();
          if (!doc?.find) return [];
          try {
            const out = await doc.find({
              select: { type: "node", nodeType: "heading" },
              limit: 500,
            });
            return ((out?.items ?? []) as Array<{
              node?: { kind?: string; heading?: { level?: number } };
              address?: { nodeId?: string };
            }>).map(it => ({
              blockId: it.address?.nodeId ?? "",
              level: it.node?.heading?.level ?? 1,
              text: extractNodeText(it.node),
            }));
          } catch {
            return [];
          }
        },

        getText: async () => {
          const doc = getDoc();
          if (!doc?.getText) return "";
          try {
            return (await doc.getText({})) ?? "";
          } catch {
            return "";
          }
        },

        insertCitationSource: async (type, fields) => {
          const doc = getDoc();
          const sources = doc?.citations?.sources;
          if (!sources?.insert) {
            return { ok: false, error: "Modul sitasi SuperDoc tidak tersedia." };
          }
          try {
            const r = (await sources.insert({ type, fields })) as {
              success?: boolean;
              source?: { sourceId?: string };
              failure?: { message?: string; code?: string };
            };
            if (r?.success && r.source?.sourceId) {
              markDirty();
              return { ok: true, sourceId: r.source.sourceId };
            }
            return { ok: false, error: r?.failure?.message || r?.failure?.code || "Gagal menambah sumber sitasi." };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        },

        insertCitationAtAnchor: async (anchorText, sourceIds, opts) => {
          const doc = getDoc();
          if (!doc?.citations?.insert) {
            return { ok: false, error: "Modul sitasi SuperDoc tidak tersedia." };
          }
          const found = await resolveTarget(
            anchorText,
            opts?.occurrence ?? 1,
            "contains",
            opts?.caseSensitive ?? false,
          );
          if (!found) return { ok: false, error: `Jangkar tidak ditemukan: "${anchorText}"` };
          // Sitasi disisipkan pada titik teks: pakai ujung selection sebagai
          // TextTarget satu-segmen (di depan/di belakang teks jangkar).
          const sel = found.target as {
            start?: { blockId?: string; offset?: number };
            end?: { blockId?: string; offset?: number };
          };
          const point = (opts?.placement ?? "after") === "before" ? sel.start : sel.end;
          if (!point?.blockId || typeof point.offset !== "number") {
            return { ok: false, error: "Titik sisip sitasi tak terbaca." };
          }
          try {
            const r = (await doc.citations.insert({
              at: {
                kind: "text",
                segments: [{ blockId: point.blockId, range: { start: point.offset, end: point.offset } }],
              },
              sourceIds,
            } as Parameters<NonNullable<typeof doc.citations.insert>>[0])) as {
              success?: boolean;
              failure?: { message?: string; code?: string };
            };
            if (r?.success) {
              markDirty();
              return { ok: true };
            }
            return { ok: false, error: r?.failure?.message || r?.failure?.code || "Gagal menyisipkan sitasi." };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        },
      };
    }, [getDoc, markDirty, resolveTarget]);

    const props: SuperDocEditorProps = {
      ...(docSource ? { document: docSource } : {}),
      documentMode: "editing",
      workerUrls,
      onReady: handleReady,
      onEditorUpdate: () => onChangeRef.current?.(),
      onTransaction: () => onChangeRef.current?.(),
      onException: handleException,
    };

    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <style>{SUPERDOC_WRAPPER_CSS}</style>
        {loading && !error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Memuat SuperDoc…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {docSource ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SuperDocEditor ref={superDocRef} {...props} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Belum ada dokumen.
          </div>
        )}
      </div>
    );
  },
);

export default SuperDocEditorWrapper;