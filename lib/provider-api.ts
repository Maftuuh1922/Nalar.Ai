import { apiFetch, apiUrl } from "@/lib/api";

export interface ProviderConfig {
  id: string;
  name: string;
  base_url: string;
  model_name: string;
  embedding_model: string;
  is_active: boolean;
  capabilities: string[];
  provider_type: string;
  capability_tier: string;
  context_window: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderInput {
  name: string;
  base_url: string;
  api_key?: string;
  model_name: string;
  embedding_model: string;
  is_active: boolean;
  capabilities: string[];
  provider_type: string;
  capability_tier: string;
  context_window: number;
}

export interface DetectResult {
  reachable: boolean;
  capabilities: string[];
  provider_type: string;
  capability_tier: string;
  context_window: number;
  available_models: string[];
  probes: Array<{ name: string; label: string; status: string; message: string; latency_ms: number | null }>;
}

const BASE = "/api/v1/settings/model";

export async function listProviders(): Promise<ProviderConfig[]> {
  const res = await apiFetch(apiUrl(BASE));
  if (!res.ok) throw new Error(`Gagal memuat provider: ${res.status}`);
  return res.json();
}

export async function createProvider(input: ProviderInput): Promise<ProviderConfig> {
  const res = await apiFetch(apiUrl(BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Gagal membuat provider: ${res.status}`);
  }
  return res.json();
}

export async function updateProvider(id: string, input: ProviderInput): Promise<ProviderConfig> {
  const res = await apiFetch(apiUrl(`${BASE}/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Gagal memperbarui provider: ${res.status}`);
  }
  return res.json();
}

export async function deleteProvider(id: string): Promise<void> {
  const res = await apiFetch(apiUrl(`${BASE}/${id}`), { method: "DELETE" });
  if (!res.ok) throw new Error(`Gagal menghapus provider: ${res.status}`);
}

export async function setActiveProvider(id: string): Promise<ProviderConfig> {
  const res = await apiFetch(apiUrl(`${BASE}/${id}/active`), { method: "PUT" });
  if (!res.ok) throw new Error(`Gagal mengaktifkan provider: ${res.status}`);
  return res.json();
}

export async function detectProvider(
  base_url: string,
  api_key: string,
  model_name: string,
  embedding_model: string,
  config_id?: string,
): Promise<DetectResult> {
  const res = await apiFetch(apiUrl(`${BASE}/detect`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url, api_key, model_name, embedding_model, config_id }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Gagal mendeteksi: ${res.status}`);
  }
  return res.json();
}
