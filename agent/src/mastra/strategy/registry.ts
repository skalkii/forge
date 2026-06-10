import { githubUsage } from "./strategies/github-usage";
import type { MetricStrategy } from "./types";

const strategies: Record<string, MetricStrategy> = {
  [githubUsage.id]: githubUsage,
};

export function getActiveStrategy(): MetricStrategy {
  const id = process.env.METRIC_STRATEGY ?? "github-usage";
  const strategy = strategies[id];
  if (!strategy) {
    throw new Error(
      `Unknown METRIC_STRATEGY "${id}" — registered: ${Object.keys(strategies).join(", ")}`,
    );
  }
  return strategy;
}

export function listStrategies(): MetricStrategy[] {
  return Object.values(strategies);
}
