import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { triageAgent, triageOutputSchema, buildTriagePrompt } from "../agents/triage-agent";
import { getPool } from "../lib/db";
import { dedupSignals } from "../lib/dedup";
import { generateStructured } from "../lib/generate";
import { BudgetExhaustedError, RetryAfterError } from "../lib/github-client";
import { getActiveStrategy } from "../strategy";
import { runGithubSearch } from "../tools/browse/github-search";

/**
 * Discovery (R1) — cron-triggered, NEVER suspends.
 * search (one GitHub query per strategy target) → pgvector dedup →
 * triage (cheap agent) → enqueue/drop. Writes `candidates` rows; the
 * dispatcher starts one touch-workflow per queued candidate.
 *
 * Every triaged signal gets a candidate row (status queued or dropped)
 * so it is never re-triaged and the dashboard sees the drop path.
 * Near-duplicates (dup_of set) are skipped entirely — the canonical
 * signal carries the cluster.
 */

export function triageThreshold(): number {
  const n = Number(process.env.TRIAGE_THRESHOLD);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.6;
}

/** per-run cap so one discovery run can't burn the whole day's cheap-model budget */
const TRIAGE_BATCH_LIMIT = 25;

const searchOutputSchema = z.object({
  queries: z.number(),
  fetched: z.number(),
  inserted: z.number(),
  searchErrors: z.array(z.string()),
});

const dedupOutputSchema = searchOutputSchema.extend({
  embedded: z.number(),
  duplicates: z.number(),
});

const discoveryOutputSchema = dedupOutputSchema.extend({
  triaged: z.number(),
  enqueued: z.number(),
  dropped: z.number(),
  triageErrors: z.array(z.string()),
});

const searchStep = createStep({
  id: "search",
  inputSchema: z.object({}),
  outputSchema: searchOutputSchema,
  execute: async () => {
    const strategy = getActiveStrategy();
    const { queries, freshnessHours } = strategy.targets;
    let fetched = 0;
    let inserted = 0;
    const searchErrors: string[] = [];

    for (const query of queries) {
      try {
        const res = await runGithubSearch({ query, freshnessHours });
        fetched += res.fetched;
        inserted += res.inserted;
      } catch (err) {
        searchErrors.push(`${query}: ${(err as Error).message}`);
        // search budget is one shared pool (R4) — once it's gone, stop
        if (err instanceof BudgetExhaustedError || err instanceof RetryAfterError) break;
      }
    }

    return { queries: queries.length, fetched, inserted, searchErrors };
  },
});

const dedupStep = createStep({
  id: "dedup",
  inputSchema: searchOutputSchema,
  outputSchema: dedupOutputSchema,
  execute: async ({ inputData }) => {
    const { embedded, duplicates } = await dedupSignals();
    return { ...inputData, embedded, duplicates };
  },
});

const triageStep = createStep({
  id: "triage",
  inputSchema: dedupOutputSchema,
  outputSchema: discoveryOutputSchema,
  execute: async ({ inputData }) => {
    const pool = getPool();
    const pending = await pool.query<{
      id: string;
      title: string;
      excerpt: string;
      repo: string;
      url: string;
    }>(
      `SELECT s.id, s.title, s.excerpt, s.repo, s.url
         FROM signals s
         LEFT JOIN candidates c ON c.signal_id = s.id
        WHERE c.id IS NULL AND s.dup_of IS NULL AND s.embedding IS NOT NULL
        ORDER BY s.created_at
        LIMIT $1`,
      [TRIAGE_BATCH_LIMIT],
    );

    const threshold = triageThreshold();
    let enqueued = 0;
    let dropped = 0;
    const triageErrors: string[] = [];

    for (const signal of pending.rows) {
      try {
        const verdict = await generateStructured(
          triageAgent,
          buildTriagePrompt(signal),
          triageOutputSchema,
          { kind: "triage" },
        );
        const pass = verdict.score >= threshold;
        await pool.query(
          `INSERT INTO candidates (signal_id, status, triage_score, triage_reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (signal_id) DO NOTHING`,
          [signal.id, pass ? "queued" : "dropped", verdict.score, verdict.reason],
        );
        if (pass) enqueued++;
        else dropped++;
      } catch (err) {
        // signal stays untriaged — next discovery run retries it
        triageErrors.push(`${signal.url}: ${(err as Error).message}`);
      }
    }

    return { ...inputData, triaged: enqueued + dropped, enqueued, dropped, triageErrors };
  },
});

export const discoveryWorkflow = createWorkflow({
  id: "discovery",
  inputSchema: z.object({}),
  outputSchema: discoveryOutputSchema,
})
  .then(searchStep)
  .then(dedupStep)
  .then(triageStep)
  .commit();
