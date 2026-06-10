// Mirrors agent/src/mastra/lib/models.ts resolution (env contract is shared
// via the root .env); dashboard never imports the agent package to keep
// Mastra out of the Next bundle.

export type ModelTier = "cheap" | "strong";

const TIER_ENV: Record<ModelTier, string> = {
  cheap: "CHEAP_MODEL",
  strong: "STRONG_MODEL",
};

const PROVIDER_KEY_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: "OLLAMA_BASE_URL",
};

export interface ModelSummary {
  tier: ModelTier;
  envVar: string;
  raw: string | null;
  provider: string | null;
  modelId: string | null;
  routerId: string | null;
  credentialEnv: string | null;
  credentialPresent: boolean;
  error: string | null;
}

export function normalizeModelId(raw: string): { provider: string; modelId: string } | null {
  const trimmed = raw.trim();
  const slash = trimmed.indexOf("/");
  const colon = trimmed.indexOf(":");
  if (slash !== -1 && (colon === -1 || slash < colon)) {
    return { provider: trimmed.slice(0, slash), modelId: trimmed.slice(slash + 1) };
  }
  if (colon !== -1) {
    return { provider: trimmed.slice(0, colon), modelId: trimmed.slice(colon + 1) };
  }
  return null;
}

export function ollamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
}

export function summarizeModel(tier: ModelTier): ModelSummary {
  const envVar = TIER_ENV[tier];
  const raw = process.env[envVar] ?? null;
  const base: ModelSummary = {
    tier,
    envVar,
    raw,
    provider: null,
    modelId: null,
    routerId: null,
    credentialEnv: null,
    credentialPresent: false,
    error: null,
  };
  if (!raw) return { ...base, error: `${envVar} not set` };
  const parsed = normalizeModelId(raw);
  if (!parsed) return { ...base, error: `"${raw}" is not provider/model form` };
  const credentialEnv = PROVIDER_KEY_ENV[parsed.provider] ?? null;
  return {
    ...base,
    provider: parsed.provider,
    modelId: parsed.modelId,
    routerId: `${parsed.provider}/${parsed.modelId}`,
    credentialEnv,
    credentialPresent:
      parsed.provider === "ollama" ? true : credentialEnv ? Boolean(process.env[credentialEnv]) : false,
  };
}

export function providerCredentials(): { provider: string; envVar: string; present: boolean }[] {
  return Object.entries(PROVIDER_KEY_ENV).map(([provider, envVar]) => ({
    provider,
    envVar,
    present: provider === "ollama" ? true : Boolean(process.env[envVar]),
  }));
}

/** Provider liveness probes — list-models endpoints, no completion spend. */
export async function pingProvider(
  provider: string,
): Promise<{ ok: boolean; status: number | null; latencyMs: number; detail: string }> {
  const started = Date.now();
  let url: string;
  const headers: Record<string, string> = {};
  switch (provider) {
    case "openai":
      url = "https://api.openai.com/v1/models";
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY ?? ""}`;
      break;
    case "anthropic":
      url = "https://api.anthropic.com/v1/models";
      headers["x-api-key"] = process.env.ANTHROPIC_API_KEY ?? "";
      headers["anthropic-version"] = "2023-06-01";
      break;
    case "deepseek":
      url = "https://api.deepseek.com/v1/models";
      headers.Authorization = `Bearer ${process.env.DEEPSEEK_API_KEY ?? ""}`;
      break;
    case "mistral":
      url = "https://api.mistral.ai/v1/models";
      headers.Authorization = `Bearer ${process.env.MISTRAL_API_KEY ?? ""}`;
      break;
    case "openrouter":
      url = "https://openrouter.ai/api/v1/models";
      headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`;
      break;
    case "qwen":
      url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models";
      headers.Authorization = `Bearer ${process.env.DASHSCOPE_API_KEY ?? ""}`;
      break;
    case "ollama":
      url = `${ollamaBaseUrl()}/api/tags`;
      break;
    default:
      return { ok: false, status: null, latencyMs: 0, detail: `unknown provider "${provider}"` };
  }
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      detail: res.ok ? "reachable" : `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
