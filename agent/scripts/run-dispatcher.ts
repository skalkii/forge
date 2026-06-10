/**
 * Dispatch one tick (`pnpm --filter agent dispatch`): start one
 * touch-workflow per queued candidate, capped at MAX_CONCURRENT_TOUCHES.
 * Each run pauses at the human gate; the dashboard resumes it.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { dispatchOnce } = await import("../src/mastra/dispatcher");

const result = await dispatchOnce();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
