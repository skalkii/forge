/**
 * Long-running scheduler (`pnpm --filter agent cron`) — the production loop:
 *   discovery    every DISCOVERY_INTERVAL_MIN (default 20, R4 low-frequency poller)
 *   dispatcher   every 2 min (honors kill-switch + MAX_CONCURRENT_TOUCHES)
 *   attribution  every 60 min
 *   purge        every 24 h (R7)
 * Posting stays impossible unless TOUCHES_ENABLED=true AND a human approved
 * at the gate — this scheduler adds no new path to a public action.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { mastra } = await import("../src/mastra/index");
const { dispatchOnce } = await import("../src/mastra/dispatcher");
const { attributeOnce } = await import("../src/mastra/lib/attribution");
const { purgeOnce } = await import("../src/mastra/lib/retention");
const { recordError } = await import("../src/mastra/lib/errors");

const MIN = 60_000;
const discoveryEveryMin = Number(process.env.DISCOVERY_INTERVAL_MIN) || 20;

async function discovery() {
  const run = await mastra.getWorkflow("discovery").createRun();
  const result = await run.start({ inputData: {} });
  return { runId: run.runId, status: result.status };
}

function schedule(name: string, everyMs: number, job: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    if (running) return; // skip overlapping ticks rather than queueing them
    running = true;
    const t0 = Date.now();
    try {
      const out = await job();
      console.log(`[cron] ${name} ok in ${Date.now() - t0}ms`, JSON.stringify(out));
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err);
      await recordError(`cron.${name}`, err);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(tick, everyMs);
}

console.log(
  `[cron] starting — discovery every ${discoveryEveryMin}m, dispatch every 2m, ` +
    `attribution every 60m, purge every 24h (TOUCHES_ENABLED=${process.env.TOUCHES_ENABLED ?? "false"})`,
);

schedule("discovery", discoveryEveryMin * MIN, discovery);
schedule("dispatch", 2 * MIN, dispatchOnce);
schedule("attribution", 60 * MIN, attributeOnce);
schedule("purge", 24 * 60 * MIN, purgeOnce);
