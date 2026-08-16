"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Check, Copy } from "lucide-react";
import Mermaid from "@/components/Mermaid";
import { useAppShell } from "@/context/AppShellContext";
import { drawioXmlToSvg, looksLikeDrawioXml } from "@/lib/drawio";
import {
  getCodeBlockTheme,
  getCodeBlockThemeBackground,
} from "./code-block-themes";

/**
 * A fenced diagram with a Preview | Code tab pair.
 *
 * Both formats render locally. `drawio` (legacy mxfile XML, emitted by chats
 * recorded before the backend prompt moved to Mermaid) used to preview through
 * a diagrams.net iframe, which needs network access and is blocked outright in
 * sandboxed frames — it left users staring at an empty box. It is drawn to SVG
 * on the spot instead, so the XML never leaves the machine.
 */

const MONOSPACE =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const FALLBACK_BACKGROUND = "#1f2937";
const FALLBACK_FOREGROUND = "#e5e7eb";

const DRAWIO_APP_URL = "https://app.diagrams.net/";

export type DiagramLang = "mermaid" | "drawio";

export interface DiagramBlockProps {
  raw: string;
  lang: DiagramLang;
  className?: string;
}

type TabId = "preview" | "code";

type SyntaxStyle = Record<string, React.CSSProperties>;

function themeForeground(style: SyntaxStyle): string | undefined {
  const code = style['code[class*="language-"]'];
  if (code && typeof code.color === "string") return code.color;
  const pre = style['pre[class*="language-"]'];
  if (pre && typeof pre.color === "string") return pre.color;
  return undefined;
}

export default function DiagramBlock({
  raw,
  lang,
  className,
}: DiagramBlockProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("preview");
  const [copied, setCopied] = useState(false);

  const {
    codeBlockTheme,
    codeBlockShowLineNumbers,
    codeBlockWrapLongLines,
  } = useAppShell();

  const syntaxTheme = getCodeBlockTheme(codeBlockTheme) as SyntaxStyle;
  const background =
    getCodeBlockThemeBackground(syntaxTheme) ?? FALLBACK_BACKGROUND;
  const foreground = themeForeground(syntaxTheme) ?? FALLBACK_FOREGROUND;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the Code tab still allows manual selection */
    }
  }, [raw]);

  const tabClass = (id: TabId) =>
    `px-3 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors ${
      tab === id
        ? "text-[var(--foreground)] shadow-[inset_0_-2px_0_0_var(--primary)]"
        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div
      className={`md-code-block overflow-hidden rounded-xl border border-[var(--border)] ${
        className || ""
      }`}
    >
      <div className="flex items-center border-b border-[var(--border)] bg-[var(--card)]">
        <div role="tablist" aria-label={t("Diagram preview")} className="flex">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            onClick={() => setTab("preview")}
            className={tabClass("preview")}
          >
            {t("Preview")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "code"}
            onClick={() => setTab("code")}
            className={tabClass("code")}
          >
            {t("Code")}
          </button>
        </div>

        <div className="ms-auto flex items-center gap-2 px-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t("Copied") : t("Copy code")}
            title={copied ? t("Copied") : t("Copy code")}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <span className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {lang}
          </span>
        </div>
      </div>

      {tab === "preview" ? (
        <div className="bg-[var(--background)] px-4 py-2">
          {lang === "mermaid" ? (
            /* Mermaid ships its own my-6; the panel already pads. */
            <Mermaid chart={raw} className="!my-2" />
          ) : (
            <DrawioPreview xml={raw} />
          )}
        </div>
      ) : (
        <CodePanel
          raw={raw}
          /* Prism has no mermaid grammar; markup would only mistokenize it. */
          language={lang === "drawio" ? "markup" : "text"}
          syntaxTheme={syntaxTheme}
          background={background}
          foreground={foreground}
          showLineNumbers={codeBlockShowLineNumbers}
          wrapLongLines={codeBlockWrapLongLines}
        />
      )}
    </div>
  );
}

/**
 * Renders legacy drawio mxfile XML straight to SVG.
 *
 * The renderer is deliberately narrow (rectangles, ellipses, rhombi,
 * orthogonal edges — the vocabulary every recorded drawio diagram uses). XML
 * that is genuinely unsupported fails the sniff here and falls back to a
 * diagram.net link; it is never shown as a blank box.
 */
function DrawioPreview({ xml }: { xml: string }) {
  const { t } = useTranslation();
  const svg = useMemo(() => drawioXmlToSvg(xml), [xml]);

  if (!looksLikeDrawioXml(xml)) {
    return (
      <p className="py-2 text-[13px] text-[var(--muted-foreground)]">
        {t("Failed to render diagram")}
      </p>
    );
  }

  if (!svg) {
    return (
      <div className="flex flex-col items-start gap-3 py-3">
        <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          {t(
            "This diagram can't be previewed here. Open the Code tab to copy the XML and paste it into diagrams.net.",
          )}
        </p>
        <a
          href={DRAWIO_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium transition hover:bg-[var(--accent)]"
        >
          {t("Open diagrams.net")}
        </a>
      </div>
    );
  }

  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-white py-3"
      role="img"
      aria-label={t("Diagram preview")}
      // Safe by construction: the SVG is assembled from validated primitives
      // only — labels go through escapeXml, colours must match a hex pattern,
      // and every coordinate is a finite number. No source text reaches the
      // markup verbatim.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CodePanel({
  raw,
  language,
  syntaxTheme,
  background,
  foreground,
  showLineNumbers,
  wrapLongLines,
}: {
  raw: string;
  language: string;
  syntaxTheme: SyntaxStyle;
  background: string;
  foreground: string;
  showLineNumbers: boolean;
  wrapLongLines: boolean;
}) {
  return (
    <SyntaxHighlighter
      language={language}
      style={syntaxTheme}
      customStyle={{
        margin: 0,
        borderRadius: 0,
        background,
        color: foreground,
        padding: "1rem",
        fontSize: "0.875rem",
        lineHeight: "1.7",
        overflowX: wrapLongLines ? "hidden" : "auto",
        whiteSpace: wrapLongLines ? "pre-wrap" : "pre",
        overflowWrap: wrapLongLines ? "break-word" : "normal",
      }}
      codeTagProps={{
        className: "md-code-block__code",
        style: {
          fontFamily: MONOSPACE,
          whiteSpace: wrapLongLines ? "pre-wrap" : "pre",
        },
      }}
      showLineNumbers={showLineNumbers}
      wrapLongLines={wrapLongLines}
    >
      {raw}
    </SyntaxHighlighter>
  );
}
