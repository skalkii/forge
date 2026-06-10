import { z } from "zod";

import { transcribeSearchCode } from "./templates/transcribe-search";

/**
 * Single source of truth for capability ↔ template ↔ params (R2).
 * The craft agent SELECTS an id + params from here — it never writes code.
 * Consumed by: qualify agent (capability list), craft agent (selection),
 * render.ts (fill), scripts/validate-snippets.py (offline QA), dashboard
 * /snippets panel.
 *
 * Templates are TS string exports (not .py files on disk) so they survive
 * `mastra build` bundling; the validator renders them out via a script.
 */
export interface SnippetTemplate {
  id: string;
  /** capability tag the qualify agent assigns — must match exactly */
  capability: "transcribe-search" | "scene-search" | "frame-extraction" | "agent-vision";
  title: string;
  /** when this template fits — injected into qualify/craft prompts */
  description: string;
  /** strict: unknown keys rejected — params land verbatim in public code */
  params: z.ZodType<Record<string, unknown>>;
  /** known-good params for the offline validator's live run */
  sampleParams: Record<string, unknown>;
  /** Python source with {{param}} placeholders, filled as Python literals */
  code: string;
}

const videoUrl = z
  .string()
  .min(1)
  .describe("public video URL (YouTube or direct file) taken from the candidate's thread");

export const snippetRegistry: Record<string, SnippetTemplate> = {
  "transcribe-search": {
    id: "transcribe-search",
    capability: "transcribe-search",
    title: "Transcribe + semantic search over spoken words",
    description:
      "Dev is hand-rolling whisper transcription plus chunking/embedding/vector search to find spoken moments in a video. One index_spoken_words() + search() replaces the pipeline and returns timestamped, playable shots.",
    params: z.strictObject({
      videoUrl,
      query: z
        .string()
        .min(1)
        .describe("natural-language search phrase mirroring what the dev is trying to find"),
    }),
    sampleParams: {
      videoUrl: "https://www.youtube.com/watch?v=WDv4AWk0J3U",
      query: "what is videodb",
    },
    code: transcribeSearchCode,
  },
};

export const snippetTemplateIds = Object.keys(snippetRegistry);

export function getSnippetTemplate(id: string): SnippetTemplate | undefined {
  return snippetRegistry[id];
}
