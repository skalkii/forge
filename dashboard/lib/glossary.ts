/**
 * One source of truth for every term the dashboard explains. Cards, headers,
 * and info tips read definitions from here so the same word never gets two
 * explanations. Keep each definition one or two plain sentences — these are
 * read by non-engineers. Mirrors docs/explained/* glossaries.
 */
export const GLOSSARY = {
  // ── The metric ──
  "cost-per-activated": {
    term: "Cost per activated developer",
    def: "All the money we've spent, divided by the number of developers who became active VideoDB users because of us. The single number this whole system optimizes.",
  },
  activation: {
    term: "Activation",
    def: "A developer's first successful VideoDB API call — proof they didn't just sign up but actually used the product. This is our definition of success.",
  },
  "touch-to-activation": {
    term: "Qualified touch → activation rate",
    def: "Of the replies we posted, the fraction that led to an activated developer.",
  },
  "negative-signal": {
    term: "Negative-signal rate",
    def: "Replies that got deleted, flagged, or downvoted. Tracked by manual review for now — must stay at zero.",
  },

  // ── Pipeline objects ──
  signal: {
    term: "Signal",
    def: "One raw GitHub thread we found, before any judgment. We store only the public minimum: username, link, repo, and a short excerpt.",
  },
  candidate: {
    term: "Candidate",
    def: "A signal that passed triage — judged real, painful, and worth pursuing. Each candidate gets its own touch run.",
  },
  touch: {
    term: "Touch",
    def: "One outreach to one developer about one thread — the basic unit of work, from research through (possibly) a posted reply.",
  },
  draft: {
    term: "Draft",
    def: "A finished reply waiting at the human gate. Nothing about it is public until a reviewer approves it.",
  },
  outcome: {
    term: "Outcome",
    def: "A recorded activation — a developer's first successful API call, attributed back to a touch we posted.",
  },

  // ── Stages / mechanics ──
  triage: {
    term: "Triage",
    def: "The cheap, fast AI's first filter: 'is this real pain worth spending money to pursue?' Most threads are rejected here, before any paid step.",
  },
  qualify: {
    term: "Qualify",
    def: "The strong AI's judgment, with web research: 'is VideoDB genuinely the best answer here?' It produces a fit score.",
  },
  craft: {
    term: "Craft",
    def: "The strong AI selects a pre-tested code example and writes a helpful reply with the disclosure line. It never invents code freehand.",
  },
  "human-gate": {
    term: "Human gate",
    def: "The mandatory checkpoint. A real person approves, edits, or rejects every reply before it can post. The AI cannot post on its own.",
  },
  dedup: {
    term: "Deduplication",
    def: "Before spending on a thread, we turn its text into 'meaning numbers' (an embedding) and compare it to others, so we never pursue the same problem twice.",
  },
  disclosure: {
    term: "Affiliation disclosure",
    def: "A short honesty line in every reply stating we're affiliated with VideoDB. Required — the guardrail blocks any draft missing it.",
  },
  guardrail: {
    term: "Spam guardrail",
    def: "A strict, non-AI checker run before a human sees a draft: disclosure present? under the daily cap? not a repeat contact? kill-switch off? Any failure hard-blocks the draft.",
  },
  "fit-score": {
    term: "Fit score",
    def: "The qualify agent's number (higher = better) for how well VideoDB fits a developer's problem. Below a threshold, we don't reach out.",
  },

  // ── Attribution / experiments ──
  utm: {
    term: "UTM tag",
    def: "An invisible label added to a link that records which reply a visit or signup came from. Ours carries the touch's ID.",
  },
  attribution: {
    term: "Attribution",
    def: "Proving a developer's activity was caused by a reply we posted — by matching the UTM tag, within an allowed time window.",
  },
  "attribution-window": {
    term: "Attribution window",
    def: "The time limit (e.g. 21 days) within which a signup must happen to count as caused by our touch.",
  },
  experiment: {
    term: "Experiment",
    def: "An A/B test: two versions of something (e.g. disclosure wording) compared by which leads to more activations.",
  },
  variant: {
    term: "Variant",
    def: "One version (A or B) within an experiment. Each touch is assigned one deterministically, so the same touch always gets the same variant.",
  },

  // ── Cost / infra ──
  "cost-event": {
    term: "Cost event",
    def: "A row recorded the moment we spend money — every AI call and every paid web search. This is what makes the cost metric measured, not estimated.",
  },
  retrieval: {
    term: "Retrieval (enrichment)",
    def: "Paid web research (Exa / Parallel) done only after a thread passes triage, with a daily budget that shuts spending off when hit.",
  },
  "rate-budget": {
    term: "GitHub rate budget",
    def: "GitHub limits how often you can search vs. act. We track both live from GitHub's own responses and stay a polite, low-frequency guest.",
  },
  snippet: {
    term: "Snippet",
    def: "A pre-written, pre-tested code example the Craft agent fills in. Validated nightly against the real VideoDB API; broken ones drop out of rotation.",
  },
  "kill-switch": {
    term: "Kill-switch",
    def: "A single toggle that instantly stops all public activity. Every flip is recorded in the audit log.",
  },
  "run-snapshot": {
    term: "Workflow run",
    def: "One execution of a workflow. A discovery run sweeps GitHub; a touch run carries one candidate toward the gate. Paused runs are saved and resumable.",
  },
  retention: {
    term: "Data retention",
    def: "We keep only public data we need, and automatically delete raw unqualified threads after a set number of days.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
