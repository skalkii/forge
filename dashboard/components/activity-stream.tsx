"use client";

import { useEffect, useState } from "react";
import { onChange, type ForgeEvent } from "@/lib/realtime";

const opStyles: Record<ForgeEvent["op"], string> = {
  INSERT: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

type StreamItem = ForgeEvent & { key: number };

let seq = 0;

export function ActivityStream({
  tables,
  maxItems = 50,
  title = "Activity",
}: {
  tables?: string[];
  maxItems?: number;
  title?: string;
}) {
  const [events, setEvents] = useState<StreamItem[]>([]);
  const tablesKey = tables?.join(",");

  useEffect(
    () =>
      onChange(
        (event) => setEvents((prev) => [{ ...event, key: seq++ }, ...prev].slice(0, maxItems)),
        tablesKey ? tablesKey.split(",") : undefined,
      ),
    [tablesKey, maxItems],
  );

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {events.length > 0 ? `${events.length} event${events.length === 1 ? "" : "s"}` : "live"}
        </span>
      </header>
      {events.length === 0 ? (
        <div className="flex items-center gap-2.5 px-4 py-8 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-slate-400" />
          Waiting for activity — database changes appear here in real time.
        </div>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">
          {events.map((e) => (
            <li key={e.key} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span
                className={`inline-flex w-16 justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${opStyles[e.op]}`}
              >
                {e.op}
              </span>
              <span className="font-medium">{e.table}</span>
              {e.id ? (
                <span className="truncate font-mono text-xs text-muted-foreground" title={e.id}>
                  {e.id.length > 12 ? `${e.id.slice(0, 12)}…` : e.id}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                {new Date(e.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
