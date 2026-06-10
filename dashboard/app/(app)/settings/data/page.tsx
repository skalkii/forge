import Link from "next/link";
import { z } from "zod";

import { ForgetUserForm } from "@/components/forget-user-form";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const StatsRow = z.object({
  total_signals: z.coerce.number(),
  purgeable: z.coerce.number(),
  oldest: z.coerce.date().nullable(),
  authors: z.coerce.number(),
});

const AuditRow = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  subject_id: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  at: z.coerce.date(),
});

function retentionDays(): number {
  const n = Number(process.env.SIGNAL_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}

async function loadStats(days: number) {
  // aggregate query — always exactly one row
  return (await queryOne(
    StatsRow,
    `SELECT COUNT(*) AS total_signals,
            COUNT(*) FILTER (
              WHERE created_at < now() - make_interval(days => $1)
                AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.signal_id = signals.id)
            ) AS purgeable,
            MIN(created_at) AS oldest,
            COUNT(DISTINCT author) AS authors
       FROM signals`,
    [days],
  ))!;
}

async function loadDeletionLog() {
  return query(
    AuditRow,
    `SELECT id::text, actor, action, subject_id, detail, at
       FROM audit_log
      WHERE action IN ('signals.purged', 'user.forgotten')
      ORDER BY at DESC
      LIMIT 10`,
  );
}

const STORED = ["GitHub username", "thread / issue URL", "repo name", "matched excerpt"];
const NOT_STORED = ["emails", "profile data", "follower graphs", "anything scraped beyond the thread"];

export default async function DataSettingsPage() {
  const days = retentionDays();
  const [stats, log] = await Promise.all([loadStats(days), loadDeletionLog()]);

  return (
    <div className="space-y-6">
      <RefreshOnChange tables={["signals", "audit_log"]} />
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Data & retention</h1>
          <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
            ← Settings
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Data minimization (R7): the system stores only the public GitHub data needed to draft
          one helpful reply. Raw signals that never became candidates are purged on a nightly
          horizon, and any person can be deleted entirely, on request, by username.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Retention horizon</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{days} days</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            SIGNAL_RETENTION_DAYS — raw unqualified signals older than this are deleted by the
            purge job.
          </p>
        </section>
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Purgeable now</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stats.purgeable}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Signals past the horizon with no candidate — the next{" "}
            <code className="font-mono">pnpm purge</code> run deletes exactly these.
          </p>
        </section>
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Signals stored</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stats.total_signals}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            {stats.oldest ? (
              <>
                oldest <RelTime iso={stats.oldest.toISOString()} />
              </>
            ) : (
              "none yet"
            )}
          </p>
        </section>
        <section className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Distinct authors</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stats.authors}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Public usernames only — the full extent of personal data held.
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <header className="border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">What we store — and don&apos;t</h2>
          </header>
          <div className="grid grid-cols-2 gap-4 px-4 py-3 text-xs">
            <div>
              <p className="mb-1.5 font-medium text-emerald-600 dark:text-emerald-400">Stored</p>
              <ul className="space-y-1 text-muted-foreground">
                {STORED.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-rose-600 dark:text-rose-400">Never stored</p>
              <ul className="space-y-1 text-muted-foreground">
                {NOT_STORED.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Forget a user</h2>
          </header>
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Deletes every row for one GitHub username — the signal cascades through candidates,
              touches, and outcomes. Irreversible, audit-logged. Same effect as{" "}
              <code className="font-mono">pnpm --filter agent forget-user &lt;username&gt;</code>.
            </p>
            <ForgetUserForm />
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Deletion log</h2>
          <span className="text-xs text-muted-foreground">purges + forget-user, last 10</span>
        </header>
        {log.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No deletions yet — purge runs and forget-user actions are recorded here from the
            audit log.
          </div>
        ) : (
          <ul>
            {log.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs last:border-b-0"
              >
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                    e.action === "user.forgotten"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {e.action}
                </span>
                {e.subject_id && <span className="font-mono">{e.subject_id}</span>}
                <span className="text-muted-foreground">
                  {e.action === "signals.purged"
                    ? `${(e.detail?.purged as number) ?? "?"} signal(s) past ${(e.detail?.retentionDays as number) ?? "?"}d`
                    : `${(e.detail?.signals as number) ?? 0} signals, ${(e.detail?.candidates as number) ?? 0} candidates, ${(e.detail?.touches as number) ?? 0} touches`}
                </span>
                <span className="text-muted-foreground">by {e.actor}</span>
                <RelTime
                  iso={e.at.toISOString()}
                  className="ml-auto tabular-nums text-muted-foreground"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
