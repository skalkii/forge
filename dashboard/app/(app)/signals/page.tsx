import { Radar } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { JsonModal } from "@/components/json-modal";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const DupRow = z.object({
  id: z.string(),
  url: z.string(),
  repo: z.string(),
  author: z.string(),
  title: z.string(),
});

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
  embedded: z.boolean(),
  dups: z.array(DupRow),
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
  // canonical rows only — near-dups collapse under their cluster head (19b)
  where.push("dup_of IS NULL");
  return query(
    SignalRow,
    `SELECT s.id, s.external_id, s.url, s.repo, s.author, s.title, s.excerpt,
            s.query, s.found_at, s.created_at,
            s.embedding IS NOT NULL AS embedded,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'id', d.id, 'url', d.url, 'repo', d.repo,
                        'author', d.author, 'title', d.title)
                      ORDER BY d.found_at)
                 FROM signals d WHERE d.dup_of = s.id),
              '[]'::json
            ) AS dups
       FROM signals s
      WHERE ${where.join(" AND ")}
      ORDER BY s.found_at DESC
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
      <PageHeader
        title="Signals"
        stage="sense"
        description="Every GitHub thread discovery found, before any AI judged it. We keep only the public minimum — username, link, repo, and the matched excerpt — and near-duplicates are folded under their first sighting so we never chase the same problem twice. New finds appear here live."
        sources={["signals"]}
      />

      <SectionCard
        title="Filter the feed"
        description="Narrow the list by the search query that surfaced a thread, or by the repository it lives in."
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              Strategy query
              <InfoTip>
                One of the saved GitHub searches the system runs to find people stuck on video
                problems. Picking one shows only the threads it surfaced.
              </InfoTip>
            </span>
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
      </SectionCard>

      <SectionCard
        title="Feed"
        term="signal"
        description="One row per GitHub thread, newest first. Click the title to read it on GitHub, or open the raw record to see exactly what we stored."
        aside={`${signals.length} shown · newest first`}
        bodyClassName=""
      >
        {signals.length === 0 ? (
          <EmptyState icon={Radar} title={`No signals${q || repo ? " match this filter" : " yet"}`}>
            Discovery runs write threads here as it finds them. Trigger one manually with{" "}
            <code className="font-mono">pnpm --filter agent loop</code>.
          </EmptyState>
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
                      <RelTime iso={s.found_at.toISOString()} className="tabular-nums" />
                      <span
                        className="max-w-56 truncate rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                        title={s.query}
                      >
                        {s.query}
                      </span>
                      {!s.embedded && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                          pending dedup
                          <InfoTip>
                            We haven&apos;t yet turned this thread&apos;s text into &quot;meaning
                            numbers&quot; to compare it against others, so its duplicate check is
                            still pending.
                          </InfoTip>
                        </span>
                      )}
                    </div>
                    {s.dups.length > 0 && (
                      <details className="mt-2">
                        <summary className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          {s.dups.length} near-duplicate{s.dups.length > 1 ? "s" : ""} collapsed
                          <InfoTip term="dedup" />
                        </summary>
                        <ul className="mt-1.5 space-y-1 border-l-2 border-amber-500/30 pl-3">
                          {s.dups.map((d) => (
                            <li key={d.id} className="text-xs text-muted-foreground">
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline"
                              >
                                {d.title}
                              </a>{" "}
                              <span className="font-mono text-[11px]">
                                {d.repo} · {d.author}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <JsonModal title={`signals/${s.id.slice(0, 8)}`} data={s} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
