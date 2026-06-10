import { getPool } from "./db";

/**
 * Best-effort error sink behind the dashboard /errors panel. Never throws —
 * recording a failure must not mask or replace the original failure path.
 */
export async function recordError(
  source: string,
  err: unknown,
  context?: { candidateId?: string; runId?: string } & Record<string, unknown>,
): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  const { candidateId, runId, ...rest } = context ?? {};
  try {
    await getPool().query(
      `INSERT INTO errors (source, message, stack, candidate_id, run_id, context)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        source,
        e.message,
        e.stack ?? null,
        candidateId ?? null,
        runId ?? null,
        Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
      ],
    );
  } catch (insertErr) {
    console.warn(`[errors] failed to record '${source}': ${(insertErr as Error).message}`);
  }
}
