import { Beaker } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
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
  { key: "drafted", label: "Drafted", hint: "Replies written under this arm." },
  { key: "approved", label: "Approved", hint: "A human approved the reply at the gate." },
  { key: "posted", label: "Posted", hint: "Reply live on GitHub, UTM-tagged." },
  { key: "signups", label: "Signups", hint: "Attributed signup within the window." },
  { key: "activated", label: "Activated", hint: "First successful VideoDB API call." },
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
          <div key={s.key} className="space-y-1">
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
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
                <InfoTip side="bottom">{s.hint}</InfoTip>
              </div>
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
      <PageHeader
        title="Experiments"
        stage="observe"
        description={
          <>
            How we improve with evidence instead of opinion: A/B tests where two versions of
            something (say, two ways of wording the disclosure line) compete, each joined to real
            activation outcomes. One experiment runs at a time, and every reply is assigned an arm
            by a fixed rule, so re-running can never flip its arm. An arm wins on activations per
            posted reply — not on volume.
          </>
        }
        sources={["experiments", "touches", "outcomes"]}
      />

      {experiments.length === 0 ? (
        <SectionCard
          title="Experiments"
          term="experiment"
          description="Each A/B test, its hypothesis, and how each arm is performing against real outcomes."
          bodyClassName=""
        >
          <EmptyState icon={Beaker} title="No experiments seeded yet">
            Seed the first A/B test with{" "}
            <code className="font-mono">pnpm --filter agent seed:experiments</code>. Once running,
            each experiment&apos;s arms and their funnels appear here.
          </EmptyState>
        </SectionCard>
      ) : (
        experiments.map((e) => {
          const arms = variantsByExperiment.get(e.id) ?? [];
          return (
            <SectionCard
              key={e.id}
              title={e.name}
              term="experiment"
              description={
                <>
                  <span className="font-medium text-foreground">Hypothesis:</span> {e.hypothesis}
                </>
              }
              aside={
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[e.status]}`}
                  >
                    {e.status}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    variable: {e.variable}
                  </span>
                  {e.started_at && (
                    <span className="text-[11px] text-muted-foreground">
                      started <RelTime iso={e.started_at.toISOString()} />
                    </span>
                  )}
                </span>
              }
              bodyClassName="px-4 py-3"
            >
              <p className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                Per-arm funnel — each step is a stricter filter, ending in real activations.
                <InfoTip term="variant" />
              </p>
              {arms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {e.status === "running"
                    ? "No replies drafted under this experiment yet — arms appear as the craft step assigns them."
                    : "Not running — no replies will be assigned to this experiment until its status flips to running."}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {arms.map((v) => (
                    <VariantFunnel key={`${v.experiment_id}-${v.variant}`} row={v} />
                  ))}
                </div>
              )}
            </SectionCard>
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
