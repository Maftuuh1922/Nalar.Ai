"use client";

import { BookOpen, Search, Plus, Book, Sparkles, Clock, Layers } from "lucide-react";

export default function BookPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F5] min-h-full">
      {/* Header */}
      <div className="border-b border-gray-200 px-8 py-8 flex items-center justify-between">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <BookOpen className="h-6 w-6 text-gray-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Books</h1>
            <p className="text-sm text-gray-500">Generate, browse and study your AI-authored books.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search books"
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm w-64 outline-none focus:border-crail transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            New book
          </button>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              <Book className="h-4 w-4" /> Total Books
            </div>
            <div className="text-3xl font-bold text-gray-900">0</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-4 w-4" /> Ready
            </div>
            <div className="text-3xl font-bold text-gray-900">0</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold uppercase tracking-wider mb-2">
              <Clock className="h-4 w-4" /> In Progress
            </div>
            <div className="text-3xl font-bold text-gray-900">0</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              <Layers className="h-4 w-4" /> Chapters
            </div>
            <div className="text-3xl font-bold text-gray-900">0</div>
          </div>
        </div>

        {/* Library Section */}
        <div>
          <div className="mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">My Library</h2>
            <p className="text-sm text-gray-400">0 of 0 books</p>
          </div>

          {/* Empty State */}
          <div className="border border-dashed border-gray-200 rounded-2xl bg-white p-16 flex flex-col items-center justify-center text-center">
            <BookOpen className="h-10 w-10 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No books yet</h3>
            <p className="text-sm text-gray-500 max-w-md mb-6">
              Create your first AI-generated book from a knowledge base, chat selections or simply a topic.
            </p>
            <button className="flex items-center gap-2 bg-crail hover:bg-crail/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Plus className="h-4 w-4" />
              New book
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
