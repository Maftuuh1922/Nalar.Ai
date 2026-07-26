"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, MessageSquare, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { chatSessionsApi } from "@/lib/api";
import { useToast } from "@/components/toast-provider";
import type { ChatSession } from "@/lib/types";

export default function ChatHistoryPage() {
  const { token } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const fetchSessions = useCallback(() => {
    if (!token) return;
    setLoading(true);
    chatSessionsApi.getAll(token)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(fetchSessions, [fetchSessions]);

  async function handleDelete(session: ChatSession) {
    if (!token) return;
    if (!confirm(`Hapus percakapan "${session.title || "Percakapan Baru"}"?`)) return;
    try {
      await chatSessionsApi.delete(token, session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      toastSuccess("Percakapan dihapus.");
    } catch {
      toastError("Gagal menghapus percakapan.");
    }
  }

  const filtered = sessions.filter(s =>
    !query || (s.title || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-transparent min-h-full">
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Breadcrumb */}
        <Link href="/progress" className="inline-flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Learning Space
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-none border border-white/30 bg-transparent flex items-center justify-center shrink-0 shadow-none">
              <History className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">Chat History</h1>
                <span className="px-2.5 py-0.5 rounded-none border border-white/30 bg-transparent text-xs font-bold text-white/70">
                  {sessions.length} conversations
                </span>
              </div>
              <p className="text-sm text-white/50 max-w-xl">
                Browse, delete, and reopen previous conversations from your learning space.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <button
              onClick={fetchSessions}
              className="flex items-center gap-2 bg-transparent border border-white/30 hover:bg-transparent text-white/80 px-4 py-2 rounded-none text-sm font-medium transition-colors shadow-none"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search & List */}
        <div className="rounded-none border border-white/30 bg-transparent shadow-none overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-white/30">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search chat history..."
                className="w-full bg-transparent border border-white/30 rounded-none pl-11 pr-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* List / Empty / Loading */}
          {loading ? (
            <div className="py-24 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 flex items-center justify-center bg-transparent/50">
              <p className="text-sm font-medium text-white/50">
                {query ? "No conversations match your search" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map(session => (
                <div key={session.id} className="group flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
                  <Link href={`/beranda?s=${session.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                    <MessageSquare className="h-4 w-4 text-white/40 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{session.title || "Percakapan Baru"}</p>
                      <p className="text-xs text-white/50">
                        {new Date(session.updated_at).toLocaleDateString("id-ID", {
                          day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(session)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-none text-red-500 hover:bg-red-50"
                    title="Hapus percakapan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
