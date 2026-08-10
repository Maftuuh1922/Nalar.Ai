"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Server, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import Modal from "@/components/common/Modal";
import {
  createProvider,
  detectProvider,
  type DetectResult,
  type ProviderConfig,
  type ProviderInput,
} from "@/lib/provider-api";

const CONTROL_CLASS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50 focus:ring-4 focus:ring-[var(--primary)]/10 backdrop-blur-sm";

const CAPABILITIES = [
  { value: "text", label: "Text" },
  { value: "vision", label: "Vision" },
  { value: "code", label: "Code" },
  { value: "reasoning", label: "Reasoning" },
  { value: "tools", label: "Tools" },
  { value: "audio", label: "Audio" },
];

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  try {
    const parsed = JSON.parse(error.message) as { detail?: string };
    return parsed.detail || error.message;
  } catch {
    return error.message;
  }
}

export default function AddProviderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (provider: ProviderConfig) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:8090/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState(
    "text-embedding-3-small",
  );
  const [providerType, setProviderType] = useState("openai-compatible");
  const [contextWindow, setContextWindow] = useState("65536");
  const [capabilities, setCapabilities] = useState<string[]>(["text"]);
  const [capabilityTier, setCapabilityTier] = useState("tidak_didukung");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setBaseUrl("http://localhost:8090/v1");
    setApiKey("");
    setModelName("");
    setEmbeddingModel("text-embedding-3-small");
    setProviderType("openai-compatible");
    setContextWindow("65536");
    setCapabilities(["text"]);
    setCapabilityTier("tidak_didukung");
    setTesting(false);
    setSaving(false);
    setDetectResult(null);
    setError("");
  };

  const close = () => {
    if (testing || saving) return;
    reset();
    onClose();
  };

  const runDetection = async () => {
    setError("");
    setTesting(true);
    try {
      const result = await detectProvider(
        baseUrl.trim(),
        apiKey,
        modelName.trim(),
        embeddingModel.trim(),
      );
      setDetectResult(result);
      if (result.provider_type) setProviderType(result.provider_type);
      if (result.context_window > 0) {
        setContextWindow(String(result.context_window));
      }
      setCapabilities(Array.from(new Set(["text", ...result.capabilities])));
      setCapabilityTier(result.capability_tier || "tidak_didukung");
      if (!modelName.trim() && result.available_models[0]) {
        setModelName(result.available_models[0]);
      }
    } catch (err) {
      setDetectResult(null);
      setError(getErrorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!name.trim() || !baseUrl.trim() || !modelName.trim()) {
      setError(t("Provider name, base URL, and model are required."));
      return;
    }

    setSaving(true);
    const input: ProviderInput = {
      name: name.trim(),
      base_url: baseUrl.trim(),
      api_key: apiKey,
      model_name: modelName.trim(),
      embedding_model: embeddingModel.trim() || "text-embedding-3-small",
      is_active: true,
      capabilities: Array.from(new Set(["text", ...capabilities])),
      provider_type: providerType,
      capability_tier: capabilityTier,
      context_window: Math.max(
        1024,
        Number.parseInt(contextWindow, 10) || 65536,
      ),
    };

    try {
      const created = await createProvider(input);
      reset();
      onCreated(created);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleCapability = (value: string) => {
    if (value === "text") return;
    setCapabilities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title={t("Add provider")}
      titleIcon={<Server className="h-4 w-4 text-[var(--primary)]" />}
      width="md"
      closeOnBackdrop={!testing && !saving}
      closeOnEscape={!testing && !saving}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={testing || saving}
            className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={testing || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {saving ? t("Saving") : t("Add provider")}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
          {t(
            "Connect an OpenAI-compatible or native model endpoint. The provider will be available immediately in this chat.",
          )}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Provider name")}
            </span>
            <input
              data-autofocus
              className={CONTROL_CLASS}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Local AI"
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Base URL")}
            </span>
            <input
              className={CONTROL_CLASS}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("API key")}
            </span>
            <input
              className={CONTROL_CLASS}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t("Optional for local endpoints")}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Provider type")}
            </span>
            <select
              className={CONTROL_CLASS}
              value={providerType}
              onChange={(event) => setProviderType(event.target.value)}
            >
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="google">Google</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Context window")}
            </span>
            <input
              className={CONTROL_CLASS}
              type="number"
              min="1024"
              value={contextWindow}
              onChange={(event) => setContextWindow(event.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Model")}
            </span>
            <input
              className={CONTROL_CLASS}
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder="auto/best-coding"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {t("Embedding model")}
            </span>
            <input
              className={CONTROL_CLASS}
              value={embeddingModel}
              onChange={(event) => setEmbeddingModel(event.target.value)}
              placeholder="text-embedding-3-small"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium text-[var(--muted-foreground)]">
            {t("Capabilities")}
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((capability) => {
              const selected = capabilities.includes(capability.value);
              return (
                <button
                  key={capability.value}
                  type="button"
                  onClick={() => toggleCapability(capability.value)}
                  disabled={capability.value === "text"}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition-all ${selected ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}
                >
                  {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {capability.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)]/60 pt-4">
          <button
            type="button"
            onClick={() => void runDetection()}
            disabled={testing || saving || !baseUrl.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Server className="h-3.5 w-3.5" />
            )}
            {testing ? t("Testing connection...") : t("Test connection")}
          </button>
          {detectResult && (
            <span
              className={`inline-flex items-center gap-1 text-[11.5px] ${detectResult.reachable ? "text-emerald-500" : "text-amber-500"}`}
            >
              {detectResult.reachable ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {detectResult.reachable
                ? t("Endpoint reachable")
                : t("Endpoint needs attention")}
            </span>
          )}
        </div>

        {detectResult?.available_models.length ? (
          <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--muted)]/25 p-3 text-[11px] text-[var(--muted-foreground)]">
            <div className="mb-1 font-medium text-[var(--foreground)]">
              {t("Available models")}
            </div>
            <div className="break-words">
              {detectResult.available_models.join(", ")}
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-[12px] text-red-500">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
