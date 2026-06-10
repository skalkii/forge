import { subscribeToChanges } from "@/lib/server/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PING_INTERVAL_MS = 15_000;

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        unsubscribe?.();
        if (ping) clearInterval(ping);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      send(`event: hello\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      try {
        unsubscribe = await subscribeToChanges((event) => {
          send(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
        });
      } catch (err) {
        send(
          `event: stream-error\ndata: ${JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          })}\n\n`,
        );
        cleanup();
        return;
      }
      ping = setInterval(() => send(`: ping\n\n`), PING_INTERVAL_MS);
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
