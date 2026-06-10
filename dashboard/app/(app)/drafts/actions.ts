"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

// The dashboard never writes the decision itself — the human-gate step
// persists decision + final_body + audit row on resume (single writer).
// This action only validates and calls the Mastra resume API (R6).

const DecisionInput = z.object({
  runId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  decidedBy: z.string().trim().min(1, "reviewer name is required"),
  editedBody: z.string().optional(),
  draftBody: z.string(),
  reason: z
    .string()
    .trim()
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
});

function mastraApiUrl(): string {
  return (process.env.MASTRA_API_URL ?? "http://localhost:4111").replace(/\/$/, "");
}

export async function decideDraft(formData: FormData): Promise<void> {
  const parsed = DecisionInput.parse({
    runId: formData.get("runId"),
    decision: formData.get("decision"),
    decidedBy: formData.get("decidedBy"),
    editedBody: formData.get("editedBody") ?? undefined,
    draftBody: formData.get("draftBody"),
    reason: formData.get("reason") ?? undefined,
  });

  const edited =
    parsed.editedBody !== undefined && parsed.editedBody !== parsed.draftBody
      ? parsed.editedBody
      : undefined;

  const resumeData: Record<string, unknown> = {
    decision: parsed.decision,
    decidedBy: parsed.decidedBy,
  };
  if (parsed.decision === "approved" && edited !== undefined) resumeData.editedBody = edited;
  if (parsed.decision === "rejected" && parsed.reason) resumeData.reason = parsed.reason;

  const res = await fetch(
    `${mastraApiUrl()}/api/workflows/touch/resume?runId=${encodeURIComponent(parsed.runId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "human-gate", resumeData }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // the run stays suspended on failure — retrying from the queue is safe
    throw new Error(`Mastra resume failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  revalidatePath("/drafts");
  revalidatePath("/candidates");
  revalidatePath("/runs");
}
