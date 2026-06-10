import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getPool } from "../../lib/db";
import { getGithubClient } from "../../lib/github-client";

const EXCERPT_MAX = 500;

/**
 * Runs ONE strategy query against GitHub issue search and persists new
 * signals. R7-minimal rows: username, url, repo, title, excerpt — nothing
 * else. Exact dedup on GitHub node id (signals.external_id UNIQUE);
 * near-dup clustering happens later in pgvector.
 *
 * `runGithubSearch` is the plain function the discovery workflow calls;
 * the tool is a thin wrapper for playground/manual use.
 */
export interface GithubSearchInput {
  query: string;
  freshnessHours?: number;
  perPage?: number;
}

export interface GithubSearchResult {
  query: string;
  totalMatches: number;
  fetched: number;
  inserted: number;
  signalIds: string[];
}

export async function runGithubSearch({
  query,
  freshnessHours = 72,
  perPage = 25,
}: GithubSearchInput): Promise<GithubSearchResult> {
    const cutoff = new Date(Date.now() - freshnessHours * 3600_000);
    // search qualifier is date-granular; exact cutoff re-checked below
    const q = `${query} created:>=${cutoff.toISOString().slice(0, 10)}`;

    const client = getGithubClient();
    const res = await client.octokit.rest.search.issuesAndPullRequests({
      q,
      per_page: perPage,
      sort: "created",
      order: "desc",
    });

    const fresh = res.data.items.filter((it) => new Date(it.created_at) >= cutoff);

    const pool = getPool();
    const signalIds: string[] = [];
    for (const it of fresh) {
      // repository_url = https://api.github.com/repos/<owner>/<name>
      const repo = it.repository_url.split("/repos/")[1] ?? "unknown";
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO signals (external_id, url, repo, author, title, excerpt, query, found_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [
          it.node_id,
          it.html_url,
          repo,
          it.user?.login ?? "ghost",
          it.title,
          (it.body ?? "").slice(0, EXCERPT_MAX),
          query,
          it.created_at,
        ],
      );
      if (inserted.rows[0]) signalIds.push(inserted.rows[0].id);
    }

    return {
      query,
      totalMatches: res.data.total_count,
      fetched: fresh.length,
      inserted: signalIds.length,
      signalIds,
    };
}

export const githubSearchTool = createTool({
  id: "github-search",
  description:
    "Search GitHub issues for a strategy query; insert unseen results into the signals table.",
  inputSchema: z.object({
    query: z.string().min(1).describe("GitHub search query (strategy-supplied)"),
    freshnessHours: z.number().int().positive().default(72),
    perPage: z.number().int().min(1).max(50).default(25),
  }),
  outputSchema: z.object({
    query: z.string(),
    totalMatches: z.number(),
    fetched: z.number(),
    inserted: z.number(),
    signalIds: z.array(z.string()),
  }),
  execute: async (input) => runGithubSearch(input),
});
