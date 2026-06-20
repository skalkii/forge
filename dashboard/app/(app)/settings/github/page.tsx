import { GitBranch } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { ScrollList } from "@/components/scroll-list";
import { SectionCard } from "@/components/section-card";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const BudgetRow = z.object({
  resource: z.string(),
  rate_limit: z.coerce.number().nullable(),
  rate_remaining: z.coerce.number().nullable(),
  rate_reset_at: z.coerce.date().nullable(),
  at: z.coerce.date(),
});

const RequestRow = z.object({
  id: z.string(),
  resource: z.string(),
  method: z.string(),
  route: z.string(),
  status: z.coerce.number().nullable(),
  rate_remaining: z.coerce.number().nullable(),
  rate_limit: z.coerce.number().nullable(),
  latency_ms: z.coerce.number().nullable(),
  at: z.coerce.date(),
});

async function loadBudgets() {
  // last observed header values per resource — the live budget
  return query(
    BudgetRow,
    `SELECT DISTINCT ON (resource) resource, rate_limit, rate_remaining, rate_reset_at, at
       FROM github_requests
      ORDER BY resource, at DESC`,
  );
}

async function loadRecentRequests() {
  return query(
    RequestRow,
    `SELECT id, resource, method, route, status, rate_remaining, rate_limit, latency_ms, at
       FROM github_requests
      WHERE at > now() - interval '1 hour'
      ORDER BY at DESC
      LIMIT 50`,
  );
}

function gaugeColor(fraction: number): string {
  if (fraction > 0.5) return "bg-emerald-500";
  if (fraction > 0.2) return "bg-amber-500";
  return "bg-rose-500";
}

const RESOURCE_HINT: Record<string, string> = {
  search: "Search API — small separate pool (~30/min authenticated), used by discovery",
  core: "Core REST — large pool (~15k/hr for an App), everything else",
};

function BudgetGauge({ b }: { b: z.infer<typeof BudgetRow> }) {
  const known = b.rate_limit !== null && b.rate_remaining !== null && b.rate_limit > 0;
  const fraction = known ? b.rate_remaining! / b.rate_limit! : 0;
  const resetIn =
    b.rate_reset_at && b.rate_reset_at.getTime() > Date.now()
      ? Math.ceil((b.rate_reset_at.getTime() - Date.now()) / 1000)
      : null;

  return (
    <section className="surface">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium capitalize">{b.resource}</h2>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {known ? `${b.rate_remaining} / ${b.rate_limit}` : "unknown"}
        </span>
      </header>
      <div className="space-y-3 px-4 py-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          {known && (
            <div
              className={`h-full rounded-full ${gaugeColor(fraction)}`}
              style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0">{RESOURCE_HINT[b.resource] ?? "secondary rate-limit pool"}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">
            {resetIn !== null ? `resets in ${resetIn}s` : "window rolled over"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Last read <RelTime iso={b.at.toISOString()} /> — budgets come from live{" "}
          <code>x-ratelimit-*</code> headers, never hardcoded (R4).
        </p>
      </div>
    </section>
  );
}

export default async function GithubSettingsPage() {
  const [budgets, requests] = await Promise.all([loadBudgets(), loadRecentRequests()]);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["github_requests"]} />
      <PageHeader
        title="GitHub budgets"
        stage="ops"
        description="GitHub limits how often you can call it, and it counts searching separately from everything else: a small allowance for search (what discovery uses to find threads) and a large one for the rest. We track both live — read from the headers GitHub returns with every response — so the agent always stays a polite, low-frequency guest and never gets rate-limited by surprise."
        sources={["github_requests"]}
      >
        <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
      </PageHeader>

      <SectionCard
        title="Live rate budgets"
        description="How much headroom is left in each of GitHub's two allowances right now. Green is plenty, amber is getting low, red means nearly exhausted — at which point the agent waits for the window to reset rather than push through."
        term="rate-budget"
        aside={<InfoTip term="rate-budget" />}
        bodyClassName="p-4"
      >
        {budgets.length === 0 ? (
          <EmptyState icon={GitBranch} title="No GitHub requests logged yet">
            Budgets appear after the first call through the github-client — a discovery run or a
            manual search.
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {budgets.map((b) => (
              <BudgetGauge key={b.resource} b={b} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Request log"
        description="The most recent calls the agent made to GitHub, with the rate budget remaining at the time of each one. A quick way to confirm the agent is pacing itself and that requests are succeeding."
        aside="last 1h · max 50"
        bodyClassName="p-0"
      >
        {requests.length === 0 ? (
          <EmptyState icon={GitBranch} title="No requests in the last hour">
            Each call the agent makes to GitHub is logged here with its status, budget, and latency.
          </EmptyState>
        ) : (
          <ScrollList maxH="max-h-[30rem]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">At</th>
                  <th className="px-4 py-2 font-medium">Resource</th>
                  <th className="px-4 py-2 font-medium">Request</th>
                  <th className="px-4 py-2 text-right font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                      <RelTime iso={r.at.toISOString()} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs ${
                          r.resource === "search"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.resource}
                      </span>
                    </td>
                    <td className="max-w-80 truncate px-4 py-2 font-mono text-xs">
                      {r.method} {r.route}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        r.status && r.status < 400 ? "" : "text-rose-500"
                      }`}
                    >
                      {r.status ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {r.rate_remaining !== null && r.rate_limit !== null
                        ? `${r.rate_remaining}/${r.rate_limit}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {r.latency_ms !== null ? `${r.latency_ms}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollList>
        )}
      </SectionCard>
    </div>
  );
}
