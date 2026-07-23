"use client";

import Link from "next/link";
import { ArrowLeft, History, RefreshCcw, Search } from "lucide-react";

export default function ChatHistoryPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F5] min-h-full">
      <div className="max-w-5xl mx-auto px-8 py-8">
        
        {/* Breadcrumb */}
        <Link href="/progress" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Learning Space
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-sm">
              <History className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
                <span className="px-2.5 py-0.5 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-600">0 conversations</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xl">
                Browse, rename, delete, and reopen previous conversations from your learning space.
              </p>
            </div>
          </div>
          
          <div className="shrink-0">
            <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Search & List */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search chat history..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Empty State */}
          <div className="py-24 flex items-center justify-center bg-gray-50/50">
            <p className="text-sm font-medium text-gray-500">No conversations yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
