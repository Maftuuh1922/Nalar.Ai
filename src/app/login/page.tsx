"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";

const Dither = dynamic(() => import("@/components/Dither"), { ssr: false });
import ScrambledText from "@/components/ScrambledText";

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
    <main className="flex min-h-screen items-center justify-center bg-[#0011ff] text-white selection:bg-white selection:text-[#0011ff] px-4 py-8">
      <div className="flex w-full max-w-xl overflow-hidden border border-white/20 bg-[#0011ff] shadow-2xl relative">
        {/* Left: Form */}
        <div className="flex w-full flex-col justify-center px-6 py-8 md:w-1/2 md:px-8 relative z-10 bg-[#0011ff]">
          {/* Logo & Header */}
          <div className="mb-6 text-center">
            <span className="mb-1 block font-serif text-xl font-black tracking-tighter uppercase text-white">Nalar AI</span>
            <h1 className="mb-1 font-serif text-3xl font-bold tracking-tighter uppercase text-white leading-none">Masuk</h1>
            <p className="text-[10px] font-mono tracking-widest uppercase opacity-70 mt-2">
              Akses dashboard belajar Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/70">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="rounded-none border-b-2 border-white/30 bg-transparent px-2 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white focus:bg-white/5 font-mono"
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/70">
                  Password
                </label>
                <button type="button" className="text-[10px] font-mono font-bold tracking-widest text-white/70 hover:text-white transition-colors uppercase">
                  Lupa?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-none border-b-2 border-white/30 bg-transparent px-2 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white focus:bg-white/5 font-mono"
              />
            </div>

            {error && <p className="text-xs font-mono text-red-400 bg-red-400/10 p-3 border border-red-400/20">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 px-6 py-3 bg-white text-[#0011ff] text-sm font-bold tracking-widest uppercase hover:bg-transparent hover:text-white border-2 border-white transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] font-mono tracking-widest uppercase text-white/50">
            Belum punya akun?{" "}
            <Link href="/register" className="font-bold text-white hover:underline decoration-white/50 underline-offset-4">
              Daftar
            </Link>
          </p>
        </div>

        {/* Right: Typography Graphic */}
        <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-[#0011ff] border-l border-white/20 flex-col justify-center items-center p-8">
           <div className="absolute inset-0 z-0">
             <Dither
               waveColor={[1, 1, 1]}
               baseColor={[0, 0.067, 1]}
               disableAnimation={false}
               enableMouseInteraction={true}
               mouseRadius={0.3}
               colorNum={4}
               waveAmplitude={0.3}
               waveFrequency={3}
               waveSpeed={0.05}
             />
           </div>
           <div className="relative z-10 flex flex-col gap-3 font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-white/80 p-6 text-left border border-white/20 bg-black/10 backdrop-blur-md rounded-xl w-64 shadow-2xl">
             <div className="flex items-center gap-3 border-b border-white/20 pb-3">
               <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
               <span className="font-bold text-white tracking-widest">Nalar AI Active</span>
             </div>
             <ScrambledText duration={1.2} speed={0.5} scrambleChars="01">
               NEURAL ENGINE V2.4
             </ScrambledText>
             <ScrambledText duration={1.5} speed={0.5} scrambleChars="X-">
               SEMANTIC EXTRACTION
             </ScrambledText>
             <ScrambledText duration={1.3} speed={0.5} scrambleChars=".*">
               DATA SYNTHESIS READY
             </ScrambledText>
           </div>
        </div>
      </div>
    </main>
  );
}
