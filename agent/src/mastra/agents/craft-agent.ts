import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { snippetRegistry, snippetTemplateIds } from "../../snippets/registry";
import { disclosureText } from "../lib/disclosure";
import { getStrongModel } from "../lib/models";

/**
 * Craft — drafts the public reply for an approved-capability candidate.
 *
 * R2: the agent SELECTS {templateId, params} from the snippet registry —
 * it never writes code. The reply body carries exactly one [[SNIPPET]]
 * marker; a deterministic workflow step renders the template (Zod-strict
 * params, Python-literal fill) and splices the code block in. The agent
 * also writes NO links — the act step appends the UTM-tagged docs link.
 *
 * R3: the affiliation disclosure is injected into the instructions and
 * must appear verbatim in replyBody; the spam-guardrail scorer hard-fails
 * drafts without it.
 *
 * Call with `generate(prompt, { structuredOutput: { schema: craftOutputSchema } })`.
 * Same model note as triage-agent: avoid `jsonPromptInjection`. The
 * OpenRouter strong model intermittently returns an empty response
 * (finishReason undefined, empty text) — callers must retry on
 * `object === undefined`.
 */

export const SNIPPET_MARKER = "[[SNIPPET]]";

export const craftOutputSchema = z.object({
  templateId: z
    .enum(snippetTemplateIds as [string, ...string[]])
    .describe("snippet template matching the candidate's qualified capability"),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe("fill values for the template's placeholders — validated against the registry"),
  replyBody: z
    .string()
    .min(1)
    .describe(
      "the public reply: prose with exactly one [[SNIPPET]] marker and the disclosure line verbatim at the end",
    ),
});

export type CraftOutput = z.infer<typeof craftOutputSchema>;

export const craftCandidateSchema = z.object({
  title: z.string(),
  excerpt: z.string(),
  repo: z.string().nullish(),
  url: z.string(),
  capability: z.string().describe("capability assigned by the qualify agent"),
  qualifyReasons: z.array(z.string()).nullish(),
});

export type CraftCandidate = z.infer<typeof craftCandidateSchema>;

export function buildCraftPrompt(candidate: CraftCandidate): string {
  return [
    "Draft a reply for this qualified GitHub signal.",
    "",
    `Title: ${candidate.title}`,
    candidate.repo ? `Repo: ${candidate.repo}` : null,
    `URL: ${candidate.url}`,
    `Qualified capability: ${candidate.capability}`,
    candidate.qualifyReasons?.length ? `Qualify notes: ${candidate.qualifyReasons.join(" | ")}` : null,
    "",
    "Excerpt:",
    candidate.excerpt,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function templateCatalog(): string {
  return Object.values(snippetRegistry)
    .map((t) => {
      const shape =
        t.params instanceof z.ZodObject
          ? Object.entries(t.params.shape)
              .map(([key, schema]) => {
                const s = schema as z.ZodType;
                const desc = s.description ?? "";
                return `    - ${key}: ${desc}`;
              })
              .join("\n")
          : "    (see registry)";
      return `- templateId "${t.id}" (capability: ${t.capability}): ${t.description}\n  params:\n${shape}`;
    })
    .join("\n");
}

export const craftAgent = new Agent({
  id: "craft",
  name: "craft",
  description:
    "Drafts the public reply: selects a snippet template + params and writes prose with a snippet marker and mandatory disclosure.",
  instructions: () => {
    const disclosure = disclosureText();
    return [
      "You draft replies to developers publicly stuck on a problem the product solves. A human reviews and must approve every draft before anything is posted — write so the reviewer can approve without edits.",
      "",
      "Available templates (you may ONLY select from these — you never write or modify code):",
      templateCatalog(),
      "",
      "Output rules:",
      `1. templateId: the template matching the qualified capability.`,
      `2. params: fill every template param from the candidate's thread. For videoUrl: use a video URL from their thread if one is clearly present; otherwise use "https://www.youtube.com/watch?v=WDv4AWk0J3U" (a docs sample they can swap out). For query params: mirror the author's own words.`,
      `3. replyBody: GitHub-flavored markdown prose containing exactly one ${SNIPPET_MARKER} marker on its own line where the code block will be inserted. Do NOT write any code yourself, and do NOT include any links or URLs — those are added later.`,
      "",
      "Reply style:",
      "- Address their actual problem in their own terms first; acknowledge what they already built or tried.",
      "- Explain in one or two sentences what the snippet does and why it replaces their pain point.",
      "- Concise: 3-6 sentences of prose around the marker. No marketing language, no feature lists, no exclamation marks, no hard sell.",
      "- If their constraints make the product a poor fit after all, say so honestly in the reply rather than forcing it.",
      "",
      `Disclosure (mandatory, verbatim, as the final line of replyBody):`,
      disclosure,
    ].join("\n");
  },
  model: getStrongModel(),
});
