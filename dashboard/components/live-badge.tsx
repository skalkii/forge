"use client";

import { useEffect, useState } from "react";
import { onStatus, type ConnectionStatus } from "@/lib/realtime";

const styles: Record<ConnectionStatus, { dot: string; text: string; label: string }> = {
  live: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Live" },
  connecting: { dot: "bg-amber-500 animate-pulse", text: "text-amber-600 dark:text-amber-400", label: "Connecting" },
  offline: { dot: "bg-slate-400", text: "text-muted-foreground", label: "Offline" },
};

export function LiveBadge() {
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  useEffect(() => onStatus(setStatus), []);
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.text}`}
      title="Realtime stream (Postgres LISTEN/NOTIFY → SSE)"
    >
      <span className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
