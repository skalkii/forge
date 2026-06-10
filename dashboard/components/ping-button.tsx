"use client";

import { useState } from "react";

type PingResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  detail: string;
};

export function PingButton({ provider, compact = false }: { provider: string; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "pinging" | PingResult>("idle");

  async function ping() {
    setState("pinging");
    try {
      const res = await fetch("/api/models/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      setState((await res.json()) as PingResult);
    } catch (err) {
      setState({
        ok: false,
        status: null,
        latencyMs: 0,
        detail: err instanceof Error ? err.message : "request failed",
      });
    }
  }

  const result = typeof state === "object" ? state : null;

  return (
    <span className={`inline-flex items-center gap-2 ${compact ? "" : "pt-1"}`}>
      <button
        type="button"
        onClick={ping}
        disabled={state === "pinging"}
        className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        {state === "pinging" ? "Pinging…" : "Ping"}
      </button>
      {result ? (
        <span
          className={`text-xs ${
            result.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
          title={result.detail}
        >
          {result.ok ? `ok · ${result.latencyMs}ms` : result.detail}
        </span>
      ) : null}
    </span>
  );
}
