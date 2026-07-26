"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { quizzesApi, ApiError } from "@/lib/api";
import type { Quiz } from "@/lib/types";
import { CheckCircle2, ChevronRight, Loader2, Target, XCircle } from "lucide-react";

export default function LatihanSoalDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    quizzesApi.getOne(token, id)
      .then(setQuiz)
      .catch(err => setError(err instanceof ApiError ? err.message : "Gagal memuat kuis."))
      .finally(() => setLoading(false));
  }, [token, id]);

  function handleSelectAnswer(option: string) {
    if (isFinished) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: option }));
  }

  function calculateScore() {
    if (!quiz) return 0;
    let correct = 0;
    quiz.questions_data.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answer) correct++;
    });
    return Math.round((correct / quiz.questions_data.length) * 100);
  }

  function handleNextQuestion() {
    if (!quiz) return;
    if (currentQuestionIndex < quiz.questions_data.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
      // Simpan skor ke backend agar masuk statistik mastery
      if (token) {
        let correct = 0;
        quiz.questions_data.forEach((q, idx) => {
          if (selectedAnswers[idx] === q.answer) correct++;
        });
        const score = Math.round((correct / quiz.questions_data.length) * 100);
        quizzesApi.recordAttempt(token, quiz.id, score).catch(console.error);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cloudy" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-cloudy">{error ?? "Kuis tidak ditemukan."}</p>
        <button
          onClick={() => router.push("/latihan-soal")}
          className="rounded-none bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Kembali ke Latihan Soal
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions_data[currentQuestionIndex];
  const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined;

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-cloudy/10 px-8 py-6">
        <button
          onClick={() => router.push("/latihan-soal")}
          className="mb-2 text-sm font-medium text-cloudy hover:text-white transition-colors flex items-center gap-1"
        >
          ← Kembali ke Latihan Soal
        </button>
        <h1 className="text-2xl font-bold font-serif text-white">
          Kuis: <span className="font-sans font-medium text-lg text-cloudy ml-2">{quiz.topic}</span>
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
                {quiz.questions_data.map((q, idx) => {
                  const isCorrect = selectedAnswers[idx] === q.answer;
                  return (
                    <div key={idx} className={`rounded-none border p-5 ${isCorrect ? "border-white/30 bg-white/10/50" : "border-red-200 bg-red-50/50"}`}>
                      <p className="font-medium text-white mb-3">{idx + 1}. {q.question}</p>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <span className="text-cloudy w-24">Jawabanmu:</span>
                          <span className={`font-semibold ${isCorrect ? "text-white" : "text-red-600 flex items-center gap-1"}`}>
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
                onClick={() => router.push("/latihan-soal")}
                className="mt-8 rounded-none bg-gray-900 px-8 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
              >
                Buat Kuis Baru
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm font-semibold text-cloudy mb-2">
                <span>Pertanyaan {currentQuestionIndex + 1} dari {quiz.questions_data.length}</span>
                <div className="flex gap-1">
                  {quiz.questions_data.map((_, i) => (
                    <div key={i} className={`h-1.5 w-6 rounded-none ${i <= currentQuestionIndex ? "bg-gray-900" : "bg-cloudy/20"}`} />
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
                  {currentQuestionIndex === quiz.questions_data.length - 1 ? "Selesai" : "Selanjutnya"}
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
