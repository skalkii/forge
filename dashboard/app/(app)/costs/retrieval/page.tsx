import { PiggyBank, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const StatsRow = z.object({
  entries: z.coerce.number(),
  hits: z.coerce.number(),
  miss_cost: z.coerce.number(),
});

const SpendRow = z.object({ spend: z.coerce.number() });

const CacheRow = z.object({
  id: z.string(),
  provider: z.string(),
  request: z.unknown(),
  hits: z.coerce.number(),
  cost_usd: z.coerce.number(),
  created_at: z.coerce.date(),
  last_used_at: z.coerce.date(),
});

async function loadStats() {
  const rows = await query(
    StatsRow,
    `SELECT COUNT(*) AS entries,
            COALESCE(SUM(hits), 0) AS hits,
            COALESCE(SUM(cost_usd), 0) AS miss_cost
       FROM retrieval_cache`,
  );
  return rows[0];
}

async function loadTodaySpend() {
  const rows = await query(
    SpendRow,
    `SELECT COALESCE(SUM(cost_usd), 0) AS spend FROM cost_events
      WHERE provider IN ('exa', 'parallel') AND at >= date_trunc('day', now() AT TIME ZONE 'utc')`,
  );
  return rows[0].spend;
}

async function loadEntries() {
  return query(
    CacheRow,
    `SELECT id, provider, request, hits, cost_usd, created_at, last_used_at
       FROM retrieval_cache
      ORDER BY last_used_at DESC
      LIMIT 50`,
  );
}

function usd(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function requestLabel(request: unknown): string {
  if (request && typeof request === "object") {
    const r = request as Record<string, unknown>;
    if (typeof r.query === "string") return r.query;
    if (Array.isArray(r.search_queries)) return r.search_queries.join(" · ");
    if (typeof r.objective === "string") return r.objective;
  }
  return JSON.stringify(request).slice(0, 80);
}

export default async function RetrievalPage() {
  const [stats, todaySpend, entries] = await Promise.all([
    loadStats(),
    loadTodaySpend(),
    loadEntries(),
  ]);

  const budget = Number(process.env.RETRIEVAL_DAILY_BUDGET_USD ?? 2);
  const fraction = budget > 0 ? Math.min(1, todaySpend / budget) : 1;
  const barColor =
    fraction < 0.5 ? "bg-emerald-500" : fraction < 0.8 ? "bg-amber-500" : "bg-rose-500";
  const lookups = stats.entries + stats.hits; // each entry = one miss
  const hitRate = lookups > 0 ? stats.hits / lookups : null;

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["retrieval_cache", "cost_events"]} />
      <PageHeader
        title="Retrieval"
        stage="observe"
        description="Paid web research — Exa and Parallel — used to fact-check a thread before we reply. Every request is cached, so asking the same question again costs nothing, and a hard daily budget shuts research off once hit. The system fails closed: it never overspends."
        sources={["retrieval_cache", "cost_events"]}
      >
        <Link href="/costs" className="text-xs text-muted-foreground hover:text-foreground">
          ← Costs
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Cache hit rate"
          icon={Search}
          term="retrieval"
          source="hits ÷ (hits + cached)"
          value={hitRate === null ? "—" : `${Math.round(hitRate * 100)}%`}
          muted={hitRate === null}
          hint={`${stats.hits} repeat questions answered free from cache, across ${stats.entries} unique cached requests. Higher is cheaper.`}
        />
        <StatCard
          label="Saved by cache"
          icon={PiggyBank}
          term="retrieval"
          source="hits × avg miss cost"
          value={
            stats.hits === 0
              ? "—"
              : usd(stats.hits * (stats.miss_cost / Math.max(1, stats.entries)))
          }
          muted={stats.hits === 0}
          hint="Roughly how much money the cache saved by serving repeat research for free instead of paying again."
        />
        <StatCard
          label="Today's retrieval spend"
          icon={Wallet}
          term="retrieval"
          source="Σ cost_events (exa+parallel, today)"
          value={
            <>
              {usd(todaySpend)}{" "}
              <span className="text-sm font-normal text-muted-foreground">/ {usd(budget)}</span>
            </>
          }
          hint="Spent so far today against the hard daily budget. When the budget is hit, all paid research stops automatically."
          spark={
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{
                  width: `${Math.max(todaySpend > 0 ? 2 : 0, Math.round(fraction * 100))}%`,
                }}
              />
            </div>
          }
        />
      </div>

      <SectionCard
        title="Cache entries"
        term="retrieval"
        description="Each unique research request we've paid for, with how many times the cached answer was reused since (hits) and what the original call cost (miss cost). Newest use first."
        aside="by last use · max 50"
        bodyClassName=""
      >
        {entries.length === 0 ? (
          <EmptyState icon={Search} title="No retrieval calls yet">
            The qualify agent fires Exa and Parallel only on shortlisted candidates — so nothing
            is spent until a thread is worth researching.
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Request</th>
                <th className="px-4 py-2 text-right font-medium">Hits</th>
                <th className="px-4 py-2 text-right font-medium">Miss cost</th>
                <th className="px-4 py-2 text-right font-medium">Last used</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                        e.provider === "exa"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      }`}
                    >
                      {e.provider}
                    </span>
                  </td>
                  <td className="max-w-96 truncate px-4 py-2 text-xs">{requestLabel(e.request)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{e.hits}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {usd(e.cost_usd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-muted-foreground">
                    <RelTime iso={e.last_used_at.toISOString()} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <JsonModal title={`retrieval_cache/${e.id.slice(0, 8)}`} data={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
