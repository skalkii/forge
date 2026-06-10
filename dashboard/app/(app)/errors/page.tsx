import Link from "next/link";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { PageIntro } from "@/components/page-intro";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { RequeueButton } from "@/components/requeue-button";
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
      <PageIntro title="Errors">
        Every caught failure from the agent — searches, triage, craft, scorers, posting — lands
        here with its stack and context. Failures never post anything; a failed candidate can be
        re-queued, which sends it through every gate (guardrail, human review) again.
      </PageIntro>

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

      {errors.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          Nothing has failed yet. Errors appear here the moment a workflow step, the dispatcher, or
          a scorer throws — with stack, context, and a re-queue path for failed candidates.
        </div>
      ) : (
        <ul className="space-y-3">
          {errors.map((e) => (
            <li key={e.id} className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-600 dark:text-rose-400">
                      {e.source}
                    </span>
                    <RelTime iso={e.at.toISOString()} className="tabular-nums text-muted-foreground" />
                  </div>
                  <p className="break-words text-sm leading-snug">{e.message}</p>
                </div>
                <JsonModal title={`errors/${e.id.slice(0, 8)}`} data={e} />
              </div>

              {e.candidate_id ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Link
                    href={`/candidates/${e.candidate_id}`}
                    className="font-mono underline-offset-2 hover:text-foreground hover:underline"
                  >
                    candidate {e.candidate_id.slice(0, 8)}
                  </Link>
                  {e.title ? <span className="truncate">{e.title}</span> : null}
                  {e.repo ? <span className="font-mono">{e.repo}</span> : null}
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
                  <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border bg-background p-2 text-[11px] leading-relaxed">
                    {e.stack}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
