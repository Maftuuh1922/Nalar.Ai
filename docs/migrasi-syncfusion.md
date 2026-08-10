# Migrasi Editor Co-Writer ke Syncfusion Document Editor

Status fase: **FASE 3 SELESAI + P1 (pipeline ekspor SFDT) SELESAI**
Tanggal: 2026-08-07

## Ringkasan arah

WordEditor (markdown) TELAH DIHAPUS dari codebase. Satu-satunya editor kerja
adalah Syncfusion Document Editor (mode `sync`; format native DOCX, halaman
A4 asli). LaTeX tetap ada hanya sebagai mode `source` untuk ekspor/typeset (P1).

## Riwayat fase

### Fase 1 — Coexist sementara (selesai, 2026-08-07)
- `editMode: 'word' | 'sync' | 'source'`; mode sync berfungsi (mount, ketik,
  autosave 1200 ms → POST `/documents/{id}/sfdt`, round-trip server).
- Backend: kolom `sfdt` (migrasi `h1j2k3l4m5n6`), endpoint GET/POST
  `/documents/{id}/sfdt`.
- Frontend: `components/co-writer/SyncDocumentEditor.tsx`, fungsi
  `getCoWriterSfdt`/`saveCoWriterSfdt`, wiring di page.tsx.
- Exit condition fase 1 (semua tools AI dipetakan ke Syncfusion API) tidak
  ditunggu — user memilih cutover langsung (fase 3).

### Fase 2 — Cutover (dilewati)
User memilih hapus total langsung; fase 3 dikerjakan dengan migrasi data dulu.

### Fase 3 — Hapus total (SELESAI)
1. **Migrasi data**: 9 dokumen terdaftar, 8 di antaranya tidak punya SFDT
   (dokumen laporan lama). Konversi markdown→DOCX→SFDT gagal dipakai (kendala
   tooling UMD/bundling) dan user memilih menghapus dokumen lama. 8 dokumen
   dihapus via `DELETE /documents/{id}`; tersisa 1 dokumen (uji_docx3) dengan
   SFDT terisi. Verifikasi: 100% (1/1) dokumen punya kolom sfdt terisi.
2. **Kode**: `WordEditor.tsx`, `wordEditorRef`, `mdTextRef`, `mdDirtyRef`,
   `mdSaveTimerRef`, `mdLoadKey`, `previewMd`, `previewOverlayOpen`,
   `handleAskAi`, `loadMd`/`saveMdNow`/`scheduleMdSave`, beacon `/from-md`,
   `getCoWriterMarkdown`/`saveCoWriterMarkdown` dihapus dari codebase.
3. **editMode** kini bertipe `'sync' | 'source'` (default `'sync'`), tanpa
   nilai `'word'` di type maupun runtime; localStorage memakai nilai `sync`
   atau `source`.
4. **Adaptasi lintas mode**:
   - `insertIntoEditor` → `syncEditorRef.insertText` (sync) / textarea (source).
   - AgenticWrite `onApply` → `syncEditorRef.appendText` (mode sync) /
     setMarkdown (mode source).
   - Diff AI (Accept/Reject) → cabang word dihapus; hanya jalur LaTeX/source.
   - Popover seleksi AI & `data-word-editor-root` hanya untuk mode source.
5. **Handle SyncDocumentEditor**: `serialize`, `load`, `openFile`, `exportDocx`,
   `insertText`, `appendText`.

## Verifikasi akhir (fase 3)

- `rg WordEditor|wordEditorRef|mdTextRef|getCoWriterMarkdown|saveCoWriterMarkdown|from-md`
  = NOL kecocokan (di luar dokumen historis ini).
- `npx tsc --noEmit` bersih; eslint 0 error (3 warning lama pre-existing).
- E2E (Playwright): mode default `sync` ter-mount; ketikan → autosave → marker
  tersimpan di server (GET /sfdt); toggle ke Sumber (CodeMirror) dan kembali
  ke Sync berfungsi; 0 page error.
- 100% dokumen punya kolom sfdt terisi sebelum penghapusan kode.

## P1 — Pipeline ekspor SFDT → DOCX → Markdown → Pandoc (SELESAI, 2026-08-07)

Kebenaran kerja mode Sync = SFDT. Kolom LaTeX/AST (`content`,
`structured_content`) kini TIDAK LAGI menjadi sumber ekspor: semua jalur
keluar diregenerasi dari SFDT lewat pipeline:

1. **SFDT → DOCX** — Syncfusion `DocumentEditor.saveAsBlob` di browser
   (handle `exportDocx`).
2. **DOCX → Markdown** — `POST /co_writer/documents/{id}/convert-docx`
   (pandoc `-f docx -t gfm`; `?to=latex` juga didukung). Service backend:
   `app/services/sfdt_pipeline.py`; pandoc di `bin/pandoc.exe` (v3.10).
3. **Markdown → LaTeX/PDF/DOCX** — jalur lama yang sudah matang:
   - DOCX: `POST /export-docx` body `{markdown}` → template kampus + sitasi
     [n] jadi hyperlink DOI (`_docx_file_dari_markdown`).
   - PDF: `POST /export-latex` body `{markdown, format}` → pandoc + template
     `ulbi-template.tex` → tectonic, dengan fallback chain §4.3
     (DOCX → HTML-to-PDF, header `X-Fallback-Notice`).
   - LaTeX: `format=tex` → source .tex template kampus.

FE (`page.tsx`):
- `handleExportDocx`/`handleExportPdf`: mode Sync pakai pipeline di atas;
  mode Sumber tetap GET lama (berbasis LaTeX yang sedang diedit).
- Toggle Sync → Sumber: DOCX diekspor **sebelum** editor di-unmount
  (saveAsBlob saat unmount membuat ZipArchive ej2 error), lalu
  `convert-docx?to=latex` → CodeMirror berisi LaTeX regenerasi; gagal →
  fallback `reloadLatexFromServer`.

Catatan sitasi: pandoc meng-escape `[n]` menjadi `\[n\]`; `sfdt_pipeline`
mengembalikannya (`\[\d+([-,]\d+)*\]` → `[n]`) supaya regex sitasi ekspor
tetap berfungsi.

### Verifikasi P1 (e2e Playwright, dokumen uji)
- Ketik di Sync → autosave → marker di server (GET /sfdt) ✓
- Ekspor PDF (menu Lainnya) → `uji_docx3.pdf` terunduh (pandoc→tectonic) ✓
- Ekspor DOCX → `uji_docx3.docx` terunduh ✓
- Toggle ke Sumber → CodeMirror berisi LaTeX hasil pipeline (preamble
  template + marker di dalamnya) ✓; 0 page error; kembali ke Sync ✓
- `npx tsc --noEmit` bersih; eslint 0 error (3 warning lama pre-existing).

## Catatan kunci

- Sumber kebenaran kerja = SFDT (kolom `sfdt`); ekspor/typeset/LaTeX
  diregenerasi dari SFDT via pipeline P1. Kolom `content`/`structured_content`
  masih diisi mode Sumber (LaTeX) dan tetap dibaca GET `/export-docx` &
  `/export-latex` (mode Sumber/back-compat), tetapi tidak lagi sumber
  kebenaran mode Sync.
- License Syncfusion: set `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY`.
- SFDT tak valid (`{"sections":[]}`) dianggap kosong oleh FE (memakai
  EMPTY_SFDT satu paragraf kosong) — lihat `loadSfdt` di page.tsx.
- Gambar dalam DOCX hasil ekspor keluar sebagai data URI dari pandoc;
  pratinjau/typeset membacanya, jalur PDF tetap menggantikan URL `/uploads/...`
  dengan jalur lokal (tectonic tidak bisa fetch http).
