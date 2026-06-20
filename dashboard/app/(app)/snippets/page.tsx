import { snippetRegistry } from "@forge/agent/snippets";
import { Code2, FlaskConical } from "lucide-react";
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

const ValidationRow = z.object({
  id: z.string(),
  template_id: z.string(),
  status: z.string(),
  output: z.string().nullable(),
  duration_ms: z.coerce.number(),
  ran_at: z.coerce.date(),
});

async function loadLatest() {
  return query(
    ValidationRow,
    `SELECT DISTINCT ON (template_id) id, template_id, status, output, duration_ms, ran_at
       FROM snippet_validations
      ORDER BY template_id, ran_at DESC`,
  );
}

async function loadRecent() {
  return query(
    ValidationRow,
    `SELECT id, template_id, status, output, duration_ms, ran_at
       FROM snippet_validations
      ORDER BY ran_at DESC
      LIMIT 20`,
  );
}

function StatusPill({ row }: { row: z.infer<typeof ValidationRow> | undefined }) {
  if (!row) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        never validated
      </span>
    );
  }
  const passed = row.status === "passed";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        passed
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      }`}
    >
      {row.status} <RelTime iso={row.ran_at.toISOString()} />
    </span>
  );
}

export default async function SnippetsPage() {
  const [latest, recent] = await Promise.all([loadLatest(), loadRecent()]);
  const latestOf = new Map(latest.map((r) => [r.template_id, r]));
  const templates = Object.values(snippetRegistry);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["snippet_validations"]} />
      <PageHeader
        title="Snippets"
        stage="craft"
        description={
          <>
            Pre-tested code examples the AI fills in when it writes a reply — it never invents code
            freehand. Every template here is re-run against the real VideoDB API every night, so
            anything posted publicly is known to actually work. A green pill means the example
            passed its last run; a red pill means it broke and is held back until fixed.
          </>
        }
        sources={["snippet_validations"]}
      />

      <SectionCard
        title="Template library"
        term="snippet"
        description={
          <>
            The hand-maintained code examples the Craft step chooses from and fills in. Each card
            shows what the example does, which blanks the AI fills, and how its most recent nightly
            validation went.
          </>
        }
        aside={
          <span className="inline-flex items-center gap-1">
            {templates.length} template{templates.length === 1 ? "" : "s"}
            <InfoTip term="craft" />
          </span>
        }
        bodyClassName="p-4"
      >
        {templates.length === 0 ? (
          <EmptyState icon={Code2} title="No templates registered yet">
            The Craft step picks a reply from this library and fills in the blanks. Templates are
            added by hand and validated nightly before they can be used.
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((t) => (
              <section key={t.id} className="rounded-lg border bg-card">
                <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-medium">{t.id}</code>
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {t.capability}
                    </span>
                  </div>
                  <StatusPill row={latestOf.get(t.id)} />
                </header>
                <div className="space-y-3 px-4 py-3">
                  <p className="text-sm">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      blanks the AI fills
                      <InfoTip>
                        The named values the AI plugs into this template (for example a video URL or
                        a search query). It can only fill these blanks — it cannot change the code
                        around them.
                      </InfoTip>
                      :
                    </span>
                    {Object.keys(t.sampleParams).map((k) => (
                      <code key={k} className="rounded bg-muted px-1 py-0.5">
                        {k}
                      </code>
                    ))}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      template source
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                      {t.code}
                    </pre>
                  </details>
                </div>
              </section>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Validation runs"
        description={
          <>
            The most recent times each template was executed against the live VideoDB API. This is
            the nightly check that keeps the library honest —{" "}
            <span className="text-emerald-600 dark:text-emerald-400">passed</span> means it still
            works, <span className="text-rose-600 dark:text-rose-400">failed</span> means it broke
            and is pulled from rotation until repaired.
          </>
        }
        aside="last 20"
        bodyClassName=""
      >
        {recent.length === 0 ? (
          <EmptyState icon={FlaskConical} title="No validation runs yet">
            Nightly validation needs <code className="font-mono">VIDEODB_API_KEY</code> and{" "}
            <code className="font-mono">agent/.venv</code> with the videodb package. Once set up,
            every template&apos;s run lands here with its pass/fail result and timing.
          </EmptyState>
        ) : (
          <ul>
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <RelTime
                    iso={r.ran_at.toISOString()}
                    className="whitespace-nowrap tabular-nums text-muted-foreground"
                  />
                  <code>{r.template_id}</code>
                  <span
                    className={
                      r.status === "passed"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  >
                    {r.status}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {(r.duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <JsonModal title={`snippet_validations/${r.id.slice(0, 8)}`} data={r} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
