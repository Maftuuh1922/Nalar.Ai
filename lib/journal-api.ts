"use client";

/**
 * API client untuk fitur Referensi Jurnal & Sitasi.
 * Kontrak mengikuti backend: app/api/routes/journal.py
 */

export interface JournalGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  reference_count: number;
}

export interface JournalReference {
  id: string;
  group_id: string;
  filename: string;
  title: string;
  authors: string[] | null;
  year: number | null;
  journal_name: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  publisher: string | null;
  abstract: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CitationFormat {
  key: string;
  label: string;
}

export interface CitationCategory {
  id: string;
  name: string;
  created_at: string;
  citation_count: number;
}

export interface SavedCitation {
  id: string;
  category_id: string;
  reference_id: string | null;
  format: string;
  citation_text: string;
  note: string | null;
  created_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // abaikan — detail default dipakai
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ── Grup laporan ────────────────────────────────────────────────────────────

export async function listJournalGroups(): Promise<JournalGroup[]> {
  return request<JournalGroup[]>("/api/v1/journal/groups");
}

export async function createJournalGroup(name: string, description?: string): Promise<JournalGroup> {
  return request<JournalGroup>("/api/v1/journal/groups", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function updateJournalGroup(
  id: string,
  payload: { name?: string; description?: string },
): Promise<JournalGroup> {
  return request<JournalGroup>(`/api/v1/journal/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJournalGroup(id: string): Promise<void> {
  await request<void>(`/api/v1/journal/groups/${id}`, { method: "DELETE" });
}

// ── Referensi jurnal ────────────────────────────────────────────────────────

export async function listJournalReferences(groupId?: string): Promise<JournalReference[]> {
  const query = groupId ? `?group_id=${encodeURIComponent(groupId)}` : "";
  return request<JournalReference[]>(`/api/v1/journal/references${query}`);
}

export async function uploadJournalReference(
  groupId: string,
  file: File,
): Promise<JournalReference> {
  const form = new FormData();
  form.append("group_id", groupId);
  form.append("file", file);
  const response = await fetch("/api/v1/journal/references", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // abaikan
    }
    throw new Error(detail);
  }
  return (await response.json()) as JournalReference;
}

export async function updateJournalReference(
  id: string,
  payload: Partial<JournalReference>,
): Promise<JournalReference> {
  return request<JournalReference>(`/api/v1/journal/references/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJournalReference(id: string): Promise<void> {
  await request<void>(`/api/v1/journal/references/${id}`, { method: "DELETE" });
}

// ── Generate sitasi ─────────────────────────────────────────────────────────

export async function generateCitation(
  referenceId: string,
  format: string,
): Promise<{ reference_id: string; format: string; citation: string }> {
  return request(`/api/v1/journal/references/${referenceId}/citation`, {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

export async function generateBibliography(
  groupId: string,
  format: string,
): Promise<{ group_id: string; format: string; citations: string[]; bibliography: string }> {
  return request(`/api/v1/journal/groups/${groupId}/bibliography`, {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

export async function listCitationFormats(): Promise<CitationFormat[]> {
  const data = await request<{ formats: CitationFormat[] }>("/api/v1/journal/formats");
  return data.formats;
}

// ── Kategori sitasi ─────────────────────────────────────────────────────────

export async function listCitationCategories(): Promise<CitationCategory[]> {
  return request<CitationCategory[]>("/api/v1/journal/citation-categories");
}

export async function createCitationCategory(name: string): Promise<CitationCategory> {
  return request<CitationCategory>("/api/v1/journal/citation-categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateCitationCategory(id: string, name: string): Promise<CitationCategory> {
  return request<CitationCategory>(`/api/v1/journal/citation-categories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteCitationCategory(id: string): Promise<void> {
  await request<void>(`/api/v1/journal/citation-categories/${id}`, { method: "DELETE" });
}

// ── Sitasi tersimpan ────────────────────────────────────────────────────────

export async function listSavedCitations(categoryId?: string): Promise<SavedCitation[]> {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
  return request<SavedCitation[]>(`/api/v1/journal/citations${query}`);
}

export async function saveCitation(payload: {
  category_id: string;
  reference_id?: string | null;
  format: string;
  citation_text: string;
  note?: string;
}): Promise<SavedCitation> {
  return request<SavedCitation>("/api/v1/journal/citations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSavedCitation(
  id: string,
  payload: { category_id?: string; note?: string },
): Promise<SavedCitation> {
  return request<SavedCitation>(`/api/v1/journal/citations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedCitation(id: string): Promise<void> {
  await request<void>(`/api/v1/journal/citations/${id}`, { method: "DELETE" });
}

// ── Simpan referensi dari URL/link (chat) ───────────────────────────────────

export async function saveReferenceFromUrl(payload: {
  url: string;
  group_id?: string | null;
  title_hint?: string | null;
}): Promise<JournalReference & { saved: boolean }> {
  return request<JournalReference & { saved: boolean }>(
    "/api/v1/journal/references/from-url",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// ── Pencarian jurnal di internet (Deep Research) ────────────────────────────

export interface JournalSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // "web" | "arxiv"
}

export async function searchJournals(payload: {
  query: string;
  source?: string;
  max_results?: number;
}): Promise<JournalSearchResult[]> {
  return request<JournalSearchResult[]>("/api/v1/journal/search", {
    method: "POST",
    body: JSON.stringify({
      query: payload.query,
      source: payload.source ?? "all",
      max_results: payload.max_results ?? 5,
    }),
  });
}
