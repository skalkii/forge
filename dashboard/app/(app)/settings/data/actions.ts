"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPool } from "@/lib/db";

// Third documented dashboard DB write (after kill-switch and re-queue):
// the R7 deletion path. Mirrors agent/scripts/forget-user.ts — count, delete
// (signals cascade through candidates → touches → outcomes), audit-log with
// the actor's name.
const ForgetInput = z.object({
  username: z.string().trim().min(1),
  actor: z.string().trim().min(1),
});

export async function forgetUserAction(formData: FormData): Promise<void> {
  const { username, actor } = ForgetInput.parse({
    username: formData.get("username"),
    actor: formData.get("actor"),
  });

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

  revalidatePath("/settings/data");
}
