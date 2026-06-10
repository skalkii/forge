"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPool } from "@/lib/db";

// Like the kill-switch, this is an ops write, not workflow state: a failed
// touch run is terminal in Mastra, so retry = put the candidate back in the
// queue and let the dispatcher start a fresh run. Audit-logged with the
// actor's name.

const RequeueInput = z.object({
  candidateId: z.string().uuid(),
  actor: z.string().trim().min(1),
});

export async function requeueCandidate(formData: FormData): Promise<void> {
  const { candidateId, actor } = RequeueInput.parse({
    candidateId: formData.get("candidateId"),
    actor: formData.get("actor"),
  });

  // status guard: only failed candidates can be re-queued — never restart
  // one that is mid-run, in review, or already decided
  const res = await getPool().query(
    `UPDATE candidates SET status = 'queued', run_id = NULL
      WHERE id = $1 AND status = 'failed'
      RETURNING id`,
    [candidateId],
  );
  if (res.rowCount === 1) {
    await getPool().query(
      `INSERT INTO audit_log (actor, action, subject_table, subject_id)
       VALUES ($1, 'candidate.requeued', 'candidates', $2)`,
      [actor, candidateId],
    );
  }

  revalidatePath("/errors");
  revalidatePath("/candidates");
  revalidatePath("/runs");
}
