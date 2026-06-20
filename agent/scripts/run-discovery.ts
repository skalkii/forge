/**
 * Trigger the discovery-workflow once (CLAUDE.md: `pnpm --filter agent loop`).
 * search → dedup → triage → enqueue. Never suspends, never posts.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { mastra } = await import("../src/mastra/index");
const { shutdownScript } = await import("../src/mastra/lib/shutdown");

const run = await mastra.getWorkflow("discovery").createRun();
const result = await run.start({ inputData: {} });

console.log(`discovery run ${run.runId}: ${result.status}`);
console.log(JSON.stringify(result.status === "success" ? result.result : result, null, 2));

// Release the onnxruntime session + close pools, then drain — never process.exit()
// directly (would abort ORT teardown, exit 134).
await shutdownScript(result.status === "success" ? 0 : 1);
