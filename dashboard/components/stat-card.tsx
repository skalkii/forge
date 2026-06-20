import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { InfoTip } from "@/components/info-tip";
import type { GlossaryKey } from "@/lib/glossary";

/**
 * KPI tile: label (+ optional ⓘ definition), big value, optional sparkline, a
 * plain-English explanation, and an optional "source" line saying where the
 * number comes from. Every number on the dashboard should be self-explaining.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  term,
  source,
  muted = false,
  spark,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon?: LucideIcon;
  /** glossary key — adds an ⓘ definition next to the label */
  term?: GlossaryKey;
  /** where the number comes from, e.g. "cost_events ÷ outcomes" */
  source?: string;
  muted?: boolean;
  spark?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5 text-primary/70" />}
        <span>{label}</span>
        {term ? <InfoTip term={term} /> : null}
      </div>
      <div
        className={`mt-1.5 text-[1.6rem] font-semibold leading-none tabular-nums ${
          muted ? "text-muted-foreground/55" : ""
        }`}
      >
        {value}
      </div>
      {spark && <div className="mt-2">{spark}</div>}
      <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>
      {source ? (
        <div className="mt-auto pt-2 font-mono text-[10px] text-muted-foreground/60">{source}</div>
      ) : null}
    </div>
  );
}
