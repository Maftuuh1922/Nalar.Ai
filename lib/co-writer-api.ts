import { apiFetch, apiUrl } from "@/lib/api";

const BASE = "/api/v1/co_writer";

export interface CoWriterDocumentSummary {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  preview: string;
  /** Folder tempat draf disimpan; null = akar (belum dikelompokkan). */
  folder_id: string | null;
}

export interface CoWriterDocument {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  source_format?: string | null;
  /**
   * Format `content`: "markdown" (sumber kebenaran baru) atau "latex" (draf
   * lama, dikonversi ke markdown saat dibuka). Menentukan editor mana yang
   * terbuka secara bawaan.
   */
  content_format?: "markdown" | "latex" | null;
}

export interface CoWriterFile {
  path: string;
  size: number;
  updated_at: number;
  read_only?: boolean;
  url?: string;
}

export interface CoWriterFileContent {
  path: string;
  content: string;
  updated_at: number;
}

export interface CoWriterOutlineHeading {
  path: string;
  level: number;
  title: string;
  offset: number;
  summary: string;
  word_count: number;
}

export interface CoWriterCheckpoint {
  id: string;
  label: string;
  created_at: number;
  content_length: number;
  file_count: number;
}

function encodeProjectPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * @param folderId UUID folder (termasuk isi subfoldernya), `"root"` untuk draf
 * tanpa folder, atau kosong untuk semua draf.
 */
export async function listCoWriterDocuments(
  folderId?: string | null,
): Promise<CoWriterDocumentSummary[]> {
  const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : "";
  const res = await apiFetch(apiUrl(`${BASE}/documents${query}`), {
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ documents: CoWriterDocumentSummary[] }>(res);
  return Array.isArray(data?.documents) ? data.documents : [];
}

export async function createCoWriterDocument(payload?: {
  title?: string;
  content?: string;
  folder_id?: string | null;
}): Promise<CoWriterDocument> {
  const res = await apiFetch(apiUrl(`${BASE}/documents`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: payload?.title ?? null,
      content: payload?.content ?? "",
      folder_id: payload?.folder_id ?? null,
    }),
  });
  return jsonOrThrow<CoWriterDocument>(res);
}

export async function getCoWriterDocument(
  docId: string,
): Promise<CoWriterDocument> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}`),
    {
      cache: "no-store",
    },
  );
  return jsonOrThrow<CoWriterDocument>(res);
}

export async function updateCoWriterDocument(
  docId: string,
  payload: { title?: string | null; content?: string | null },
): Promise<CoWriterDocument> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title ?? null,
        content: payload.content ?? null,
      }),
    },
  );
  return jsonOrThrow<CoWriterDocument>(res);
}

export async function deleteCoWriterDocument(docId: string): Promise<boolean> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}`),
    {
      method: "DELETE",
    },
  );
  const data = await jsonOrThrow<{ deleted: boolean }>(res);
  return Boolean(data?.deleted);
}

export async function listCoWriterFiles(
  docId: string,
): Promise<CoWriterFile[]> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/files`),
    { cache: "no-store" },
  );
  const data = await jsonOrThrow<{ files?: CoWriterFile[] } | CoWriterFile[]>(
    res,
  );
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.files) ? data.files : [];
}

export async function getCoWriterOutline(
  docId: string,
): Promise<CoWriterOutlineHeading[]> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/outline`),
    { cache: "no-store" },
  );
  const data = await jsonOrThrow<{ headings?: CoWriterOutlineHeading[] }>(res);
  return Array.isArray(data.headings) ? data.headings : [];
}

export async function listCoWriterCheckpoints(
  docId: string,
): Promise<CoWriterCheckpoint[]> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/checkpoints`),
    { cache: "no-store" },
  );
  const data = await jsonOrThrow<{ checkpoints?: CoWriterCheckpoint[] }>(res);
  return Array.isArray(data.checkpoints) ? data.checkpoints : [];
}

export async function getCoWriterCheckpoint(
  docId: string,
  checkpointId: string,
): Promise<{ content: string; files: string[]; label: string }> {
  const res = await apiFetch(
    apiUrl(
      `${BASE}/documents/${encodeURIComponent(docId)}/checkpoints/${encodeURIComponent(checkpointId)}`,
    ),
    { cache: "no-store" },
  );
  return jsonOrThrow<{ content: string; files: string[]; label: string }>(res);
}

export async function createCoWriterCheckpoint(
  docId: string,
  label: string,
): Promise<{ id: string; label: string; created_at: number }> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/checkpoints`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    },
  );
  return jsonOrThrow<{ id: string; label: string; created_at: number }>(res);
}

export async function restoreCoWriterCheckpoint(
  docId: string,
  checkpointId: string,
): Promise<CoWriterDocument> {
  const res = await apiFetch(
    apiUrl(
      `${BASE}/documents/${encodeURIComponent(docId)}/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
    ),
    { method: "POST" },
  );
  return jsonOrThrow<CoWriterDocument>(res);
}

/** Berkas asli yang diunggah (DOCX/PDF/dll.) untuk impor berfidelitas tinggi. */
export async function getCoWriterSource(docId: string): Promise<Blob> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/source`),
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.blob();
}

/** DOCX kerja NATIVE hasil pipeline import (pdf2docx/postprocess) untuk editor.
 * Menghindari markdown mentah bocor ke editor. */
export async function getWorkingDocx(docId: string): Promise<Blob> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/working-docx`),
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.blob();
}

/** Simpan DOCX kerja dari editor SuperDoc (autosave mode Word).
 *
 * Ini SATU-SATUNYA sumber kebenaran mode Word: apa yang tampil di editor =
 * apa yang tersimpan = apa yang terunduh. Blob dikirim sebagai `multipart/
 * form-data` (bukan JSON base64) supaya OOXML dokumen besar tidak membengkak. */
export async function saveWorkingDocx(
  docId: string,
  blob: Blob,
): Promise<{ ok: boolean; bytes: number }> {
  const form = new FormData();
  form.append("file", blob, "document.docx");
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/working-docx`),
    { method: "PUT", body: form },
  );
  return jsonOrThrow<{ ok: boolean; bytes: number }>(res);
}

/** Ambil representasi Markdown yang sudah dirapikan (AST-first) untuk mengisi editor Word. */
export async function getCoWriterMarkdown(
  docId: string,
): Promise<{ markdown: string; title: string; updated_at: number }> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/md`),
    { cache: "no-store" },
  );
  return jsonOrThrow<{ markdown: string; title: string; updated_at: number }>(res);
}

/** Simpan SFDT hasil edit editor ala Word (sync, tanpa konversi LaTeX). */
export async function saveCoWriterSfdt(
  docId: string,
  payload: { sfdt: string },
): Promise<{ updated_at: number }> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/sfdt`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return jsonOrThrow<{ updated_at: number }>(res);
}

export async function getCoWriterFile(
  docId: string,
  path: string,
): Promise<CoWriterFileContent> {  const res = await apiFetch(
    apiUrl(
      `${BASE}/documents/${encodeURIComponent(docId)}/files/${encodeProjectPath(path)}`,
    ),
    { cache: "no-store" },
  );
  return jsonOrThrow<CoWriterFileContent>(res);
}

export async function saveCoWriterFile(
  docId: string,
  path: string,
  content: string,
): Promise<CoWriterFileContent> {
  const res = await apiFetch(
    apiUrl(
      `${BASE}/documents/${encodeURIComponent(docId)}/files/${encodeProjectPath(path)}`,
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  return jsonOrThrow<CoWriterFileContent>(res);
}

export async function deleteCoWriterFile(
  docId: string,
  path: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `${BASE}/documents/${encodeURIComponent(docId)}/files/${encodeProjectPath(path)}`,
    ),
    { method: "DELETE" },
  );
  await jsonOrThrow<{ deleted: boolean; path: string }>(res);
}

export async function renameCoWriterFile(
  docId: string,
  from: string,
  to: string,
): Promise<CoWriterFileContent> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/files/rename`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    },
  );
  return jsonOrThrow<CoWriterFileContent>(res);
}

export async function splitCoWriterDocument(
  docId: string,
): Promise<{ content: string; files: string[]; checkpoint_id?: string }> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/split`),
    { method: "POST" },
  );
  const data = await jsonOrThrow<{
    content: string;
    files: Array<string | CoWriterFile>;
    checkpoint_id?: string;
  }>(res);
  return {
    content: data.content,
    files: (data.files || []).map((item) =>
      typeof item === "string" ? item : item.path,
    ),
    checkpoint_id: data.checkpoint_id,
  };
}

// ── Folder (pengelompokan draf, boleh bersarang) ────────────────────────────

export interface CoWriterFolder {
  id: string;
  name: string;
  /** null = folder akar. */
  parent_id: string | null;
  /** Warna aksen "#rrggbb", null bila memakai warna bawaan. */
  color: string | null;
  /** Termasuk draf di seluruh subfolder, sesuai isi yang tampil saat dipilih. */
  document_count: number;
  created_at: number;
}

export async function listCoWriterFolders(): Promise<CoWriterFolder[]> {
  const res = await apiFetch(apiUrl(`${BASE}/folders`), { cache: "no-store" });
  const data = await jsonOrThrow<{ folders?: CoWriterFolder[] }>(res);
  return Array.isArray(data?.folders) ? data.folders : [];
}

export async function createCoWriterFolder(payload: {
  name: string;
  parent_id?: string | null;
  color?: string | null;
}): Promise<CoWriterFolder> {
  const res = await apiFetch(apiUrl(`${BASE}/folders`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      parent_id: payload.parent_id ?? null,
      color: payload.color ?? null,
    }),
  });
  return jsonOrThrow<CoWriterFolder>(res);
}

/**
 * Field yang tidak disertakan tidak diubah. Menyertakan `parent_id: null`
 * memindahkan folder ke akar — berbeda dari tidak mengirimnya sama sekali.
 */
export async function updateCoWriterFolder(
  folderId: string,
  payload: { name?: string; color?: string | null; parent_id?: string | null },
): Promise<CoWriterFolder> {
  const res = await apiFetch(
    apiUrl(`${BASE}/folders/${encodeURIComponent(folderId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return jsonOrThrow<CoWriterFolder>(res);
}

/** Menghapus wadahnya saja: draf dan subfolder di dalamnya naik ke folder induk. */
export async function deleteCoWriterFolder(folderId: string): Promise<void> {
  const res = await apiFetch(
    apiUrl(`${BASE}/folders/${encodeURIComponent(folderId)}`),
    { method: "DELETE" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
}

/** `folderId: null` mengeluarkan draf ke akar. */
export async function moveDocumentToFolder(
  docId: string,
  folderId: string | null,
): Promise<CoWriterDocumentSummary> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/folder`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    },
  );
  return jsonOrThrow<CoWriterDocumentSummary>(res);
}

// ── Agentic write & integrasi Learning Space ────────────────────────────────

export interface AgenticWriteResult {
  draft: string;
  references: string[];
  citation_count: number;
  confirm_required: boolean;
}

export interface LearningSpaceData {
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: number;
  }>;
  references: Array<{
    id: string;
    group_id: string;
    filename: string;
    title: string;
    authors: string[];
    year: number | null;
    journal_name: string;
    status: string;
    created_at: number;
  }>;
  saved_citations: Array<{
    id: string;
    category_id: string;
    category_name: string;
    reference_id: string | null;
    format: string;
    citation_text: string;
    note: string | null;
    created_at: number;
  }>;
  chat_history: Array<{ id: string; title: string; updated_at: number }>;
  drafts: Array<{ id: string; title: string; updated_at: number; preview: string }>;
}

export async function agenticWrite(payload: {
  instruction: string;
  group_id: string;
  format?: string;
  use_rag?: boolean;
}): Promise<AgenticWriteResult> {
  const res = await apiFetch(apiUrl(`${BASE}/agent-write`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<AgenticWriteResult>(res);
}

export async function getLearningSpaceData(): Promise<LearningSpaceData> {
  const res = await apiFetch(apiUrl(`${BASE}/learning-space`), {
    cache: "no-store",
  });
  return jsonOrThrow<LearningSpaceData>(res);
}

export async function importChatToCoWriter(payload: {
  doc_id?: string | null;
  session_id: string;
}): Promise<CoWriterDocument> {
  const res = await apiFetch(apiUrl(`${BASE}/import-chat`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<CoWriterDocument>(res);
}

export async function importFileToCoWriter(file: File): Promise<CoWriterDocument> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(apiUrl(`${BASE}/import-file`), {
    method: "POST",
    body: form,
  });
  return jsonOrThrow<CoWriterDocument>(res);
}

// ── P1: pipeline ekspor berbasis SFDT (SFDT → DOCX → Markdown → Pandoc) ─────

/**
 * Konversi DOCX (hasil Syncfusion export) → Markdown/LaTeX via Pandoc.
 * Dipakai mode Sync: kebenaran kerja = SFDT, ekspor/typeset harus
 * diregenerasi dari SFDT, bukan dari kolom LaTeX lama.
 */
export async function convertDocxToMarkdown(
  docId: string,
  file: Blob | File,
  opts: { to?: "markdown" | "latex" } = {},
): Promise<{ markdown: string } | { latex: string }> {
  const form = new FormData();
  form.append("file", file, "dokumen.docx");
  const query = opts.to === "latex" ? "?to=latex" : "";
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/convert-docx${query}`),
    { method: "POST", body: form, cache: "no-store" },
  );
  return jsonOrThrow<{ markdown: string } | { latex: string }>(res);
}

/** Ekspor DOCX (template kampus + sitasi DOI aktif) dari markdown (P1). */
export async function exportDocxFromMarkdown(
  docId: string,
  markdown: string,
): Promise<Blob> {
  const res = await apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/export-docx`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.blob();
}

/**
 * Ekspor LaTeX/PDF dari markdown (P1). Mengembalikan Response utk membaca
 * blob dan header X-Fallback-Notice.
 */
export async function exportLatexFromMarkdown(
  docId: string,
  markdown: string,
  format: "pdf" | "tex",
): Promise<Response> {
  return apiFetch(
    apiUrl(`${BASE}/documents/${encodeURIComponent(docId)}/export-latex`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, format }),
      cache: "no-store",
    },
  );
}
