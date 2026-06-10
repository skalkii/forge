import { Mastra } from "@mastra/core/mastra";

import { qualifyAgent } from "./agents/qualify-agent";
import { triageAgent } from "./agents/triage-agent";

export const mastra = new Mastra({
  agents: { triage: triageAgent, qualify: qualifyAgent },
});
