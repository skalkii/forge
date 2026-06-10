import { createScorer } from "@mastra/core/evals";
import { z } from "zod";

import { getPool } from "../lib/db";
import { disclosureText } from "../lib/disclosure";
import { SNIPPET_MARKER } from "../lib/reply";

/**
 * Spam-guardrail — the deterministic hard gate (no LLM anywhere).
 * Score is binary: 1 = all checks pass, 0 = any failure; the touch
 * workflow blocks on anything below 1. Checks:
 *   1. disclosure present verbatim (R3 — hard fail)
 *   2. global kill-switch off (settings.kill_switch / KILL_SWITCH env, R6)
 *   3. daily touch cap not exhausted (DAILY_TOUCH_CAP)
 *   4. dedup — never touch the same author or thread twice
 *   5. zero links in the draft (the act step appends the single UTM'd link)
 *   6. exactly one [[SNIPPET]] marker for the compose step
 *
 * Pure checks live in `runGuardrailChecks` with injectable deps so unit
 * tests cover every rule without a database.
 */

export const guardrailInputSchema = z.object({
  candidateId: z.string().nullish(),
  author: z.string().describe("GitHub username of the thread author"),
  threadUrl: z.string().describe("URL of the thread being replied to"),
});

export const guardrailDraftSchema = z.object({
  replyBody: z.string(),
});

export type GuardrailInput = z.infer<typeof guardrailInputSchema>;
export type GuardrailDraft = z.infer<typeof guardrailDraftSchema>;

export interface GuardrailDeps {
  isKillSwitchOn(): Promise<boolean>;
  postedCountToday(): Promise<number>;
  hasPriorTouch(author: string, threadUrl: string, excludeCandidateId?: string | null): Promise<boolean>;
}

export function dailyTouchCap(): number {
  const n = Number(process.env.DAILY_TOUCH_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

export function countLinks(body: string): number {
  return body.match(/https?:\/\//g)?.length ?? 0;
}

export function countMarkers(body: string): number {
  return body.split(SNIPPET_MARKER).length - 1;
}

export interface GuardrailResult {
  failures: string[];
  checks: {
    disclosure: boolean;
    killSwitch: boolean;
    dailyCap: boolean;
    dedup: boolean;
    links: boolean;
    marker: boolean;
  };
}

export async function runGuardrailChecks(
  input: GuardrailInput,
  draft: GuardrailDraft,
  deps: GuardrailDeps,
): Promise<GuardrailResult> {
  const failures: string[] = [];

  const disclosureOk = draft.replyBody.includes(disclosureText());
  if (!disclosureOk) failures.push("missing affiliation disclosure (R3)");

  const killSwitchOn = await deps.isKillSwitchOn();
  if (killSwitchOn) failures.push("global kill-switch is ON (R6)");

  const cap = dailyTouchCap();
  const postedToday = await deps.postedCountToday();
  const capOk = postedToday < cap;
  if (!capOk) failures.push(`daily touch cap reached (${postedToday}/${cap})`);

  const prior = await deps.hasPriorTouch(input.author, input.threadUrl, input.candidateId);
  if (prior) failures.push(`already touched this author or thread (${input.author}, ${input.threadUrl})`);

  const links = countLinks(draft.replyBody);
  const linksOk = links === 0;
  if (!linksOk) failures.push(`draft contains ${links} link(s) — links are added deterministically at act`);

  const markers = countMarkers(draft.replyBody);
  const markerOk = markers === 1;
  if (!markerOk) failures.push(`expected exactly one ${SNIPPET_MARKER} marker, found ${markers}`);

  return {
    failures,
    checks: {
      disclosure: disclosureOk,
      killSwitch: !killSwitchOn,
      dailyCap: capOk,
      dedup: !prior,
      links: linksOk,
      marker: markerOk,
    },
  };
}

/** Production deps — settings table + touches/candidates/signals join. */
export const dbGuardrailDeps: GuardrailDeps = {
  async isKillSwitchOn() {
    if (process.env.KILL_SWITCH === "true") return true;
    const { rows } = await getPool().query(
      `SELECT value FROM settings WHERE key = 'kill_switch'`,
    );
    return rows[0]?.value === true;
  },
  async postedCountToday() {
    const { rows } = await getPool().query(
      `SELECT count(*)::int AS n FROM touches WHERE posted_at >= date_trunc('day', now())`,
    );
    return rows[0]?.n ?? 0;
  },
  async hasPriorTouch(author, threadUrl, excludeCandidateId) {
    const { rows } = await getPool().query(
      `SELECT 1
         FROM touches t
         JOIN candidates c ON c.id = t.candidate_id
         JOIN signals s ON s.id = c.signal_id
        WHERE t.decision IS DISTINCT FROM 'rejected'
          AND (s.author = $1 OR s.url = $2)
          AND ($3::uuid IS NULL OR c.id <> $3::uuid)
        LIMIT 1`,
      [author, threadUrl, excludeCandidateId ?? null],
    );
    return rows.length > 0;
  },
};

export const spamGuardrailScorer = createScorer({
  id: "spam-guardrail",
  description:
    "Deterministic hard gate: disclosure (R3), kill-switch (R6), daily cap, author/thread dedup, zero links, one snippet marker. Binary score.",
  type: { input: guardrailInputSchema, output: guardrailDraftSchema },
})
  .analyze(async ({ run }) => runGuardrailChecks(run.input!, run.output, dbGuardrailDeps))
  .generateScore(({ results }) => (results.analyzeStepResult.failures.length === 0 ? 1 : 0))
  .generateReason(({ results, score }) => {
    const r = results.analyzeStepResult;
    return score === 1 ? "all guardrail checks passed" : `BLOCKED: ${r.failures.join(" | ")}`;
  });
