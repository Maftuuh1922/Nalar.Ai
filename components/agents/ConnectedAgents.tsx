"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, Loader2, Plug, Plus, Trash2, X } from "lucide-react";

import { agentGlyph } from "@/components/agents/agent-icons";
import SpaceSectionHeader from "@/components/space/SpaceSectionHeader";
import {
  connectSubagent,
  detectSubagents,
  disconnectSubagent,
  listSubagentConnections,
  type SubagentBackendInfo,
  type SubagentConnection,
} from "@/lib/subagents-api";

/**
 * Connected agents — live agents the chat composer can select and consult in
 * real time: Claude Code / Codex / Gemini CLI / Kimi CLI / opencode / MiMo Code
 * on the user's machine. Distinct from the imported-history agents below it:
 * those replay past transcripts, these drive the live agent now. CLI detection
 * is machine-global (is the CLI installed here).
 */

type Lang = { zh: string; en: string };

function backendLabel(kind: string): string {
  if (kind === "claude_code") return "Claude Code";
  if (kind === "codex") return "Codex";
  if (kind === "gemini") return "Gemini CLI";
  if (kind === "kimi") return "Kimi CLI";
  if (kind === "opencode") return "opencode";
  if (kind === "mimo") return "MiMo Code";
  return kind;
}

export default function ConnectedAgents() {
  const { i18n } = useTranslation();
  const zh = i18n.language?.toLowerCase().startsWith("zh");
  const tr = useCallback((l: Lang) => (zh ? l.zh : l.en), [zh]);

  const [backends, setBackends] = useState<SubagentBackendInfo[]>([]);
  const [connections, setConnections] = useState<SubagentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detected, conns] = await Promise.all([
        detectSubagents().catch(() => [] as SubagentBackendInfo[]),
        listSubagentConnections().catch(() => [] as SubagentConnection[]),
      ]);
      setBackends(detected);
      setConnections(conns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const available = useMemo(
    () => backends.filter((b) => b.available),
    [backends],
  );
  // Something is connectable when a CLI is installed here.
  const canConnect = available.length > 0;

  const handleDisconnect = useCallback(
    async (name: string) => {
      if (
        !window.confirm(
          tr({
            zh: `断开「${name}」？这只会移除连接，不影响本机的智能体配置。`,
            en: `Disconnect “${name}”? This only removes the connection; your local agent is untouched.`,
          }),
        )
      )
        return;
      setBusyName(name);
      try {
        await disconnectSubagent(name);
        await load();
      } finally {
        setBusyName(null);
      }
    },
    [load, tr],
  );

  return (
    <section className="space-y-4">
      <SpaceSectionHeader
        icon={Plug}
        title={tr({ zh: "连接的智能体", en: "Connected agents" })}
        description={tr({
          zh: "把本机的 Claude Code、Codex、Gemini CLI、Kimi CLI、opencode、MiMo Code 接进来，在对话中选中后直接向它提问 —— 它的完整运行过程会实时展示。",
          en: "Bring in the Claude Code, Codex, Gemini CLI, Kimi CLI, opencode, or MiMo Code on this machine — select one in chat to consult it directly, with its full run shown live.",
        })}
        action={
          canConnect ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr({ zh: "连接智能体", en: "Connect agent" })}
            </button>
          ) : null
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 px-1 text-[12px] text-[var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tr({ zh: "检测本机智能体…", en: "Detecting local agents…" })}
        </div>
      ) : !canConnect ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 px-4 py-5 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
          {tr({
            zh: "未在本机检测到可用的智能体 CLI（Claude Code、Codex、Gemini CLI、Kimi CLI、opencode、MiMo Code）。安装并登录其中任一 CLI 即可连接。",
            en: "No agent CLI detected on this machine (Claude Code, Codex, Gemini CLI, Kimi CLI, opencode, MiMo Code). Install and log in to any of them to connect one.",
          })}
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 px-4 py-5 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
          {tr({
            zh: "尚未连接任何智能体。点击「连接智能体」把本机检测到的智能体 CLI 接进来。",
            en: "No agents connected yet. Click “Connect agent” to bring in a detected local agent CLI.",
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((conn) => {
            const Glyph = agentGlyph(conn.agent_kind);
            return (
              <div
                key={conn.name}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)]/60 bg-[var(--background)] text-[var(--foreground)]">
                  {Glyph ? (
                    <Glyph size={20} />
                  ) : (
                    <Cpu size={18} strokeWidth={1.6} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--foreground)]">
                    {conn.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-[var(--muted-foreground)]">
                    {backendLabel(conn.agent_kind)}
                    {conn.cwd ? ` · ${conn.cwd}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDisconnect(conn.name)}
                  disabled={busyName === conn.name}
                  title={tr({ zh: "断开", en: "Disconnect" })}
                  aria-label={tr({ zh: "断开", en: "Disconnect" })}
                  className="rounded-lg border border-[var(--border)]/50 p-2 text-[var(--muted-foreground)] transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:hover:border-red-900 dark:hover:text-red-400"
                >
                  {busyName === conn.name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ConnectModal
          backends={available}
          existingNames={connections.map((c) => c.name)}
          tr={tr}
          onClose={() => setModalOpen(false)}
          onConnected={() => {
            setModalOpen(false);
            void load();
          }}
        />
      )}
    </section>
  );
}

function ConnectModal({
  backends,
  existingNames,
  tr,
  onClose,
  onConnected,
}: {
  backends: SubagentBackendInfo[];
  existingNames: string[];
  tr: (l: Lang) => string;
  onClose: () => void;
  onConnected: () => void;
}) {
  // The agent-type choices: each detected CLI.
  const options = useMemo(
    () => backends.map((b) => ({ kind: b.kind, label: b.display_name })),
    [backends],
  );

  const [kind, setKind] = useState(options[0]?.kind ?? "");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [cwd, setCwd] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(tr({ zh: "请填写名称。", en: "Please enter a name." }));
      return;
    }
    if (existingNames.includes(trimmed)) {
      setError(
        tr({
          zh: "已存在同名连接。",
          en: "A connection with this name already exists.",
        }),
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await connectSubagent({
        name: trimmed,
        agent_kind: kind,
        cwd: cwd.trim(),
      });
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [name, kind, cwd, existingNames, onConnected, tr]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[16px] font-semibold tracking-tight text-[var(--foreground)]">
            {tr({ zh: "连接智能体", en: "Connect an agent" })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
            aria-label={tr({ zh: "关闭", en: "Close" })}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--foreground)]">
              {tr({ zh: "智能体", en: "Agent" })}
            </label>
            {/* Two per row — up to six CLIs can be on offer. */}
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => {
                const Glyph = agentGlyph(opt.kind);
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => setKind(opt.kind)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                      kind === opt.kind
                        ? "border-[var(--primary)] bg-[var(--primary)]/[0.07] text-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {Glyph ? <Glyph size={15} /> : null}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--foreground)]">
              {tr({ zh: "名称", en: "Name" })}
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              placeholder={tr({
                zh: "例如：我的代码助手",
                en: "e.g. My coding agent",
              })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--foreground)]">
              {tr({
                zh: "工作目录（可选）",
                en: "Working directory (optional)",
              })}
            </label>
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder={tr({
                zh: "例如：/Users/you/project —— 智能体将在此目录运行",
                en: "e.g. /Users/you/project — the agent runs here",
              })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-[12px] text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {tr({ zh: "取消", en: "Cancel" })}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--background)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            {tr({ zh: "连接", en: "Connect" })}
          </button>
        </div>
      </div>
    </div>
  );
}
