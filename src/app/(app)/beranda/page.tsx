"use client";

import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";

export default function BerandaPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // TODO: hubungkan ke endpoint chat RAG setelah pipeline dokumen tersedia.
    setMessage("");
  }

  const firstName = user?.full_name?.split(" ")[0] || user?.email.split("@")[0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <h1 className="mb-2 text-2xl font-semibold">Halo, {firstName} 👋</h1>
        <p className="max-w-md text-center text-sm text-black/60 dark:text-white/60">
          Unggah materi belajarmu di menu <span className="font-medium">Materi Saya</span>, lalu
          tanyakan apa saja tentang isinya di sini.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-black/10 p-4 dark:border-white/10">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tanyakan sesuatu tentang materimu..."
            className="flex-1 rounded-full border border-black/15 px-4 py-2 text-sm outline-none focus:border-emerald-600 dark:border-white/15"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Kirim
          </button>
        </div>
      </form>
    </div>
  );
}
