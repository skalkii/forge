"use client";

import { useEffect, useState } from "react";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

function format(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, span] of UNITS) {
    if (Math.abs(seconds) >= span) return rtf.format(Math.round(-seconds / span), unit);
  }
  return "just now";
}

/** Human-relative timestamp ("2h ago") with the full local time in a tooltip. */
export function RelTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => format(iso));
  useEffect(() => {
    const t = setInterval(() => setLabel(format(iso)), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString()}
      className={className}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
