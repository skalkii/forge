import Link from "next/link";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { PageIntro } from "@/components/page-intro";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { StatusPill, CANDIDATE_STATUSES } from "@/components/status-pill";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const CandidateRow = z.object({
  id: z.string(),
  status: z.string(),
  triage_score: z.number().nullable(),
  fit_score: z.number().nullable(),
  capability: z.string().nullable(),
  run_id: z.string().nullable(),
  updated_at: z.coerce.date(),
  title: z.string(),
  repo: z.string(),
  author: z.string(),
  url: z.string(),
});

const StatusCount = z.object({ status: z.string(), n: z.coerce.number() });

async function loadCandidates(status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE c.status = $1`;
  }
  return query(
    CandidateRow,
    `SELECT c.id, c.status::text, c.triage_score, c.fit_score, c.capability,
            c.run_id, c.updated_at,
            s.title, s.repo, s.author, s.url
       FROM candidates c
       JOIN signals s ON s.id = c.signal_id
       ${where}
      ORDER BY c.updated_at DESC
      LIMIT 100`,
    params,
  );
}

async function loadCounts() {
  return query(
    StatusCount,
    `SELECT status::text, count(*) AS n FROM candidates GROUP BY status`,
  );
}

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{value.toFixed(2)}</span>;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status && CANDIDATE_STATUSES.includes(status) ? status : undefined;
  const [candidates, counts] = await Promise.all([loadCandidates(active), loadCounts()]);
  const countBy = new Map(counts.map((c) => [c.status, c.n]));
  const total = counts.reduce((sum, c) => sum + c.n, 0);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["candidates", "signals", "touches"]} />
      <PageIntro title="Candidates">
        Signals that passed triage, each moving through the pipeline: qualify (is VideoDB genuinely
        the answer?) → craft (template + reply) → review (a human decides) → outcome. One row per
        candidate; click through for the full journey, drafts, and scorer verdicts.
      </PageIntro>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Link
          href="/candidates"
          className={`rounded-full border px-2.5 py-1 ${
            !active ? "bg-foreground text-background" : "bg-card hover:bg-accent"
          }`}
        >
          all <span className="tabular-nums opacity-70">{total}</span>
        </Link>
        {CANDIDATE_STATUSES.map((s) => {
          const n = countBy.get(s) ?? 0;
          return (
            <Link
              key={s}
              href={`/candidates?status=${s}`}
              className={`rounded-full border px-2.5 py-1 ${
                active === s
                  ? "bg-foreground text-background"
                  : n === 0
                    ? "bg-card text-muted-foreground/50"
                    : "bg-card hover:bg-accent"
              }`}
            >
              {s} <span className="tabular-nums opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Queue</h2>
          <span className="text-xs text-muted-foreground">
            {candidates.length} shown · most recently updated first
          </span>
        </header>
        {candidates.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No candidates{active ? ` in '${active}'` : " yet"}. Discovery enqueues them when a
            signal scores above the triage threshold.
          </div>
        ) : (
          <ul>
            {candidates.map((c) => (
              <li key={c.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <StatusPill status={c.status} />
                      <span className="font-mono">{c.repo}</span>
                      <span>by {c.author}</span>
                      <span title="triage score — is this real pain worth spending on?">
                        triage <Score value={c.triage_score} />
                      </span>
                      <span title="qualify fit — is VideoDB genuinely the answer?">
                        fit <Score value={c.fit_score} />
                      </span>
                      {c.capability ? (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">
                          {c.capability}
                        </span>
                      ) : null}
                      <RelTime iso={c.updated_at.toISOString()} className="tabular-nums" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <JsonModal title={`candidates/${c.id.slice(0, 8)}`} data={c} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
