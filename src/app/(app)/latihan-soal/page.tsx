"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { documentsApi, quizzesApi, ApiError } from "@/lib/api";
import type { Document, Quiz, QuizQuestion } from "@/lib/types";
import { BookOpen, BrainCircuit, CheckCircle2, ChevronRight, FileText, Loader2, Target, XCircle } from "lucide-react";

export default function LatihanSoalPage() {
  const { token } = useAuth();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (token) {
      documentsApi.getAll(token).then(docs => {
        // Hanya dokumen yang berhasil di-indeks yang bisa dijadikan soal
        setDocuments(docs.filter(d => d.status === "indexed"));
      }).catch(console.error);
    }
  }, [token]);

  async function handleGenerateQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedDocId || !topic) return;

    setIsGenerating(true);
    setError(null);
    try {
      const quiz = await quizzesApi.generate(token, selectedDocId, topic, numQuestions);
      setActiveQuiz(quiz);
      // Reset quiz state
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setIsFinished(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat kuis. Pastikan model AI merespons dengan format JSON yang valid.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSelectAnswer(option: string) {
    if (isFinished) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: option
    }));
  }

  function handleNextQuestion() {
    if (!activeQuiz) return;
    if (currentQuestionIndex < activeQuiz.questions_data.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  }

  function calculateScore() {
    if (!activeQuiz) return 0;
    let correct = 0;
    activeQuiz.questions_data.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answer) correct++;
    });
    return Math.round((correct / activeQuiz.questions_data.length) * 100);
  }

  if (activeQuiz) {
    const currentQuestion = activeQuiz.questions_data[currentQuestionIndex];
    const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined;

    return (
      <div className="flex h-full flex-col bg-transparent">
        <div className="border-b border-cloudy/10 px-8 py-6">
          <button 
            onClick={() => setActiveQuiz(null)} 
            className="mb-2 text-sm font-medium text-cloudy hover:text-white transition-colors flex items-center gap-1"
          >
            ← Kembali ke Pengaturan Kuis
          </button>
          <h1 className="text-2xl font-bold font-serif text-white">
            Kuis: <span className="font-sans font-medium text-lg text-cloudy ml-2">{activeQuiz.topic}</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl space-y-8">
            
            {isFinished ? (
              <div className="rounded-none border border-cloudy/20 bg-transparent p-8 text-center shadow-none">
                <Target className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
                <h2 className="mb-2 text-2xl font-bold text-white">Kuis Selesai!</h2>
                <p className="mb-6 text-cloudy">Skor Akhir Anda:</p>
                <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-none bg-white/10 border-8 border-white/30">
                  <span className="text-4xl font-black text-white">{calculateScore()}</span>
                </div>
                
                <div className="space-y-6 text-left border-t border-cloudy/10 pt-8 mt-8">
                  <h3 className="font-bold text-white">Pembahasan:</h3>
                  {activeQuiz.questions_data.map((q, idx) => {
                    const isCorrect = selectedAnswers[idx] === q.answer;
                    return (
                      <div key={idx} className={`rounded-none border p-5 ${isCorrect ? 'border-white/30 bg-white/10/50' : 'border-red-200 bg-red-50/50'}`}>
                        <p className="font-medium text-white mb-3">{idx + 1}. {q.question}</p>
                        <div className="space-y-2 text-sm">
                          <p className="flex items-center gap-2">
                            <span className="text-cloudy w-24">Jawabanmu:</span>
                            <span className={`font-semibold ${isCorrect ? 'text-white' : 'text-red-600 flex items-center gap-1'}`}>
                              {selectedAnswers[idx] || "Tidak dijawab"} {!isCorrect && <XCircle className="h-4 w-4" />}
                            </span>
                          </p>
                          {!isCorrect && (
                            <p className="flex items-center gap-2">
                              <span className="text-cloudy w-24">Kunci:</span>
                              <span className="font-semibold text-white flex items-center gap-1">
                                {q.answer} <CheckCircle2 className="h-4 w-4" />
                              </span>
                            </p>
                          )}
                          <div className="mt-4 text-white/70 bg-transparent p-3 rounded-none border border-cloudy/20 text-xs leading-relaxed">
                            <span className="font-semibold text-white block mb-1">Penjelasan:</span>
                            {q.explanation}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => setActiveQuiz(null)}
                  className="mt-8 rounded-none bg-gray-900 px-8 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Buat Kuis Baru
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-sm font-semibold text-cloudy mb-2">
                  <span>Pertanyaan {currentQuestionIndex + 1} dari {activeQuiz.questions_data.length}</span>
                  <div className="flex gap-1">
                    {activeQuiz.questions_data.map((_, i) => (
                      <div key={i} className={`h-1.5 w-6 rounded-none ${i <= currentQuestionIndex ? 'bg-gray-900' : 'bg-cloudy/20'}`} />
                    ))}
                  </div>
                </div>

                <div className="rounded-none border border-cloudy/20 bg-transparent p-8 shadow-none">
                  <h2 className="text-lg font-medium leading-relaxed text-white mb-8">
                    {currentQuestion.question}
                  </h2>
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectAnswer(opt)}
                        className={`w-full rounded-none border p-4 text-left text-sm transition-all ${
                          selectedAnswers[currentQuestionIndex] === opt
                            ? "border-gray-900 bg-pampas font-semibold text-white shadow-none"
                            : "border-cloudy/20 text-foreground hover:border-gray-400 hover:bg-cloudy/5"
                        }`}
                      >
                        <span className="mr-3 font-bold text-cloudy inline-block w-4">{String.fromCharCode(65 + i)}</span> 
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleNextQuestion}
                    disabled={!isAnswered}
                    className="flex items-center gap-2 rounded-none bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentQuestionIndex === activeQuiz.questions_data.length - 1 ? "Selesai" : "Selanjutnya"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-cloudy/10 px-8 py-6">
        <h1 className="text-2xl font-bold font-serif text-white">Latihan Soal</h1>
        <p className="mt-1 text-sm text-cloudy">Uji pemahaman Anda dengan soal yang di-generate dari materi.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleGenerateQuiz} className="rounded-none border border-cloudy/20 bg-transparent p-8 shadow-none space-y-6">
            
            <div>
              <label className="mb-2 block text-sm font-bold text-white">Pilih Materi Rujukan</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-cloudy" />
                <select 
                  className="w-full appearance-none rounded-none border border-cloudy/30 bg-pampas py-3 pl-10 pr-4 text-sm font-medium text-foreground outline-none focus:border-gray-900 focus:bg-transparent"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Pilih Dokumen --</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </div>
              {documents.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">Anda belum memiliki materi yang terindeks. Silakan unggah di menu Materi Saya.</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white">Topik Spesifik</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-3 h-5 w-5 text-cloudy" />
                <input 
                  type="text" 
                  placeholder="Contoh: Hukum Archimedes, Revolusi Industri, dll"
                  className="w-full rounded-none border border-cloudy/30 bg-pampas py-3 pl-10 pr-4 text-sm font-medium text-foreground outline-none focus:border-gray-900 focus:bg-transparent"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white">Jumlah Soal</label>
              <div className="flex gap-3">
                {[5, 10, 15].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumQuestions(num)}
                    className={`flex-1 rounded-none border py-3 text-sm font-bold transition-all ${
                      numQuestions === num 
                      ? "border-gray-900 bg-gray-900 text-white shadow-none" 
                      : "border-cloudy/30 bg-pampas text-cloudy hover:border-cloudy hover:text-white"
                    }`}
                  >
                    {num} Soal
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-none border border-red-200 bg-red-50 p-4 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            <div className="pt-4 border-t border-cloudy/10">
              <button
                type="submit"
                disabled={isGenerating || !selectedDocId || !topic}
                className="flex w-full items-center justify-center gap-2 rounded-none bg-gray-900 py-3.5 text-sm font-bold text-white transition-all hover:bg-gray-800 hover:shadow-none disabled:opacity-50 disabled:hover:shadow-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Menyusun Kuis...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-5 w-5" />
                    Generate Kuis Sekarang
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
