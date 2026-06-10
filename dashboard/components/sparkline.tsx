/** Tiny 7-day bar sparkline for KPI cards. Pure markup — renders on the server. */
export function Sparkline({
  points,
  format,
}: {
  points: { day: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1e-9);
  return (
    <div className="flex h-6 items-end gap-px" aria-hidden>
      {points.map((p) => (
        <div
          key={p.day}
          className="flex-1 rounded-[1px] bg-primary/25"
          style={{
            height: p.value === 0 ? "2px" : `${Math.max(12, (p.value / max) * 100)}%`,
          }}
          title={`${p.day} — ${format ? format(p.value) : String(p.value)}`}
        />
      ))}
    </div>
  );
}
