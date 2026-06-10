/**
 * Retrieval chokepoint — ALL Exa/Parallel calls go through here.
 *
 * Demand-driven enrichment: only shortlisted candidates (post-triage)
 * reach this code, so every call costs real money. Three guarantees:
 *   1. cache — identical requests are served from `retrieval_cache`
 *      (hit rate is shown on the dashboard), zero spend on hits;
 *   2. budget — a daily USD cap across both providers, checked before
 *      every live call; FAILS CLOSED (throws) when the cap is hit;
 *   3. metering — every live call is recorded via the cost-meter
 *      (cost_events + spend-and-efficiency.csv).
 *
 * Per-search cost estimates are env-tunable; Exa's actual costDollars
 * from the response is preferred when present. Verify pricing against
 * the providers before production (OPEN_QUESTIONS / R10).
 */
import { createHash } from "node:crypto";

import Exa from "exa-js";
import Parallel from "parallel-web";

import { recordCost } from "./cost-meter";
import { getPool } from "./db";

export interface RetrievalResult {
  title: string;
  url: string;
  excerpt: string;
}

export class RetrievalDisabledError extends Error {
  constructor(provider: string, envVar: string) {
    super(`${provider} retrieval disabled — ${envVar} is not set`);
    this.name = "RetrievalDisabledError";
  }
}

export class RetrievalBudgetError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly budgetUsd: number,
  ) {
    super(
      `retrieval budget exhausted: $${spentUsd.toFixed(4)} of $${budgetUsd.toFixed(4)} spent today — failing closed`,
    );
    this.name = "RetrievalBudgetError";
  }
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function utcDayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** today's combined exa+parallel spend, straight from cost_events */
async function retrievalSpendToday(): Promise<number> {
  const res = await getPool().query<{ total: string | null }>(
    `SELECT SUM(cost_usd) AS total FROM cost_events
      WHERE at >= $1 AND provider IN ('exa', 'parallel')`,
    [utcDayStart()],
  );
  return Number(res.rows[0]?.total ?? 0);
}

interface CacheHit<T> {
  response: T;
  cached: true;
}

async function cacheLookup<T>(hash: string): Promise<CacheHit<T> | null> {
  const res = await getPool().query<{ response: T }>(
    `UPDATE retrieval_cache
        SET hits = hits + 1, last_used_at = now()
      WHERE request_hash = $1
      RETURNING response`,
    [hash],
  );
  const row = res.rows[0];
  return row ? { response: row.response, cached: true } : null;
}

/**
 * Cache → budget check (fail closed) → live call → meter + cache store.
 * Exported for the research tools and directly testable with a stub fetcher.
 */
export async function withCacheAndBudget<T>(opts: {
  provider: "exa" | "parallel";
  request: Record<string, unknown>;
  candidateId?: string;
  estCostUsd: number;
  fetcher: () => Promise<{ response: T; costUsd?: number }>;
}): Promise<{ response: T; cached: boolean }> {
  const hash = createHash("sha256")
    .update(JSON.stringify({ provider: opts.provider, ...opts.request }))
    .digest("hex");

  const hit = await cacheLookup<T>(hash);
  if (hit) return { response: hit.response, cached: true };

  const budget = envNumber("RETRIEVAL_DAILY_BUDGET_USD", 2);
  const spent = await retrievalSpendToday();
  if (spent + opts.estCostUsd > budget) {
    throw new RetrievalBudgetError(spent, budget);
  }

  const { response, costUsd } = await opts.fetcher();
  const cost = costUsd ?? opts.estCostUsd;

  await recordCost({
    provider: opts.provider,
    kind: opts.provider === "exa" ? "search" : "enrich",
    candidateId: opts.candidateId,
    costUsd: cost,
    meta: { request: opts.request },
  });
  await getPool().query(
    `INSERT INTO retrieval_cache (provider, request_hash, request, response, cost_usd)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (request_hash) DO NOTHING`,
    [opts.provider, hash, JSON.stringify(opts.request), JSON.stringify(response), cost],
  );
  return { response, cached: false };
}

let exaClient: Exa | undefined;
let parallelClient: Parallel | undefined;

function getExa(): Exa {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new RetrievalDisabledError("exa", "EXA_API_KEY");
  exaClient ??= new Exa(key);
  return exaClient;
}

function getParallel(): Parallel {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) throw new RetrievalDisabledError("parallel", "PARALLEL_API_KEY");
  parallelClient ??= new Parallel({ apiKey: key });
  return parallelClient;
}

const EXCERPT_CHARS = 1500;

export async function exaSearch(
  query: string,
  opts: { numResults?: number; candidateId?: string } = {},
): Promise<{ results: RetrievalResult[]; cached: boolean }> {
  const numResults = opts.numResults ?? 5;
  const exa = getExa();
  const { response, cached } = await withCacheAndBudget<RetrievalResult[]>({
    provider: "exa",
    request: { query, numResults },
    candidateId: opts.candidateId,
    estCostUsd: envNumber("EXA_COST_PER_SEARCH_USD", 0.005),
    fetcher: async () => {
      const res = await exa.search(query, {
        numResults,
        contents: { text: { maxCharacters: EXCERPT_CHARS } },
      });
      const results = res.results.map((r) => ({
        title: r.title ?? r.url,
        url: r.url,
        excerpt: (r as { text?: string }).text?.slice(0, EXCERPT_CHARS) ?? "",
      }));
      const actual = (res as { costDollars?: { total?: number } }).costDollars?.total;
      return { response: results, costUsd: actual };
    },
  });
  return { results: response, cached };
}

export async function parallelSearch(opts: {
  /** 2-3 concise keyword queries, 3-6 words each (SDK requirement) */
  searchQueries: string[];
  objective?: string;
  maxResults?: number;
  candidateId?: string;
}): Promise<{ results: RetrievalResult[]; cached: boolean }> {
  const maxResults = opts.maxResults ?? 5;
  const client = getParallel();
  const request: Record<string, unknown> = {
    search_queries: opts.searchQueries,
    objective: opts.objective,
    max_results: maxResults,
  };
  const { response, cached } = await withCacheAndBudget<RetrievalResult[]>({
    provider: "parallel",
    request,
    candidateId: opts.candidateId,
    estCostUsd: envNumber("PARALLEL_COST_PER_SEARCH_USD", 0.005),
    fetcher: async () => {
      const res = await client.search({
        search_queries: opts.searchQueries,
        objective: opts.objective,
        mode: "basic", // low latency/cost — enrichment doesn't need deep retrieval
        max_chars_total: EXCERPT_CHARS * maxResults,
      });
      const results = (res.results ?? []).slice(0, maxResults).map((r) => ({
        title: r.title ?? r.url,
        url: r.url,
        excerpt: (r.excerpts ?? []).join(" … ").slice(0, EXCERPT_CHARS),
      }));
      return { response: results };
    },
  });
  return { results: response, cached };
}
