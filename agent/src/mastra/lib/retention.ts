import { getPool } from "./db";

/**
 * R7 — data minimization. Two deletion paths:
 *  - purgeOnce(): nightly cron, drops raw signals past SIGNAL_RETENTION_DAYS
 *    that never became candidates. Qualified signals stay — deleting them
 *    would cascade through candidates → touches → outcomes and erase the
 *    attribution record.
 *  - forgetUser(): deletes everything for one GitHub username. Cascade does
 *    the rest (signals → candidates → touches → outcomes).
 * Both write an audit_log row.
 */

const DEFAULT_RETENTION_DAYS = 90;

export function retentionDays(): number {
  const n = Number(process.env.SIGNAL_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RETENTION_DAYS;
}

export interface PurgeResult {
  retentionDays: number;
  purged: number;
}

export async function purgeOnce(actor = "cron"): Promise<PurgeResult> {
  const pool = getPool();
  const days = retentionDays();
  const res = await pool.query(
    `DELETE FROM signals
      WHERE created_at < now() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.signal_id = signals.id)`,
    [days],
  );
  const purged = res.rowCount ?? 0;
  if (purged > 0) {
    await pool.query(
      `INSERT INTO audit_log (actor, action, subject_table, detail)
       VALUES ($1, 'signals.purged', 'signals', $2)`,
      [actor, JSON.stringify({ purged, retentionDays: days })],
    );
  }
  return { retentionDays: days, purged };
}

export interface ForgetResult {
  username: string;
  signals: number;
  candidates: number;
  touches: number;
}

export async function forgetUser(username: string, actor = "script"): Promise<ForgetResult> {
  const pool = getPool();
  const { rows } = await pool.query<{ signals: string; candidates: string; touches: string }>(
    `SELECT COUNT(DISTINCT s.id) AS signals,
            COUNT(DISTINCT c.id) AS candidates,
            COUNT(DISTINCT t.id) AS touches
       FROM signals s
       LEFT JOIN candidates c ON c.signal_id = s.id
       LEFT JOIN touches t ON t.candidate_id = c.id
      WHERE s.author = $1`,
    [username],
  );
  const counts = rows[0]!;
  await pool.query(`DELETE FROM signals WHERE author = $1`, [username]);
  await pool.query(
    `INSERT INTO audit_log (actor, action, subject_table, subject_id, detail)
     VALUES ($1, 'user.forgotten', 'signals', $2, $3)`,
    [
      actor,
      username,
      JSON.stringify({
        signals: Number(counts.signals),
        candidates: Number(counts.candidates),
        touches: Number(counts.touches),
      }),
    ],
  );
  return {
    username,
    signals: Number(counts.signals),
    candidates: Number(counts.candidates),
    touches: Number(counts.touches),
  };
}
