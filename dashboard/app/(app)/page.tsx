import { CircleDollarSign, Percent, ShieldAlert, Wallet } from "lucide-react";

import { ActivityStream } from "@/components/activity-stream";
import { PageIntro } from "@/components/page-intro";
import { StatCard } from "@/components/stat-card";

const kpis = [
  {
    label: "Cost / activated dev",
    icon: CircleDollarSign,
    hint: "Total LLM + research spend divided by developers who made their first successful VideoDB API call. The one number this whole system optimizes.",
  },
  {
    label: "Qualified → activation",
    icon: Percent,
    hint: "Of the threads we judged a genuine fit and replied to, how many led to an activated developer.",
  },
  {
    label: "Negative signal rate",
    icon: ShieldAlert,
    hint: "Replies that got deleted, flagged, or downvoted. The guardrail metric — must stay at zero.",
  },
  {
    label: "Spend today",
    icon: Wallet,
    hint: "Every paid model and research call across providers. Resets at midnight UTC.",
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <PageIntro title="Overview">
        The north-star view: the cheapest path from a developer stuck on a video problem to one
        actively using VideoDB. KPIs fill in as touches go live; the stream below shows everything
        the system does, as it happens.
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} icon={kpi.icon} value="—" hint={kpi.hint} muted />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityStream />
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Errors</h2>
            <span className="text-xs text-muted-foreground">last 24h</span>
          </header>
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No errors recorded — caught failures from agents and workflows will land here with
            context and a retry link.
          </div>
        </section>
      </div>
    </div>
  );
}
