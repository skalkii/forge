import { ScrollText } from "lucide-react";
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

const TableRow = z.object({
  table_name: z.string(),
  column_count: z.coerce.number(),
  row_count: z.coerce.number(),
  has_notify: z.boolean(),
});

const AuditRow = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  subject_table: z.string().nullable(),
  subject_id: z.string().nullable(),
  detail: z.unknown().nullable(),
  at: z.coerce.date(),
});

async function loadTables() {
  return query(
    TableRow,
    `SELECT c.relname AS table_name,
            (SELECT count(*) FROM information_schema.columns col
              WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS column_count,
            (SELECT count(*) FROM pg_trigger tg
              WHERE tg.tgrelid = c.oid AND tg.tgname LIKE '%_notify') > 0 AS has_notify,
            COALESCE((SELECT n_live_tup FROM pg_stat_user_tables s WHERE s.relid = c.oid), 0) AS row_count
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`,
  );
}

async function loadAuditTail() {
  return query(
    AuditRow,
    `SELECT id, actor, action, subject_table, subject_id, detail, at
       FROM audit_log ORDER BY at DESC LIMIT 25`,
  );
}

export default async function DbSettingsPage() {
  const [tables, audit] = await Promise.all([loadTables(), loadAuditTail()]);

  return (
    <div className="space-y-6">
      <RefreshOnChange />
      <PageHeader
        title="Database"
        stage="ops"
        description="A live look inside the database that backs the whole system. The table below lists every table with how many rows it holds and whether it pushes its changes to this dashboard in real time. Underneath sits the audit trail — a tamper-evident record of who did what."
        sources={["pg_class", "pg_stat_user_tables", "audit_log"]}
      >
        <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
      </PageHeader>

      <SectionCard
        title="Tables"
        description="Every table in the database, with its column count, an approximate live row count, and whether it has a NOTIFY trigger that tells this dashboard to refresh the moment its data changes."
        aside="public schema"
        bodyClassName="p-0"
      >
        <ScrollList maxH="max-h-[30rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Table</th>
                <th className="px-4 py-2 text-right font-medium">Columns</th>
                <th className="px-4 py-2 text-right font-medium">Rows</th>
                <th className="px-4 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    NOTIFY
                    <InfoTip>
                      A green dot means this table has a trigger that pings the dashboard the instant
                      its rows change, so the view updates live without a manual refresh.
                    </InfoTip>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.table_name} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-mono text-xs">
                    <span className="block min-w-0 truncate">{t.table_name}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.column_count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.row_count}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`inline-block size-1.5 rounded-full ${
                        t.has_notify ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`}
                      title={t.has_notify ? "forge_notify trigger attached" : "no trigger"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollList>
      </SectionCard>

      <SectionCard
        title="Audit log"
        description="The system's diary of who did what: every reviewer decision, kill-switch flip, and deletion, recorded as it happens and shown newest first. It's the accountability record that proves a human stayed in control."
        aside={
          <span className="inline-flex items-center gap-1">
            last 25 entries
            <InfoTip>
              An audit log is an append-only history of important actions — who did it, what they
              did, and when — kept so nothing significant happens without a trace.
            </InfoTip>
          </span>
        }
        bodyClassName="p-0"
      >
        {audit.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries yet">
            Reviewer decisions, kill-switch flips, and deletions are recorded here as they happen.
          </EmptyState>
        ) : (
          <ScrollList maxH="max-h-[30rem]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">At</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Subject</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                      <RelTime iso={row.at.toISOString()} />
                    </td>
                    <td className="px-4 py-2">
                      <span className="block min-w-0 truncate">{row.actor}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.subject_table ? `${row.subject_table}/${row.subject_id ?? "—"}` : "—"}
                    </td>
                    <td className="max-w-64 truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.detail ? JSON.stringify(row.detail) : "—"}
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
