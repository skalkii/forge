import type { MastraModelConfig } from "@mastra/core/llm";

/**
 * Provider-agnostic model registry.
 *
 * CHEAP_MODEL / STRONG_MODEL env vars name models as `provider/model`
 * (Mastra model-router form, e.g. `anthropic/claude-haiku-4-5`,
 * `deepseek/deepseek-chat`, `ollama/qwen2.5-coder:7b`). The legacy
 * `provider:model` form is accepted and normalized — split on the FIRST
 * colon only, because Ollama model ids contain colons themselves.
 *
 * Hosted providers (openai, anthropic, deepseek, mistral, qwen, …) are in
 * Mastra's built-in router registry: the plain string id resolves and the
 * API key is auto-detected from the standard env var. Ollama is not in the
 * registry, so it resolves to an OpenAI-compatible config pointing at
 * `OLLAMA_BASE_URL/v1` (Ollama ships an OpenAI-compatible endpoint).
 */

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
  ollama: "OLLAMA_BASE_URL",
};

export interface ResolvedModel {
  tier: ModelTier;
  raw: string;
  provider: string;
  modelId: string;
  /** what gets handed to Mastra (string router id or OpenAI-compatible config) */
  config: MastraModelConfig;
  /** env var holding the credential (or base URL for ollama) */
  credentialEnv: string | undefined;
  credentialPresent: boolean;
}

export function normalizeModelId(raw: string): { provider: string; modelId: string } {
  const trimmed = raw.trim();
  const slash = trimmed.indexOf("/");
  const colon = trimmed.indexOf(":");
  if (slash !== -1 && (colon === -1 || slash < colon)) {
    return { provider: trimmed.slice(0, slash), modelId: trimmed.slice(slash + 1) };
  }
  if (colon !== -1) {
    return { provider: trimmed.slice(0, colon), modelId: trimmed.slice(colon + 1) };
  }
  throw new Error(
    `Model id "${raw}" must be in provider/model form (e.g. anthropic/claude-haiku-4-5)`,
  );
}

function ollamaBaseUrl(): string {
  const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  return base.replace(/\/$/, "");
}

export function resolveModel(tier: ModelTier): ResolvedModel {
  const envVar = TIER_ENV[tier];
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`${envVar} is not set — set it to provider/model, e.g. anthropic/claude-haiku-4-5`);
  }
  const { provider, modelId } = normalizeModelId(raw);
  const credentialEnv = PROVIDER_KEY_ENV[provider];
  const credentialPresent = credentialEnv ? Boolean(process.env[credentialEnv]) : false;

  if (provider === "ollama") {
    return {
      tier,
      raw,
      provider,
      modelId,
      config: { providerId: "ollama", modelId, url: `${ollamaBaseUrl()}/v1`, apiKey: "ollama" },
      credentialEnv,
      // local default works without the env var being set
      credentialPresent: true,
    };
  }

  return {
    tier,
    raw,
    provider,
    modelId,
    config: `${provider}/${modelId}` as MastraModelConfig,
    credentialEnv,
    credentialPresent,
  };
}

export function getModel(tier: ModelTier): MastraModelConfig {
  return resolveModel(tier).config;
}

export const getCheapModel = (): MastraModelConfig => getModel("cheap");
export const getStrongModel = (): MastraModelConfig => getModel("strong");
