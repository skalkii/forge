import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
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

/** Render the draft with the disclosure line highlighted (R3 — reviewers verify it at a glance). */
function DraftBody({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const isDisclosure = /disclosure/i.test(line) && line.trim().length > 0;
        return (
          <span
            key={i}
            className={
              isDisclosure
                ? "block rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300"
                : undefined
            }
          >
            {line}
            {"\n"}
          </span>
        );
      })}
    </pre>
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

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/candidates" className="hover:text-foreground hover:underline">
            Candidates
          </Link>
          <span>/</span>
          <span className="font-mono">{candidate.id.slice(0, 8)}</span>
          <StatusPill status={candidate.status} />
          {candidate.run_id ? (
            <Link
              href="/runs"
              className="font-mono underline-offset-2 hover:text-foreground hover:underline"
              title={`workflow run ${candidate.run_id}`}
            >
              run {candidate.run_id.slice(0, 8)} →
            </Link>
          ) : null}
        </div>
        <h1 className="mt-1.5 font-heading text-xl font-semibold leading-snug tracking-tight">
          {candidate.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{candidate.repo}</span> · by {candidate.author} · found{" "}
          <RelTime iso={candidate.found_at.toISOString()} className="tabular-nums" /> · updated{" "}
          <RelTime iso={candidate.updated_at.toISOString()} className="tabular-nums" />
        </p>
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
          <p className="text-[11px] text-muted-foreground">Capability</p>
          <p className="truncate font-mono text-sm font-medium leading-7">
            {candidate.capability ?? "—"}
          </p>
        </div>
        <div
          className="rounded-md border bg-background px-3 py-2"
          title={`${cost?.n ?? 0} paid calls · ${cost?.tokens_in ?? 0} tokens in / ${cost?.tokens_out ?? 0} out`}
        >
          <p className="text-[11px] text-muted-foreground">Spend on this candidate</p>
          <p className="font-heading text-lg font-semibold tabular-nums">
            ${(cost?.total_usd ?? 0).toFixed(4)}
          </p>
        </div>
      </div>

      <Section title="Signal" hint="the public GitHub thread that started this — minimal data only (R7)">
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
      </Section>

      <Section title="Judgment" hint="why the agents let this through (or didn't)">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Triage said</dt>
            <dd className="mt-0.5 leading-relaxed">{candidate.triage_reason ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Qualify reasons</dt>
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
      </Section>

      <Section
        title="Scorer verdicts"
        hint="pulled from the workflow run snapshot — guardrail blocks, quality advises"
      >
        {!candidate.run_id ? (
          <p className="text-sm text-muted-foreground">
            No touch run yet — scorers fire after craft, inside the touch workflow.
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
                <p className="text-sm font-medium">
                  Spam guardrail{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    deterministic, hard gate — disclosure (R3), caps, dedup, kill-switch
                  </span>
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
                    model judge, advisory — shown to the reviewer, never blocks
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
      </Section>

      <Section
        title={`Drafts & decisions${touches.length > 0 ? ` (${touches.length})` : ""}`}
        hint="every draft written for this candidate — nothing posts without a reviewer"
      >
        {touches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No draft yet — craft runs after qualify passes the fit threshold.
          </p>
        ) : (
          <ul className="space-y-4">
            {touches.map((t) => (
              <li key={t.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">touch/{t.id.slice(0, 8)}</span>
                  {t.template_id ? (
                    <span
                      className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                      title="snippet template (R2 — select-and-fill, never freeform code)"
                    >
                      {t.template_id}
                    </span>
                  ) : null}
                  {t.variant ? <span>variant {t.variant}</span> : null}
                  <span
                    className={
                      t.disclosure_ok
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                    title="R3 — affiliation disclosure must be present verbatim"
                  >
                    disclosure {t.disclosure_ok ? "present" : "MISSING"}
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
                    Awaiting review — approve, edit, or reject from the drafts queue.
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
      </Section>
    </div>
  );
}
