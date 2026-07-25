"use client";

import Link from "next/link";
import { ArrowLeft, History, RefreshCcw, Search } from "lucide-react";

export default function ChatHistoryPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F5] min-h-full">
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
                <span className="px-2.5 py-0.5 rounded-none border border-white/30 bg-transparent text-xs font-bold text-white/70">0 conversations</span>
              </div>
              <p className="text-sm text-white/50 max-w-xl">
                Browse, rename, delete, and reopen previous conversations from your learning space.
              </p>
            </div>
          </div>
          
          <div className="shrink-0">
            <button className="flex items-center gap-2 bg-transparent border border-white/30 hover:bg-transparent text-white/80 px-4 py-2 rounded-none text-sm font-medium transition-colors shadow-none">
              <RefreshCcw className="h-4 w-4" />
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
                placeholder="Search chat history..."
                className="w-full bg-transparent border border-white/30 rounded-none pl-11 pr-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Empty State */}
          <div className="py-24 flex items-center justify-center bg-transparent/50">
            <p className="text-sm font-medium text-white/50">No conversations yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
