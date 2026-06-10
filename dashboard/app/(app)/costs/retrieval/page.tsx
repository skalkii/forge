import Link from "next/link";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
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
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Retrieval</h1>
          <Link href="/costs" className="text-xs text-muted-foreground hover:text-foreground">
            ← Costs
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Exa + Parallel enrichment through <code>lib/retrieval.ts</code> — cached, metered, and
          capped by a daily budget that fails closed. Money is only spent after triage passes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Cache hit rate</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {hitRate === null ? "—" : `${Math.round(hitRate * 100)}%`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stats.hits} hits · {stats.entries} cached requests
          </p>
        </section>
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Saved by cache</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {stats.hits === 0 ? "—" : usd(stats.hits * (stats.miss_cost / Math.max(1, stats.entries)))}
          </p>
          <p className="text-[11px] text-muted-foreground">hits × avg miss cost</p>
        </section>
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Today&apos;s retrieval spend</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {usd(todaySpend)} <span className="text-xs text-muted-foreground">/ {usd(budget)}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.max(todaySpend > 0 ? 2 : 0, Math.round(fraction * 100))}%` }}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Cache entries</h2>
          <span className="text-xs text-muted-foreground">by last use · max 50</span>
        </header>
        {entries.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No retrieval calls yet — the qualify agent fires Exa/Parallel only on shortlisted
            candidates.
          </div>
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
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {usd(e.cost_usd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {e.last_used_at.toISOString().slice(5, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <JsonModal title={`retrieval_cache/${e.id.slice(0, 8)}`} data={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
