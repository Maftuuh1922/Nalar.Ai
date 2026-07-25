"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Highlighter, X } from "lucide-react";
import { DrawioViewer } from "./drawio-viewer";

interface MarkdownContentProps {
  content: string;
  enableHighlight?: boolean;
  searchKeyword?: string;
  textAlign?: "left" | "justify";
}

const CodeBlock = React.memo(function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, "");
  const language = className?.replace("language-", "") || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 group rounded-xl border border-border bg-secondary overflow-hidden shadow-sm">
      {/* Hover Copy Button */}
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-border px-2 py-1.5 text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-background hover:text-foreground shadow-sm z-10"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        {copied ? "Tersalin" : "Salin"}
      </button>

      {/* Language badge (if any) */}
      {language && (
        <div className="absolute top-0 left-4 px-2 py-1 bg-background/50 text-[9px] font-bold text-muted-foreground uppercase rounded-b-md">
          {language}
        </div>
      )}

      <pre className={`p-4 ${language ? 'pt-7' : ''} text-[12.5px] font-mono leading-relaxed text-secondary-foreground overflow-x-auto`}>
        <code>{codeText}</code>
      </pre>
    </div>
  );
});

/**
 * Komponen pembaca Markdown berestetika & berperforma tinggi.
 * Stabilo menempel langsung pada teks inline menggunakan seleksi DOM asli.
 */
export const MarkdownContent = React.memo(function MarkdownContent({
  content,
  enableHighlight = false,
  searchKeyword = "",
  textAlign = "justify",
}: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Counter for highlights to show the "Hapus Semua" button
  const [highlightCount, setHighlightCount] = useState(0);
  const [selectionTooltip, setSelectionTooltip] = useState<{
    range: Range | null;
    x: number;
    y: number;
  } | null>(null);

  // Detect mouse text selection ONLY inside this container on MouseUp
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionTooltip(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      setSelectionTooltip(null);
      return;
    }

    if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();
      setSelectionTooltip({
        range,
        x: rect.left + rect.width / 2,
        y: rect.top - 44,
      });
    }
  }, []);

  const addManualHighlight = useCallback(() => {
    if (selectionTooltip?.range) {
      try {
        const range = selectionTooltip.range;
        const mark = document.createElement("mark");
        mark.className = "bg-amber-200/90 text-amber-950 rounded-sm px-0.5 py-0 not-italic font-inherit border-b-2 border-amber-400/80 manual-highlight";
        mark.style.backgroundColor = "#fde047cc";
        
        // Extract contents and wrap in mark tag
        const contents = range.extractContents();
        mark.appendChild(contents);
        range.insertNode(mark);
        
        setHighlightCount(prev => prev + 1);
      } catch (e) {
        console.warn("Could not highlight selection safely. Make sure you select text within a single paragraph.", e);
      }
    }
    setSelectionTooltip(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionTooltip]);

  const clearManualHighlights = useCallback(() => {
    if (containerRef.current) {
      const marks = containerRef.current.querySelectorAll("mark.manual-highlight");
      marks.forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent?.insertBefore(mark.firstChild, mark);
        }
        parent?.removeChild(mark);
      });
    }
    setHighlightCount(0);
  }, []);

  // Use native CSS classes from globals.css for reliable cross-browser justify
  const alignClass = textAlign === "justify" ? "is-justify" : "is-left";

  // Inline style applied directly to block elements — cannot be overridden by any CSS class
  const justifyStyle: React.CSSProperties = textAlign === "justify"
    ? { textAlign: "justify", wordSpacing: "0.05em" }
    : { textAlign: "left" };

  // Memoize markdown components to prevent unnecessary re-rendering
  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: any) => (
        <h1 className="mt-7 mb-3.5 text-2xl font-serif font-bold border-b border-gray-300 pb-2.5 text-gray-900 tracking-tight">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="mt-6 mb-3 text-xl font-serif font-bold text-gray-800 tracking-tight">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="mt-4 mb-2 text-lg font-serif font-bold text-gray-800 tracking-tight">
          {children}
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="mt-3.5 mb-1.5 text-base font-serif font-bold text-gray-800">
          {children}
        </h4>
      ),
      p: ({ children }: any) => {
        // Check if children contain block-level elements (code blocks render as div/pre)
        const hasBlockChild = React.Children.toArray(children).some(
          (child: any) => child?.type === 'div' || child?.props?.node?.tagName === 'code'
        );
        if (hasBlockChild) {
          return (
            <div className="my-3 font-serif text-[15.5px] leading-relaxed text-gray-800" style={justifyStyle}>
              {children}
            </div>
          );
        }
        return (
          <p className="my-3 font-serif text-[15.5px] leading-relaxed text-gray-800" style={justifyStyle}>
            {children}
          </p>
        );
      },
      strong: ({ children }: any) => (
        <strong>
          {children}
        </strong>
      ),
      em: ({ children }: any) => (
        <em>
          {children}
        </em>
      ),
      ul: ({ children }: any) => (
        <ul className="my-3.5 space-y-1.5 pl-6 list-disc">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="my-3.5 space-y-1.5 pl-6 list-decimal">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="pl-1 font-serif text-[15.5px] leading-relaxed text-gray-800" style={justifyStyle}>
          {children}
        </li>
      ),
      blockquote: ({ children }: any) => (
        <blockquote className="my-5 border-l-4 border-gray-300 bg-gray-50/70 pl-5 py-3 pr-4 italic text-gray-700 font-serif text-[15.5px]">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-6 border-t border-gray-200/80" />,
      table: ({ children }: any) => (
        <div className="overflow-x-auto w-full my-6">
          <table className="w-full text-left border-collapse text-[14.5px] font-serif">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="border-y-2 border-gray-900 bg-transparent text-gray-900">
          {children}
        </thead>
      ),
      tbody: ({ children }: any) => (
        <tbody className="border-b-2 border-gray-900 bg-transparent divide-y divide-gray-200">
          {children}
        </tbody>
      ),
      tr: ({ children }: any) => (
        <tr className="hover:bg-gray-50 transition-colors group">
          {children}
        </tr>
      ),
      th: ({ children }: any) => (
        <th className="px-3 py-2.5 font-bold text-gray-900 tracking-wide text-[14px] align-bottom">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-3 py-2.5 leading-relaxed text-gray-800 align-top">
          {children}
        </td>
      ),
      code({ inline, className, children, ...props }: any) {
        if (inline) {
          return (
            <code className="rounded bg-purple-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-purple-800 border border-purple-100 text-left">
              {children}
            </code>
          );
        }
        
        const codeText = String(children).replace(/\n$/, "");
        const language = className?.replace("language-", "") || "";
        
        // Render drawio xml visually (inline chat = readonly)
        if (language === "drawio" || (language === "xml" && codeText.includes("<mxfile"))) {
            return (
              <button 
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-drawio-diagram', { detail: { xml: codeText } }));
                }}
                className="w-full my-4 border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors px-4 py-3 rounded-xl flex items-center justify-center text-sm font-medium text-blue-700 font-sans shadow-sm cursor-pointer"
              >
                <svg className="h-4 w-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <span>Diagram Draw.io telah ditambahkan. <strong>Klik untuk membuka di Kanvas Samping</strong></span>
              </button>
            );
        }
        
        return <CodeBlock className={className}>{children}</CodeBlock>;
      },
    }),
    [justifyStyle]
  );

  if (!content) return null;

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={`relative markdown-book space-y-0.5 ${alignClass}`}
      lang="id"
    >
      {/* Floating stabilo tooltip — appears directly above the selected text */}
      {selectionTooltip && (
        <div
          className="fixed z-[9999] transform -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gray-950 text-white px-3 py-1.5 text-xs font-semibold shadow-2xl border border-gray-800 pointer-events-auto select-none"
          style={{ top: `${selectionTooltip.y}px`, left: `${selectionTooltip.x}px` }}
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); addManualHighlight(); }}
            className="flex items-center gap-1.5 text-amber-300 hover:text-amber-100 transition-colors"
          >
            <Highlighter className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>Tandai Stabilo</span>
          </button>
        </div>
      )}

      {/* Clear highlights button */}
      {highlightCount > 0 && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={clearManualHighlights}
            className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline px-2 py-1 bg-amber-50/50 rounded-full"
          >
            Hapus {highlightCount} Stabilo
          </button>
        </div>
      )}

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
