"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  History, 
  BookOpen, 
  ClipboardList, 
  GraduationCap, 
  Users, 
  Wrench,
  ArrowUpRight,
  TrendingUp,
  BrainCircuit,
  Award
} from "lucide-react";
import { progressApi, notebooksApi } from "@/lib/api";
import { ProgressStats, Notebook } from "@/lib/types";

export default function ProgressPage() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    Promise.all([
      progressApi.getStats(token).catch(() => null),
      notebooksApi.getAll(token).catch(() => []),
    ]).then(([statsData, notebooksData]) => {
      if (statsData) setStats(statsData);
      if (notebooksData) setNotebooks(notebooksData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-transparent min-h-full">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-serif font-bold text-white mb-2">Learning Space</h1>
        <p className="text-sm text-white/50 mb-10">
          Statistik penguasaan materi, riwayat percakapan, dan catatan pembelajaran Anda.
        </p>

        {/* DeepTutor Mastery Path Card */}
        <div className="mb-10 rounded-none border border-white/30 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-6 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-none bg-emerald-600 flex items-center justify-center text-white shadow-none shadow-emerald-600/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Cognitive Mastery Path</h2>
                  <span className="inline-flex items-center rounded-none bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">
                    DeepTutor Algorithm
                  </span>
                </div>
                <p className="text-xs text-white/50">
                  Pembobotan akurasi kebaruan (Recency-Weighted Accuracy) & gerbang kepercayaan.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">
                {loading ? "..." : `${stats?.mastery_score_percentage ?? 0}%`}
              </div>
              <div className="text-xs font-medium text-emerald-600">
                {loading ? "Memuat..." : stats?.mastery_level ?? "Belum ada data"}
              </div>
            </div>
          </div>

          {/* Topic Mastery Breakdown */}
          {stats?.topic_mastery && stats.topic_mastery.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/30/80">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-3">Penguasaan Per Topik</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stats.topic_mastery.map((tm, idx) => (
                  <div key={idx} className="bg-transparent rounded-none p-3 border border-white/30 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-white block truncate max-w-[180px]">{tm.topic}</span>
                      <span className="text-[10px] text-white/50">{tm.total_attempts} percobaan • {tm.level}</span>
                    </div>
                    <span className="text-sm font-black text-white bg-white/10 px-2 py-1 rounded-none">{tm.mastery_score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Conversations & Materials */}
        <div className="mb-10">
          <h2 className="text-base font-bold text-white mb-4">Conversations & Materials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chat History */}
            <Link href="/progress/history" className="block rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all group relative cursor-pointer">
              <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-none bg-transparent flex items-center justify-center">
                  <History className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Chat History</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-white">{stats?.total_sessions ?? 0}</span>
                    <span className="text-xs text-white/50">sesi</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Buka kembali riwayat percakapan sebelumnya.
              </p>
            </Link>

            {/* Notebooks */}
            <div className="rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all cursor-pointer group relative">
              <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-none bg-transparent flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Notebooks</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-white">{notebooks.length}</span>
                    <span className="text-xs text-white/50">catatan</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Catatan ringkasan otomatis dari DeepTutor agentic loop.
              </p>
            </div>

            {/* Question Bank */}
            <Link href="/latihan-soal" className="block rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all cursor-pointer group relative">
              <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-none bg-transparent flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bank Soal & Kuis</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-white">{stats?.total_quizzes ?? 0}</span>
                    <span className="text-xs text-white/50">kuis dibuat</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Kerjakan kuis dan ukur tingkat penguasaan Anda.
              </p>
            </Link>
          </div>
        </div>

        {/* Personalization */}
        <div>
          <h2 className="text-base font-bold text-white mb-4">Fitur AI</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all cursor-pointer group relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-none bg-transparent flex items-center justify-center">
                  <BrainCircuit className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">CoT Reasoning Mode</h3>
                  <span className="text-xs text-emerald-600 font-semibold">Aktif di Chat</span>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Penalaran bertahap (Chain-of-Thought) untuk analisis dokumen mendalam.
              </p>
            </div>

            <Link href="/settings" className="block rounded-none border border-white/30 bg-transparent p-5 hover:border-white/30 hover:shadow-none transition-all group relative cursor-pointer">
              <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-none bg-transparent flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Model Configuration</h3>
                  <span className="text-xs text-white/50">Pengaturan LLM</span>
                </div>
              </div>
              <p className="text-xs text-white/50">
                Kelola API Key, Base URL, dan model AI aktif.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
