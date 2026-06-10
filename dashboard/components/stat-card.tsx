import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** KPI tile: label, big value, and a plain-English definition underneath. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon?: LucideIcon;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5 text-primary/70" />}
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${muted ? "text-muted-foreground/60" : ""}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{hint}</div>
    </div>
  );
}
