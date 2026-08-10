import {
  AudioLines,
  Bot,
  Boxes,
  Brain,
  BrainCircuit,
  Database,
  FileText,
  Library,
  type LucideIcon,
  MessagesSquare,
  Mic,
  Network,
  Palette,
  PenLine,
  Search,
} from "lucide-react";

import type { ServiceName } from "@/components/settings/SettingsContext";

export type Lang = { zh: string; en: string };

export interface SettingsLeaf {
  key: string;
  href: string;
  label: Lang;
  blurb: Lang;
  icon: LucideIcon;
  tile: string;
  service?: string;
  adminOnly?: boolean;
}

export interface SettingsCategory {
  key: string;
  label: Lang;
  blurb: Lang;
  icon: LucideIcon;
  href: string;
  children?: SettingsLeaf[];
}

const MODEL_CHILDREN: SettingsLeaf[] = [
  {
    key: "llm",
    href: "/settings/llm",
    label: { zh: "LLM", en: "LLM" },
    blurb: {
      zh: "语言模型供应商与当前档位。",
      en: "Language model providers and active profile.",
    },
    icon: Brain,
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    service: "llm",
  },
  {
    key: "embedding",
    href: "/settings/embedding",
    label: { zh: "嵌入模型", en: "Embedding" },
    blurb: {
      zh: "向量模型供应商与维度。",
      en: "Embedding model providers and dimensions.",
    },
    icon: Database,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    service: "embedding",
  },
  {
    key: "search",
    href: "/settings/search",
    label: { zh: "搜索", en: "Search" },
    blurb: { zh: "联网搜索供应商。", en: "Web search providers." },
    icon: Search,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    service: "search",
  },
  {
    key: "tts",
    href: "/settings/tts",
    label: { zh: "语音合成", en: "Text-to-Speech" },
    blurb: {
      zh: "朗读助手回复的 TTS 供应商。",
      en: "Text-to-speech for reading replies aloud.",
    },
    icon: AudioLines,
    tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    service: "tts",
  },
  {
    key: "stt",
    href: "/settings/stt",
    label: { zh: "语音识别", en: "Speech-to-Text" },
    blurb: {
      zh: "转写麦克风录音的 STT 供应商。",
      en: "Speech-to-text for the composer microphone.",
    },
    icon: Mic,
    tile: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    service: "stt",
  },
];

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    key: "appearance",
    label: { zh: "外观", en: "Appearance" },
    blurb: { zh: "视觉主题与界面语言", en: "Theme and interface language" },
    icon: Palette,
    href: "/settings/appearance",
  },
  {
    key: "models",
    label: { zh: "模型", en: "Models" },
    blurb: {
      zh: "语言、向量与语音模型",
      en: "Language, embedding, and voice models",
    },
    icon: Boxes,
    href: "/settings/models",
    children: MODEL_CHILDREN,
  },
  {
    key: "knowledge",
    label: { zh: "知识库", en: "Knowledge Base" },
    blurb: { zh: "文档解析引擎", en: "Document parsing engine" },
    icon: Library,
    href: "/settings/document-parsing",
  },
  {
    key: "chat",
    label: { zh: "聊天", en: "Chat" },
    blurb: {
      zh: "工具与附件",
      en: "Tools and attachments",
    },
    icon: MessagesSquare,
    href: "/settings/chat",
    children: [
      {
        key: "tools",
        href: "/settings/tools",
        label: { zh: "工具", en: "Tools" },
        blurb: { zh: "对话中可用的工具", en: "Tools available in chat" },
        icon: Bot,
        tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      },
      {
        key: "attachments",
        href: "/settings/attachments",
        label: { zh: "附件", en: "Attachments" },
        blurb: { zh: "附件大小与类型限制", en: "Attachment size and type limits" },
        icon: FileText,
        tile: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      },
    ],
  },
];

export const SETTINGS_HUB_HREF = "/settings";
const HUB_LABEL: Lang = { zh: "设置", en: "Settings" };

/** Routes that are pure navigation (hub + sub-hubs) — no Save/Apply toolbar. */
const NAV_ONLY_ROUTES = new Set<string>([
  SETTINGS_HUB_HREF,
  ...SETTINGS_CATEGORIES.filter((c) => c.children).map((c) => c.href),
]);

export function isNavOnlyRoute(pathname: string): boolean {
  return NAV_ONLY_ROUTES.has(pathname);
}

/** Breadcrumb trail: [Settings] / [category] / [leaf]. */
export function breadcrumbFor(pathname: string): Array<{
  label: Lang;
  href?: string;
}> {
  const crumbs: Array<{ label: Lang; href?: string }> = [
    { label: HUB_LABEL, href: SETTINGS_HUB_HREF },
  ];
  const category = SETTINGS_CATEGORIES.find(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );
  if (category) {
    crumbs.push({ label: category.label, href: category.children ? category.href : undefined });
    const leaf = category.children?.find((l) => l.href === pathname);
    if (leaf) {
      crumbs.push({ label: leaf.label });
    }
  }
  return crumbs;
}

// The on-disk file (under data/user/settings/) each leaf module persists to.
// Surfaced in the toolbar status line so every page says where its parameters
// live, without duplicating the string on each page.
const STORAGE_PATHS: Record<string, string> = {
  "/settings/appearance": "data/user/settings/interface.json",
  "/settings/network": "data/user/settings/system.json",
  "/settings/llm": "data/user/settings/model_catalog.json",
  "/settings/embedding": "data/user/settings/model_catalog.json",
  "/settings/search": "data/user/settings/model_catalog.json",
  "/settings/tts": "data/user/settings/model_catalog.json",
  "/settings/stt": "data/user/settings/model_catalog.json",
  "/settings/tools": "data/user/settings/tool_gate.json",
  "/settings/attachments": "data/user/settings/attachments.json",
  "/settings/document-parsing": "data/user/settings/parsing.json",
};

export function storagePathFor(pathname: string): string | undefined {
  return STORAGE_PATHS[pathname];
}
