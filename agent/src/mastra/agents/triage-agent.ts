import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { getCheapModel } from "../lib/models";
import { getActiveStrategy } from "../strategy";

/**
 * Triage — first and cheapest LLM gate in the loop.
 * Cheap model, NO tools: money (Exa/Parallel, strong model) is spent only
 * on signals that pass this gate. The rubric comes from the active
 * MetricStrategy so the agent stays metric-agnostic.
 *
 * Call with `generate(prompt, { structuredOutput: { schema: triageOutputSchema } })`.
 * Live-tested 2026-06-10 (openrouter/openai/gpt-oss-120b): native structured
 * output parsed 7/7; `jsonPromptInjection: true` intermittently returned
 * `object: undefined` — don't use it with this model.
 */

export const triageOutputSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("0 = noise / off-topic, 1 = developer in real pain the product natively solves"),
  reason: z.string().min(1).describe("one or two sentences justifying the score"),
});

export type TriageOutput = z.infer<typeof triageOutputSchema>;

export const triageSignalSchema = z.object({
  title: z.string(),
  excerpt: z.string().describe("matched body excerpt from the public thread"),
  repo: z.string().nullish(),
  url: z.string(),
});

export type TriageSignal = z.infer<typeof triageSignalSchema>;

export function buildTriagePrompt(signal: TriageSignal): string {
  return [
    "Score this public GitHub signal for triage.",
    "",
    `Title: ${signal.title}`,
    signal.repo ? `Repo: ${signal.repo}` : null,
    `URL: ${signal.url}`,
    "",
    "Excerpt:",
    signal.excerpt,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export const triageAgent = new Agent({
  id: "triage",
  name: "triage",
  description: "Cheap-model gate: is this signal real developer pain worth spending on?",
  instructions: () => {
    const strategy = getActiveStrategy();
    return [
      "You triage public GitHub signals for a developer-relations team.",
      "Decide whether the author is genuinely stuck on a problem the product natively solves — before any money is spent researching them.",
      "",
      "Rubric:",
      strategy.rubric,
      "",
      "Scoring guide:",
      "- 0.0–0.2: off-topic, spam, vendor, or already solved.",
      "- 0.3–0.5: related space but the product is a stretch, or pain is unclear.",
      "- 0.6–0.8: real pain, plausibly a native fit; worth qualifying.",
      "- 0.9–1.0: textbook case — hand-rolling exactly what the product does.",
      "",
      "Judge only from the signal text given. Do not invent details. Be conservative: a false positive wastes research budget and risks a spammy touch.",
    ].join("\n");
  },
  model: getCheapModel(),
});
