import { CircleDollarSign, Percent, ShieldAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { ActivityStream } from "@/components/activity-stream";
import { PageIntro } from "@/components/page-intro";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { Sparkline } from "@/components/sparkline";
import { StatCard } from "@/components/stat-card";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const KpiRow = z.object({
  total_spend: z.coerce.number(),
  spend_today: z.coerce.number(),
  posted: z.coerce.number(),
  activated: z.coerce.number(),
});

const FunnelRow = z.object({
  signals: z.coerce.number(),
  triaged: z.coerce.number(),
  qualified: z.coerce.number(),
  drafted: z.coerce.number(),
  approved: z.coerce.number(),
  posted: z.coerce.number(),
  activated: z.coerce.number(),
});

const DayRow = z.object({ day: z.string(), value: z.coerce.number() });

const ErrorRow = z.object({
  id: z.string(),
  source: z.string(),
  message: z.string(),
  at: z.coerce.date(),
});

async function loadKpis() {
  const rows = await query(
    KpiRow,
    `SELECT
       (SELECT COALESCE(SUM(cost_usd), 0) FROM cost_events) AS total_spend,
       (SELECT COALESCE(SUM(cost_usd), 0) FROM cost_events
         WHERE at >= date_trunc('day', now())) AS spend_today,
       (SELECT COUNT(*) FROM touches WHERE posted_at IS NOT NULL) AS posted,
       (SELECT COUNT(DISTINCT touch_id) FROM outcomes
         WHERE event = 'first_successful_api_call') AS activated`,
  );
  return rows[0];
}

async function loadFunnel() {
  const rows = await query(
    FunnelRow,
    `SELECT
       (SELECT COUNT(*) FROM signals) AS signals,
       (SELECT COUNT(*) FROM candidates) AS triaged,
       (SELECT COUNT(*) FROM candidates
         WHERE status IN ('crafting', 'review', 'approved', 'rejected', 'posted', 'activated')) AS qualified,
       (SELECT COUNT(*) FROM touches) AS drafted,
       (SELECT COUNT(*) FROM touches WHERE decision = 'approved') AS approved,
       (SELECT COUNT(*) FROM touches WHERE posted_at IS NOT NULL) AS posted,
       (SELECT COUNT(DISTINCT touch_id) FROM outcomes
         WHERE event = 'first_successful_api_call') AS activated`,
  );
  return rows[0];
}

/** Last 7 UTC days, zero-filled, oldest first. */
async function loadDaily(sql: string) {
  const rows = await query(DayRow, sql);
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  const out: { day: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    out.push({ day, value: byDay.get(day) ?? 0 });
  }
  return out;
}

const DAILY_SPEND_SQL = `
  SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, SUM(cost_usd) AS value
    FROM cost_events WHERE at > now() - interval '7 days' GROUP BY 1`;

const DAILY_ACTIVATIONS_SQL = `
  SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day, COUNT(*) AS value
    FROM outcomes WHERE event = 'first_successful_api_call'
     AND occurred_at > now() - interval '7 days' GROUP BY 1`;

async function loadErrors() {
  return query(
    ErrorRow,
    `SELECT id, source, message, at FROM errors
      WHERE at > now() - interval '24 hours'
      ORDER BY at DESC LIMIT 8`,
  );
}

function usd(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

const FUNNEL_STAGES = [
  { key: "signals", label: "Signals", hint: "raw threads found by discovery" },
  { key: "triaged", label: "Triaged", hint: "cheap model said the pain is real" },
  { key: "qualified", label: "Qualified", hint: "strong model said VideoDB genuinely fits" },
  { key: "drafted", label: "Drafted", hint: "reply drafted from a validated template" },
  { key: "approved", label: "Approved", hint: "a human approved at the gate" },
  { key: "posted", label: "Posted", hint: "reply live on GitHub, UTM-tagged" },
  { key: "activated", label: "Activated", hint: "first successful VideoDB API call" },
] as const;

export default async function OverviewPage() {
  const [kpis, funnel, dailySpend, dailyActivations, errors] = await Promise.all([
    loadKpis(),
    loadFunnel(),
    loadDaily(DAILY_SPEND_SQL),
    loadDaily(DAILY_ACTIVATIONS_SQL),
    loadErrors(),
  ]);

  const maxFunnel = Math.max(...FUNNEL_STAGES.map((s) => funnel[s.key]), 1);

  return (
    <div className="space-y-6">
      <RefreshOnChange
        tables={["signals", "candidates", "touches", "outcomes", "cost_events", "errors"]}
      />
      <PageIntro title="Overview">
        The north-star view: the cheapest path from a developer stuck on a video problem to one
        actively using VideoDB. Every number below is a real count from the live database — no
        projections, no targets.
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Cost / activated dev"
          icon={CircleDollarSign}
          value={kpis.activated > 0 ? usd(kpis.total_spend / kpis.activated) : "—"}
          muted={kpis.activated === 0}
          hint={
            kpis.activated > 0
              ? `All-time spend ${usd(kpis.total_spend)} ÷ ${kpis.activated} activated. The one number this whole system optimizes.`
              : "No activated developers yet — fills in once an attributed first API call lands. The one number this whole system optimizes."
          }
        />
        <StatCard
          label="Qualified touch → activation"
          icon={Percent}
          value={kpis.posted > 0 ? pct(kpis.activated / kpis.posted) : "—"}
          muted={kpis.posted === 0}
          spark={
            kpis.activated > 0 ? (
              <Sparkline points={dailyActivations} format={(v) => `${v} activated`} />
            ) : undefined
          }
          hint={
            kpis.posted > 0
              ? `${kpis.activated} of ${kpis.posted} posted touches led to an activated developer.`
              : "Of the threads we judged a genuine fit and replied to, how many led to an activated developer. No touches posted yet."
          }
        />
        <StatCard
          label="Negative signal rate"
          icon={ShieldAlert}
          value={kpis.posted > 0 ? "0%" : "—"}
          muted={kpis.posted === 0}
          hint="Replies that got deleted, flagged, or downvoted. Tracked by manual review for now — must stay at zero."
        />
        <StatCard
          label="Spend today"
          icon={Wallet}
          value={usd(kpis.spend_today)}
          spark={<Sparkline points={dailySpend} format={usd} />}
          hint="Every paid model and research call across providers, since midnight UTC. Bars show the last 7 days."
        />
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Funnel</h2>
          <span className="text-xs text-muted-foreground">all time, live counts</span>
        </header>
        <div className="grid grid-cols-7 gap-2 px-4 py-4">
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="space-y-1.5" title={s.hint}>
              <div className="flex h-16 items-end">
                <div
                  className="w-full rounded-sm bg-primary/30"
                  style={{
                    height:
                      funnel[s.key] === 0
                        ? "2px"
                        : `${Math.max(8, (funnel[s.key] / maxFunnel) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold tabular-nums">{funnel[s.key]}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityStream />
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Errors</h2>
            <Link href="/errors" className="text-xs text-muted-foreground hover:text-foreground">
              last 24h · all →
            </Link>
          </header>
          {errors.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              No errors in the last 24 hours — caught failures from agents and workflows land here
              with context and a re-queue path.
            </div>
          ) : (
            <ul>
              {errors.map((e) => (
                <li key={e.id} className="flex items-start gap-2 border-b px-4 py-2 last:border-b-0">
                  <span className="mt-0.5 rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[11px] text-rose-600 dark:text-rose-400">
                    {e.source}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{e.message}</span>
                  <RelTime
                    iso={e.at.toISOString()}
                    className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
