import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";

import { craftAgent } from "./agents/craft-agent";
import { qualifyAgent } from "./agents/qualify-agent";
import { triageAgent } from "./agents/triage-agent";
import { spamGuardrailScorer } from "./scorers/spam-guardrail";
import { touchQualityScorer } from "./scorers/touch-quality";
import { discoveryWorkflow } from "./workflows/discovery-workflow";
import { touchWorkflow } from "./workflows/touch-workflow";

/** Mastra's own Postgres pool (workflow snapshots, memory). Exported so
 * short-lived scripts can close it on the way out — see lib/shutdown.ts. */
export const store = new PostgresStore({
  id: "forge",
  connectionString: process.env.DATABASE_URL ?? "postgres://forge:forge@localhost:5432/forge",
});

export const mastra = new Mastra({
  agents: { triage: triageAgent, qualify: qualifyAgent, craft: craftAgent },
  workflows: { discovery: discoveryWorkflow, touch: touchWorkflow },
  scorers: { touchQuality: touchQualityScorer, spamGuardrail: spamGuardrailScorer },
  storage: store,
});
