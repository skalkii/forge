import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { snippetRegistry } from "../../snippets/registry";
import { getStrongModel } from "../lib/models";
import { getActiveStrategy } from "../strategy";
import { exaResearchTool } from "../tools/research/exa";
import { parallelResearchTool } from "../tools/research/parallel";

/**
 * Qualify — strong-model gate, runs only after triage passes (this is the
 * first step that can spend research money; both tools route through
 * lib/retrieval's cache + fail-closed daily budget).
 *
 * Decides whether the product is GENUINELY the answer and which snippet
 * capability fits. `capability: "none"` is a first-class outcome — per R2,
 * no fitting template means no touch (or cookbook escalation), never
 * improvised code.
 *
 * Call with `generate(prompt, { structuredOutput: { schema: qualifyOutputSchema } })`.
 * Same model note as triage-agent: avoid `jsonPromptInjection` with the
 * OpenRouter models in use.
 */

const capabilityValues = ["none", ...Object.keys(snippetRegistry)] as ["none", ...string[]];

export const qualifyOutputSchema = z.object({
  fit: z
    .number()
    .min(0)
    .max(1)
    .describe("0 = product is a stretch or wrong, 1 = product is plainly the best answer"),
  capability: z
    .enum(capabilityValues)
    .describe('snippet capability that fits the problem, or "none" if no template genuinely fits'),
  reasons: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .describe("evidence-backed reasons for the fit score and capability choice"),
});

export type QualifyOutput = z.infer<typeof qualifyOutputSchema>;

export const qualifyCandidateSchema = z.object({
  title: z.string(),
  excerpt: z.string().describe("matched body excerpt from the public thread"),
  repo: z.string().nullish(),
  url: z.string(),
  triageReason: z.string().nullish(),
  candidateId: z.string().nullish().describe("UUID passed to research tools for spend attribution"),
});

export type QualifyCandidate = z.infer<typeof qualifyCandidateSchema>;

export function buildQualifyPrompt(candidate: QualifyCandidate): string {
  return [
    "Qualify this triaged GitHub signal.",
    "",
    `Title: ${candidate.title}`,
    candidate.repo ? `Repo: ${candidate.repo}` : null,
    `URL: ${candidate.url}`,
    candidate.triageReason ? `Triage notes: ${candidate.triageReason}` : null,
    candidate.candidateId
      ? `Candidate id (pass as candidateId to research tools): ${candidate.candidateId}`
      : null,
    "",
    "Excerpt:",
    candidate.excerpt,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function capabilityCatalog(): string {
  return Object.values(snippetRegistry)
    .map((t) => `- ${t.capability}: ${t.description}`)
    .join("\n");
}

export const qualifyAgent = new Agent({
  id: "qualify",
  name: "qualify",
  description:
    "Strong-model gate: is the product genuinely the answer, and which snippet capability fits?",
  instructions: () => {
    const strategy = getActiveStrategy();
    return [
      "You qualify triaged GitHub signals for a developer-relations team that only ever replies when the product is genuinely the best answer.",
      "",
      "Rubric:",
      strategy.rubric,
      "",
      "Available snippet capabilities (a public reply may ONLY use one of these — nothing else exists):",
      capabilityCatalog(),
      "",
      "Process:",
      "1. Read the signal. If the fit is already obvious either way, do NOT search — research costs money.",
      "2. Use research tools only to resolve genuine uncertainty: is the problem already solved in the thread's ecosystem? did the author find an answer? is there a simpler standard fix? At most 2 searches.",
      "3. Pick the single capability whose description matches the author's actual problem. If none truly matches, return capability \"none\" — never force a fit.",
      "",
      "Scoring guide:",
      "- fit ≥ 0.7 only when the author is hand-rolling what the product does natively AND no simpler standard answer exists.",
      "- Penalize: question already answered, author constraint rules out a hosted API (e.g. must be offline/on-prem), vendor/competitor threads, stale threads.",
      "- reasons[] must cite concrete evidence from the signal or search results, not restate the rubric.",
      "",
      "Be conservative: a wrong touch is worse than a missed one.",
    ].join("\n");
  },
  model: getStrongModel(),
  tools: { exaResearchTool, parallelResearchTool },
});
