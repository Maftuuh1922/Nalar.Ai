"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/**
 * Indeterminate loading overlay shown while a chat session is fetched from
 * the server (e.g. when opening an entry from chat history). It replaces the
 * misleading welcome screen during the load and lets the user cancel.
 *
 * The indicator follows the Beautiful UI "Loading State" pattern — a
 * pixel-grid loader with an elapsed-time readout. The fetch reports no real
 * progress, so an indeterminate loader is honest where a percentage bar
 * would be fabricated. After a while we surface a reassurance hint.
 */
interface SessionLoadingViewProps {
  onCancel?: () => void;
}

// After this long with no response, reassure the user it is still working.
const STILL_LOADING_AFTER_MS = 8000;

const PIXEL_DOTS = Array.from({ length: 35 }, (_, i) => i);

export default function SessionLoadingView({
  onCancel,
}: SessionLoadingViewProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), STILL_LOADING_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-fade-in relative flex h-full flex-col items-center justify-center gap-4 px-6">
      {/* Cancel button — top-right */}
      {onCancel ? (
        <button
          type="button"
          aria-label={t("Cancel")}
          onClick={onCancel}
          className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {/* Logo + pixel-grid loader */}
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo_black.png"
          alt="Nalar AI"
          width={32}
          height={32}
          className="h-8 w-8 select-none"
          draggable={false}
        />
        <span
          className="pixel-loader text-[var(--primary)]"
          aria-hidden
        >
          {PIXEL_DOTS.map((i) => (
            <i key={i} />
          ))}
        </span>
      </div>

      {/* Primary message */}
      <p className="text-sm font-medium text-[var(--foreground)]">
        {t("Loading conversation")}
      </p>

      {/* Elapsed time — Beautiful UI style readout */}
      <p className="text-[11px] tabular-nums text-[var(--muted-foreground)]">
        {elapsed}s
      </p>

      {/* Slow-load hint */}
      {showHint ? (
        <p className="animate-fade-in text-[12px] text-[var(--muted-foreground)]">
          {t("Still loading…")}
        </p>
      ) : null}
    </div>
  );
}
