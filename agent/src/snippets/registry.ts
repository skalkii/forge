import { z } from "zod";

import { agentVisionCode } from "./templates/agent-vision";
import { frameExtractionCode } from "./templates/frame-extraction";
import { sceneSearchCode } from "./templates/scene-search";
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
      query: "morning sunlight",
    },
    code: transcribeSearchCode,
  },
  "scene-search": {
    id: "scene-search",
    capability: "scene-search",
    title: "Index + search what's visually on screen",
    description:
      "Dev is sampling frames and captioning/embedding them to find visual moments ('search inside video for a scene'). index_scenes() captions every shot server-side; search(search_type=scene) answers natural-language visual queries with timestamps.",
    params: z.strictObject({
      videoUrl,
      query: z
        .string()
        .min(1)
        .describe("natural-language description of the visual moment the dev wants to find"),
      scenePrompt: z
        .string()
        .min(1)
        .default("Describe the visual content of the scene, focusing on objects, people, and actions.")
        .describe("instruction for how scenes should be captioned during indexing"),
    }),
    sampleParams: {
      // VideoDB's own docs sample — direct-file URLs can hit "Download failed"
      videoUrl: "https://www.youtube.com/watch?v=WDv4AWk0J3U",
      query: "a man speaking indoors",
      scenePrompt:
        "Describe the visual content of the scene, focusing on objects, people, and actions.",
    },
    code: sceneSearchCode,
  },
  "frame-extraction": {
    id: "frame-extraction",
    capability: "frame-extraction",
    title: "Extract frames every N seconds (no ffmpeg)",
    description:
      "Dev is wrestling with ffmpeg fps filters / temp files to pull frames at an interval. extract_scenes(time_based) returns hosted frame URLs in a few lines — no ffmpeg, no local storage.",
    params: z.strictObject({
      videoUrl,
      intervalSec: z
        .number()
        .int()
        .min(1)
        .max(3600)
        .describe("sampling interval in seconds, taken from the dev's stated requirement"),
    }),
    sampleParams: {
      // VideoDB's own docs sample — direct-file URLs can hit "Download failed"
      videoUrl: "https://www.youtube.com/watch?v=WDv4AWk0J3U",
      intervalSec: 10,
    },
    code: frameExtractionCode,
  },
  "agent-vision": {
    id: "agent-vision",
    capability: "agent-vision",
    title: "Hosted frame URLs for a vision model / agent",
    description:
      "Dev wants their AI agent to 'see' a video (screenshot loops, manual frame grabs feeding a vision LLM). Sampled frames come back as hosted image URLs that drop straight into any multimodal model.",
    params: z.strictObject({
      videoUrl,
      intervalSec: z
        .number()
        .int()
        .min(1)
        .max(3600)
        .describe("how often the agent needs a frame, in seconds"),
    }),
    sampleParams: {
      // VideoDB's own docs sample — direct-file URLs can hit "Download failed"
      videoUrl: "https://www.youtube.com/watch?v=WDv4AWk0J3U",
      intervalSec: 15,
    },
    code: agentVisionCode,
  },
};

export const snippetTemplateIds = Object.keys(snippetRegistry);

export function getSnippetTemplate(id: string): SnippetTemplate | undefined {
  return snippetRegistry[id];
}
