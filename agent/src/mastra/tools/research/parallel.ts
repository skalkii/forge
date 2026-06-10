import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { parallelSearch } from "../../lib/retrieval";

/**
 * Thin wrapper over lib/retrieval — attached to the qualify agent ONLY.
 * Same guarantees as research-exa: cache, fail-closed daily budget,
 * cost metering. Parallel wants 2-3 short keyword queries plus an
 * optional objective.
 */
export const parallelResearchTool = createTool({
  id: "research-parallel",
  description:
    "Keyword web search (Parallel) for qualifying a candidate — give 2-3 concise keyword queries (3-6 words each) plus an objective describing what you want to learn.",
  inputSchema: z.object({
    searchQueries: z
      .array(z.string().min(1))
      .min(1)
      .max(3)
      .describe("2-3 concise keyword queries, 3-6 words each"),
    objective: z.string().optional().describe("what the search should establish"),
    maxResults: z.number().int().min(1).max(10).default(5),
    candidateId: z.string().optional().describe("candidate UUID for spend attribution"),
  }),
  outputSchema: z.object({
    cached: z.boolean(),
    results: z.array(z.object({ title: z.string(), url: z.string(), excerpt: z.string() })),
  }),
  execute: async ({ searchQueries, objective, maxResults = 5, candidateId }) => {
    const { results, cached } = await parallelSearch({
      searchQueries,
      objective,
      maxResults,
      candidateId,
    });
    return { cached, results };
  },
});
