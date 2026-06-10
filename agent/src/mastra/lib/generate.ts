import type { Agent } from "@mastra/core/agent";
import type { z } from "zod";

import { recordCost } from "./cost-meter";

/**
 * Structured-output wrapper for all agent calls made from workflow steps.
 *
 * Live testing (2026-06-10, OpenRouter free tiers) showed two transient
 * failure modes that MUST be retried, not propagated:
 *   - completely empty response (finishReason undefined, empty text) from
 *     the strong model → `object === undefined`
 *   - schema-validation throw when the model emits out-of-range values
 * Every call is token-metered into cost_events (LLM_COST_PER_MTOK_* envs
 * convert tokens to USD; default 0 for free tiers).
 */

export class AgentGenerateError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(
      `agent "${agentId}" produced no structured output after ${attempts} attempt(s): ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
    this.name = "AgentGenerateError";
  }
}

function perTok(env: string | undefined): number {
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n / 1_000_000 : 0;
}

interface GenerateOptions {
  attempts?: number;
  candidateId?: string;
  /** cost_events meta tag, e.g. "triage" | "qualify" | "craft" */
  kind?: string;
}

export async function generateStructured<S extends z.ZodType>(
  // biome-ignore lint: Agent generics vary per agent; only .generate is used
  agent: Agent<any, any>,
  prompt: string,
  schema: S,
  opts: GenerateOptions = {},
): Promise<z.infer<S>> {
  const attempts = opts.attempts ?? 3;
  let lastError: unknown = "empty response";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await agent.generate(prompt, { structuredOutput: { schema } });

      const usage = (res as { usage?: { inputTokens?: number; outputTokens?: number } }).usage;
      const tokensIn = usage?.inputTokens ?? 0;
      const tokensOut = usage?.outputTokens ?? 0;
      void recordCost({
        provider: "llm",
        kind: "llm",
        candidateId: opts.candidateId,
        tokensIn,
        tokensOut,
        costUsd:
          tokensIn * perTok(process.env.LLM_COST_PER_MTOK_IN) +
          tokensOut * perTok(process.env.LLM_COST_PER_MTOK_OUT),
        meta: { agent: agent.id, step: opts.kind, attempt },
      }).catch((err: Error) => console.warn(`[generate] cost record failed: ${err.message}`));

      if (res.object !== undefined) return res.object as z.infer<S>;
      lastError = new Error(`empty response (finishReason=${String(res.finishReason)})`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 500 * attempt));
  }

  throw new AgentGenerateError(agent.id, attempts, lastError);
}
