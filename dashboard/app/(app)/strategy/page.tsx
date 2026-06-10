import { getActiveStrategy, listStrategies } from "@forge/agent/strategy";

export const dynamic = "force-dynamic";

export default function StrategyPage() {
  const strategy = getActiveStrategy();
  const registered = listStrategies();
  const denylistEmpty =
    strategy.denylist.repos.length === 0 &&
    strategy.denylist.orgs.length === 0 &&
    strategy.denylist.users.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Strategy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The only metric-specific code in the engine. Active:{" "}
          <code className="text-foreground">{strategy.id}</code>
          {registered.length > 1 ? ` · ${registered.length} registered` : null}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Search queries</h2>
            <span className="text-xs text-muted-foreground">
              {strategy.targets.source} · last {strategy.targets.freshnessHours}h
            </span>
          </header>
          <ul className="divide-y">
            {strategy.targets.queries.map((q) => (
              <li key={q} className="px-4 py-2.5 font-mono text-xs">
                {q}
              </li>
            ))}
          </ul>
          <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground/70">
            Starting points — tuned against real GitHub search before discovery goes live (R10).
          </footer>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Rubric</h2>
          </header>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">
            {strategy.rubric}
          </pre>
          <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground/70">
            Injected verbatim into the triage and qualify prompts.
          </footer>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Attribution</h2>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Success event</dt>
            <dd>
              <code className="text-xs">{strategy.successEvent}</code>
            </dd>
            <dt className="text-muted-foreground">utm_source</dt>
            <dd>{strategy.attributionMap.utmSource}</dd>
            <dt className="text-muted-foreground">utm_medium</dt>
            <dd>{strategy.attributionMap.utmMedium}</dd>
            <dt className="text-muted-foreground">Join on</dt>
            <dd>
              <code className="text-xs">{strategy.attributionMap.joinOn}</code> = touch id
            </dd>
            <dt className="text-muted-foreground">Window</dt>
            <dd>{strategy.attributionMap.windowDays} days</dd>
          </dl>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Denylist</h2>
            <span className="text-xs text-muted-foreground">never touched</span>
          </header>
          {denylistEmpty ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Empty — pending off-limits repos/orgs from VideoDB (open question #7).
            </div>
          ) : (
            <dl className="space-y-2 px-4 py-3 text-sm">
              {(["repos", "orgs", "users"] as const).map((kind) =>
                strategy.denylist[kind].length ? (
                  <div key={kind}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {kind}
                    </dt>
                    <dd className="mt-1 font-mono text-xs">
                      {strategy.denylist[kind].join(", ")}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
