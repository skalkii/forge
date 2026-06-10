import Link from "next/link";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SummaryRow = z.object({
  total: z.coerce.number(),
  last24h: z.coerce.number(),
  last7d: z.coerce.number(),
  events: z.coerce.number(),
});

const DailyRow = z.object({
  day: z.string(),
  provider: z.string(),
  spend: z.coerce.number(),
});

const CandidateSpendRow = z.object({
  candidate_id: z.string(),
  calls: z.coerce.number(),
  spend: z.coerce.number(),
});

const EventRow = z.object({
  id: z.string(),
  provider: z.string(),
  kind: z.string(),
  candidate_id: z.string().nullable(),
  tokens_in: z.coerce.number().nullable(),
  tokens_out: z.coerce.number().nullable(),
  cost_usd: z.coerce.number(),
  meta: z.unknown(),
  at: z.coerce.date(),
});

async function loadSummary() {
  const rows = await query(
    SummaryRow,
    `SELECT COALESCE(SUM(cost_usd), 0) AS total,
            COALESCE(SUM(cost_usd) FILTER (WHERE at > now() - interval '24 hours'), 0) AS last24h,
            COALESCE(SUM(cost_usd) FILTER (WHERE at > now() - interval '7 days'), 0) AS last7d,
            COUNT(*) AS events
       FROM cost_events`,
  );
  return rows[0];
}

async function loadDaily() {
  return query(
    DailyRow,
    `SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, provider,
            SUM(cost_usd) AS spend
       FROM cost_events
      WHERE at > now() - interval '14 days'
      GROUP BY 1, 2
      ORDER BY 1`,
  );
}

async function loadCandidateSpend() {
  return query(
    CandidateSpendRow,
    `SELECT candidate_id::text, COUNT(*) AS calls, SUM(cost_usd) AS spend
       FROM cost_events
      WHERE candidate_id IS NOT NULL
      GROUP BY candidate_id
      ORDER BY spend DESC
      LIMIT 20`,
  );
}

async function loadEvents() {
  return query(
    EventRow,
    `SELECT id, provider, kind, candidate_id::text, tokens_in, tokens_out, cost_usd, meta, at
       FROM cost_events
      ORDER BY at DESC
      LIMIT 50`,
  );
}

const PROVIDER_COLORS = [
  "bg-orange-500",
  "bg-amber-400",
  "bg-rose-400",
  "bg-teal-500",
  "bg-violet-400",
  "bg-lime-600",
];

function usd(n: number): string {
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function DailyChart({ rows }: { rows: z.infer<typeof DailyRow>[] }) {
  const providers = [...new Set(rows.map((r) => r.provider))].sort();
  const colorOf = new Map(providers.map((p, i) => [p, PROVIDER_COLORS[i % PROVIDER_COLORS.length]]));

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  }
  const byDay = new Map(days.map((d) => [d, new Map<string, number>()]));
  for (const r of rows) byDay.get(r.day)?.set(r.provider, r.spend);
  const maxTotal = Math.max(
    ...days.map((d) => [...byDay.get(d)!.values()].reduce((a, b) => a + b, 0)),
    1e-9,
  );

  return (
    <div className="space-y-3">
      <div className="flex h-36 items-end gap-1.5">
        {days.map((d) => {
          const parts = byDay.get(d)!;
          const total = [...parts.values()].reduce((a, b) => a + b, 0);
          return (
            <div
              key={d}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d} — ${usd(total)}`}
            >
              <div
                className="flex flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${total === 0 ? 0 : Math.max(3, (total / maxTotal) * 100)}%` }}
              >
                {providers.map((p) => {
                  const v = parts.get(p) ?? 0;
                  if (v === 0) return null;
                  return (
                    <div key={p} className={colorOf.get(p)} style={{ flexGrow: v, flexBasis: 0 }} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{days[0]}</span>
        <span>{days[13]} (UTC days)</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {providers.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${colorOf.get(p)}`} />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function CostsPage() {
  const [summary, daily, candidateSpend, events] = await Promise.all([
    loadSummary(),
    loadDaily(),
    loadCandidateSpend(),
    loadEvents(),
  ]);

  const cards = [
    { label: "Last 24h", value: usd(summary.last24h), hint: "Rolling 24-hour spend across all providers" },
    { label: "Last 7 days", value: usd(summary.last7d), hint: "Rolling weekly spend — watch the trend, not the day" },
    { label: "All time", value: usd(summary.total), hint: "Everything this agent has ever spent" },
    { label: "Paid calls", value: String(summary.events), hint: "Count of individual metered API calls" },
  ];

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["cost_events"]} />
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Costs</h1>
          <Link
            href="/costs/retrieval"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Retrieval →
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Every paid call the system makes — model inference, embeddings, web research — is
          metered here the moment it happens. This feeds the headline metric: how much it costs
          to activate one developer. By design, money is only spent on a thread after cheap
          triage says it&apos;s worth it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <section key={c.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{c.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{c.hint}</p>
          </section>
        ))}
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Daily spend by provider</h2>
          <span className="text-xs text-muted-foreground">last 14 days</span>
        </header>
        <div className="px-4 py-4">
          {daily.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No spend recorded yet. Paid calls (LLM, embedding, search, enrich) appear here live.
            </p>
          ) : (
            <DailyChart rows={daily} />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Spend per candidate</h2>
            <span className="text-xs text-muted-foreground">top 20</span>
          </header>
          {candidateSpend.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              No per-candidate spend yet — money is only spent after triage passes (enrich,
              qualify, craft).
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Candidate</th>
                  <th className="px-4 py-2 text-right font-medium">Calls</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                </tr>
              </thead>
              <tbody>
                {candidateSpend.map((c) => (
                  <tr key={c.candidate_id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{c.candidate_id.slice(0, 8)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.calls}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{usd(c.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Recent events</h2>
            <span className="text-xs text-muted-foreground">last 50</span>
          </header>
          {events.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No cost events yet.</div>
          ) : (
            <ul>
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <RelTime
                      iso={e.at.toISOString()}
                      className="whitespace-nowrap tabular-nums text-muted-foreground"
                    />
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {e.provider}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {e.kind}
                    </span>
                    {e.tokens_in !== null && (
                      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {e.tokens_in}→{e.tokens_out ?? 0} tok
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs">{usd(e.cost_usd)}</span>
                    <JsonModal title={`cost_events/${e.id.slice(0, 8)}`} data={e} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
