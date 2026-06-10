import { Client } from "pg";

// One LISTEN connection per server process, fanned out to every SSE client.

export type ForgeEvent = {
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  at: string;
};

type Subscriber = (event: ForgeEvent) => void;

const subscribers = new Set<Subscriber>();
let client: Client | null = null;
let connecting: Promise<void> | null = null;

async function ensureListener(): Promise<void> {
  if (client) return;
  if (connecting) return connecting;
  connecting = (async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query("LISTEN forge_events");
    c.on("notification", (msg) => {
      if (!msg.payload) return;
      let event: ForgeEvent;
      try {
        event = JSON.parse(msg.payload);
      } catch {
        return;
      }
      for (const fn of subscribers) fn(event);
    });
    const onDrop = () => {
      if (client === c) {
        client = null;
        scheduleReconnect();
      }
    };
    c.on("error", onDrop);
    c.on("end", onDrop);
    client = c;
  })();
  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

function scheduleReconnect() {
  setTimeout(() => {
    if (subscribers.size > 0) {
      ensureListener().catch(scheduleReconnect);
    }
  }, 2000);
}

export async function subscribeToChanges(fn: Subscriber): Promise<() => void> {
  subscribers.add(fn);
  await ensureListener();
  return () => {
    subscribers.delete(fn);
  };
}
