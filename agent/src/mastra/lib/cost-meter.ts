/**
 * Cost meter — single chokepoint for paid-call telemetry.
 *
 * Every paid API call (LLM, embedding, search, enrich) records a row in
 * `cost_events` (NOTIFY trigger pushes it live to the dashboard) and
 * appends a line to `submission/spend-and-efficiency.csv` (a Forge
 * deliverable). The DB insert is strict — spend caps are enforced by
 * reading this table, so an undercount is worse than a loud failure.
 * The CSV append is best-effort.
 */
import { statSync } from "node:fs";
import { appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { getPool } from "./db";

export type CostKind = "llm" | "embedding" | "search" | "enrich";

export interface CostEventInput {
  provider: string;
  kind: CostKind;
  candidateId?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd: number;
  meta?: Record<string, unknown>;
}

const CSV_HEADER = "at,provider,kind,candidate_id,tokens_in,tokens_out,cost_usd\n";

/** walk up from cwd to the workspace root (mastra dev runs with cwd=agent/) */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      statSync(path.join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return process.cwd();
}

function csvPath(): string {
  return (
    process.env.SPEND_CSV_PATH ??
    path.join(findRepoRoot(), "submission", "spend-and-efficiency.csv")
  );
}

async function appendCsv(event: CostEventInput, at: Date): Promise<void> {
  const file = csvPath();
  await mkdir(path.dirname(file), { recursive: true });
  const exists = await stat(file).then(
    () => true,
    () => false,
  );
  const line = [
    at.toISOString(),
    event.provider,
    event.kind,
    event.candidateId ?? "",
    event.tokensIn ?? "",
    event.tokensOut ?? "",
    event.costUsd.toFixed(6),
  ].join(",");
  await appendFile(file, (exists ? "" : CSV_HEADER) + line + "\n");
}

export async function recordCost(event: CostEventInput): Promise<void> {
  const at = new Date();
  await getPool().query(
    `INSERT INTO cost_events (provider, kind, candidate_id, tokens_in, tokens_out, cost_usd, meta, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.provider,
      event.kind,
      event.candidateId ?? null,
      event.tokensIn ?? null,
      event.tokensOut ?? null,
      event.costUsd,
      event.meta ? JSON.stringify(event.meta) : null,
      at,
    ],
  );
  try {
    await appendCsv(event, at);
  } catch (err) {
    console.warn(`[cost-meter] csv append failed: ${(err as Error).message}`);
  }
}

/** total spend since a timestamp — backs daily caps and the retrieval budget */
export async function spendSince(since: Date, provider?: string): Promise<number> {
  const params: unknown[] = [since];
  let where = "at >= $1";
  if (provider) {
    params.push(provider);
    where += ` AND provider = $${params.length}`;
  }
  const res = await getPool().query<{ total: string | null }>(
    `SELECT SUM(cost_usd) AS total FROM cost_events WHERE ${where}`,
    params,
  );
  return Number(res.rows[0]?.total ?? 0);
}
