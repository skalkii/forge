import Link from "next/link";
import { z } from "zod";

import { DraftBody } from "@/components/draft-body";
import { JsonModal } from "@/components/json-modal";
import { PageIntro } from "@/components/page-intro";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const ScorerResult = z.object({ score: z.number(), reason: z.string() }).nullable();

const DraftRow = z.object({
  touch_id: z.string(),
  template_id: z.string().nullable(),
  variant: z.string().nullable(),
  draft_body: z.string(),
  disclosure_ok: z.boolean().nullable(),
  touch_created_at: z.coerce.date(),
  candidate_id: z.string(),
  run_id: z.string().nullable(),
  fit_score: z.number().nullable(),
  capability: z.string().nullable(),
  qualify_reasons: z.array(z.string()).nullable(),
  title: z.string(),
  excerpt: z.string(),
  repo: z.string(),
  author: z.string(),
  url: z.string(),
  guardrail: ScorerResult,
  quality: ScorerResult,
});

const CapRow = z.object({ posted_today: z.coerce.number() });

async function loadDrafts() {
  // a draft is reviewable when its run is suspended at the human gate:
  // candidate sits in 'review' and the touch has no decision yet
  return query(
    DraftRow,
    `SELECT t.id AS touch_id, t.template_id, t.variant, t.draft_body,
            t.disclosure_ok, t.created_at AS touch_created_at,
            c.id::text AS candidate_id, c.run_id, c.fit_score, c.capability,
            c.qualify_reasons,
            s.title, s.excerpt, s.repo, s.author, s.url,
            m.snapshot->'context'->'scorers'->'output'->'guardrail' AS guardrail,
            m.snapshot->'context'->'scorers'->'output'->'quality' AS quality
       FROM touches t
       JOIN candidates c ON c.id = t.candidate_id
       JOIN signals s ON s.id = c.signal_id
       LEFT JOIN mastra_workflow_snapshot m ON m.run_id = c.run_id
      WHERE t.decision IS NULL
        AND c.status = 'review'
      ORDER BY t.created_at ASC`,
  );
}

async function loadPostedToday() {
  const row = await queryOne(
    CapRow,
    `SELECT count(*)::int AS posted_today
       FROM touches WHERE posted_at >= date_trunc('day', now())`,
  );
  return row?.posted_today ?? 0;
}

function dailyTouchCap(): number {
  const n = Number(process.env.DAILY_TOUCH_CAP);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export default async function DraftsPage() {
  const [drafts, postedToday] = await Promise.all([loadDrafts(), loadPostedToday()]);
  const cap = dailyTouchCap();
  const touchesEnabled = process.env.TOUCHES_ENABLED === "true";

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["touches", "candidates"]} />
      <PageIntro title="Drafts">
        Replies waiting for a human decision. Each one is a suspended touch-workflow run — nothing
        posts without approval here, ever. The affiliation disclosure (R3) is highlighted in every
        draft; the spam guardrail has already hard-checked it.
      </PageIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full border px-2.5 py-1 ${
            postedToday >= cap
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-card text-muted-foreground"
          }`}
          title="DAILY_TOUCH_CAP — the guardrail hard-fails any draft once reached"
        >
          daily cap: <span className="tabular-nums">{postedToday}/{cap}</span> posted today
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 ${
            touchesEnabled
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
          title="TOUCHES_ENABLED — the act step refuses to post unless this is 'true', even after approval"
        >
          posting {touchesEnabled ? "enabled" : "disabled — approvals are recorded but nothing posts"}
        </span>
        <span className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground">
          {drafts.length} awaiting review
        </span>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          Nothing to review. Drafts land here when a touch run reaches the human gate — run the
          dispatcher (<code>pnpm --filter agent dispatch</code>) with queued candidates to produce
          one.
        </div>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.touch_id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-medium leading-snug hover:underline"
                  >
                    {d.title}
                  </a>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{d.repo}</span>
                    <span>by {d.author}</span>
                    <span title="qualify fit — is VideoDB genuinely the answer?">
                      fit{" "}
                      <span className="tabular-nums">
                        {d.fit_score === null ? "—" : d.fit_score.toFixed(2)}
                      </span>
                    </span>
                    {d.capability ? (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">
                        {d.capability}
                      </span>
                    ) : null}
                    {d.template_id ? (
                      <span
                        className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400"
                        title="snippet template (R2 — select-and-fill, never freeform code)"
                      >
                        {d.template_id}
                      </span>
                    ) : null}
                    {d.variant ? <span>variant {d.variant}</span> : null}
                    <RelTime iso={d.touch_created_at.toISOString()} className="tabular-nums" />
                    <Link
                      href={`/candidates/${d.candidate_id}`}
                      className="font-mono underline-offset-2 hover:text-foreground hover:underline"
                    >
                      full journey →
                    </Link>
                  </div>
                </div>
                <JsonModal title={`touches/${d.touch_id.slice(0, 8)}`} data={d} />
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Original thread excerpt
                </summary>
                <p className="mt-1.5 whitespace-pre-wrap border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground">
                  {d.excerpt}
                </p>
              </details>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={
                    d.guardrail?.score === 1
                      ? "rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400"
                      : "rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-600 dark:text-rose-400"
                  }
                  title={
                    d.guardrail?.score === 1
                      ? "deterministic hard gate passed: disclosure, caps, dedup, kill-switch, links"
                      : (d.guardrail?.reason ?? "guardrail result missing")
                  }
                >
                  guardrail {d.guardrail?.score === 1 ? "passed" : "FAILED"}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    d.quality
                      ? d.quality.score >= 0.7
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                  title={d.quality?.reason ?? "advisory model judge — unavailable for this draft"}
                >
                  quality{" "}
                  {d.quality ? (
                    <span className="tabular-nums">{d.quality.score.toFixed(2)}</span>
                  ) : (
                    "n/a"
                  )}
                </span>
                <span
                  className={
                    d.disclosure_ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                  title="R3 — affiliation disclosure must be present verbatim"
                >
                  disclosure {d.disclosure_ok ? "present" : "MISSING"}
                </span>
              </div>

              <DraftBody body={d.draft_body} />

              <p className="text-xs text-muted-foreground">
                Approve / edit / reject actions arrive in the next commit — this run stays
                suspended until then.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
