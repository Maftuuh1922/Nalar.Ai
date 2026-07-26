<div align="center">
  <h1 align="center">🧠 Nalar.ai (Frontend)</h1>
  <p align="center">
    <strong>Asisten AI Edukasional Pintar dengan Fitur RAG & Analisis Dokumen Real-Time</strong>
  </p>
  <p align="center">
    Pahami dokumen, jurnal, dan materi belajar secara interaktif tanpa repot membaca ratusan halaman.
  </p>
</div>

<p align="center">
  <a href="#-fitur-utama">Fitur</a> •
  <a href="#-tech-stack">Teknologi</a> •
  <a href="#-panduan-instalasi">Instalasi</a> •
  <a href="#-penggunaan">Penggunaan</a>
</p>

---

## 🌟 Mengapa Nalar.ai?

Nalar.ai dirancang khusus untuk pelajar, mahasiswa, peneliti, dan profesional yang sering berhadapan dengan dokumen teks berukuran besar (jurnal ilmiah, laporan, buku). Daripada mencari informasi secara manual, Nalar.ai mengindeks dokumen Anda dengan metode *Retrieval-Augmented Generation (RAG)* dan memungkinkan Anda bertanya langsung ke AI dengan hasil yang dilengkapi sitasi.

## 🚀 Fitur Utama

- 💬 **Agentic AI Chat**: Antarmuka obrolan intuitif untuk bertanya apa saja seputar dokumen Anda.
- ⚡ **Real-Time Knowledge (RTK)**: Dukungan mode analisis secara *real-time* untuk respons yang akurat.
- 📄 **Manajemen Multi-Dokumen**: Unggah berbagai format dokumen sekaligus (PDF, Word, TXT) dan biarkan AI yang memahaminya untuk Anda.
- 🎓 **Auto-Quiz Generation**: Evaluasi pemahaman Anda dengan fitur pembuat kuis otomatis yang diambil murni dari teks dokumen Anda.
- 🎨 **Desain Modern & Glassmorphism**: Dibangun dengan *Resizable Panels*, animasi halus, efek pengetikan (*streaming*), dan desain modern untuk memanjakan mata pengguna.
- 📊 **Draw.io Viewer Integration**: Mampu merender XML dari Draw.io secara langsung di dalam chat untuk memvisualisasikan *flowchart* atau arsitektur.
- 🛑 **Kontrol Respons AI**: Dukungan menghentikan (*stop generation*) saat AI sedang menjawab.

## 🛠️ Tech Stack

Nalar.ai Frontend dibangun menggunakan kumpulan pustaka modern untuk menjamin kecepatan dan pengalaman pengguna yang luar biasa:

| Kategori | Teknologi |
| --- | --- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router) dengan TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/) |
| **Komponen UI** | [HeroUI](https://heroui.com/) & `react-resizable-panels` |
| **Ikonografi** | [Lucide React](https://lucide.dev/) |

## 📦 Panduan Instalasi (Cara Tercepat)

Cara paling mudah dan direkomendasikan untuk menjalankan seluruh ekosistem Nalar.ai (Frontend & Backend) adalah dengan menggunakan **Nalar AI CLI**.

Alat ini akan secara otomatis mengkloning repositori, mengatur *virtual environment* Python, menginstal dependensi, dan menjalankan server secara bersamaan dengan satu baris perintah.

### 1. Instal Nalar AI CLI (Global)
```bash
npm install -g nalar-ai-cli
```

### 2. Jalankan Nalar AI
```bash
nalar-ai start
```
Perintah ini akan secara otomatis:
1. Membuat direktori `~/.nalar-ai` di lokal Anda.
2. Mengkloning repositori Frontend dan Backend Nalar.ai.
3. Menyiapkan environment & menginstal semua dependensi secara otomatis.
4. Menjalankan *development server* Backend (`localhost:8000`) dan Frontend (`localhost:3000`).
5. Otomatis membuka aplikasi di browser Anda.

<br/>

### Alternatif: Instalasi Manual
Jika Anda ingin mengembangkan atau mengkloning Frontend ini saja (tanpa otomatisasi CLI), Anda bisa melakukannya secara konvensional:

```bash
git clone https://github.com/Maftuuh1922/Nalar.ai_fe.git
cd Nalar.ai_fe
pnpm install
pnpm dev
```

## 🔗 Ketergantungan Backend (Penting)
Jika Anda menggunakan instalasi manual, Nalar.ai *Frontend* hanyalah separuh dari keajaiban. Agar seluruh fitur (Obrolan AI, Ekstraksi Dokumen, Kuis) berjalan sempurna, Anda **wajib** menjalankan repositori Backend API Nalar.ai secara berdampingan di `localhost:8000`. Jika menggunakan `nalar-ai start`, langkah ini sudah tertangani otomatis.

---
<div align="center">
  <i>Dibuat untuk kebutuhan Tugas Akhir / Proyek Pengembangan.</i>
</div>