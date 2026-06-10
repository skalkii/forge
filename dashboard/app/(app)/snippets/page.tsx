import { snippetRegistry } from "@forge/agent/snippets";
import { z } from "zod";

import { JsonModal } from "@/components/json-modal";
import { RefreshOnChange } from "@/components/refresh-on-change";
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
      {row.status} · {row.ran_at.toISOString().slice(5, 16).replace("T", " ")}
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
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Snippets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select-and-fill template library (R2) — the craft agent picks an id + params, never
          writes code. Validate against the live VideoDB API with{" "}
          <code>pnpm --filter agent validate:snippets</code>; failures block deploy.
        </p>
      </div>

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
              <p className="text-xs text-muted-foreground">
                params:{" "}
                {Object.keys(t.sampleParams).map((k) => (
                  <code key={k} className="mr-1.5 rounded bg-muted px-1 py-0.5">
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

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Validation runs</h2>
          <span className="text-xs text-muted-foreground">last 20</span>
        </header>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No validation runs yet — needs <code>VIDEODB_API_KEY</code> and{" "}
            <code>agent/.venv</code> with the videodb package.
          </div>
        ) : (
          <ul>
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {r.ran_at.toISOString().slice(5, 16).replace("T", " ")}
                  </span>
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
      </section>
    </div>
  );
}
