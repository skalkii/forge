import Link from "next/link";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const StepRow = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
});

const RunRow = z.object({
  run_id: z.string(),
  workflow_name: z.string(),
  run_status: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  candidate_id: z.string().nullable(),
  candidate_status: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  steps: z.array(StepRow).nullable(),
  suspended_step: z.string().nullable(),
  touch_status: z.string().nullable(),
  touch_reason: z.string().nullable(),
});

type Run = z.infer<typeof RunRow>;

async function loadRuns() {
  return query(
    RunRow,
    `SELECT m.run_id,
            m.workflow_name,
            m.snapshot->>'status' AS run_status,
            m."createdAtZ" AS created_at,
            m."updatedAtZ" AS updated_at,
            c.id::text AS candidate_id,
            c.status::text AS candidate_status,
            s.title,
            s.url,
            (SELECT jsonb_agg(jsonb_build_object(
                      'id', k.key,
                      'status', k.value->>'status',
                      'startedAt', (k.value->'startedAt')::numeric,
                      'endedAt', (k.value->'endedAt')::numeric)
                    ORDER BY (k.value->>'startedAt')::numeric NULLS LAST)
               FROM jsonb_each(m.snapshot->'context') k
              WHERE k.key <> 'input') AS steps,
            (SELECT min(k) FROM jsonb_object_keys(m.snapshot->'suspendedPaths') k) AS suspended_step,
            m.snapshot->'context'->'act'->'output'->>'status' AS touch_status,
            m.snapshot->'context'->'act'->'output'->>'reason' AS touch_reason
       FROM mastra_workflow_snapshot m
       LEFT JOIN candidates c ON c.run_id = m.run_id
       LEFT JOIN signals s ON s.id = c.signal_id
      ORDER BY m."updatedAtZ" DESC
      LIMIT 100`,
  );
}

/** Expected step order per workflow — steps not yet reached are rendered as pending. */
const EXPECTED_STEPS: Record<string, string[]> = {
  touch: ["load", "qualify", "craft", "scorers", "human-gate", "act"],
  discovery: ["search", "dedup", "triage"],
};

const STALE_RUNNING_MS = 15 * 60 * 1000;

type Column = "running" | "suspended" | "done" | "failed";

function columnOf(run: Run): Column {
  switch (run.run_status) {
    case "running":
    case "waiting":
      return "running";
    case "suspended":
      return "suspended";
    case "success":
      return "done";
    default:
      return "failed";
  }
}

const COLUMN_META: Record<Column, { label: string; dot: string; hint: string }> = {
  running: { label: "Running", dot: "bg-blue-500", hint: "actively working a step" },
  suspended: { label: "Awaiting review", dot: "bg-amber-500", hint: "paused at the human gate" },
  done: { label: "Done", dot: "bg-emerald-500", hint: "reached a final state" },
  failed: { label: "Failed", dot: "bg-rose-500", hint: "errored or was cancelled" },
};

const STEP_DOT: Record<string, string> = {
  success: "bg-emerald-500",
  running: "bg-blue-500 animate-pulse",
  suspended: "bg-amber-500",
  failed: "bg-rose-500",
};

function isStale(run: Run): boolean {
  return columnOf(run) === "running" && Date.now() - run.updated_at.getTime() > STALE_RUNNING_MS;
}

function durationLabel(run: Run): string | null {
  const times = (run.steps ?? []).flatMap((s) =>
    [s.startedAt, s.endedAt].filter((t): t is number => t !== null),
  );
  if (times.length === 0) return null;
  const start = Math.min(...times);
  const end = columnOf(run) === "running" ? Date.now() : Math.max(...times);
  const secs = Math.max(0, Math.round((end - start) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function StepStrip({ run }: { run: Run }) {
  const expected = EXPECTED_STEPS[run.workflow_name] ?? [];
  const byId = new Map((run.steps ?? []).map((s) => [s.id, s]));
  const ids = expected.length > 0 ? expected : [...byId.keys()];
  return (
    <div className="flex items-center gap-1">
      {ids.map((id) => {
        const step = byId.get(id);
        const status = run.suspended_step === id ? "suspended" : (step?.status ?? "pending");
        return (
          <span
            key={id}
            title={`${id} — ${status}`}
            className={`h-1.5 flex-1 rounded-full ${STEP_DOT[status] ?? "bg-muted-foreground/25"}`}
          />
        );
      })}
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  const stale = isStale(run);
  const duration = durationLabel(run);
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
            run.workflow_name === "discovery"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {run.workflow_name}
        </span>
        <JsonModal title={`run/${run.run_id.slice(0, 8)}`} data={run} />
      </div>

      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {run.title ?? (run.workflow_name === "discovery" ? "Discovery sweep" : "(no candidate)")}
      </p>

      <StepStrip run={run} />

      {run.suspended_step ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Waiting at <span className="font-mono">{run.suspended_step}</span> — a reviewer decides
          next.
        </p>
      ) : null}
      {run.touch_status ? (
        <p className="text-xs text-muted-foreground">
          Outcome: <span className="font-medium text-foreground">{run.touch_status}</span>
          {run.touch_reason ? ` — ${run.touch_reason}` : ""}
        </p>
      ) : null}
      {stale ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No progress for 15+ minutes — the process that ran this is likely gone.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <RelTime iso={run.updated_at.toISOString()} className="tabular-nums" />
          {duration ? <span className="tabular-nums">· {duration}</span> : null}
        </span>
        {run.candidate_id ? (
          <Link
            href={`/candidates/${run.candidate_id}`}
            className="font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {run.candidate_id.slice(0, 8)} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function RunsPage() {
  const runs = await loadRuns();
  const columns: Column[] = ["running", "suspended", "done", "failed"];
  const grouped = new Map<Column, Run[]>(columns.map((c) => [c, []]));
  for (const run of runs) grouped.get(columnOf(run))!.push(run);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["candidates", "touches", "signals"]} />
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Runs</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Every workflow run the engine has started, newest first. A <em>discovery</em> run sweeps
          GitHub and enqueues candidates; a <em>touch</em> run carries one candidate from qualify
          to the human gate — where it pauses until a reviewer decides. Each bar below is one
          step of that journey.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          No runs yet. Trigger discovery (<code>pnpm --filter agent loop</code>) or the dispatcher
          (<code>pnpm --filter agent dispatch</code>) to see runs land here.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const items = grouped.get(col)!;
            const meta = COLUMN_META[col];
            return (
              <section key={col} className="space-y-3">
                <header className="flex items-center gap-2 px-1">
                  <span className={`size-2 rounded-full ${meta.dot}`} />
                  <h2 className="text-sm font-medium">{meta.label}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{meta.hint}</span>
                </header>
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    none
                  </div>
                ) : (
                  items.map((run) => <RunCard key={run.run_id} run={run} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
