import { Mastra } from "@mastra/core/mastra";

import { triageAgent } from "./agents/triage-agent";

export const mastra = new Mastra({
  agents: { triage: triageAgent },
});
