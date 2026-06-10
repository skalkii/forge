/**
 * The ONLY metric-specific code in the engine lives behind this interface
 * (non-negotiable #5). Everything else — workflows, agents, scorers,
 * attribution — reads the active strategy and stays metric-agnostic.
 *
 * Strategy modules must stay dependency-free (pure types + data): the
 * dashboard imports them directly for the /strategy panel.
 */
export interface MetricStrategy {
  id: string;
  targets: {
    source: "github";
    /** Starting points — verified/tuned against real GitHub search at commit 20 (R10/V4). */
    queries: string[];
    freshnessHours: number;
  };
  /** Injected into triage/qualify prompts. */
  rubric: string;
  /** The activation event we attribute to. */
  successEvent: string;
  attributionMap: {
    utmSource: string;
    utmMedium: string;
    /** e.g. "utm_campaign" == touch id */
    joinOn: string;
    windowDays: number;
  };
  /** OPEN_QUESTIONS #7 — hand-curated, ships empty until VideoDB answers. */
  denylist: {
    repos: string[];
    orgs: string[];
    users: string[];
  };
}
