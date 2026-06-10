/**
 * Run the attribution join once (`pnpm --filter agent attribute`): match
 * unprocessed signup_events to posted touches on utm_campaign == touch id
 * within the strategy's attribution window, write outcomes rows. Cron-able.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { attributeOnce } = await import("../src/mastra/lib/attribution");

const result = await attributeOnce();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
