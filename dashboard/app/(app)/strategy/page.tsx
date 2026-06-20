import { getActiveStrategy, listStrategies } from "@forge/agent/strategy";
import { Ban } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

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
      <PageHeader
        title="Strategy"
        stage="ops"
        description={
          <>
            The system&apos;s mission in one swappable place. The engine itself doesn&apos;t know or
            care what it&apos;s hunting for — everything specific to this goal (what we search
            GitHub for, the rubric the AIs follow, how we measure success) lives in a single
            strategy defined in code. Change this one thing and the whole system goes after
            something else. Active strategy:{" "}
            <code className="text-foreground">{strategy.id}</code>
            {registered.length > 1 ? ` · ${registered.length} registered` : null}.
          </>
        }
        sources={["strategy config (in code)"]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Search queries"
          description="The exact phrases we search for on GitHub to find developers who are publicly stuck on a problem VideoDB solves. Each line is one search; results newer than the freshness window are considered."
          aside={`${strategy.targets.source} · last ${strategy.targets.freshnessHours}h`}
        >
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
        </SectionCard>

        <SectionCard
          title="Rubric"
          description="The plain-English guidance handed verbatim to the AIs as they decide whether a thread is a genuine fit. This is what keeps them from chasing off-topic or already-solved problems."
        >
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">
            {strategy.rubric}
          </pre>
          <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground/70">
            Injected verbatim into the triage and qualify prompts.
          </footer>
        </SectionCard>

        <SectionCard
          title="Attribution rules"
          term="attribution"
          description={
            <>
              How we prove a developer&apos;s VideoDB activity was caused by a reply we posted: the
              success event we count, the invisible link tags we attach, and the time window a
              signup has to happen within.
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
            <dt className="inline-flex items-center gap-1 text-muted-foreground">
              Success event
              <InfoTip term="activation" />
            </dt>
            <dd>
              <code className="text-xs">{strategy.successEvent}</code>
            </dd>
            <dt className="inline-flex items-center gap-1 text-muted-foreground">
              utm_source
              <InfoTip term="utm" />
            </dt>
            <dd>{strategy.attributionMap.utmSource}</dd>
            <dt className="text-muted-foreground">utm_medium</dt>
            <dd>{strategy.attributionMap.utmMedium}</dd>
            <dt className="text-muted-foreground">Join on</dt>
            <dd>
              <code className="text-xs">{strategy.attributionMap.joinOn}</code> = touch id
            </dd>
            <dt className="inline-flex items-center gap-1 text-muted-foreground">
              Window
              <InfoTip term="attribution-window" />
            </dt>
            <dd>{strategy.attributionMap.windowDays} days</dd>
          </dl>
        </SectionCard>

        <SectionCard
          title="Denylist"
          description="Repos, orgs, and users the agent will never contact, no matter what it finds. A hard off-limits list, separate from the AI's judgment."
          aside="never touched"
          bodyClassName=""
        >
          {denylistEmpty ? (
            <EmptyState icon={Ban} title="Denylist is empty">
              Off-limits repos, orgs, and users go here. Pending the list from VideoDB (open
              question #7) — until then nothing is hard-blocked by name.
            </EmptyState>
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
        </SectionCard>
      </div>
    </div>
  );
}
