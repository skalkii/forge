import { FileEdit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { DraftBody } from "@/components/draft-body";
import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const CandidateDetail = z.object({
  id: z.string(),
  status: z.string(),
  triage_score: z.number().nullable(),
  triage_reason: z.string().nullable(),
  fit_score: z.number().nullable(),
  capability: z.string().nullable(),
  qualify_reasons: z.array(z.string()).nullable(),
  run_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  title: z.string(),
  excerpt: z.string(),
  repo: z.string(),
  author: z.string(),
  url: z.string(),
  signal_query: z.string(),
  found_at: z.coerce.date(),
});

const TouchRow = z.object({
  id: z.string(),
  variant: z.string().nullable(),
  template_id: z.string().nullable(),
  draft_body: z.string(),
  final_body: z.string().nullable(),
  disclosure_ok: z.boolean().nullable(),
  decision: z.string().nullable(),
  decided_by: z.string().nullable(),
  decided_at: z.coerce.date().nullable(),
  posted_at: z.coerce.date().nullable(),
  posted_url: z.string().nullable(),
  created_at: z.coerce.date(),
});

const ScorerResult = z.object({ score: z.number(), reason: z.string() }).nullable();
const SnapshotScorers = z.object({
  run_status: z.string().nullable(),
  guardrail: ScorerResult,
  quality: ScorerResult,
});

const CostSummary = z.object({
  n: z.coerce.number(),
  total_usd: z.coerce.number(),
  tokens_in: z.coerce.number(),
  tokens_out: z.coerce.number(),
});

async function loadCandidate(id: string) {
  return queryOne(
    CandidateDetail,
    `SELECT c.id, c.status::text, c.triage_score, c.triage_reason, c.fit_score,
            c.capability, c.qualify_reasons, c.run_id, c.created_at, c.updated_at,
            s.title, s.excerpt, s.repo, s.author, s.url,
            s.query AS signal_query, s.found_at
       FROM candidates c
       JOIN signals s ON s.id = c.signal_id
      WHERE c.id = $1`,
    [id],
  );
}

async function loadTouches(candidateId: string) {
  return query(
    TouchRow,
    `SELECT id, variant, template_id, draft_body, final_body, disclosure_ok,
            decision, decided_by, decided_at, posted_at, posted_url, created_at
       FROM touches
      WHERE candidate_id = $1
      ORDER BY created_at DESC`,
    [candidateId],
  );
}

async function loadScorers(runId: string) {
  return queryOne(
    SnapshotScorers,
    `SELECT snapshot->>'status' AS run_status,
            snapshot->'context'->'scorers'->'output'->'guardrail' AS guardrail,
            snapshot->'context'->'scorers'->'output'->'quality' AS quality
       FROM mastra_workflow_snapshot
      WHERE run_id = $1`,
    [runId],
  );
}

async function loadCost(candidateId: string) {
  return queryOne(
    CostSummary,
    `SELECT count(*) AS n,
            COALESCE(sum(cost_usd), 0) AS total_usd,
            COALESCE(sum(tokens_in), 0) AS tokens_in,
            COALESCE(sum(tokens_out), 0) AS tokens_out
       FROM cost_events
      WHERE candidate_id = $1`,
    [candidateId],
  );
}

function ScoreBadge({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2" title={hint}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-semibold tabular-nums">
        {value === null ? "—" : value.toFixed(2)}
      </p>
    </div>
  );
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const candidate = await loadCandidate(id);
  if (!candidate) notFound();

  const [touches, scorers, cost] = await Promise.all([
    loadTouches(id),
    candidate.run_id ? loadScorers(candidate.run_id) : Promise.resolve(null),
    loadCost(id),
  ]);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["candidates", "touches"]} />

      <PageHeader
        title={candidate.title}
        stage="sense"
        description="The full journey of one candidate — the GitHub thread it came from, how the AIs judged it, every draft reply written for it, and where it ended up. Nothing here is public unless a reviewer has approved a reply."
        sources={["candidates", "signals", "touches", "outcomes"]}
      >
        <Link
          href="/candidates"
          className="rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          ← Candidates
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{candidate.id.slice(0, 8)}</span>
        <StatusPill status={candidate.status} />
        <span className="font-mono">{candidate.repo}</span>
        <span>by {candidate.author}</span>
        <span>
          found <RelTime iso={candidate.found_at.toISOString()} className="tabular-nums" />
        </span>
        <span>
          updated <RelTime iso={candidate.updated_at.toISOString()} className="tabular-nums" />
        </span>
        {candidate.run_id ? (
          <span className="inline-flex items-center gap-1">
            <Link
              href="/runs"
              className="font-mono underline-offset-2 hover:text-foreground hover:underline"
              title={`workflow run ${candidate.run_id}`}
            >
              run {candidate.run_id.slice(0, 8)} →
            </Link>
            <InfoTip term="run-snapshot" />
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreBadge
          label="Triage score"
          value={candidate.triage_score}
          hint="cheap model: is this real pain worth spending on?"
        />
        <ScoreBadge
          label="Qualify fit"
          value={candidate.fit_score}
          hint="strong model: is VideoDB genuinely the answer?"
        />
        <div className="rounded-md border bg-background px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Capability
            <InfoTip>
              The VideoDB feature this developer&apos;s problem maps to — e.g. transcription, frame
              extraction, or scene search.
            </InfoTip>
          </p>
          <p className="truncate font-mono text-sm font-medium leading-7">
            {candidate.capability ?? "—"}
          </p>
        </div>
        <div
          className="rounded-md border bg-background px-3 py-2"
          title={`${cost?.n ?? 0} paid calls · ${cost?.tokens_in ?? 0} tokens in / ${cost?.tokens_out ?? 0} out`}
        >
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Spend on this candidate
            <InfoTip>
              Every penny spent on this one candidate — AI calls and paid web research — metered the
              moment it was spent.
            </InfoTip>
          </p>
          <p className="font-heading text-lg font-semibold tabular-nums">
            ${(cost?.total_usd ?? 0).toFixed(4)}
          </p>
        </div>
      </div>

      <SectionCard
        title="Signal"
        term="signal"
        description="The public GitHub thread that started this. We store only the minimum needed to act — the matched excerpt, the link, the repo, and the search that found it."
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{candidate.excerpt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            open thread on GitHub ↗
          </a>
          <span
            className="max-w-72 truncate rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
            title={candidate.signal_query}
          >
            {candidate.signal_query}
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Judgment"
        description="In plain words, why the AIs let this thread through (or held it back). Triage is the cheap first filter; qualify is the deeper check that VideoDB genuinely fits."
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Triage said
              <InfoTip term="triage" />
            </dt>
            <dd className="mt-0.5 leading-relaxed">{candidate.triage_reason ?? "—"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Qualify reasons
              <InfoTip term="qualify" />
            </dt>
            <dd className="mt-0.5">
              {candidate.qualify_reasons && candidate.qualify_reasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 leading-relaxed">
                  {candidate.qualify_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Scorer verdicts"
        term="guardrail"
        description="Two automatic checks run before a human sees a draft. The guardrail is a strict pass/fail that can block; the quality score is advisory and only advises the reviewer."
        aside="from the workflow run snapshot"
      >
        {!candidate.run_id ? (
          <p className="text-sm text-muted-foreground">
            No touch run yet — scorers fire after the reply is crafted, inside the touch workflow.
          </p>
        ) : !scorers ? (
          <p className="text-sm text-muted-foreground">
            Run snapshot not found (it may have been purged).
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  scorers.guardrail
                    ? scorers.guardrail.score === 1
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                    : "bg-muted-foreground/30"
                }`}
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-medium">
                  Spam guardrail
                  <span className="text-xs font-normal text-muted-foreground">
                    strict pass/fail — checks the disclosure line, daily cap, repeat contacts, and
                    the kill-switch
                  </span>
                  <InfoTip term="disclosure" />
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {scorers.guardrail
                    ? scorers.guardrail.score === 1
                      ? "Passed all checks."
                      : scorers.guardrail.reason
                    : "not reached"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  scorers.quality
                    ? scorers.quality.score >= 0.7
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : "bg-muted-foreground/30"
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Touch quality{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    an AI judge&apos;s advisory rating — shown to the reviewer, never blocks
                  </span>
                  {scorers.quality ? (
                    <span className="ml-2 tabular-nums">{scorers.quality.score.toFixed(2)}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {scorers.quality ? scorers.quality.reason : "not reached or judge unavailable"}
                </p>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={`Drafts & decisions${touches.length > 0 ? ` (${touches.length})` : ""}`}
        term="draft"
        description="Every reply written for this candidate, and what a reviewer decided about it. Nothing here goes public until a person approves it — the AI cannot post on its own."
      >
        {touches.length === 0 ? (
          <EmptyState icon={FileEdit} title="No draft yet">
            A reply is crafted only after qualify clears the fit threshold — the bar for &quot;VideoDB
            genuinely fits.&quot;
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {touches.map((t) => (
              <li key={t.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">touch/{t.id.slice(0, 8)}</span>
                  {t.template_id ? (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">
                      {t.template_id}
                      <InfoTip term="snippet" />
                    </span>
                  ) : null}
                  {t.variant ? (
                    <span className="inline-flex items-center gap-1">
                      variant {t.variant}
                      <InfoTip term="variant" />
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex items-center gap-1 ${
                      t.disclosure_ok
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    disclosure {t.disclosure_ok ? "present" : "MISSING"}
                    <InfoTip term="disclosure" />
                  </span>
                  <RelTime iso={t.created_at.toISOString()} className="tabular-nums" />
                  <span className="ml-auto">
                    <JsonModal title={`touches/${t.id.slice(0, 8)}`} data={t} />
                  </span>
                </div>
                <DraftBody body={t.final_body ?? t.draft_body} />
                {t.decision ? (
                  <p
                    className={`text-xs ${
                      t.decision === "approved"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {t.decision} by {t.decided_by ?? "unknown"}
                    {t.decided_at ? (
                      <>
                        {" "}
                        · <RelTime iso={t.decided_at.toISOString()} className="tabular-nums" />
                      </>
                    ) : null}
                    {t.final_body && t.final_body !== t.draft_body
                      ? " · edited before approval"
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Awaiting review — a person will approve, edit, or reject this from the drafts
                    queue.
                  </p>
                )}
                {t.posted_url ? (
                  <p className="text-xs text-muted-foreground">
                    Posted{" "}
                    {t.posted_at ? (
                      <RelTime iso={t.posted_at.toISOString()} className="tabular-nums" />
                    ) : null}{" "}
                    ·{" "}
                    <a
                      href={t.posted_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:text-foreground hover:underline"
                    >
                      view on GitHub ↗
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
