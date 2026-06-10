/**
 * Retention purge (R7), cron-able: `pnpm --filter agent purge`. Deletes raw
 * signals older than SIGNAL_RETENTION_DAYS that never became candidates.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { purgeOnce } = await import("../src/mastra/lib/retention");

const result = await purgeOnce();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
