import { createScorer } from "@mastra/core/evals";
import { z } from "zod";

import { getCheapModel } from "../lib/models";

/**
 * Touch-quality — model-judged review of a drafted reply, run on every
 * draft before the human gate (cheap model keeps it affordable). It is
 * advisory: the result is shown to the reviewer alongside the draft.
 * The deterministic spam-guardrail (separate scorer) is the hard gate.
 */

export const touchQualityInputSchema = z.object({
  title: z.string(),
  excerpt: z.string(),
  url: z.string(),
  capability: z.string(),
});

export const touchQualityOutputSchema = z.object({
  replyBody: z.string(),
  templateId: z.string(),
});

export type TouchQualityInput = z.infer<typeof touchQualityInputSchema>;
export type TouchQualityOutput = z.infer<typeof touchQualityOutputSchema>;

const analyzeSchema = z.object({
  addressesProblem: z
    .number()
    .min(0)
    .max(1)
    .describe("does the reply engage the author's actual problem in their own terms?"),
  explainsValue: z
    .number()
    .min(0)
    .max(1)
    .describe("does it briefly explain what the snippet does and why it removes the pain?"),
  tone: z
    .number()
    .min(0)
    .max(1)
    .describe("1 = peer-to-peer helpful and concise; 0 = salesy, hypey, or condescending"),
  promotional: z
    .boolean()
    .describe("true if the reply reads like marketing rather than help"),
  issues: z.array(z.string()).describe("concrete problems a reviewer should look at, empty if none"),
});

export const touchQualityScorer = createScorer({
  id: "touch-quality",
  description:
    "Model-judged quality review of a drafted public reply: relevance, clarity, helpful tone, no marketing.",
  judge: {
    model: getCheapModel(),
    instructions: [
      "You review drafts written by a developer-relations team replying to developers publicly stuck on a problem.",
      "A good reply: engages the author's actual problem in their own terms, briefly explains what the suggested snippet does and why it removes their pain, stays concise, and reads peer-to-peer.",
      "The team recommends their own product openly, with an affiliation disclosure line — that is expected and is NOT promotional by itself. 'Promotional' means hype language, feature-list dumping, superlatives, or sign-up pressure.",
      "Be a careful reviewer: drafts you wave through get posted publicly under a real person's name.",
      "All numeric sub-scores must be between 0 and 1 inclusive.",
    ].join("\n"),
  },
  type: { input: touchQualityInputSchema, output: touchQualityOutputSchema },
})
  .analyze({
    description: "Judge the draft against the candidate's thread",
    outputSchema: analyzeSchema,
    createPrompt: ({ run }) => {
      const c = run.input!;
      const d = run.output;
      return [
        "The developer's public thread:",
        `Title: ${c.title}`,
        `URL: ${c.url}`,
        `Excerpt: ${c.excerpt}`,
        `Capability the reply offers: ${c.capability} (template ${d.templateId}; the [[SNIPPET]] marker is replaced with validated code before posting)`,
        "",
        "Draft reply to evaluate:",
        d.replyBody,
      ].join("\n");
    },
  })
  .generateScore(({ results }) => {
    const a = results.analyzeStepResult;
    const base = (a.addressesProblem + a.explainsValue + a.tone) / 3;
    return a.promotional ? Math.min(base, 0.4) : base;
  })
  .generateReason(({ results, score }) => {
    const a = results.analyzeStepResult;
    const parts = [
      `addresses=${a.addressesProblem.toFixed(2)} explains=${a.explainsValue.toFixed(2)} tone=${a.tone.toFixed(2)}${a.promotional ? " PROMOTIONAL" : ""}`,
    ];
    if (a.issues.length) parts.push(`issues: ${a.issues.join("; ")}`);
    return `score=${score.toFixed(2)} — ${parts.join(" | ")}`;
  });
