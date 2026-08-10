import { apiFetch, apiUrl } from "@/lib/api";
import { invalidateClientCache, withClientCache } from "@/lib/client-cache";

const PERSONAS_CACHE_PREFIX = "personas:";

export const BUILTIN_PERSONAS: any[] = [];

export type PersonaSource = "user" | "admin";

export interface PersonaInfo {
  id: string;
  name: string;
  description: string;
  source: PersonaSource;
  read_only: boolean;
}

export interface PersonaDetail extends PersonaInfo {
  content: string;
}

export interface CreatePersonaPayload {
  name: string;
  description: string;
  content: string;
}

export interface UpdatePersonaPayload {
  description?: string;
  content?: string;
  rename_to?: string;
}

function normalizeSource(raw: unknown): PersonaSource {
  return raw === "admin" ? "admin" : "user";
}

async function asJson(response: Response) {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return response.json();
}

function normalizeInfo(item: any): PersonaInfo {
  return {
    id: String(item?.id ?? ""),
    name: String(item?.name ?? ""),
    description: String(item?.description ?? item?.role ?? ""),
    source: item?.is_builtin ? "admin" : normalizeSource(item?.source),
    read_only: Boolean(item?.read_only || item?.is_builtin),
  };
}

export async function listPersonas(options?: {
  force?: boolean;
}): Promise<PersonaInfo[]> {
  return withClientCache<PersonaInfo[]>(
    `${PERSONAS_CACHE_PREFIX}list`,
    async () => {
      let items: any[] = [];
      try {
        const response = await apiFetch(apiUrl("/api/v1/agents"), {
          cache: "no-store",
        });
        const data = await asJson(response);
        if (Array.isArray(data)) {
          items = data;
        } else if (data && Array.isArray(data.personas)) {
          items = data.personas;
        }
      } catch (err) {
        // Ignore API errors, will just return empty array
      }
      const mapped = items.map(normalizeInfo);
      return [
        ...BUILTIN_PERSONAS.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          source: p.source,
          read_only: p.read_only,
        })),
        ...mapped
      ];
    },
    { force: options?.force },
  );
}

export async function getPersona(name: string): Promise<PersonaDetail> {
  const builtin = BUILTIN_PERSONAS.find(p => p.name === name);
  if (builtin) return builtin;

  const personas = await listPersonas();
  const persona = personas.find(p => p.name === name);
  if (!persona) throw new Error("Persona not found");

  const response = await apiFetch(
    apiUrl(`/api/v1/agents/${encodeURIComponent(persona.id)}`),
    {
      cache: "no-store",
    },
  );
  const data = await asJson(response);
  return {
    ...normalizeInfo({ ...data, name: data?.name ?? name }),
    content: String(data?.system_prompt ?? ""),
  };
}

export async function createPersona(
  payload: CreatePersonaPayload,
): Promise<PersonaInfo> {
  const response = await apiFetch(apiUrl("/api/v1/agents"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      role: payload.description,
      system_prompt: payload.content,
      avatar_icon: "bot",
    }),
  });
  const data = await asJson(response);
  invalidatePersonasCache();
  return normalizeInfo({ ...data, name: data?.name ?? payload.name });
}

export async function updatePersona(
  name: string,
  payload: UpdatePersonaPayload,
): Promise<PersonaInfo> {
  const personas = await listPersonas();
  const persona = personas.find(p => p.name === name);
  if (!persona) throw new Error("Persona not found");

  const response = await apiFetch(
    apiUrl(`/api/v1/agents/${encodeURIComponent(persona.id)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(payload.rename_to && { name: payload.rename_to }),
        ...(payload.description && { role: payload.description }),
        ...(payload.content && { system_prompt: payload.content }),
      }),
    },
  );
  const data = await asJson(response);
  invalidatePersonasCache();
  return normalizeInfo({ ...data, name: data?.name ?? name });
}

export async function deletePersona(name: string): Promise<void> {
  const personas = await listPersonas();
  const persona = personas.find(p => p.name === name);
  if (!persona) throw new Error("Persona not found");

  const response = await apiFetch(
    apiUrl(`/api/v1/agents/${encodeURIComponent(persona.id)}`),
    {
      method: "DELETE",
    },
  );
  await asJson(response);
  invalidatePersonasCache();
}

export function invalidatePersonasCache() {
  invalidateClientCache(PERSONAS_CACHE_PREFIX);
}
