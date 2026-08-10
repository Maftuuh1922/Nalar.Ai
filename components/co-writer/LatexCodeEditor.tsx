"use client";

/**
 * Editor kode LaTeX untuk Co-Writer.
 *
 * Halaman editor sudah punya 16 titik pemanggilan yang memakai API textarea
 * (`selectionStart`, `setSelectionRange`, `scrollTop`, …) untuk sisip sitasi,
 * lompat heading, dan sinkronisasi gulir. Daripada menulis ulang semuanya,
 * komponen ini memaparkan bentuk yang sama lewat `ref` — jadi CodeMirror bisa
 * masuk tanpa menyentuh logika di atasnya.
 */

import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";

/** Bagian API textarea yang benar-benar dipakai halaman editor. */
export interface TextareaLikeHandle {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  readonly clientWidth: number;
  focus: () => void;
  setSelectionRange: (start: number, end: number) => void;
  getBoundingClientRect: () => DOMRect;
  contains: (node: Node | null) => boolean;
  /**
   * Posisi layar sebuah offset karakter — dipakai untuk menempelkan popover
   * seleksi. CodeMirror tahu persis di mana kursornya, jadi tidak perlu lagi
   * mengukur lewat elemen bayangan seperti pada textarea dulu.
   */
  coordsAtPos: (index: number) => { top: number; left: number };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: () => void;
  onScroll?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  dark?: boolean;
  placeholder?: string;
}

const LatexCodeEditor = forwardRef<TextareaLikeHandle, Props>(function LatexCodeEditor(
  { value, onChange, onSelectionChange, onScroll, onKeyDown, dark, placeholder },
  ref,
) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const extensions = useMemo(
    () => [
      StreamLanguage.define(stex),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { height: "100%", minHeight: "0" },
        ".cm-scroller": { overflow: "auto" },
      }),
    ],
    [],
  );

  useImperativeHandle(
    ref,
    (): TextareaLikeHandle => {
      const view = () => cmRef.current?.view ?? null;
      const scroller = () =>
        cmRef.current?.editor?.querySelector<HTMLElement>(".cm-scroller") ?? null;

      return {
        get value() {
          return view()?.state.doc.toString() ?? value;
        },
        get selectionStart() {
          return view()?.state.selection.main.from ?? 0;
        },
        get selectionEnd() {
          return view()?.state.selection.main.to ?? 0;
        },
        get scrollTop() {
          return scroller()?.scrollTop ?? 0;
        },
        set scrollTop(next: number) {
          const el = scroller();
          if (el) el.scrollTop = next;
        },
        get clientWidth() {
          return scroller()?.clientWidth ?? 0;
        },
        focus() {
          view()?.focus();
        },
        setSelectionRange(start, end) {
          const v = view();
          if (!v) return;
          const max = v.state.doc.length;
          const from = Math.max(0, Math.min(start, max));
          const to = Math.max(0, Math.min(end, max));
          v.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
        },
        getBoundingClientRect() {
          const el = scroller() ?? cmRef.current?.editor;
          return (el?.getBoundingClientRect() ?? new DOMRect()) as DOMRect;
        },
        contains(node) {
          return cmRef.current?.editor?.contains(node) ?? false;
        },
        coordsAtPos(index) {
          const v = view();
          const fallback = () => {
            const r = (scroller() ?? cmRef.current?.editor)?.getBoundingClientRect();
            return { top: r?.top ?? 0, left: r?.left ?? 0 };
          };
          if (!v) return fallback();
          const pos = Math.max(0, Math.min(index, v.state.doc.length));
          const c = v.coordsAtPos(pos);
          return c ? { top: c.top, left: c.left } : fallback();
        },
      };
    },
    [value],
  );

  return (
    <div
      className="latex-editor flex h-full min-h-0 flex-1 overflow-hidden"
      onKeyDown={onKeyDown}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
    >
      <CodeMirror
        ref={cmRef}
        className="h-full min-h-0 w-full overflow-hidden"
        value={value}
        onChange={onChange}
        onUpdate={(u) => {
          if (u.selectionSet) onSelectionChange?.();
        }}
        onScrollCapture={onScroll}
        extensions={extensions}
        theme={dark ? "dark" : "light"}
        placeholder={placeholder}
        height="100%"
        maxHeight="100%"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          highlightSelectionMatches: false,
searchKeymap: false,
        }}
      />
    </div>
  );
});

export default LatexCodeEditor;
