import Link from "next/link";

import { PingButton } from "@/components/ping-button";
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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Settings</h1>
          <Link href="/settings/db" className="text-xs text-muted-foreground hover:text-foreground">
            Database →
          </Link>
          <Link
            href="/settings/github"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            GitHub →
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Which AI models the agent runs on, and whether their credentials are in place. Two
          tiers: a cheap model handles high-volume triage; a strong model makes the judgment
          calls (qualify + craft). Both are swappable via <code>.env</code> — no code changes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">Provider credentials</h2>
          <span className="text-xs text-muted-foreground">presence only — values never shown</span>
        </header>
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
      </section>
    </div>
  );
}
