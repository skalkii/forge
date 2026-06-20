import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { RequeueButton } from "@/components/requeue-button";
import { ScrollList } from "@/components/scroll-list";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ErrorRow = z.object({
  id: z.string(),
  source: z.string(),
  message: z.string(),
  stack: z.string().nullable(),
  candidate_id: z.string().nullable(),
  run_id: z.string().nullable(),
  context: z.record(z.string(), z.unknown()).nullable(),
  at: z.coerce.date(),
  candidate_status: z.string().nullable(),
  title: z.string().nullable(),
  repo: z.string().nullable(),
});

const SourceCount = z.object({ source: z.string(), n: z.coerce.number() });

async function loadErrors() {
  return query(
    ErrorRow,
    `SELECT e.id, e.source, e.message, e.stack,
            e.candidate_id::text AS candidate_id, e.run_id::text AS run_id,
            e.context, e.at,
            c.status::text AS candidate_status, s.title, s.repo
       FROM errors e
       LEFT JOIN candidates c ON c.id = e.candidate_id
       LEFT JOIN signals s ON s.id = c.signal_id
      ORDER BY e.at DESC
      LIMIT 100`,
  );
}

async function loadSourceCounts() {
  return query(
    SourceCount,
    `SELECT source, count(*)::int AS n FROM errors GROUP BY source ORDER BY n DESC`,
  );
}

export default async function ErrorsPage() {
  const [errors, sources] = await Promise.all([loadErrors(), loadSourceCounts()]);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["errors", "candidates"]} />
      <PageHeader
        title="Errors"
        stage="ops"
        description="The system fails visibly, never silently. Every caught failure — a search, triage, craft, a scorer, or posting — lands here with its full context. Nothing is posted as a result of a failure, and a failed candidate can be re-queued, which sends it back through every gate (guardrail, human review) again."
        sources={["errors", "candidates", "signals"]}
      />

      <SectionCard
        title="Errors by source"
        description="A tally of where failures came from. 'Source' names the step or component that threw — for example a workflow step, the dispatcher, or a scorer."
        aside={
          <span className="inline-flex items-center gap-1">
            all time <InfoTip side="bottom">The system component or workflow step that raised the error — e.g. github-search, triage, craft, a scorer, or the dispatcher. It tells you where to look first.</InfoTip>
          </span>
        }
        bodyClassName="px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {sources.length === 0 ? (
            <span className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground">
              no errors recorded
            </span>
          ) : (
            sources.map((s) => (
              <span key={s.source} className="rounded-full border bg-card px-2.5 py-1">
                <span className="font-mono text-rose-600 dark:text-rose-400">{s.source}</span>{" "}
                <span className="tabular-nums text-muted-foreground">×{s.n}</span>
              </span>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Recent failures"
        description="The 100 most recent caught failures, newest first. Each keeps its message, stack, and context, and links back to the candidate it belongs to. Failed candidates carry a re-queue button."
        aside="latest 100"
        bodyClassName="p-0"
      >
        {errors.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={ShieldCheck} title="Nothing has failed yet">
              Errors appear here the moment a workflow step, the dispatcher, or a scorer throws —
              with stack, context, and a re-queue path for failed candidates.
            </EmptyState>
          </div>
        ) : (
          <ScrollList maxH="max-h-[36rem]">
            <ul className="space-y-3 p-4">
              {errors.map((e) => (
                <li key={e.id} className="surface space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-600 dark:text-rose-400">
                          {e.source}
                        </span>
                        <RelTime
                          iso={e.at.toISOString()}
                          className="tabular-nums text-muted-foreground"
                        />
                      </div>
                      <p className="break-words text-sm leading-snug">{e.message}</p>
                    </div>
                    <div className="shrink-0">
                      <JsonModal title={`errors/${e.id.slice(0, 8)}`} data={e} />
                    </div>
                  </div>

                  {e.candidate_id ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Link
                        href={`/candidates/${e.candidate_id}`}
                        className="shrink-0 font-mono underline-offset-2 hover:text-foreground hover:underline"
                      >
                        candidate {e.candidate_id.slice(0, 8)}
                      </Link>
                      {e.title ? <span className="min-w-0 truncate">{e.title}</span> : null}
                      {e.repo ? <span className="shrink-0 font-mono">{e.repo}</span> : null}
                      {e.candidate_status ? <StatusPill status={e.candidate_status} /> : null}
                      {e.candidate_status === "failed" ? (
                        <RequeueButton candidateId={e.candidate_id} />
                      ) : null}
                    </div>
                  ) : null}

                  {e.stack ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Stack trace
                      </summary>
                      <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border bg-background p-2 text-xs leading-relaxed">
                        {e.stack}
                      </pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollList>
        )}
      </SectionCard>
    </div>
  );
}
