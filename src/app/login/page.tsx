"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace("/beranda");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pampas px-4 py-8">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl border border-cloudy/20 bg-white shadow-xl">
        {/* Left: Form */}
        <div className="flex w-full flex-col justify-center px-8 py-12 md:w-1/2 md:px-12">
          {/* Logo & Header */}
          <div className="mb-8 text-center">
            <span className="mb-2 block font-serif text-xl font-bold tracking-tight text-gray-900">Nalar AI</span>
            <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight text-gray-900">Masuk</h1>
            <p className="text-sm text-cloudy">
              Lanjutkan untuk mengakses dashboard belajar Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-cloudy">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="rounded-xl border border-cloudy/30 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-cloudy">
                  Password
                </label>
                <button type="button" className="text-xs font-medium text-gray-900 hover:underline">
                  Lupa password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-cloudy/30 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-900/90 active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-cloudy">
            Belum punya akun?{" "}
            <Link href="/register" className="font-semibold text-gray-900 hover:underline">
              Daftar
            </Link>
          </p>
        </div>

        {/* Right: Halftone Artwork */}
        <div className="hidden md:block md:w-1/2 relative overflow-hidden bg-pampas">
          <Image
            src="/login_bg.png"
            alt="Halftone abstract artwork"
            fill
            sizes="100vw" className="object-cover"
            priority
          />
          {/* Overlay gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/10 to-transparent" />
        </div>
      </div>
    </main>
  );
}
