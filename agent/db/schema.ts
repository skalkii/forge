/**
 * Domain schema v1.
 *
 * R7 data minimization: only public GitHub data needed for a touch —
 * username, URL, repo, excerpt. No emails, no profile data. `signals`
 * rows are purged after SIGNAL_RETENTION_DAYS; forget-user script
 * deletes by author across all tables.
 *
 * Every table gets a forge_notify() trigger (see migrations) so the
 * dashboard receives live change events over LISTEN/NOTIFY → SSE.
 */
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const candidateStatus = pgEnum("candidate_status", [
  "queued", // discovery enqueued it; dispatcher hasn't started a touch-workflow
  "enriching",
  "qualifying",
  "crafting",
  "review", // suspended at the human gate
  "approved",
  "rejected",
  "posted",
  "activated", // outcome joined to first_successful_api_call
  "dropped", // triage/qualify said no — discard+log path
  "failed",
]);

export const touchDecision = pgEnum("touch_decision", ["approved", "rejected"]);

export const experimentStatus = pgEnum("experiment_status", ["draft", "running", "ended"]);

export const outcomeEvent = pgEnum("outcome_event", ["signup", "first_successful_api_call"]);

/** Raw discovered items, one row per GitHub thread we noticed. */
export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("github"),
    externalId: text("external_id").notNull().unique(), // GitHub node id — exact dedup
    url: text("url").notNull(),
    repo: text("repo").notNull(),
    author: text("author").notNull(), // public username only (R7)
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(), // truncated body, enough to triage
    query: text("query").notNull(), // which strategy query found it
    foundAt: timestamp("found_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // near-dup clustering (exact dedup is external_id UNIQUE)
    embedding: vector("embedding", { dimensions: 384 }), // bge-small-en-v1.5, local fastembed
    dupOf: uuid("dup_of").references((): AnyPgColumn => signals.id, { onDelete: "set null" }),
  },
  (t) => [index("signals_author_idx").on(t.author), index("signals_created_idx").on(t.createdAt)],
);

/** Signals that passed triage; one touch-workflow run each (R1). */
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalId: uuid("signal_id")
      .notNull()
      .unique()
      .references(() => signals.id, { onDelete: "cascade" }),
    status: candidateStatus("status").notNull().default("queued"),
    triageScore: real("triage_score"),
    triageReason: text("triage_reason"),
    fitScore: real("fit_score"),
    capability: text("capability"), // ∈ snippet registry ids
    qualifyReasons: jsonb("qualify_reasons").$type<string[]>(),
    runId: text("run_id"), // Mastra touch-workflow run — dashboard resumes with this
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("candidates_status_idx").on(t.status)],
);

/** R5 — experiments registry; variants ride on touches.variant. */
export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  hypothesis: text("hypothesis").notNull(),
  variable: text("variable").notNull(), // e.g. disclosure-wording | reply-length | capability-mix
  status: experimentStatus("status").notNull().default("draft"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/** One public action (or its draft). utm_campaign == touch id. */
export const touches = pgTable(
  "touches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id").references(() => experiments.id),
    variant: text("variant"), // deterministic hash of candidate id; UTM utm_content
    templateId: text("template_id"), // ∈ snippet registry
    draftBody: text("draft_body").notNull(),
    finalBody: text("final_body"), // reviewer-edited body (R6: persisted before resume)
    disclosureOk: boolean("disclosure_ok").notNull().default(false),
    decision: touchDecision("decision"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedUrl: text("posted_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("touches_candidate_idx").on(t.candidateId),
    index("touches_experiment_idx").on(t.experimentId),
  ],
);

/** Attributed downstream events, joined on utm_campaign == touch id. */
export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    touchId: uuid("touch_id")
      .notNull()
      .references(() => touches.id, { onDelete: "cascade" }),
    event: outcomeEvent("event").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    attributedAt: timestamp("attributed_at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("outcomes_touch_idx").on(t.touchId)],
);

/** Paid API calls — backs /costs and spend-and-efficiency.csv. */
export const costEvents = pgTable(
  "cost_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // anthropic | exa | parallel | ...
    kind: text("kind").notNull(), // llm | embedding | search | enrich
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: real("cost_usd").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cost_events_at_idx").on(t.at)],
);

/** Append-only audit trail: decisions, kill-switch flips, deletions. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: text("actor").notNull(), // reviewer name | "system" | "cron"
    action: text("action").notNull(), // e.g. touch.approved, kill_switch.on, user.forgotten
    subjectTable: text("subject_table"),
    subjectId: text("subject_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

/** R4 — every GitHub API call with its live rate-budget headers. Backs /settings/github. */
export const githubRequests = pgTable(
  "github_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resource: text("resource").notNull(), // search | core | ... (x-ratelimit-resource)
    method: text("method").notNull(),
    route: text("route").notNull(),
    status: integer("status"),
    rateLimit: integer("rate_limit"),
    rateRemaining: integer("rate_remaining"),
    rateResetAt: timestamp("rate_reset_at", { withTimezone: true }),
    latencyMs: integer("latency_ms"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("github_requests_at_idx").on(t.at),
    index("github_requests_resource_idx").on(t.resource),
  ],
);

/** Retrieval (Exa/Parallel) response cache — hit rate backs /costs/retrieval. */
export const retrievalCache = pgTable(
  "retrieval_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // exa | parallel
    requestHash: text("request_hash").notNull().unique(), // sha256 of normalized request
    request: jsonb("request").$type<Record<string, unknown>>().notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    costUsd: real("cost_usd").notNull(), // what the original miss cost
    hits: integer("hits").notNull().default(0), // cache hits since creation
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("retrieval_cache_provider_idx").on(t.provider)],
);

/** Single-row operational flags (R6 kill-switch lives here, not in env). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const allTables = {
  signals,
  candidates,
  experiments,
  touches,
  outcomes,
  costEvents,
  auditLog,
  githubRequests,
  retrievalCache,
  settings,
} as const;

export type Signal = typeof signals.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type Touch = typeof touches.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type CostEvent = typeof costEvents.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type GithubRequest = typeof githubRequests.$inferSelect;
export type RetrievalCacheEntry = typeof retrievalCache.$inferSelect;
