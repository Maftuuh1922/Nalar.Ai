import Link from "next/link";
import Image from "next/image";
import { Play, CheckCircle2, FileText, Send, BookOpen, BrainCircuit, Check, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] font-sans text-gray-900">
      {/* Navbar - Static, not sticky to avoid screenshot/layout glitches */}
      <header className="relative z-50 border-b border-gray-200 bg-[#FAF9F5] px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold tracking-tight text-gray-900">Nalar AI.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-semibold hover:text-gray-600 transition-colors">
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-gray-800"
            >
              Mulai Sekarang
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {/* Section 1: Hero */}
        <section className="relative px-6 pb-20 pt-16 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-16 lg:grid-cols-12 items-center">
              {/* Left Column: Copy */}
              <div className="lg:col-span-5 relative z-10">
                <div className="mb-6 font-semibold uppercase tracking-widest text-[10px] text-gray-500">
                  AI Tutor Berbasis Dokumen
                </div>
                <h1 className="mb-6 font-serif text-[3.5rem] md:text-[4rem] lg:text-[4.5rem] font-medium leading-[1.05] tracking-tight text-gray-900">
                  Belajar Apapun Dari Dokumen Anda.
                </h1>
                <p className="mb-10 text-lg leading-relaxed text-gray-600">
                  Nalar AI adalah AI Agent yang mengekstrak informasi, membuat ringkasan, dan menguji pemahaman dari dokumen PDF atau materi kuliah Anda sendiri.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/register"
                    className="flex items-center justify-center rounded-full bg-gray-900 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-gray-800"
                  >
                    Mulai Sekarang
                  </Link>
                  <Link
                    href="#demo"
                    className="flex items-center justify-center rounded-full border border-gray-300 bg-white px-8 py-4 text-sm font-bold text-gray-900 transition-all hover:bg-gray-50"
                  >
                    Lihat Demo
                  </Link>
                </div>
              </div>

              {/* Right Column: Visual */}
              <div className="lg:col-span-7 relative z-0 mt-8 lg:mt-0">
                <div className="relative w-full max-w-[800px] mx-auto lg:ml-auto">
                  {/* Background Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-lg">
                    <Image
                      src="/hero_landscape.png"
                      alt="Landscape painting"
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover"
                      priority
                    />
                  </div>
                  
                  {/* Embedded UI Mockup - Positioned cleanly over the bottom left */}
                  <div className="absolute -bottom-8 -left-4 sm:-left-12 w-[90%] sm:w-[450px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-gray-300"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-gray-300"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-gray-300"></div>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-5">
                      <div className="flex justify-end">
                        <div className="rounded-2xl rounded-tr-sm bg-gray-900 px-4 py-3 text-sm text-white max-w-[85%] shadow-sm">
                          Apa inti dari paper ini?
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-700 text-xs">AI</div>
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-gray-800">
                            Paper ini membahas metode efisien dalam Machine Learning.
                          </p>
                          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                            <FileText className="h-3 w-3 text-gray-400" />
                            Hal 2: "Our novel approach..."
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Value Props */}
        <section className="border-t border-gray-200 py-12 text-center">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-400">Nilai Inti Nalar AI</p>
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-6 px-6 font-serif text-xl font-medium text-gray-800 opacity-80">
            <span>Gratis Dipakai</span>
            <span>Model AI Bebas Pilih</span>
            <span>100% Data Privat</span>
          </div>
        </section>

        {/* Section 3: 3 Columns Features (Clean, Minimalist Mockups) */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-20 text-center max-w-3xl mx-auto">
              <h2 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-gray-900">
                Pengalaman belajar yang lebih baik untuk siapa saja
              </h2>
            </div>

            <div className="grid gap-12 md:grid-cols-3 items-start">
              {/* Feature 1 */}
              <div>
                <div className="aspect-[4/3] rounded-2xl bg-white border border-gray-200 shadow-sm mb-6 p-8 flex flex-col justify-center items-center">
                  <div className="w-full max-w-[240px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                    <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Sitasi Otomatis</div>
                    <p className="text-sm text-gray-900 leading-relaxed font-medium">"...pembelahan sel terjadi pada fase mitotik."</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 font-medium">
                      <BookOpen className="h-3 w-3 text-gray-400" /> Hal. 14
                    </div>
                  </div>
                </div>
                <h3 className="mb-3 font-semibold text-lg text-gray-900">Pemahaman instan</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Tanya apapun tentang dokumen Anda, dapatkan jawaban akurat dalam hitungan detik yang dilengkapi dengan referensi halaman sumber.
                </p>
              </div>

              {/* Feature 2 */}
              <div>
                <div className="aspect-[4/3] rounded-2xl bg-white border border-gray-200 shadow-sm mb-6 p-8 flex flex-col justify-center items-center">
                  <div className="w-full max-w-[240px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                    <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Latihan Soal</div>
                    <p className="text-sm font-bold text-gray-900 mb-3">Pusat tata surya adalah?</p>
                    <div className="space-y-2">
                      <div className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500">A. Bumi</div>
                      <div className="rounded border border-gray-900 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-900 flex justify-between items-center">
                        B. Matahari <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="mb-3 font-semibold text-lg text-gray-900">Latihan yang lebih kuat</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Uji pengetahuan Anda. Nalar AI otomatis men-generate kuis pilihan ganda langsung dari materi bacaan yang Anda unggah.
                </p>
              </div>

              {/* Feature 3 */}
              <div>
                <div className="aspect-[4/3] rounded-2xl bg-white border border-gray-200 shadow-sm mb-6 p-8 flex flex-col justify-center items-center">
                   <div className="w-full max-w-[240px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                    <div className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Kebebasan Model</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded border border-gray-900 bg-gray-50 p-2.5 text-xs">
                        <span className="font-semibold text-gray-900">GPT-4o</span>
                        <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Aktif</span>
                      </div>
                      <div className="flex items-center justify-between rounded border border-gray-200 p-2.5 text-xs opacity-60">
                        <span className="font-medium text-gray-500">Llama 3 (Lokal)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="mb-3 font-semibold text-lg text-gray-900">Kebebasan penuh</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Anda tidak dikunci pada satu AI. Gunakan API favorit seperti OpenAI, atau jalankan model lokal offline untuk 100% privasi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Honest Comparison Table */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-200">
            <div className="text-center mb-10">
              <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight text-gray-900">Lebih dari sekadar chatbot.</h2>
              <p className="text-gray-600 text-sm">Perbedaan utama AI Tutor berbasis dokumen dengan chatbot umum.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-4 font-bold text-gray-900 w-1/2">Kemampuan</th>
                    <th className="pb-4 font-bold text-gray-500 text-center w-1/4">Chatbot Biasa</th>
                    <th className="pb-4 font-bold text-gray-900 text-center w-1/4 bg-gray-50 rounded-t-lg">Nalar AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-4 font-medium text-gray-800">Jawaban bersumber murni dari dokumen Anda</td>
                    <td className="py-4 text-center text-gray-300">-</td>
                    <td className="py-4 text-center text-gray-900 font-bold text-lg bg-gray-50">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium text-gray-800">Sitasi presisi dengan nomor halaman</td>
                    <td className="py-4 text-center text-gray-300">-</td>
                    <td className="py-4 text-center text-gray-900 font-bold text-lg bg-gray-50">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium text-gray-800">Generate latihan soal otomatis</td>
                    <td className="py-4 text-center text-gray-300">-</td>
                    <td className="py-4 text-center text-gray-900 font-bold text-lg bg-gray-50">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium text-gray-800">Personalisasi Asisten (My Agents)</td>
                    <td className="py-4 text-center text-gray-300">-</td>
                    <td className="py-4 text-center text-gray-900 font-bold text-lg bg-gray-50">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium text-gray-800">Dukungan model lokal (Offline & Privat)</td>
                    <td className="py-4 text-center text-gray-300">-</td>
                    <td className="py-4 text-center text-gray-900 font-bold text-lg bg-gray-50 rounded-b-lg">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 5: Segmen Pengguna */}
        <section className="px-6 py-24 border-t border-gray-200">
          <div className="mx-auto max-w-6xl">
            {/* Segmen 1: Pelajar */}
            <div className="mb-40 flex flex-col items-center">
              <div className="text-center max-w-2xl mb-12">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Untuk Pelajar</div>
                <h2 className="mb-6 font-serif text-4xl md:text-5xl font-medium tracking-tight text-gray-900">
                  Pahami materi kuliah lebih cepat
                </h2>
                <p className="text-lg text-gray-600">
                  Upload slide, modul, atau catatan kuliah. Tanyakan konsep yang membingungkan kapan saja tanpa harus membaca ratusan halaman.
                </p>
              </div>
              
              <div className="relative w-full aspect-[2/1] max-w-5xl overflow-hidden rounded-2xl shadow-lg border border-gray-200">
                <Image src="/segment_pelajar.png" alt="Ladang" fill sizes="100vw" className="object-cover" />
                
                {/* Mockup Overlay */}
                <div className="absolute inset-x-0 bottom-0 mx-auto w-[90%] max-w-lg translate-y-2 rounded-t-xl bg-white p-6 shadow-2xl border-x border-t border-gray-200 flex flex-col gap-4">
                   <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-bold text-gray-900">Biologi_Sel.pdf</div>
                      <div className="text-xs text-gray-500">12 Halaman</div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                    "Bedanya mitosis dan meiosis?"
                  </div>
                  <div className="rounded-lg bg-gray-900 text-white px-4 py-3 text-sm shadow-sm text-center">
                    Mitosis menghasilkan sel anak identik. Meiosis untuk reproduksi.
                  </div>
                </div>
              </div>
            </div>

            {/* Segmen 2: Peneliti */}
            <div className="mb-40 flex flex-col items-center">
              <div className="text-center max-w-2xl mb-12">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Untuk Peneliti</div>
                <h2 className="mb-6 font-serif text-4xl md:text-5xl font-medium tracking-tight text-gray-900">
                  AI-first tools for more efficient research
                </h2>
                <p className="text-lg text-gray-600">
                  Upload paper jurnal, ekstrak poin penting, dan telusuri metodologi tanpa perlu membolak-balik halaman secara manual.
                </p>
              </div>
              
              <div className="relative w-full aspect-[2.5/1] max-w-6xl overflow-hidden rounded-2xl shadow-lg border border-gray-200 mb-12">
                <Image src="/segment_peneliti.png" alt="Hutan" fill sizes="100vw" className="object-cover" />
                
                {/* Overlay Mockup */}
                <div className="absolute bottom-0 inset-x-4 sm:inset-x-8 rounded-t-xl bg-white border-x border-t border-gray-200 p-4 shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="flex items-center justify-between rounded bg-gray-50 p-3 border border-gray-100">
                      <span className="text-xs font-bold text-gray-800 truncate pr-2">Attention_Is_All_You_Need.pdf</span>
                      <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Indexed</span>
                   </div>
                   <div className="flex items-center justify-between rounded bg-gray-50 p-3 border border-gray-100">
                      <span className="text-xs font-bold text-gray-800 truncate pr-2">Llama_3_Architecture.pdf</span>
                      <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Indexed</span>
                   </div>
                </div>
              </div>

              {/* 3 Text Columns Below Image */}
              <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl text-left">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Multi-Document Analysis</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">Tanyakan satu pertanyaan, dan Nalar AI akan mencari jawabannya di seluruh library paper yang Anda unggah.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">The AI Copilot</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">Asisten virtual yang memahami konteks teknis dari jurnal-jurnal ilmiah terbaru.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Secure & Private</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">Gunakan model LLM lokal via Ollama untuk memastikan data riset Anda yang belum dipublikasi tetap aman.</p>
                </div>
              </div>
            </div>
            
            {/* Segmen 3: Mandiri */}
            <div className="flex flex-col items-center">
              <div className="text-center max-w-2xl mb-12">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Untuk Siapa Saja</div>
                <h2 className="mb-6 font-serif text-4xl md:text-5xl font-medium tracking-tight text-gray-900">
                  Uji pemahaman Anda sendiri
                </h2>
                <p className="text-lg text-gray-600">
                  Generate soal latihan dari dokumen apapun. Cek seberapa jauh pemahaman Anda sebelum menghadapi ujian sebenarnya.
                </p>
              </div>
              
              <div className="relative w-full aspect-[2/1] max-w-5xl overflow-hidden rounded-2xl shadow-lg border border-gray-200">
                <Image src="/segment_mandiri.png" alt="Laut" fill sizes="100vw" className="object-cover" />
                
                {/* Overlay Mockup */}
                <div className="absolute inset-y-8 right-8 w-64 sm:w-80 rounded-xl bg-white p-5 shadow-2xl border border-gray-200 flex flex-col">
                  <div className="border-b border-gray-100 pb-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center">Simulasi Ujian</h3>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-6 text-center">Apa dampak utama revolusi industri?</p>
                  <div className="space-y-2 mt-auto">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-center text-gray-500">A. Berkurangnya polusi</div>
                    <div className="rounded-lg border border-gray-900 bg-gray-900 p-3 text-xs font-bold text-white flex justify-between items-center">
                      B. Mekanisasi massal <Check className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </section>

        {/* Section 6: CTA Penutup */}
        <section className="relative flex min-h-[600px] items-center justify-center overflow-hidden px-6 text-center">
          <Image src="/cta_water_lilies.png" alt="Danau dengan bunga lili air" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gray-900/60"></div>
          
          <div className="relative z-10 mx-auto max-w-4xl text-white">
            <h2 className="mb-8 font-serif text-5xl md:text-6xl font-medium tracking-tight">
              Mulai belajar lebih cerdas hari ini.
            </h2>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-gray-900 transition-all hover:bg-gray-100"
              >
                Mulai Sekarang (Gratis)
              </Link>
              <Link
                href="#demo"
                className="rounded-full border border-white/30 bg-black/30 px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-black/50 backdrop-blur-sm"
              >
                Lihat Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Section 7: Footer */}
      <footer className="bg-gray-900 text-white py-12 text-center">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex flex-col items-center gap-1 md:items-start">
            <span className="font-serif text-2xl font-medium tracking-tight">Nalar AI.</span>
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} Nalar AI. Dibangun untuk efektivitas belajar.</p>
          </div>
          
          <div className="flex gap-8 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <Link href="#" className="hover:text-white transition-colors">Privasi</Link>
            <Link href="#" className="hover:text-white transition-colors">Persyaratan</Link>
            <Link href="/login" className="hover:text-white transition-colors">Masuk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
