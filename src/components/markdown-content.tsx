"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Highlighter, X } from "lucide-react";

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
 * Splits a string by a set of highlight phrases and wraps each match
 * in a <mark> span — producing inline highlights directly in the text.
 */
function applyInlineHighlights(text: string, highlights: string[]): React.ReactNode {
  if (!highlights.length) return text;

  // Build a regex that matches any of the highlighted phrases (case-insensitive)
  const escaped = highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const isMatch = highlights.some((h) => h.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark
          key={i}
          className="bg-amber-300/90 text-amber-950 rounded-sm px-0.5 py-0 not-italic font-inherit border-b-2 border-amber-500/70"
          style={{ backgroundColor: "#fde047cc" }}
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * Wraps all text nodes in a React.ReactNode tree with inline highlight marks.
 * This works recursively on any children passed to markdown elements.
 */
function withHighlight(children: React.ReactNode, highlights: string[]): React.ReactNode {
  if (!highlights.length) return children;
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return applyInlineHighlights(child, highlights);
    }
    // isValidElement narrows child to ReactElement<unknown>, cast to any to access props safely
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        children: withHighlight(child.props.children, highlights),
      });
    }
    return child;
  });
}

/**
 * Komponen pembaca Markdown berestetika & berperforma tinggi.
 * Stabilo menempel langsung pada teks inline — bukan panel terpisah.
 */
export const MarkdownContent = React.memo(function MarkdownContent({
  content,
  enableHighlight = false,
  searchKeyword = "",
  textAlign = "justify",
}: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Array of manually highlighted phrases (selected by user with mouse)
  const [manualHighlights, setManualHighlights] = useState<string[]>([]);
  const [selectionTooltip, setSelectionTooltip] = useState<{
    text: string;
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
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionTooltip({
        text: selectedText,
        x: rect.left + rect.width / 2,
        y: rect.top - 44,
      });
    }
  }, []);

  const addManualHighlight = useCallback(() => {
    if (selectionTooltip && !manualHighlights.includes(selectionTooltip.text)) {
      setManualHighlights((prev) => [...prev, selectionTooltip.text]);
    }
    setSelectionTooltip(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionTooltip, manualHighlights]);

  const removeHighlight = useCallback((term: string) => {
    setManualHighlights((prev) => prev.filter((h) => h !== term));
  }, []);

  const clearManualHighlights = useCallback(() => {
    setManualHighlights([]);
  }, []);

  // Active highlights = manual ones (enableHighlight adds a visual cue but doesn't auto-highlight text)
  const activeHighlights = manualHighlights;

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
        <h1 className="mt-7 mb-3.5 text-2xl font-bold border-b border-gray-200/80 pb-2.5 tracking-tight">
          {withHighlight(children, activeHighlights)}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="mt-6 mb-3 text-xl font-bold tracking-tight border-l-4 border-emerald-500 pl-3.5 py-0.5">
          {withHighlight(children, activeHighlights)}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="mt-4 mb-2 text-lg font-bold tracking-tight">
          {withHighlight(children, activeHighlights)}
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="mt-3.5 mb-1.5 text-base font-bold">
          {withHighlight(children, activeHighlights)}
        </h4>
      ),
      p: ({ children }: any) => {
        // Check if children contain block-level elements (code blocks render as div/pre)
        const hasBlockChild = React.Children.toArray(children).some(
          (child: any) => child?.type === 'div' || child?.props?.node?.tagName === 'code'
        );
        if (hasBlockChild) {
          return (
            <div className="my-3" style={justifyStyle}>
              {withHighlight(children, activeHighlights)}
            </div>
          );
        }
        return (
          <p className="my-3" style={justifyStyle}>
            {withHighlight(children, activeHighlights)}
          </p>
        );
      },
      strong: ({ children }: any) => (
        <strong>
          {withHighlight(children, activeHighlights)}
        </strong>
      ),
      em: ({ children }: any) => (
        <em>
          {withHighlight(children, activeHighlights)}
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
        <li className="pl-1" style={justifyStyle}>
          {withHighlight(children, activeHighlights)}
        </li>
      ),
      blockquote: ({ children }: any) => (
        <blockquote className="my-4 border-l-4 border-emerald-500 bg-emerald-50/50 pl-4 py-3 pr-4 italic rounded-r-xl border-y border-r border-emerald-100/60 text-left text-opacity-80">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-6 border-t border-gray-200/80" />,
      code({ inline, className, children, ...props }: any) {
        if (inline) {
          return (
            <code className="rounded bg-purple-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-purple-800 border border-purple-100 text-left">
              {children}
            </code>
          );
        }
        return <CodeBlock className={className}>{children}</CodeBlock>;
      },
    }),
    [activeHighlights, justifyStyle]
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

      {/* Active highlights chips — small pill badges below text, not above */}
      {manualHighlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {manualHighlights.map((term, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full text-[11px] font-medium border border-amber-300 group"
            >
              <Highlighter className="h-3 w-3 text-amber-600" />
              <span className="max-w-[180px] truncate">{term}</span>
              <button
                type="button"
                onClick={() => removeHighlight(term)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-amber-400/40 transition-colors"
              >
                <X className="h-2.5 w-2.5 text-amber-700" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearManualHighlights}
            className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline px-1"
          >
            Hapus Semua
          </button>
        </div>
      )}

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
