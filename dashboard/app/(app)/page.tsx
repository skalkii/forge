import { ActivityStream } from "@/components/activity-stream";

const kpis = [
  {
    label: "Cost / activated dev",
    hint: "LLM + retrieval spend ÷ devs reaching first_successful_api_call",
  },
  { label: "Qualified → activation", hint: "Share of qualified touches that convert" },
  { label: "Negative signal rate", hint: "Deleted / flagged / downvoted touches" },
  { label: "Spend today", hint: "All providers, resets at midnight UTC" },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          North-star: cheapest path from a stuck developer to an activated one.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground/60">
              —
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground/70" title={kpi.hint}>
              {kpi.hint}
            </div>
          </div>
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
            No errors recorded. The error log wires up with the errors table.
          </div>
        </section>
      </div>
    </div>
  );
}
