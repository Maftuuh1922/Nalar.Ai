"use client";

// Editor dokumen WYSIWYG untuk Co-Writer — SuperDoc (AGPL-3.0, open source,
// tanpa server eksternal / lisensi berbayar). Menggantikan OnlyOffice
// (Docker berat) & Syncfusion (berlisensi).
// SuperDoc merender & mengedit .docx langsung di browser, self-hosted.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
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

export type SuperDocEditorHandle = {
  serialize: () => string;
  load: (content: string) => void;
  insertText: (text: string) => void;
  appendText: (text: string) => void;
  exportDocx: () => Promise<Blob>;
};

type Props = {
  docUrl?: string; // URL DOCX kerja (endpoint backend) — kalau ada, dipakai
  initialFile?: File | null;
  onChange?: (html: string) => void;
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
    const [loading, setLoading] = useState(true);
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
      setLoading(false);
    }, []);

    const handleException = useCallback((e: unknown) => {
      console.error("SuperDoc exception:", e);
      if (!mountedRef.current) return;
      setError("SuperDoc gagal memuat dokumen.");
      setLoading(false);
      initGuardRef.current = false;
    }, []);

    useImperativeHandle(ref, () => ({
      serialize: () => "",
      load: () => undefined,
      insertText: () => undefined,
      appendText: () => undefined,
      exportDocx: async () => {
        const inst = superDocRef.current?.getInstance()
        if (!inst) return new Blob()
        const blob = await inst.export({ exportType: ["docx"], triggerDownload: false })
        return blob
      },
    }), []);

    const props: SuperDocEditorProps = {
      ...(docSource ? { document: docSource } : {}),
      documentMode: "editing",
      onReady: handleReady,
      onEditorUpdate: () => onChangeRef.current?.(String(Date.now())),
      onTransaction: () => onChangeRef.current?.(String(Date.now())),
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