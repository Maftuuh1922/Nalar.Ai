const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
};

/** Wrapper fetch generic ke backend FastAPI. Melempar ApiError jika gagal. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail: string | any = "Terjadi kesalahan saat menghubungi server.";
    try {
      const data = await response.json();
      detail = data.detail ?? detail;
      if (Array.isArray(detail)) {
        detail = detail.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`).join("\n");
      } else if (typeof detail === "object" && detail !== null) {
        detail = JSON.stringify(detail);
      }
    } catch {
      // respons bukan JSON, gunakan pesan default
    }
    throw new ApiError(String(detail), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Fetch khusus untuk streaming (JSONL / SSE format). Mengembalikan reader. */
export async function apiFetchStream(path: string, options: RequestOptions = {}): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const { method = "POST", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError("Gagal memulai stream", response.status);
  }
  
  if (!response.body) {
    throw new ApiError("Response tidak memiliki body", response.status);
  }

  return response.body.getReader();
}

/** Upload file via multipart/form-data (tidak pakai JSON body). */
export async function apiUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let detail = "Terjadi kesalahan saat mengunggah file.";
    try {
      const data = await response.json();
      detail = data.detail ?? detail;
    } catch {}
    throw new ApiError(String(detail), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ============================================================
// API Modules
// ============================================================

export const settingsApi = {
  getAll: (token: string) =>
    apiFetch<import("./types").ModelConfig[]>("/settings/model", { token }),
  create: (token: string, data: Record<string, string | boolean>) =>
    apiFetch<import("./types").ModelConfig>("/settings/model", {
      method: "POST",
      token,
      body: data,
    }),
  update: (token: string, id: string, data: Record<string, string | boolean>) =>
    apiFetch<import("./types").ModelConfig>(`/settings/model/${id}`, {
      method: "PUT",
      token,
      body: data,
    }),
  setActive: (token: string, id: string) =>
    apiFetch<import("./types").ModelConfig>(`/settings/model/${id}/active`, {
      method: "PUT",
      token,
    }),
  delete: (token: string, id: string) =>
    apiFetch<void>(`/settings/model/${id}`, {
      method: "DELETE",
      token,
    }),
};

export const documentsApi = {
  getAll: (token: string) =>
    apiFetch<import("./types").Document[]>("/documents", { token }),
  upload: (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiUpload<import("./types").Document>("/documents", formData, token);
  },
  delete: (token: string, id: string) =>
    apiFetch<void>(`/documents/${id}`, { method: "DELETE", token }),
};

export const chatApi = {
  send: (token: string, message: string, sessionId?: string | null, documentIds?: string[], agentId?: string, enableReasoning?: boolean) =>
    apiFetch<{ id: string; answer: string; thinking_process?: string; sources: { filename: string; page: string; excerpt: string }[]; created_at: string }>("/chat", {
      method: "POST",
      token,
      body: {
        message,
        session_id: sessionId || undefined,
        document_ids: documentIds || undefined,
        agent_id: agentId || undefined,
        enable_reasoning: enableReasoning || false,
      },
    }),
  sendStream: (token: string, message: string, sessionId?: string | null, documentIds?: string[], agentId?: string, enableReasoning?: boolean) =>
    apiFetchStream("/chat", {
      method: "POST",
      token,
      body: {
        message,
        session_id: sessionId || undefined,
        document_ids: documentIds || undefined,
        agent_id: agentId || undefined,
        enable_reasoning: enableReasoning || false,
      },
    }),
};


export const chatSessionsApi = {
  getAll: (token: string) =>
    apiFetch<import("./types").ChatSession[]>("/chat/sessions", { token }),
  delete: (token: string, id: string) =>
    apiFetch<void>(`/chat/sessions/${id}`, { method: "DELETE", token }),
  getHistory: (token: string, id: string) =>
    apiFetch<import("./types").ChatMessage[]>(`/chat/sessions/${id}/history`, { token }),
};

export const quizzesApi = {
  generate: (token: string, document_id: string, topic: string, num_questions: number = 5) =>
    apiFetch<import("./types").Quiz>("/quizzes/generate", {
      method: "POST",
      token,
      body: { document_id, topic, num_questions },
    }),
  getAll: (token: string) =>
    apiFetch<import("./types").Quiz[]>("/quizzes", { token }),
  getOne: (token: string, id: string) =>
    apiFetch<import("./types").Quiz>(`/quizzes/${id}`, { token }),
  delete: (token: string, id: string) =>
    apiFetch<void>(`/quizzes/${id}`, { method: "DELETE", token }),
};

export const progressApi = {
  getStats: (token: string) =>
    apiFetch<import("./types").ProgressStats>("/progress/stats", { token }),
};

export const agentsApi = {
  getAll: (token: string) =>
    apiFetch<import("./types").Agent[]>("/agents", { token }),
  create: (token: string, data: { name: string; role: string; system_prompt: string; avatar_icon: string }) =>
    apiFetch<import("./types").Agent>("/agents", { method: "POST", token, body: data }),
  update: (token: string, id: string, data: { name?: string; role?: string; system_prompt?: string; avatar_icon?: string }) =>
    apiFetch<import("./types").Agent>(`/agents/${id}`, { method: "PUT", token, body: data }),
  delete: (token: string, id: string) =>
    apiFetch<void>(`/agents/${id}`, { method: "DELETE", token }),
};

export const notebooksApi = {
  getAll: (token: string) =>
    apiFetch<import("./types").Notebook[]>("/notebooks", { token }),
  create: (token: string, data: { title: string; content?: string }) =>
    apiFetch<import("./types").Notebook>("/notebooks", { method: "POST", token, body: data }),
  getById: (token: string, id: string) =>
    apiFetch<import("./types").Notebook>(`/notebooks/${id}`, { token }),
  update: (token: string, id: string, data: { title?: string; content?: string }) =>
    apiFetch<import("./types").Notebook>(`/notebooks/${id}`, { method: "PUT", token, body: data }),
  delete: (token: string, id: string) =>
    apiFetch<void>(`/notebooks/${id}`, { method: "DELETE", token }),
};
