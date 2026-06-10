import { z } from "zod";

import { PageIntro } from "@/components/page-intro";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ExperimentRow = z.object({
  id: z.string(),
  name: z.string(),
  hypothesis: z.string(),
  variable: z.string(),
  status: z.enum(["draft", "running", "ended"]),
  started_at: z.coerce.date().nullable(),
  ended_at: z.coerce.date().nullable(),
});

const VariantRow = z.object({
  experiment_id: z.string(),
  variant: z.string().nullable(),
  drafted: z.coerce.number(),
  approved: z.coerce.number(),
  posted: z.coerce.number(),
  signups: z.coerce.number(),
  activated: z.coerce.number(),
});

const UnassignedRow = z.object({ unassigned: z.coerce.number() });

async function loadExperiments() {
  return query(
    ExperimentRow,
    `SELECT id::text, name, hypothesis, variable, status, started_at, ended_at
       FROM experiments
      ORDER BY (status = 'running') DESC, name`,
  );
}

async function loadVariants() {
  return query(
    VariantRow,
    `SELECT t.experiment_id::text, t.variant,
            COUNT(*) AS drafted,
            COUNT(*) FILTER (WHERE t.decision = 'approved') AS approved,
            COUNT(*) FILTER (WHERE t.posted_at IS NOT NULL) AS posted,
            COUNT(DISTINCT o_s.touch_id) AS signups,
            COUNT(DISTINCT o_a.touch_id) AS activated
       FROM touches t
       LEFT JOIN outcomes o_s ON o_s.touch_id = t.id AND o_s.event = 'signup'
       LEFT JOIN outcomes o_a ON o_a.touch_id = t.id AND o_a.event = 'first_successful_api_call'
      WHERE t.experiment_id IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1, 2`,
  );
}

async function loadUnassigned() {
  const rows = await query(
    UnassignedRow,
    `SELECT COUNT(*) AS unassigned FROM touches WHERE experiment_id IS NULL`,
  );
  return rows[0].unassigned;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  ended: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const FUNNEL_STAGES = [
  { key: "drafted", label: "Drafted", hint: "touches drafted under this arm" },
  { key: "approved", label: "Approved", hint: "a human approved at the gate" },
  { key: "posted", label: "Posted", hint: "live on GitHub, UTM-tagged" },
  { key: "signups", label: "Signups", hint: "attributed signup within the window" },
  { key: "activated", label: "Activated", hint: "first successful VideoDB API call" },
] as const;

function VariantFunnel({ row }: { row: z.infer<typeof VariantRow> }) {
  const max = Math.max(row.drafted, 1);
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
          Variant {row.variant ?? "?"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {row.posted > 0
            ? `${row.activated} of ${row.posted} posted activated`
            : "nothing posted yet"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {FUNNEL_STAGES.map((s) => (
          <div key={s.key} className="space-y-1" title={s.hint}>
            <div className="flex h-10 items-end">
              <div
                className="w-full rounded-sm bg-violet-500/30"
                style={{
                  height: row[s.key] === 0 ? "2px" : `${Math.max(10, (row[s.key] / max) * 100)}%`,
                }}
              />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold tabular-nums">{row[s.key]}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ExperimentsPage() {
  const [experiments, variants, unassigned] = await Promise.all([
    loadExperiments(),
    loadVariants(),
    loadUnassigned(),
  ]);
  const variantsByExperiment = new Map<string, z.infer<typeof VariantRow>[]>();
  for (const v of variants) {
    const list = variantsByExperiment.get(v.experiment_id) ?? [];
    list.push(v);
    variantsByExperiment.set(v.experiment_id, list);
  }

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["experiments", "touches", "outcomes"]} />
      <PageIntro title="Experiments">
        One experiment runs at a time; every drafted touch is assigned an arm by a deterministic
        hash of its candidate (re-dispatching can never flip arms). The variant rides on
        utm_content, so outcomes join back per arm. Counts below are live — an arm wins on
        activations per posted touch, not on volume.
      </PageIntro>

      {experiments.length === 0 ? (
        <section className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          No experiments seeded yet — run <code className="font-mono">pnpm --filter agent seed:experiments</code>.
        </section>
      ) : (
        experiments.map((e) => {
          const arms = variantsByExperiment.get(e.id) ?? [];
          return (
            <section key={e.id} className="rounded-lg border bg-card">
              <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <h2 className="text-sm font-medium">{e.name}</h2>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[e.status]}`}
                >
                  {e.status}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  variable: {e.variable}
                </span>
                {e.started_at && (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    started <RelTime iso={e.started_at.toISOString()} />
                  </span>
                )}
              </header>
              <div className="space-y-3 px-4 py-3">
                <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Hypothesis:</span> {e.hypothesis}
                </p>
                {arms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {e.status === "running"
                      ? "No touches drafted under this experiment yet — arms appear as the craft step assigns them."
                      : "Not running — no touches will be assigned to this experiment until its status flips to running."}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {arms.map((v) => (
                      <VariantFunnel key={`${v.experiment_id}-${v.variant}`} row={v} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })
      )}

      {unassigned > 0 && (
        <p className="text-xs text-muted-foreground">
          {unassigned} touch{unassigned === 1 ? " was" : "es were"} drafted while no experiment was
          running and {unassigned === 1 ? "is" : "are"} not part of any arm.
        </p>
      )}
    </div>
  );
}
