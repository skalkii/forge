import { Inbox } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { DraftBody } from "@/components/draft-body";
import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { ReviewButtons } from "@/components/review-buttons";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
import { query, queryOne } from "@/lib/db";

import { decideDraft } from "./actions";

export const dynamic = "force-dynamic";

const ScorerResult = z.object({ score: z.number(), reason: z.string() }).nullable();

const DraftRow = z.object({
  touch_id: z.string(),
  template_id: z.string().nullable(),
  variant: z.string().nullable(),
  draft_body: z.string(),
  disclosure_ok: z.boolean().nullable(),
  touch_created_at: z.coerce.date(),
  candidate_id: z.string(),
  run_id: z.string().nullable(),
  fit_score: z.number().nullable(),
  capability: z.string().nullable(),
  qualify_reasons: z.array(z.string()).nullable(),
  title: z.string(),
  excerpt: z.string(),
  repo: z.string(),
  author: z.string(),
  url: z.string(),
  guardrail: ScorerResult,
  quality: ScorerResult,
});

const CapRow = z.object({ posted_today: z.coerce.number() });

async function loadDrafts() {
  // a draft is reviewable when its run is suspended at the human gate:
  // candidate sits in 'review' and the touch has no decision yet
  return query(
    DraftRow,
    `SELECT t.id AS touch_id, t.template_id, t.variant, t.draft_body,
            t.disclosure_ok, t.created_at AS touch_created_at,
            c.id::text AS candidate_id, c.run_id, c.fit_score, c.capability,
            c.qualify_reasons,
            s.title, s.excerpt, s.repo, s.author, s.url,
            m.snapshot->'context'->'scorers'->'output'->'guardrail' AS guardrail,
            m.snapshot->'context'->'scorers'->'output'->'quality' AS quality
       FROM touches t
       JOIN candidates c ON c.id = t.candidate_id
       JOIN signals s ON s.id = c.signal_id
       LEFT JOIN mastra_workflow_snapshot m ON m.run_id = c.run_id
      WHERE t.decision IS NULL
        AND c.status = 'review'
      ORDER BY t.created_at ASC`,
  );
}

async function loadPostedToday() {
  const row = await queryOne(
    CapRow,
    `SELECT count(*)::int AS posted_today
       FROM touches WHERE posted_at >= date_trunc('day', now())`,
  );
  return row?.posted_today ?? 0;
}

function dailyTouchCap(): number {
  const n = Number(process.env.DAILY_TOUCH_CAP);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export default async function DraftsPage() {
  const [drafts, postedToday] = await Promise.all([loadDrafts(), loadPostedToday()]);
  const cap = dailyTouchCap();
  const touchesEnabled = process.env.TOUCHES_ENABLED === "true";

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["touches", "candidates"]} />
      <PageHeader
        title="Drafts"
        stage="gate"
        description="The human gate — the one place a reply can become public, and only if a person says so. Each card below is a finished reply, paused mid-run, waiting for you to approve, edit, or reject it. The affiliation disclosure is highlighted, and the automatic guardrail has already checked it. Nothing here is live on GitHub yet."
        sources={["touches", "candidates", "signals", "mastra_workflow_snapshot"]}
      >
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          what is this?
          <InfoTip term="human-gate" />
        </span>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
            postedToday >= cap
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-card text-muted-foreground"
          }`}
        >
          daily cap: <span className="tabular-nums">{postedToday}/{cap}</span> posted today
          <InfoTip>
            How many replies have gone live today versus the maximum allowed (DAILY_TOUCH_CAP).
            Once the cap is reached, the guardrail hard-blocks every remaining draft until tomorrow.
          </InfoTip>
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
            touchesEnabled
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          posting {touchesEnabled ? "enabled" : "disabled — approvals are recorded but nothing posts"}
          <InfoTip term="kill-switch" />
        </span>
        <span className="rounded-full border bg-card px-2.5 py-1 tabular-nums text-muted-foreground">
          {drafts.length} awaiting review
        </span>
      </div>

      <SectionCard
        title="Review queue"
        term="draft"
        description="Replies finished by the Craft agent and paused at the human gate. Read the original thread, check the highlighted disclosure line and the guardrail scores, edit if needed, then approve or reject. Your decision resumes the paused run."
        aside={<span className="tabular-nums">{drafts.length} pending</span>}
        bodyClassName="p-4"
      >
      {drafts.length === 0 ? (
        <EmptyState icon={Inbox} title="No replies waiting">
          Drafts that pass the spam guardrail appear here for approval. When a touch run reaches the
          human gate it pauses and lands in this queue — nothing about it is public until you
          approve it.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.touch_id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-medium leading-snug hover:underline"
                  >
                    {d.title}
                  </a>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{d.repo}</span>
                    <span>by {d.author}</span>
                    <span className="inline-flex items-center gap-0.5">
                      fit{" "}
                      <span className="tabular-nums">
                        {d.fit_score === null ? "—" : d.fit_score.toFixed(2)}
                      </span>
                      <InfoTip term="fit-score" />
                    </span>
                    {d.capability ? (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">
                        {d.capability}
                      </span>
                    ) : null}
                    {d.template_id ? (
                      <span
                        className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                        title="snippet template (R2 — select-and-fill, never freeform code)"
                      >
                        {d.template_id}
                      </span>
                    ) : null}
                    {d.variant ? <span>variant {d.variant}</span> : null}
                    <RelTime iso={d.touch_created_at.toISOString()} className="tabular-nums" />
                    <Link
                      href={`/candidates/${d.candidate_id}`}
                      className="font-mono underline-offset-2 hover:text-foreground hover:underline"
                    >
                      full journey →
                    </Link>
                  </div>
                </div>
                <JsonModal title={`touches/${d.touch_id.slice(0, 8)}`} data={d} />
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Original thread excerpt
                </summary>
                <p className="mt-1.5 whitespace-pre-wrap border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground">
                  {d.excerpt}
                </p>
              </details>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                    d.guardrail?.score === 1
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  guardrail {d.guardrail?.score === 1 ? "passed" : "FAILED"}
                  {d.guardrail?.score === 1 ? (
                    <InfoTip term="guardrail" />
                  ) : (
                    <InfoTip>{d.guardrail?.reason ?? "Guardrail result missing."}</InfoTip>
                  )}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                    d.quality
                      ? d.quality.score >= 0.7
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  quality{" "}
                  {d.quality ? (
                    <span className="tabular-nums">{d.quality.score.toFixed(2)}</span>
                  ) : (
                    "n/a"
                  )}
                  <InfoTip>
                    {d.quality?.reason ??
                      "An advisory AI judge of how genuinely helpful the reply reads. Guidance only — it never blocks a draft on its own."}
                  </InfoTip>
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    d.disclosure_ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  disclosure {d.disclosure_ok ? "present" : "MISSING"}
                  <InfoTip term="disclosure" />
                </span>
              </div>

              <DraftBody body={d.draft_body} />

              {d.run_id ? (
                <form action={decideDraft} className="space-y-3 rounded-md border bg-background p-3">
                  <input type="hidden" name="runId" value={d.run_id} />
                  <input type="hidden" name="draftBody" value={d.draft_body} />
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Edit before approving (your edit is what gets posted)
                    </summary>
                    <textarea
                      name="editedBody"
                      defaultValue={d.draft_body}
                      rows={10}
                      className="mt-2 w-full rounded-md border bg-card p-2 font-mono text-xs leading-relaxed"
                    />
                  </details>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Your name (logged with the decision)
                      <input
                        name="decidedBy"
                        required
                        placeholder="reviewer"
                        className="rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="flex min-w-48 grow flex-col gap-1 text-xs text-muted-foreground">
                      Reason (kept on reject)
                      <input
                        name="reason"
                        placeholder="optional — why this draft shouldn't go out"
                        className="rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <ReviewButtons />
                  </div>
                </form>
              ) : (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  No run id on this candidate — cannot resume. Inspect the row via the JSON view.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      </SectionCard>
    </div>
  );
}
