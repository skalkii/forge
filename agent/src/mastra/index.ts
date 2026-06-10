import { Mastra } from "@mastra/core/mastra";

import { craftAgent } from "./agents/craft-agent";
import { qualifyAgent } from "./agents/qualify-agent";
import { triageAgent } from "./agents/triage-agent";
import { spamGuardrailScorer } from "./scorers/spam-guardrail";
import { touchQualityScorer } from "./scorers/touch-quality";

export const mastra = new Mastra({
  agents: { triage: triageAgent, qualify: qualifyAgent, craft: craftAgent },
  scorers: { touchQuality: touchQualityScorer, spamGuardrail: spamGuardrailScorer },
});
