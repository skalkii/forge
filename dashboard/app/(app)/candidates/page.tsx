import { Compass } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
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
      <PageHeader
        title="Candidates"
        stage="sense"
        description="Threads the cheap triage AI judged worth pursuing. Each one runs its own touch — qualify (is VideoDB genuinely the answer?), then craft (template + reply), then the human gate. Click any candidate for its full history, drafts, and scorer verdicts."
        sources={["candidates", "signals"]}
      />

      <SectionCard
        title="Filter by stage"
        description="Each candidate sits at one stage of the pipeline. Click a chip to show only candidates currently at that stage; the number is how many are there now."
      >
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
      </SectionCard>

      <SectionCard
        title="Queue"
        term="candidate"
        description="One row per candidate, most recently updated first. The two scores show how the AIs rated it; click a title to open its full journey."
        aside={`${candidates.length} shown · most recently updated first`}
        bodyClassName=""
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={`No candidates${active ? ` at the '${active}' stage` : " yet"}`}
          >
            Discovery enqueues a candidate whenever a signal scores above the triage threshold —
            the cheap AI&apos;s bar for &quot;real pain worth pursuing.&quot;
          </EmptyState>
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
                      <span className="inline-flex items-center gap-1">
                        triage <Score value={c.triage_score} />
                        <InfoTip term="triage" />
                      </span>
                      <span className="inline-flex items-center gap-1">
                        fit <Score value={c.fit_score} />
                        <InfoTip term="fit-score" />
                      </span>
                      {c.capability ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                          title="the VideoDB capability this thread maps to (e.g. transcription, scene search)"
                        >
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
      </SectionCard>
    </div>
  );
}
