import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { exaSearch } from "../../lib/retrieval";

/**
 * Thin wrapper over lib/retrieval — attached to the qualify agent ONLY.
 * Demand-driven: fires after triage passes, so every miss spends money.
 * Cache, daily budget (fails closed), and cost metering live in the lib.
 */
export const exaResearchTool = createTool({
  id: "research-exa",
  description:
    "Semantic web search (Exa) for qualifying a candidate — e.g. checking whether their problem is already solved, what they have tried, or what the ecosystem offers.",
  inputSchema: z.object({
    query: z.string().min(1).describe("natural-language search query"),
    numResults: z.number().int().min(1).max(10).default(5),
    candidateId: z.string().optional().describe("candidate UUID for spend attribution"),
  }),
  outputSchema: z.object({
    cached: z.boolean(),
    results: z.array(z.object({ title: z.string(), url: z.string(), excerpt: z.string() })),
  }),
  execute: async ({ query, numResults = 5, candidateId }) => {
    const { results, cached } = await exaSearch(query, { numResults, candidateId });
    return { cached, results };
  },
});
