import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { buildCraftPrompt, craftAgent, craftOutputSchema } from "../agents/craft-agent";
import { buildQualifyPrompt, qualifyAgent, qualifyOutputSchema } from "../agents/qualify-agent";
import { getPool } from "../lib/db";
import { disclosureText } from "../lib/disclosure";
import { generateStructured } from "../lib/generate";
import { composeReply } from "../lib/reply";
import { spamGuardrailScorer } from "../scorers/spam-guardrail";
import { touchQualityScorer } from "../scorers/touch-quality";
import { getActiveStrategy } from "../strategy";
import { postGithubComment } from "../tools/operate/github-comment";
import { renderSnippet, SnippetRenderError } from "../../snippets/render";

/**
 * Touch (R1) — ONE RUN PER CANDIDATE, exactly one suspend (the human
 * gate), so an approval pending on candidate A never blocks candidate B.
 *
 * load → qualify → craft → scorers → humanGate(suspend) → act
 *
 * One accumulating state object flows through every step; a step whose
 * input is no longer `running` passes it through untouched — that keeps
 * the chain linear (no branch() plumbing) while drop/block/reject paths
 * still produce a complete workflow result for the runs board.
 *
 * Posting happens ONLY in the deterministic act step, after resume with
 * an approved decision, via the operate tool's own defense-in-depth
 * gates (TOUCHES_ENABLED, disclosure, kill-switch, human PAT).
 */

export function qualifyThreshold(): number {
  const n = Number(process.env.QUALIFY_THRESHOLD);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.7;
}

const scorerResultSchema = z.object({ score: z.number(), reason: z.string() });

const touchStateSchema = z.object({
  candidateId: z.string(),
  status: z.enum(["running", "dropped", "blocked", "rejected", "approved", "posted", "failed"]),
  reason: z.string().optional(),
  signal: z
    .object({
      title: z.string(),
      excerpt: z.string(),
      repo: z.string(),
      url: z.string(),
      author: z.string(),
    })
    .optional(),
  triageReason: z.string().nullish(),
  fit: z.number().optional(),
  capability: z.string().optional(),
  qualifyReasons: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  replyBodyRaw: z.string().optional(),
  snippetCode: z.string().optional(),
  draftBody: z.string().optional(),
  touchId: z.string().optional(),
  guardrail: scorerResultSchema.optional(),
  quality: scorerResultSchema.nullish(),
  finalBody: z.string().optional(),
  decidedBy: z.string().optional(),
  postedUrl: z.string().optional(),
});

export type TouchState = z.infer<typeof touchStateSchema>;

async function setCandidateStatus(candidateId: string, status: string): Promise<void> {
  await getPool().query(`UPDATE candidates SET status = $2, updated_at = now() WHERE id = $1`, [
    candidateId,
    status,
  ]);
}

const loadStep = createStep({
  id: "load",
  inputSchema: z.object({ candidateId: z.string() }),
  outputSchema: touchStateSchema,
  execute: async ({ inputData, runId }) => {
    const { candidateId } = inputData;
    // atomic claim: only one run can flip queued → qualifying, so two
    // concurrent dispatches can never double-process the same candidate
    const { rows } = await getPool().query<{
      triage_reason: string | null;
      title: string;
      excerpt: string;
      repo: string;
      url: string;
      author: string;
    }>(
      `UPDATE candidates c
          SET status = 'qualifying', run_id = $2, updated_at = now()
         FROM signals s
        WHERE c.id = $1 AND c.status = 'queued' AND s.id = c.signal_id
        RETURNING c.triage_reason, s.title, s.excerpt, s.repo, s.url, s.author`,
      [candidateId, runId],
    );
    const row = rows[0];
    if (!row) {
      const { rows: existing } = await getPool().query<{ status: string }>(
        `SELECT status FROM candidates WHERE id = $1`,
        [candidateId],
      );
      return {
        candidateId,
        status: "failed" as const,
        reason: existing[0]
          ? `candidate is '${existing[0].status}', expected 'queued' — refusing to double-process`
          : `candidate not found: ${candidateId}`,
      };
    }
    return {
      candidateId,
      status: "running" as const,
      signal: { title: row.title, excerpt: row.excerpt, repo: row.repo, url: row.url, author: row.author },
      triageReason: row.triage_reason,
    };
  },
});

const qualifyStep = createStep({
  id: "qualify",
  inputSchema: touchStateSchema,
  outputSchema: touchStateSchema,
  execute: async ({ inputData }) => {
    if (inputData.status !== "running") return inputData;
    const { candidateId, signal } = inputData;

    const verdict = await generateStructured(
      qualifyAgent,
      buildQualifyPrompt({ ...signal!, triageReason: inputData.triageReason, candidateId }),
      qualifyOutputSchema,
      { candidateId, kind: "qualify" },
    );

    const pass = verdict.fit >= qualifyThreshold() && verdict.capability !== "none";
    await getPool().query(
      `UPDATE candidates
          SET fit_score = $2, capability = $3, qualify_reasons = $4,
              status = $5, updated_at = now()
        WHERE id = $1`,
      [
        candidateId,
        verdict.fit,
        verdict.capability,
        JSON.stringify(verdict.reasons),
        pass ? "crafting" : "dropped",
      ],
    );

    if (!pass) {
      return {
        ...inputData,
        status: "dropped" as const,
        fit: verdict.fit,
        capability: verdict.capability,
        qualifyReasons: verdict.reasons,
        reason:
          verdict.capability === "none"
            ? `no snippet capability fits (R2 — no improvised code): ${verdict.reasons[0]}`
            : `fit ${verdict.fit.toFixed(2)} below threshold ${qualifyThreshold()}`,
      };
    }
    return {
      ...inputData,
      fit: verdict.fit,
      capability: verdict.capability,
      qualifyReasons: verdict.reasons,
    };
  },
});

const CRAFT_RENDER_ATTEMPTS = 2;

const craftStep = createStep({
  id: "craft",
  inputSchema: touchStateSchema,
  outputSchema: touchStateSchema,
  execute: async ({ inputData }) => {
    if (inputData.status !== "running") return inputData;
    const { candidateId, signal } = inputData;

    const basePrompt = buildCraftPrompt({
      ...signal!,
      capability: inputData.capability!,
      qualifyReasons: inputData.qualifyReasons,
    });

    let lastRenderError: string | null = null;
    for (let attempt = 1; attempt <= CRAFT_RENDER_ATTEMPTS; attempt++) {
      const prompt = lastRenderError
        ? `${basePrompt}\n\nYour previous draft failed template validation: ${lastRenderError}\nFix templateId/params and redraft.`
        : basePrompt;
      const draft = await generateStructured(craftAgent, prompt, craftOutputSchema, {
        candidateId,
        kind: "craft",
      });
      try {
        // R2: select-and-fill only — render validates params Zod-strict
        const { code } = renderSnippet(draft.templateId, draft.params);
        return {
          ...inputData,
          templateId: draft.templateId,
          replyBodyRaw: draft.replyBody,
          snippetCode: code,
        };
      } catch (err) {
        if (!(err instanceof SnippetRenderError)) throw err;
        lastRenderError = err.message;
      }
    }

    await setCandidateStatus(candidateId, "failed");
    return {
      ...inputData,
      status: "failed" as const,
      reason: `craft output failed template validation after ${CRAFT_RENDER_ATTEMPTS} attempts: ${lastRenderError}`,
    };
  },
});

const scorersStep = createStep({
  id: "scorers",
  inputSchema: touchStateSchema,
  outputSchema: touchStateSchema,
  execute: async ({ inputData }) => {
    if (inputData.status !== "running") return inputData;
    const { candidateId, signal, replyBodyRaw } = inputData;

    // hard gate on the RAW draft — the marker/zero-link checks only make
    // sense before the snippet (and later the UTM link) are spliced in
    const guardrail = await spamGuardrailScorer.run({
      input: { candidateId, author: signal!.author, threadUrl: signal!.url },
      output: { replyBody: replyBodyRaw! },
    });
    const guardrailResult = { score: guardrail.score, reason: guardrail.reason ?? "" };

    if (guardrail.score !== 1) {
      await setCandidateStatus(candidateId, "failed");
      return {
        ...inputData,
        status: "blocked" as const,
        guardrail: guardrailResult,
        reason: `spam-guardrail blocked the draft: ${guardrailResult.reason}`,
      };
    }

    const draftBody = composeReply(replyBodyRaw!, inputData.snippetCode!);

    // advisory judge — shown to the reviewer; never blocks on judge failure
    let quality: { score: number; reason: string } | null = null;
    try {
      const q = await touchQualityScorer.run({
        input: {
          title: signal!.title,
          excerpt: signal!.excerpt,
          url: signal!.url,
          capability: inputData.capability!,
        },
        output: { replyBody: draftBody, templateId: inputData.templateId! },
      });
      quality = { score: q.score, reason: q.reason ?? "" };
    } catch (err) {
      console.warn(`[touch ${candidateId}] touch-quality judge failed: ${(err as Error).message}`);
    }

    const inserted = await getPool().query<{ id: string }>(
      `INSERT INTO touches (candidate_id, template_id, draft_body, disclosure_ok)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [candidateId, inputData.templateId, draftBody],
    );
    await setCandidateStatus(candidateId, "review");

    return {
      ...inputData,
      draftBody,
      touchId: inserted.rows[0].id,
      guardrail: guardrailResult,
      quality,
    };
  },
});

export const gateResumeSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  editedBody: z.string().optional(),
  decidedBy: z.string(),
  reason: z.string().optional(),
});

const gateSuspendSchema = z.object({
  touchId: z.string(),
  threadUrl: z.string(),
  preview: z.string(),
  disclosure: z.string(),
  scorerResults: z.object({
    guardrail: scorerResultSchema,
    quality: scorerResultSchema.nullish(),
  }),
});

const humanGateStep = createStep({
  id: "human-gate",
  inputSchema: touchStateSchema,
  outputSchema: touchStateSchema,
  suspendSchema: gateSuspendSchema,
  resumeSchema: gateResumeSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.status !== "running") return inputData;
    const { candidateId, touchId } = inputData;

    if (resumeData?.decision === "rejected") {
      await getPool().query(
        `UPDATE touches SET decision = 'rejected', decided_by = $2, decided_at = now() WHERE id = $1`,
        [touchId, resumeData.decidedBy],
      );
      await setCandidateStatus(candidateId, "rejected");
      await getPool().query(
        `INSERT INTO audit_log (actor, action, subject_table, subject_id, detail)
         VALUES ($1, 'touch.rejected', 'touches', $2, $3)`,
        [resumeData.decidedBy, touchId, JSON.stringify({ reason: resumeData.reason ?? null })],
      );
      return {
        ...inputData,
        status: "rejected" as const,
        decidedBy: resumeData.decidedBy,
        reason: resumeData.reason ?? "reviewer rejected",
      };
    }

    if (resumeData?.decision === "approved") {
      const finalBody = resumeData.editedBody ?? inputData.draftBody!;
      // R6: the edited body is persisted as part of the decision
      await getPool().query(
        `UPDATE touches
            SET decision = 'approved', decided_by = $2, decided_at = now(), final_body = $3
          WHERE id = $1`,
        [touchId, resumeData.decidedBy, finalBody],
      );
      await setCandidateStatus(candidateId, "approved");
      await getPool().query(
        `INSERT INTO audit_log (actor, action, subject_table, subject_id, detail)
         VALUES ($1, 'touch.approved', 'touches', $2, $3)`,
        [resumeData.decidedBy, touchId, JSON.stringify({ edited: resumeData.editedBody != null })],
      );
      return { ...inputData, finalBody, decidedBy: resumeData.decidedBy };
    }

    return await suspend({
      touchId: touchId!,
      threadUrl: inputData.signal!.url,
      preview: inputData.draftBody!,
      disclosure: disclosureText(),
      scorerResults: { guardrail: inputData.guardrail!, quality: inputData.quality },
    });
  },
});

function buildUtmLink(touchId: string): string {
  const { utmSource, utmMedium } = getActiveStrategy().attributionMap;
  const url = new URL(process.env.UTM_BASE_URL || "https://docs.videodb.io/");
  url.searchParams.set("utm_source", utmSource);
  url.searchParams.set("utm_medium", utmMedium);
  url.searchParams.set("utm_campaign", touchId);
  return `Docs: ${url.toString()}`;
}

const actStep = createStep({
  id: "act",
  inputSchema: touchStateSchema,
  outputSchema: touchStateSchema,
  execute: async ({ inputData }) => {
    if (inputData.status !== "running") return inputData;
    const { candidateId, touchId, signal, finalBody } = inputData;

    if (process.env.TOUCHES_ENABLED !== "true") {
      // read-only soak: candidate stays approved, nothing is posted
      return {
        ...inputData,
        status: "approved" as const,
        reason: "TOUCHES_ENABLED is not 'true' — approved but not posted",
      };
    }

    const body = `${finalBody}\n\n${buildUtmLink(touchId!)}`;
    try {
      const { commentUrl } = await postGithubComment({ threadUrl: signal!.url, body });
      await getPool().query(
        `UPDATE touches SET posted_at = now(), posted_url = $2, final_body = $3 WHERE id = $1`,
        [touchId, commentUrl, body],
      );
      await setCandidateStatus(candidateId, "posted");
      return { ...inputData, status: "posted" as const, finalBody: body, postedUrl: commentUrl };
    } catch (err) {
      await setCandidateStatus(candidateId, "failed");
      return {
        ...inputData,
        status: "failed" as const,
        reason: `posting failed after approval: ${(err as Error).message}`,
      };
    }
  },
});

export const touchWorkflow = createWorkflow({
  id: "touch",
  inputSchema: z.object({ candidateId: z.string() }),
  outputSchema: touchStateSchema,
})
  .then(loadStep)
  .then(qualifyStep)
  .then(craftStep)
  .then(scorersStep)
  .then(humanGateStep)
  .then(actStep)
  .commit();
