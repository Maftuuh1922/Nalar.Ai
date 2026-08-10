/**
 * Template awal draf jurnal (PRD v2.3 §3.3).
 *
 * Draf Co-Writer disimpan sebagai LaTeX murni, jadi template ini adalah
 * dokumen `.tex` utuh — lengkap dengan preamble — supaya bisa langsung
 * dikompilasi oleh tombol pratinjau tanpa penyuntingan awal.
 *
 * Margin mengikuti template kampus (atas 4, bawah 3, kiri 4, kanan 3 cm),
 * sama dengan preamble di `latex_export.py` dan pengekspor DOCX.
 */
export const CO_WRITER_SAMPLE_TEMPLATE = String.raw`\documentclass[12pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[bahasa]{babel}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{float}
\usepackage{setspace}
\usepackage{hyperref}

\geometry{a4paper,top=4cm,bottom=3cm,left=4cm,right=3cm}
\onehalfspacing

\title{Judul Artikel Jurnal}
\author{Nama Penulis Pertama \and Nama Penulis Kedua}
\date{Afiliasi / Institusi \\ \texttt{penulis@email.com}}

\begin{document}
\maketitle

\begin{abstract}
Tulis abstrak di sini: latar belakang singkat, tujuan penelitian, metode,
hasil utama, dan kesimpulan. Panjang ideal 150--250 kata.

\textbf{Kata kunci:} kata kunci 1; kata kunci 2; kata kunci 3
\end{abstract}

\section{Pendahuluan}

\subsection{Latar Belakang}

Tulis latar belakang masalah: mengapa topik ini penting, gap penelitian yang
belum dijawab, dan konteks umum. Sertakan sitasi [1] pada klaim yang diambil
dari jurnal referensi.

\subsection{Rumusan Masalah}

\begin{itemize}
  \item Bagaimana \ldots?
  \item Apa pengaruh \ldots?
\end{itemize}

\subsection{Tujuan Penelitian}

Tulis tujuan yang menjawab rumusan masalah di atas.

\subsection{Cakupan Penelitian}

Batasan ruang lingkup penelitian.

\section{Tinjauan Pustaka}

\subsection{Teori Dasar}

Jelaskan teori yang mendasari penelitian, dengan sitasi [1] dan [2].

\subsection{Penelitian Terdahulu}

Rangkum penelitian sebelumnya yang relevan dan posisikan penelitian ini
sebagai pelengkap/pembeda.

\section{Metodologi}

\subsection{Desain Penelitian}

Jelaskan pendekatan dan jenis penelitian.

\subsection{Populasi dan Sampel}

\subsection{Instrumen dan Teknik Pengumpulan Data}

\subsection{Teknik Analisis Data}

\section{Hasil dan Pembahasan}

\subsection{Hasil Penelitian}

Paparkan temuan secara sistematis. Contoh tabel:

\begin{table}[H]
\centering
\caption{Ringkasan hasil pengujian}
\begin{tabular}{lrr}
\toprule
Skenario & Jumlah & Persentase \\
\midrule
Berhasil & 0 & 0\% \\
Gagal & 0 & 0\% \\
\bottomrule
\end{tabular}
\end{table}

\subsection{Pembahasan}

Bahas temuan dengan membandingkan penelitian terdahulu [1]--[3].

\section{Kesimpulan}

\subsection{Ringkasan Temuan}

\subsection{Keterbatasan Penelitian}

\subsection{Saran}

\section*{Daftar Pustaka}

\noindent
[1] Tulis sitasi IEEE lengkap di sini. Gunakan tombol \emph{Generate Sitasi} di
panel Referensi untuk membuatnya otomatis.

\end{document}
`;
