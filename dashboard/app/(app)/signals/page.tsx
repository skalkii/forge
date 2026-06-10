import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SignalRow = z.object({
  id: z.string(),
  external_id: z.string(),
  url: z.string(),
  repo: z.string(),
  author: z.string(),
  title: z.string(),
  excerpt: z.string(),
  query: z.string(),
  found_at: z.coerce.date(),
  created_at: z.coerce.date(),
});

const QueryRow = z.object({ query: z.string(), n: z.coerce.number() });

async function loadSignals(q?: string, repo?: string) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(q);
    where.push(`query = $${params.length}`);
  }
  if (repo) {
    params.push(`%${repo}%`);
    where.push(`repo ILIKE $${params.length}`);
  }
  return query(
    SignalRow,
    `SELECT * FROM signals
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY found_at DESC
      LIMIT 100`,
    params,
  );
}

async function loadQueries() {
  return query(QueryRow, `SELECT query, count(*) AS n FROM signals GROUP BY query ORDER BY n DESC`);
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; repo?: string }>;
}) {
  const { q, repo } = await searchParams;
  const [signals, queries] = await Promise.all([loadSignals(q, repo), loadQueries()]);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["signals"]} />
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Signals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw discovery results — one row per GitHub thread, R7-minimal (username, URL, repo,
          excerpt). New rows appear live on NOTIFY.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Strategy query
          <select
            name="q"
            defaultValue={q ?? ""}
            className="rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">all queries</option>
            {queries.map((row) => (
              <option key={row.query} value={row.query}>
                {row.query.slice(0, 60)} ({row.n})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Repo contains
          <input
            name="repo"
            defaultValue={repo ?? ""}
            placeholder="owner/name"
            className="rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
        >
          Filter
        </button>
      </form>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Feed</h2>
          <span className="text-xs text-muted-foreground">
            {signals.length} shown · newest first
          </span>
        </header>
        {signals.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No signals{q || repo ? " match the filter" : " yet"}. Discovery runs write here; trigger
            one with <code>pnpm --filter agent loop</code>.
          </div>
        ) : (
          <ul>
            {signals.map((s) => (
              <li key={s.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {s.title}
                    </a>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.excerpt}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{s.repo}</span>
                      <span>by {s.author}</span>
                      <span className="tabular-nums">
                        {s.found_at.toISOString().replace("T", " ").slice(0, 16)} UTC
                      </span>
                      <span
                        className="max-w-56 truncate rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                        title={s.query}
                      >
                        {s.query}
                      </span>
                    </div>
                  </div>
                  <JsonModal title={`signals/${s.id.slice(0, 8)}`} data={s} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
