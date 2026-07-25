"use client";

import Link from "next/link";
import { Copy, Terminal, ChevronRight, Download, ExternalLink, BookOpen, BrainCircuit, FileText, MessageSquare, Zap, Shield, Globe } from "lucide-react";
import { motion } from "framer-motion";
import TextType from '@/components/TextType';
import ScrambledText from '@/components/ScrambledText';
import VariableProximity from '@/components/VariableProximity';
import PillNav from '@/components/PillNav';
import Dither from '@/components/Dither';
import { useEffect, useState, useRef } from "react";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0011ff] text-white font-sans selection:bg-white selection:text-[#0011ff] overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="w-full px-6 py-8 flex items-center justify-between max-w-[1400px] mx-auto relative z-50">
        
        {/* LOGO ON THE LEFT */}
        <div>
           <div className="font-serif font-bold text-2xl md:text-3xl leading-[0.9] text-left tracking-tight text-white hover:opacity-80 transition-opacity cursor-pointer">
              NALAR<br/>AI
           </div>
        </div>

        {/* PILL NAV ON THE RIGHT */}
        <div>
           <PillNav
              items={[
                 { label: 'Tentang', href: '#' },
                 { label: 'Docs', href: '#' },
                 { label: 'Mulai', href: '/login' }
              ]}
              className="custom-nav"
              ease="power2.easeOut"
              baseColor="#ffffff"
              pillColor="#0011ff"
              hoveredPillTextColor="#0011ff"
              pillTextColor="#ffffff"
           />
        </div>

      </nav>

      {/* HERO SECTION */}
      <section className="px-6 pt-20 pb-32 max-w-[1400px] mx-auto relative z-20 flex min-h-[85vh] items-center">
         
         {/* HERO ILLUSTRATION (Absolute Right Bleed) */}
         <div className="absolute top-12 md:-top-24 -right-[20%] md:-right-[10%] w-[120%] md:w-[900px] aspect-square opacity-90 mix-blend-screen z-10 pointer-events-none flex items-center justify-center">
            <div className="w-full h-full bg-[url('/images/hero_illustration.png')] bg-contain bg-center bg-no-repeat" />
         </div>

         {/* HERO CONTENT */}
         <div className="flex flex-col max-w-4xl relative z-20">
            <div className="overflow-hidden mb-8">
               <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }} className="font-mono text-[10px] uppercase tracking-widest opacity-80 border-l border-white pl-4">
                  DIPERCAYA RIBUAN PELAJAR & PENELITI
               </motion.div>
            </div>
            
            <ScrambledText
               className="font-serif text-[3.5rem] sm:text-6xl md:text-[6rem] lg:text-[7.5rem] leading-[0.85] font-bold uppercase tracking-tighter mb-16 flex flex-col min-h-[200px] sm:min-h-[250px] md:min-h-[350px] lg:min-h-[450px]"
               radius={150}
               duration={1.5}
               speed={0.6}
               scrambleChars="."
            >
               KECERDASAN<br/>YANG<br/>BEREVOLUSI<br/>UNTUK ANDA
            </ScrambledText>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }} className="grid sm:grid-cols-2 gap-12 max-w-2xl">
               <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-4 opacity-70">MULAI SEKARANG</div>
                  <Link href="/register" className="inline-flex items-center justify-center bg-white text-[#0011ff] font-serif font-bold text-lg px-8 py-4 hover:bg-gray-200 transition-colors uppercase w-full">
                     Coba Nalar Gratis
                  </Link>
               </div>
               
               <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-4 opacity-70">AKSES CEPAT</div>
                  <div className="bg-white text-[#111] p-1.5 flex items-center justify-between font-mono text-sm w-full font-bold">
                     <span className="px-3">nalar.ai/upload</span>
                     <button className="bg-gray-200 hover:bg-gray-300 p-2 transition-colors text-[#0011ff]">
                        <Copy className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="flex gap-4 mt-4 font-mono text-[10px] uppercase tracking-widest opacity-70">
                     <Link href="#" className="hover:underline">Upload Dokumen</Link>
                     <Link href="#" className="hover:underline">Ekstensi Browser</Link>
                  </div>
               </div>
            </motion.div>
         </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="px-6 py-32 w-full flex justify-center relative border-y border-white/20 bg-black/20 overflow-hidden">
         {/* Impressionist Artwork Background */}
         <div className="absolute inset-0 opacity-40 bg-[url('/images/product_preview_background.png')] bg-cover bg-center blur-md mix-blend-luminosity"></div>
         
         <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-5xl rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black/80 backdrop-blur-xl"
         >
            {/* Browser Header */}
            <div className="bg-[#1e1e1e] px-4 py-3 flex items-center gap-2 border-b border-white/10">
               <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
               </div>
               <div className="mx-auto bg-black/50 text-white/50 font-mono text-xs px-6 py-1.5 rounded text-center border border-white/5">nalar.ai/app</div>
            </div>
            {/* Mockup Body */}
            <div className="aspect-[16/10] md:aspect-video bg-[#0c0c0c] flex p-6 gap-6 relative">
               <div className="hidden md:block w-1/3 bg-white/5 rounded border border-white/10 p-5 font-mono text-xs text-white/60 leading-relaxed">
                  # DOKUMEN_AKTIF<br/><br/>
                  &gt; Analisis_Inflasi_2024.pdf<br/>
                  <span className="text-green-400 pl-4">Terindeks (124 hal)</span><br/><br/>
                  &gt; Jurnal_Ekonomi_Makro.pdf<br/>
                  <span className="text-green-400 pl-4">Terindeks (45 hal)</span><br/><br/>
                  <br/>
                  [+] UPLOAD BARU
               </div>
               <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 bg-white/5 rounded border border-white/10 p-5 font-mono text-sm overflow-hidden flex flex-col gap-4">
                     <div className="text-white/40 mb-2 border-b border-white/10 pb-2 border-dashed">
                        USER_QUERY &gt; Apa definisi inflasi menurut jurnal?
                     </div>
                     <div className="text-white leading-relaxed">
                        NALAR &gt; Menurut Jurnal Ekonomi Makro (Hal 24), inflasi adalah kenaikan harga barang dan jasa secara umum dan terus menerus dalam jangka waktu tertentu.<br/><br/>
                        <span className="bg-white/10 px-2 py-1 text-xs rounded text-blue-300 border border-white/10">Sitasi: [Jurnal_Ekonomi_Makro.pdf, Hal 24]</span>
                     </div>
                  </div>
                  <div className="h-14 bg-white/10 rounded border border-white/20 flex items-center px-4 font-mono text-xs text-white/40">
                     <Terminal className="w-4 h-4 mr-2" />
                     Tanya Nalar tentang dokumen ini...
                  </div>
               </div>
            </div>
         </motion.div>
      </section>

      {/* AUDIENCE CARDS */}
      <section className="w-full border-b border-white/20 bg-[#0011ff] relative overflow-hidden">
         {/* Background Texture (Spans across all cards) */}
         <div className="absolute inset-0 bg-[url('/images/hero_illustration.png')] bg-cover bg-center bg-no-repeat opacity-20 mix-blend-screen pointer-events-none z-0"></div>

         <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
               hidden: { opacity: 0 },
               visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/20 relative z-10"
         >
            {[
               { label: "UNTUK", title: "MAHASISWA", cta: "MULAI" },
               { label: "UNTUK", title: "PENELITI", cta: "MULAI" },
               { label: "UNTUK", title: "TIM & PERUSAHAAN", cta: "HUBUNGI KAMI" }
            ].map((card, i) => (
               <motion.div variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0 } }} key={i} className="p-16 lg:p-24 hover:bg-white/5 backdrop-blur-[2px] transition-colors flex flex-col items-center text-center group cursor-pointer relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-6 opacity-70 relative z-10">{card.label}</div>
                  <h3 className="font-serif text-4xl md:text-5xl font-bold uppercase mb-16 tracking-tight relative z-10">{card.title}</h3>
                  <div className="bg-white text-[#0011ff] font-mono text-xs px-6 py-2.5 uppercase font-bold group-hover:scale-110 transition-transform flex items-center gap-2 relative z-10">
                     <Download className="w-3 h-3" /> {card.cta}
                  </div>
               </motion.div>
            ))}
         </motion.div>
      </section>

      {/* FEATURE GRID */}
      <section className="bg-white text-[#0011ff] py-32 px-6 border-b border-white/20">
         <div className="max-w-[1400px] mx-auto">
            <div className="flex justify-end mb-24">
               <div className="font-mono text-[10px] uppercase tracking-widest border border-[#0011ff] px-4 py-1.5 font-bold">FITUR UTAMA</div>
            </div>
            
            <motion.div 
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true, margin: "-100px" }}
               variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
               }}
               className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-24"
            >
               {[
                  { num: "#1 RINGKAS", title: "RINGKASAN\nINSTAN", desc: "Ekstrak inti dari ratusan halaman dalam hitungan detik.", img: "feature_1", icon: FileText },
                  { num: "#2 TANYA", title: "TANYA JAWAB\nKONTEKSTUAL", desc: "Tanyakan apa saja tentang dokumen Anda, dapat jawaban akurat.", img: "feature_2", icon: MessageSquare },
                  { num: "#3 UJI", title: "KUIS\nOTOMATIS", desc: "Uji pemahaman Anda dengan kuis dari isi dokumen.", img: "feature_3", icon: Zap },
                  { num: "#4 FORMAT", title: "MULTI-\nFORMAT", desc: "Dukungan PDF, slide, dan format dokumen umum lainnya.", img: "feature_4", icon: BookOpen },
                  { num: "#5 AMAN", title: "KEAMANAN\nDATA", desc: "Dokumen Anda diproses secara aman dan privat.", img: "feature_5", icon: Shield },
                  { num: "#6 SAMBUNG", title: "TERINTEGRASI", desc: "Sambungkan dengan tools belajar/kerja yang sudah dipakai.", img: "feature_6", icon: Globe }
               ].map((feat, i) => (
                  <motion.div variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0 } }} key={i} className="flex flex-col group">
                     <div className="font-mono text-[10px] uppercase tracking-widest mb-6 border-b border-[#0011ff]/20 pb-4">{feat.num}</div>
                     <h3 className="font-serif text-4xl font-bold uppercase whitespace-pre-line mb-8 leading-[0.9] group-hover:opacity-70 transition-opacity tracking-tight">
                        {feat.title}
                     </h3>
                     <div className="w-full aspect-square mb-8 bg-black/5 border border-[#0011ff]/10 relative overflow-hidden flex items-center justify-center transition-colors">
                        {/* Background image loaded via inline style since Tailwind cannot parse dynamic URLs */}
                        <div 
                           className="absolute inset-0 bg-cover bg-center bg-no-repeat mix-blend-multiply opacity-100 z-10" 
                           style={{ backgroundImage: `url('/images/${feat.img}.png')` }}
                        ></div>
                        
                        {/* Elegant Fallback Icon */}
                        <feat.icon className="w-1/3 h-1/3 text-[#0011ff]/10 group-hover:text-[#0011ff]/20 transition-colors duration-500 relative z-0" strokeWidth={0.5} />
                     </div>
                     <p className="font-mono text-xs uppercase leading-relaxed opacity-80 border-l border-[#0011ff] pl-4">
                        {feat.desc}
                     </p>
                  </motion.div>
               ))}
            </motion.div>
         </div>
      </section>

      {/* GIANT WORDMARK */}
      <section className="bg-white text-[#0011ff] pt-32 pb-12 overflow-hidden relative border-b border-[#0011ff]/10">

         <div className="w-full flex justify-center items-end leading-[0.72] font-serif font-black tracking-tighter text-[26vw] uppercase select-none overflow-hidden">
            <motion.div 
               initial={{ y: "100%" }}
               whileInView={{ y: 0 }}
               viewport={{ once: true, margin: "-50px" }}
               transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
               NALAR
            </motion.div>
         </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative px-6 py-32 text-center border-t border-white/20 overflow-hidden min-h-[60vh] flex flex-col justify-center">
         
         {/* Dither Background */}
         <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto">
            <Dither
               waveColor={[1, 1, 1]}
               baseColor={[0, 0.067, 1]}
               disableAnimation={false}
               enableMouseInteraction={true}
               mouseRadius={0.4}
               colorNum={4}
               waveAmplitude={0.3}
               waveFrequency={3}
               waveSpeed={0.05}
            />
         </div>

         {/* Content */}
         <div className="relative z-10 max-w-[1400px] mx-auto w-full pointer-events-none">
            <div ref={containerRef} className="relative inline-block w-full max-w-4xl mx-auto cursor-pointer pointer-events-auto">
              <VariableProximity
                 label="PAHAMI DOKUMEN ANDA, SEPENUHNYA"
                 className="font-serif font-black text-6xl md:text-8xl leading-[0.9] tracking-tighter mix-blend-difference"
                 fromFontVariationSettings="'wght' 400"
                 toFontVariationSettings="'wght' 900"
                 containerRef={containerRef}
                 radius={150}
                 falloff="exponential"
              />
            </div>
            <p className="mt-12 font-mono text-sm tracking-widest uppercase opacity-80 pointer-events-auto">
               Pelajari semua fitur Nalar AI dan mulai gunakan secara gratis.
            </p>
            <div className="mt-16 pointer-events-auto inline-block">
               <button className="px-8 py-4 bg-white text-[#0011ff] font-bold tracking-widest uppercase hover:bg-transparent hover:text-white border-2 border-white transition-all">
                  Lihat Semua Fitur
               </button>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0011ff] text-white overflow-hidden border-t border-white/20 relative">
         {/* Huge Watermark Behind Illustration */}
         <div className="absolute bottom-16 w-full flex justify-center opacity-10 pointer-events-none select-none overflow-hidden">
            <div className="font-serif font-black text-[30vw] leading-[0.7] tracking-tighter text-center">
               NALAR<br/>AI
            </div>
         </div>

         {/* Engraving Footer Illustration */}
         <div className="w-full max-w-4xl mx-auto h-[600px] relative z-10 opacity-80 mix-blend-screen pointer-events-none mt-24">
            <div className="absolute inset-0 bg-[url('/images/footer_illustration.png')] bg-contain bg-bottom bg-no-repeat"></div>
            
         </div>

         <div className="relative z-20 border-t border-white/20 px-8 py-8 flex flex-col md:flex-row items-center justify-between font-mono text-[10px] uppercase tracking-widest bg-[#0011ff]">
            <div className="opacity-70">NALAR AI v1.0</div>
            <div className="font-serif font-bold text-xl leading-none mt-4 md:mt-0 tracking-tighter">NALAR.AI</div>
            <div className="opacity-70 mt-4 md:mt-0">© 2026 NALAR.AI — SEMUA HAK DILINDUNGI</div>
         </div>
      </footer>
    </div>
  );
}
