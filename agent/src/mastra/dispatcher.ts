import { getPool } from "./lib/db";
import { recordError } from "./lib/errors";
import { mastra } from "./index";
import { dbGuardrailDeps } from "./scorers/spam-guardrail";

/**
 * Dispatcher (R1) — bridges discovery and touch: polls `candidates` for
 * queued rows and starts ONE touch-workflow run per candidate, capped at
 * MAX_CONCURRENT_TOUCHES open runs. Suspended runs (status 'review')
 * count against the cap — a stalled review queue should stop new spend,
 * not pile up stale drafts.
 *
 * Deterministic code only; no LLM here. The touch-workflow's load step
 * re-checks status='queued', so a concurrent double dispatch cannot
 * double-process a candidate.
 */

export function maxConcurrentTouches(): number {
  const n = Number(process.env.MAX_CONCURRENT_TOUCHES);
  return Number.isInteger(n) && n > 0 ? n : 10;
}

const OPEN_STATUSES = ["enriching", "qualifying", "crafting", "review"];

export interface DispatchedRun {
  candidateId: string;
  runId: string;
  runStatus: string;
  touchStatus?: string;
  reason?: string;
}

export interface DispatchResult {
  queued: number;
  open: number;
  capacity: number;
  started: DispatchedRun[];
  skipped: string | null;
}

export async function dispatchOnce(): Promise<DispatchResult> {
  const pool = getPool();
  const cap = maxConcurrentTouches();

  const { rows: openRows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM candidates WHERE status = ANY($1)`,
    [OPEN_STATUSES],
  );
  const open = openRows[0]?.n ?? 0;

  const { rows: queuedRows } = await pool.query<{ id: string }>(
    `SELECT id FROM candidates WHERE status = 'queued' ORDER BY created_at ASC`,
  );

  const base = { queued: queuedRows.length, open, capacity: Math.max(0, cap - open) };

  if (base.queued === 0) return { ...base, started: [], skipped: "no queued candidates" };
  if (await dbGuardrailDeps.isKillSwitchOn()) {
    return {
      ...base,
      started: [],
      skipped: "kill-switch is ON (R6) — not spending on new touches",
    };
  }
  if (base.capacity === 0) {
    return {
      ...base,
      started: [],
      skipped: `concurrency cap reached (${open}/${cap} open runs)`,
    };
  }

  const batch = queuedRows.slice(0, base.capacity).map((r) => r.id);
  const wf = mastra.getWorkflow("touch");

  const started = await Promise.all(
    batch.map(async (candidateId): Promise<DispatchedRun> => {
      const run = await wf.createRun();
      try {
        // resolves when the run suspends at the human gate or terminates
        const result = await run.start({ inputData: { candidateId } });
        const touch =
          result.status === "success"
            ? (result.result as { status?: string; reason?: string })
            : undefined;
        return {
          candidateId,
          runId: run.runId,
          runStatus: result.status,
          touchStatus: touch?.status,
          reason: touch?.reason,
        };
      } catch (err) {
        await recordError("dispatcher.run", err, { candidateId, runId: run.runId });
        return { candidateId, runId: run.runId, runStatus: "error", reason: (err as Error).message };
      }
    }),
  );

  return { ...base, started, skipped: null };
}
