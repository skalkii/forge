import { Database, GitBranch, Shield } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { PingButton } from "@/components/ping-button";
import { SectionCard } from "@/components/section-card";
import { providerCredentials, summarizeModel } from "@/lib/server/models";

export const dynamic = "force-dynamic";

const TIER_LABEL = { cheap: "Cheap model", strong: "Strong model" } as const;
const TIER_HINT = {
  cheap: "Triage — high volume, low stakes",
  strong: "Qualify + craft — low volume, judgment calls",
} as const;

export default function SettingsPage() {
  const models = [summarizeModel("cheap"), summarizeModel("strong")];
  const credentials = providerCredentials();

  const subPages = [
    {
      href: "/settings/github",
      icon: GitBranch,
      title: "GitHub budgets",
      blurb: "How much GitHub API headroom is left right now, read live from GitHub's own responses.",
    },
    {
      href: "/settings/db",
      icon: Database,
      title: "Database",
      blurb: "Every table with its row counts, plus the audit trail of who did what.",
    },
    {
      href: "/settings/data",
      icon: Shield,
      title: "Data & retention",
      blurb: "What public data we keep, the automatic purge, and how to forget a user entirely.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        stage="ops"
        description="The operator's toolbox. This page shows which AI models the agent runs on and whether their credentials are in place; the cards below open the rest of the controls — GitHub limits, database health, and privacy. Everything here is configured via .env, with no code changes."
        sources={["settings", "audit_log"]}
      />

      <SectionCard
        title="More controls"
        description="The rest of the operator settings, each on its own page."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {subPages.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className="surface flex flex-col gap-1.5 px-3.5 py-3 transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4 text-primary/70" />
                  {p.title}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{p.blurb}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="AI models"
        description="Two tiers run the agent: a cheap model handles high-volume triage; a strong model makes the judgment calls (qualify + craft). Each card shows the configured model and whether its API key is present. Both are swappable via .env."
        bodyClassName="grid gap-4 p-4 lg:grid-cols-2"
      >
        {models.map((m) => (
          <section key={m.tier} className="rounded-lg border bg-card">
            <header className="flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="text-sm font-medium">{TIER_LABEL[m.tier]}</h2>
              <code className="text-xs text-muted-foreground">{m.envVar}</code>
            </header>
            <div className="space-y-3 px-4 py-4">
              {m.error ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                  {m.error}
                </div>
              ) : (
                <>
                  <div className="text-lg font-semibold tabular-nums">{m.routerId}</div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd>{m.provider}</dd>
                    <dt className="text-muted-foreground">Model</dt>
                    <dd className="truncate" title={m.modelId ?? undefined}>
                      {m.modelId}
                    </dd>
                    <dt className="text-muted-foreground">Credential</dt>
                    <dd>
                      {m.credentialEnv ? (
                        <span
                          className={
                            m.credentialPresent
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {m.credentialEnv} {m.credentialPresent ? "set" : "missing"}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          unknown provider — no credential mapping
                        </span>
                      )}
                    </dd>
                  </dl>
                  {m.provider ? <PingButton provider={m.provider} /> : null}
                </>
              )}
              <p className="text-[11px] text-muted-foreground/70">{TIER_HINT[m.tier]}</p>
            </div>
          </section>
        ))}
      </SectionCard>

      <SectionCard
        title="Provider credentials"
        description="A quick presence check across every provider the model router can reach. Green means an API key is set in the environment; the actual values are never read or shown. Use Ping to confirm the key actually works."
        aside="presence only — values never shown"
        bodyClassName=""
      >
        <table className="w-full text-sm">
          <tbody>
            {credentials.map((c) => (
              <tr key={c.provider} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{c.provider}</td>
                <td className="px-4 py-2">
                  <code className="text-xs text-muted-foreground">{c.envVar}</code>
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      c.present
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        c.present ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    {c.present ? "set" : "not set"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <PingButton provider={c.provider} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
