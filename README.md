<div align="center">
  <h1 align="center">🧠 Nalar AI</h1>
  <p align="center">
    <strong>Asisten AI Edukasional Pintar dengan Fitur RAG & Analisis Dokumen Real-Time</strong>
  </p>
  <p align="center">
    Pahami dokumen, jurnal, dan materi belajar secara interaktif tanpa repot membaca ratusan halaman.
  </p>
</div>

<p align="center">
  <a href="#-arsitektur-sistem">Arsitektur</a> •
  <a href="#-fitur-utama">Fitur Lengkap</a> •
  <a href="#-tech-stack">Teknologi</a> •
  <a href="#-panduan-instalasi-cara-tercepat">Instalasi</a> •
  <a href="#-ekosistem-nalar-ai">Ekosistem</a>
</p>

---

## 🌟 Mengapa Nalar AI?

Nalar AI dirancang khusus untuk pelajar, mahasiswa, peneliti, dan profesional yang sering berhadapan dengan dokumen teks berukuran besar (jurnal ilmiah, laporan, buku). Daripada mencari informasi secara manual, Nalar AI mengindeks dokumen Anda dengan metode *Retrieval-Augmented Generation (RAG)* dan memungkinkan Anda bertanya langsung ke AI dengan hasil yang dilengkapi sitasi dan referensi ke dokumen asli.

## 🏗️ Arsitektur Sistem

Berikut adalah alur kerja bagaimana Nalar AI memproses dokumen Anda dari hulu ke hilir:

```mermaid
graph TD
    User([👨‍💻 Pengguna]) -->|1. Upload PDF/DOCX| FE[💻 Frontend Next.js]
    User -->|4. Tanya Jawab (Chat)| FE
    
    FE -->|2. Kirim Dokumen via API| BE[⚙️ FastAPI Backend]
    FE -->|5. Kirim Query & Konteks| BE
    
    BE -->|3a. Ekstraksi & Chunking Teks| RAG[📄 Pemrosesan Dokumen]
    RAG -->|3b. Generate Embeddings| VDB[(🗄️ Vector Database)]
    
    BE -->|6. Pencarian Konteks Relevan| VDB
    VDB -.->|7. Kembalikan Teks Relevan| BE
    
    BE -->|8. Rangkai Prompt RAG| LLM((🧠 Model AI Besar))
    LLM -.->|9. Streaming Jawaban| BE
    
    BE -.->|10. Tampilkan Jawaban + Sitasi| FE
```

## 🚀 Fitur Lengkap

Nalar AI dikemas dengan berbagai fitur mutakhir untuk produktivitas pendidikan:

### 🤖 Kecerdasan Buatan (AI Engine)
- 💬 **Agentic AI Chat**: Berinteraksi layaknya manusia. AI mengingat riwayat obrolan dan memahami konteks percakapan.
- ⚡ **Real-Time Knowledge (RTK)**: Dukungan mode analisis secara *real-time* untuk memberikan respons akurat yang tidak *out-of-date*.
- 🛑 **Streaming & Stop Generation**: Jawaban ditampilkan mengetik secara *real-time*. Anda bisa menghentikan AI kapan saja saat ia sedang menjawab.

### 📄 Analisis Dokumen (RAG)
- 📚 **Manajemen Multi-Dokumen**: Unggah berbagai format (PDF, Word, TXT). Nalar AI bisa memproses beberapa dokumen sekaligus dan membedakan sumbernya.
- 🎯 **Akurasi Sitasi**: Setiap kali Nalar AI mengutip informasi dari dokumen, ia menyertakan sitasi (misal: *[Sumber: Jurnal_A.pdf, Hal 12]*).
- 📑 **Ringkasan Otomatis**: Dapatkan intisari dari dokumen ratusan halaman hanya dalam hitungan detik.

### 🎓 Alat Pembelajaran Interaktif
- 📝 **Auto-Quiz Generation**: Evaluasi pemahaman Anda! Nalar AI dapat membuat kuis pilihan ganda otomatis murni berdasarkan isi dokumen yang Anda unggah.
- 📊 **Draw.io Viewer Integration**: Pertama di kelasnya! Nalar AI bisa me-render dan merancang arsitektur/flowchart dari *Draw.io (XML)* langsung di layar chat.
- 🎨 **Syntax Highlighting & Markdown**: Menampilkan baris kode, rumus matematika, dan tabel dengan rapi berkat dukungan *Markdown* penuh.

### 🖥️ Antarmuka (UI/UX)
- 🪟 **Resizable Panels**: Sesuaikan ukuran panel chat, panel dokumen, dan panel kuis sesuka hati (menggunakan `react-resizable-panels`).
- 🌙 **Dark/Light Mode & Glassmorphism**: Desain tembus pandang yang elegan dan transisi mode gelap yang memanjakan mata pengguna.
- ⚡ **Animasi Halus**: Didukung oleh Framer Motion untuk setiap interaksi tombol dan modal.

## 🛠️ Tech Stack

Nalar AI dibangun menggunakan ekosistem pustaka modern:

| Kategori | Teknologi |
| --- | --- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router) dengan TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/) |
| **Komponen UI** | [HeroUI](https://heroui.com/) & `react-resizable-panels` |
| **Ikonografi** | [Lucide React](https://lucide.dev/) |
| **Visualisasi**| `react-drawio` |

## 📦 Panduan Instalasi (Cara Tercepat)

Cara paling direkomendasikan untuk menjalankan seluruh ekosistem Nalar AI (Frontend & Backend) secara instan adalah melalui **Nalar AI CLI**.

### 1. Instal Nalar AI CLI (Global)
```bash
npm install -g nalar-ai-cli
```

### 2. Jalankan Nalar AI
```bash
nalar-ai
```
Perintah ini akan secara ajaib:
1. Membuat direktori `~/.nalar-ai` di lokal Anda.
2. Mengkloning repositori Frontend dan Backend Nalar AI.
3. Menyiapkan environment Python & Node, lalu menginstal semua dependensinya.
4. Menjalankan *server* Backend (`localhost:8000`) dan Frontend (`localhost:3000`).
5. Membuka aplikasi secara otomatis di browser Anda.

<br/>

### Alternatif: Instalasi Manual
Jika Anda hanya ingin mengembangkan antarmuka (Frontend) ini secara manual:

```bash
git clone https://github.com/Maftuuh1922/Nalar.ai.git
cd Nalar.ai
pnpm install
pnpm dev
```

## 🔗 Ekosistem Nalar AI

Aplikasi ini merupakan bagian dari ekosistem yang terintegrasi:

1. **[Nalar AI Frontend (Repo Ini)](https://github.com/Maftuuh1922/Nalar.ai)**: Antarmuka utama aplikasi.
2. **[Nalar AI Backend](https://github.com/Maftuuh1922/Nalar.ai-be)**: *Core engine* (FastAPI) untuk pemrosesan NLP, PDF parsing, Vector Database, dan koneksi LLM. **(Wajib dijalankan bersamaan dengan Frontend)**.
3. **[Nalar AI Landing Page](https://github.com/Maftuuh1922/landingpage)**: Repositori profil dan dokumentasi produk.
4. **[Nalar AI CLI](https://github.com/Maftuuh1922/nalar-ai-cli)**: *Automated installer & runner* untuk seluruh *service*.

---
<div align="center">
  <i>Dibuat untuk kebutuhan Tugas Akhir / Proyek Pengembangan.</i>
</div>