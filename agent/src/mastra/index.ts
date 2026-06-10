import { Mastra } from "@mastra/core/mastra";

import { craftAgent } from "./agents/craft-agent";
import { qualifyAgent } from "./agents/qualify-agent";
import { triageAgent } from "./agents/triage-agent";

export const mastra = new Mastra({
  agents: { triage: triageAgent, qualify: qualifyAgent, craft: craftAgent },
});
