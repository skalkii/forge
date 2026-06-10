"use client";

// Single EventSource shared by every panel. Subscribe to row changes
// (optionally filtered by table) and to connection status for the Live badge.

export type ForgeEvent = {
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  at: string;
};

export type ConnectionStatus = "connecting" | "live" | "offline";

type ChangeHandler = (event: ForgeEvent) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const changeSubs = new Map<ChangeHandler, string[] | undefined>();
const statusSubs = new Set<StatusHandler>();
let source: EventSource | null = null;
let status: ConnectionStatus = "offline";

function setStatus(next: ConnectionStatus) {
  if (status === next) return;
  status = next;
  for (const fn of statusSubs) fn(status);
}

function ensureSource() {
  if (source || typeof window === "undefined") return;
  setStatus("connecting");
  source = new EventSource("/api/stream");
  source.onopen = () => setStatus("live");
  // EventSource reconnects on its own; reflect the gap in the badge.
  source.onerror = () => setStatus("connecting");
  source.addEventListener("change", (ev) => {
    let event: ForgeEvent;
    try {
      event = JSON.parse((ev as MessageEvent).data);
    } catch {
      return;
    }
    for (const [fn, tables] of changeSubs) {
      if (!tables || tables.includes(event.table)) fn(event);
    }
  });
}

function teardownIfIdle() {
  if (changeSubs.size === 0 && statusSubs.size === 0 && source) {
    source.close();
    source = null;
    setStatus("offline");
  }
}

export function onChange(fn: ChangeHandler, tables?: string[]): () => void {
  changeSubs.set(fn, tables);
  ensureSource();
  return () => {
    changeSubs.delete(fn);
    teardownIfIdle();
  };
}

export function onStatus(fn: StatusHandler): () => void {
  statusSubs.add(fn);
  ensureSource();
  fn(status);
  return () => {
    statusSubs.delete(fn);
    teardownIfIdle();
  };
}
