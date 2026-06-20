import { Trash2 } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { ForgetUserForm } from "@/components/forget-user-form";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { RefreshOnChange } from "@/components/refresh-on-change";
import { RelTime } from "@/components/rel-time";
import { SectionCard } from "@/components/section-card";
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
      <PageHeader
        title="Data & retention"
        stage="ops"
        description="Privacy by design. The system keeps only the public GitHub data it needs to draft one helpful reply — nothing more. Raw threads that never went anywhere are deleted automatically after a set number of days, and any person can ask to be removed entirely, by username, with one form below."
        sources={["signals", "audit_log"]}
      >
        <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="surface px-4 py-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Retention horizon
            <InfoTip term="retention" />
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{days} days</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Set by SIGNAL_RETENTION_DAYS — raw unqualified signals older than this are deleted by
            the purge job.
          </p>
        </section>
        <section className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Purgeable now</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stats.purgeable}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Signals past the horizon with no candidate — the next{" "}
            <code className="font-mono">pnpm purge</code> run deletes exactly these.
          </p>
        </section>
        <section className="surface px-4 py-3">
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
        <section className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Distinct authors</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stats.authors}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
            Public usernames only — the full extent of personal data held.
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="What we store — and don't"
          description="The complete list of what's kept versus what's deliberately never collected. Data minimization means holding the least we can to do the job."
          bodyClassName="p-4"
        >
          <div className="grid grid-cols-2 gap-4 text-xs">
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
        </SectionCard>

        <SectionCard
          title="Forget a user"
          description="A privacy off-switch for one person. Enter a GitHub username and every row tied to it is deleted permanently — the signal cascades through candidates, touches, and outcomes — and the deletion is audit-logged."
        >
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Irreversible. Same effect as running{" "}
              <code className="font-mono">pnpm --filter agent forget-user &lt;username&gt;</code> on
              the server.
            </p>
            <ForgetUserForm />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Deletion log"
        description="Proof the privacy promises are kept: every automatic purge run and every forget-user request, pulled straight from the audit log."
        aside="purges + forget-user, last 10"
        bodyClassName=""
      >
        {log.length === 0 ? (
          <EmptyState icon={Trash2} title="No deletions yet">
            Purge runs and forget-user actions are recorded here from the audit log as they happen.
          </EmptyState>
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
      </SectionCard>
    </div>
  );
}
