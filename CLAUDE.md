# CLAUDE.md — VideoDB Growth Agent

> **Read this first.** This repo builds a *growth agent* for VideoDB's Growth Forge. It finds developers who are publicly stuck on problems VideoDB already solves, helps them genuinely (a human approves every public action), and turns that help into product usage. The metric we own is **GitHub → Usage** — a developer's first successful API call — measured as **cost per activated developer**.
>
> Full architecture, diagrams, and costs are in `docs/videodb-growth-agent-architecture.pdf`.

---

## ⚠️ Non-negotiable constraints — respect these in every change

1. **This is NOT a spam engine.** No public action (comment, reply, PR) may ever be posted autonomously. Every outbound touch MUST pass a human approval gate implemented as a Mastra workflow `suspend()` / `resume()`.
2. **`operate` tools are attached to NO agent.** Tools that post (comment / PR) are invoked *only* by deterministic workflow steps that run **after** human approval. An LLM must never be able to post. Do not attach them to any `Agent`.
3. **Value-first + capped.** The agent proceeds only when VideoDB is genuinely the best answer. Enforce `DAILY_TOUCH_CAP`, dedup (never touch the same person/thread twice), and a global kill-switch.
4. **Respect platform rules.** GitHub's Acceptable Use Policy forbids bulk/promotional posting in others' threads. Stay within rate limits; the posting identity is a real human account (`GITHUB_POST_AS`), never a bot.
5. **Never hardcode the metric.** All metric-specific logic lives behind the `MetricStrategy` interface. The engine is metric-agnostic; only `strategy/strategies/github-usage.ts` knows what we're optimizing.
6. **Affiliation disclosure (R3).** Every public touch MUST include a short, plain affiliation disclosure (`DISCLOSURE_TEXT` env var). The `spam-guardrail` scorer hard-fails any draft missing it via deterministic string/pattern check.

> **Audit revisions absorbed.** An architecture audit of the original plan produced corrections R1–R10 (formerly `HANDOVER.md`, now merged into this file). The R-numbers are kept as shorthand throughout; the full changelist is in the [Audit revisions](#audit-revisions-r1r10) section below.

---

## Architecture

One loop: **Sense → Qualify → Craft → [human gate] → Act → Observe → Learn.**

| Step | Type | Tech |
|------|------|------|
| Sense + dedup | tool + deterministic | GitHub search (Octokit) + pgvector clustering |
| Triage | **agent** (cheap model) | is this real pain worth spending on? |
| Enrich (shortlist only) | tools | Exa + Parallel, behind `lib/retrieval.ts` |
| Qualify | **agent** (strong model + research tools) | is VideoDB genuinely the answer? fit score |
| Craft | **agent** (strong model) | selects a snippet template + params + reply body with disclosure (R2 + R3) |
| QA | tool / deterministic (offline) | nightly snippet-validator runs templates against live VideoDB API |
| Guardrail | scorers | quality + spam/promo check (disclosure hard-fail) |
| Human gate | workflow `suspend()` | approve / edit / reject |
| Act | tools / deterministic (post-approval) | post reply / open cookbook PR, UTM-tagged |
| Observe + Learn | deterministic | attribute touch → signup → first API call; outcomes refine scorers |

Only **triage / qualify / craft** are agents. Everything else is plain typed code. Money (Exa/Parallel) is spent only *after* triage passes.

Per **R1**, the loop is implemented as **two workflows**:

```
workflows/
├── discovery-workflow.ts   # cron-triggered. search → dedup → triage → enqueue.
│                           # writes qualified candidates to `candidates` table. NEVER suspends.
└── touch-workflow.ts       # ONE RUN PER CANDIDATE. enrich → qualify → craft → QA →
                            # scorers → suspend(human gate) → act → observe.
```

A dispatcher (cron) launches one `touch-workflow` per new qualified candidate. Concurrency cap: `MAX_CONCURRENT_TOUCHES`.

---

## Tech stack

- **Language / runtime:** TypeScript, Node 20+.
- **Framework:** Mastra — `@mastra/core` (agents, workflows, tools), `@mastra/memory`, `@mastra/pg`.
- **Models:** Mastra model router behind one swappable interface in `lib/models.ts` — provider-agnostic registry. `CHEAP_MODEL` / `STRONG_MODEL` env vars use the router's `provider/model` form (e.g. `anthropic/claude-haiku-4-5`, `ollama/qwen2.5-coder:7b`, `deepseek/deepseek-chat`, `openai/gpt-5-mini`); legacy `provider:model` is accepted and normalized (split on first colon — Ollama model ids contain colons). Hosted providers resolve via Mastra's built-in registry with API keys auto-detected from env; `ollama/*` resolves to an OpenAI-compatible config at `OLLAMA_BASE_URL/v1`.
- **GitHub:** Octokit via a **GitHub App** (read + higher rate limits); posting via a real human account (`GITHUB_POST_AS`).
- **Research:** Exa (`exa-js`) + Parallel (SDK/REST), wrapped by `lib/retrieval.ts` (cache + budget + cost-meter).
- **Data:** Postgres + pgvector (local Docker for dev; managed for prod) — backs Mastra memory, workflow snapshots, vectors, and domain tables.
- **Product QA:** VideoDB Python API (offline validator only — never in the request path).
- **Deploy:** Local-first via `mastra dev`; self-host or Vercel later.
- **Review queue + dashboard:** sibling Next.js 15 app `dashboard/` in the same pnpm workspace, reading the same Postgres. **R6**: auth required; kill-switch wired.

---

## Repo structure (effective)

```
forge/
├── agent/                              # the Mastra app
│   ├── src/mastra/
│   │   ├── index.ts                    # new Mastra({ agents, workflows, scorers, storage })
│   │   ├── agents/                     # DECIDE — only LLM pieces
│   │   │   ├── triage-agent.ts         #   cheap model, no tools
│   │   │   ├── qualify-agent.ts        #   strong model + research tools
│   │   │   └── craft-agent.ts          #   strong model, structured: { templateId, params, replyBody }
│   │   ├── tools/
│   │   │   ├── browse/github-search.ts
│   │   │   ├── research/exa.ts         # demand-driven, after triage
│   │   │   ├── research/parallel.ts
│   │   │   └── operate/                # attached to NO agent
│   │   │       ├── github-comment.ts
│   │   │       └── github-pr.ts
│   │   ├── workflows/
│   │   │   ├── discovery-workflow.ts   # never suspends
│   │   │   └── touch-workflow.ts       # one run per candidate, one suspend
│   │   ├── scorers/
│   │   │   ├── touch-quality.ts        # model-graded
│   │   │   └── spam-guardrail.ts       # deterministic: disclosure + caps + dedup + kill-switch
│   │   ├── strategy/                   # the ONLY metric-specific code
│   │   │   ├── types.ts                # MetricStrategy interface
│   │   │   ├── registry.ts             # picks active strategy from env
│   │   │   └── strategies/github-usage.ts
│   │   └── lib/
│   │       ├── models.ts               # provider-agnostic registry
│   │       ├── github-client.ts        # GitHub App auth + dual rate budgets (R4)
│   │       ├── retrieval.ts            # Exa/Parallel + cache + budget + cost-meter
│   │       ├── attribution.ts          # UTM build + touch→outcome join (stubbed signup source per R10)
│   │       └── cost-meter.ts           # every paid call → spend-and-efficiency.csv
│   ├── src/snippets/                   # R2 — validated template library
│   │   ├── templates/
│   │   ├── registry.ts                 # capability → template + Zod params
│   │   └── render.ts
│   ├── scripts/validate-snippets.py    # offline template QA
│   └── db/{schema.ts,migrations/}      # signals · candidates · experiments · touches · outcomes · audit_log
├── dashboard/                          # Next.js 15 — review queue + live ops
├── .env.example
└── submission/                         # Forge deliverables
```

---

## The metric strategy (GitHub → Usage)

`src/mastra/strategy/types.ts`:

```ts
export interface MetricStrategy {
  id: string;
  targets: { source: "github"; queries: string[]; freshnessHours: number };
  rubric: string;                       // injected into triage/qualify prompts
  successEvent: string;                 // the activation event we attribute to
  attributionMap: {
    utmSource: string; utmMedium: string;
    joinOn: string;                     // e.g. "utm_campaign" == touch id
    windowDays: number;
  };
}
```

`src/mastra/strategy/strategies/github-usage.ts` — the locked strategy. Per **R10**, queries listed below are starting points; verify against real GitHub Search syntax before relying on them (`in:title,body`, `language:`, `state:open`, etc.).

```ts
export const githubUsage: MetricStrategy = {
  id: "github-usage",
  targets: {
    source: "github",
    queries: [
      'ffmpeg extract frames "every n seconds" is:issue',
      'whisper transcribe video timestamps in:title,body',
      'search inside video for moment OR scene state:open',
      '"give my agent" vision screenshot frames in:body',
    ],
    freshnessHours: 72,
  },
  rubric: `Strong = a dev hand-rolling something VideoDB does natively
(frame extraction, transcription+search, scene/semantic video search,
visual access for an agent). Reject already-solved, vendors, off-topic,
or anything where VideoDB is a stretch.`,
  successEvent: "first_successful_api_call",
  attributionMap: { utmSource: "github", utmMedium: "agent-touch", joinOn: "utm_campaign", windowDays: 21 },
};
```

Metrics we report: **cost per activated developer** (headline), **qualified-touch → activation rate** (daily), **negative-signal rate** (guardrail, must stay ~0).

---

## Key implementation notes

- **Mastra API anchors (verified against `@mastra/core` 1.41 at commit 6).**
  - `createStep({ id, inputSchema, outputSchema, resumeSchema, suspendSchema, execute })` — all schemas are Zod. `execute` receives `{ inputData, resumeData, suspend, suspendData, bail }`.
  - `createWorkflow({ id, inputSchema, outputSchema }).then(step).parallel([a, b]).branch([[predicate, step], ...]).map(async ({ inputData }) => ({...})).commit()`. `.commit()` is required to register the workflow.
  - `createStep(agent)` adapts an `Agent` into a workflow step (input goes to the agent prompt, structured output becomes the step output). Use this to embed `triage` / `qualify` / `craft` inline in `touch-workflow`.
  - `createTool({ id, inputSchema, outputSchema, execute })` — Zod-typed. Agent tools are attached on the `Agent` constructor; deterministic-only tools (the `operate/*` family) are simply *not* added to any agent.
  - `createScorer({ id, description, judge?, type }).preprocess(...).analyze(...).generateScore(...).generateReason(...)` — chain pattern. Scorers can be attached to agents (sampled) or invoked from workflow steps directly.
- **Human gate pattern** — the gate is a deterministic step that suspends on first execution and resumes on the second; **always `return await suspend(...)`** (the prior sketch's bare `await suspend(...)` followed by an inline `return {...}` is wrong — the suspend resolves to the resumeData on resume).
  ```ts
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    if (resumeData?.decision === 'rejected') {
      return bail({ reason: resumeData.reason ?? 'reviewer rejected' });
    }
    if (resumeData?.decision === 'approved') {
      return { finalReply: resumeData.edited ?? inputData.draft, decidedBy: resumeData.decidedBy };
    }
    return await suspend({
      preview: inputData.draft,
      disclosure: inputData.disclosure,
      scorerResults: inputData.scorerResults,
    });
  }
  ```
  Mastra persists the workflow snapshot to its storage adapter (Postgres in our case), so a draft can sit in the queue for hours/days. The dashboard resumes via the Mastra HTTP API using `runId` (stored on the candidate row) + the step id.
- **Branch syntax** — `branch()` takes pairs of `[predicate, step]`; the first true predicate wins; provide an explicit fallback step to cover the `else` case rather than relying on falsthrough.
- **Per-candidate runs (R1)** — discovery enqueues qualified candidates; dispatcher starts one `touch-workflow` per candidate. One suspend per run ⇒ approvals never block other candidates.
- **Snippets are select-and-fill (R2)** — craft agent returns `{templateId ∈ registry, params}` validated by the registry's Zod schema. It never writes code freeform. Offline validator (`scripts/validate-snippets.py`) runs each template against live VideoDB API; failures block deploy.
- **Disclosure mandatory (R3)** — craft agent instructions inject `DISCLOSURE_TEXT`; spam-guardrail does a deterministic substring/regex check; gate UI highlights the disclosure line.
- **GitHub rate budgets (R4)** — `lib/github-client.ts` keeps **two budgets** (search ~30/min vs core ~15k/hr), read live from response headers. Discovery is a low-frequency poller (`DISCOVERY_INTERVAL_MIN`); writes serialized ≥1s apart; `Retry-After` honored.
- **Experiments (R5)** — `touches.experiment_id` + `touches.variant`; UTM variant rides on `utm_content` (keep `utm_campaign` = touch id). Attribution join groups outcomes by experiment/variant.
- **Branch to drop** — after triage and after the gate, low-pain / rejected candidates route to a discard+log path.
- **Retrieval is demand-driven** — Exa/Parallel fire only on shortlisted candidates, through `lib/retrieval.ts` with caching, a spend cap, and per-call cost metering into `spend-and-efficiency.csv`.
- **Attribution** — tag every posted link with a UTM where `utm_campaign == touch id`; a join job matches UTM'd signups to `first_successful_api_call` within `ATTRIBUTION_WINDOW_DAYS`. Report a confident lower bound + a soft upper bound — never claim precision the data lacks.
- **Idempotency / dedup** — cluster signals in pgvector; never process or touch the same person/thread twice.
- **Typing** — all tool/step inputs & outputs are Zod schemas.
- **Secrets** — never commit; keep `.env.example` in sync with any new key.
- **Data minimization (R7)** — store only public GitHub data needed for the touch (username, URL, repo, excerpt). No emails, no profile scraping. Retention purge for old signals; deletion-by-username script.

---

## Audit revisions (R1–R10)

The actionable changelist from the architecture audit (formerly `HANDOVER.md`). Priority order was **R1, R2, R3** — they change the build's shape; R4–R10 are applied along the way. Everything below is already reflected in the sections above; this is the canonical record of *why*, plus details not repeated elsewhere.

- **R1 · Split the workflow: discovery vs per-candidate touch.** A single linear workflow can't work: discovery returns a *batch* of candidates, but `suspend()` pauses the *entire run* — the first candidate awaiting review would block all others. Hence `discovery-workflow` (never suspends) + `touch-workflow` (one run per candidate, exactly one suspend), with the run ID stored on the candidate/draft row so the queue can resume the right run. **Acceptance check:** 5 candidates pending review = 5 independently resumable runs; approving #3 must not affect #1.
- **R2 · Validated template library, never freeform code.** Live-executing LLM-generated Python from a TS app means a sandboxed subprocess (real work, real risk), and LLM code posted publicly under VideoDB's name is a brand hazard even with QA. So: craft agent *selects* a template + params (Zod-validated); the validator is an offline nightly/CI job (a small Python script is fine — it's tooling, not the request path). **If no template fits a candidate's problem → route to "no touch" or a cookbook-PR escalation. Never improvise code.** Templates are maintained by hand; reviewers learn them, which speeds review.
- **R3 · Affiliation disclosure on every public touch.** A helpful reply recommending VideoDB *without* disclosing affiliation is astroturfing by most community standards; being unmasked later is a worse brand event than never posting. Disclosure is constraint #6: injected into craft instructions, deterministically hard-failed by the spam-guardrail, shown highlighted in the gate UI. Ship with a sensible default wording; VideoDB's preferred wording is tracked in `OPEN_QUESTIONS.md` — don't block on it.
- **R4 · GitHub search is its own, much smaller budget.** The Search API allows roughly 30 req/min — separate from the App's ~15k/hr core limit, and search is exactly what Sense uses. Core limits also vary by installation size. Both budgets are read live from rate-limit headers, never hardcoded. Discovery is a low-frequency poller (`DISCOVERY_INTERVAL_MIN`), results diffed against seen signals; honor `Retry-After`, never retry-hammer; serialize writes ≥1s apart.
- **R5 · Instrument experiments end-to-end.** The Forge requires ≥3 experiments; without a variant dimension results would be unmeasurable. `touches` gains `experiment_id` + `variant`; variant rides on `utm_content` (keep `utm_campaign` = touch id); attribution join groups by experiment/variant. `experiments` table: `id, name, hypothesis, variable, status, started_at, ended_at` (feeds the `experiments/` submission folder). **Variant assignment is deterministic (hash of candidate id), logged on the touch row.**
- **R6 · The review queue is a security boundary.** It's the only path to public posting — never an open URL. Auth mandatory (`REVIEW_QUEUE_SECRET`). Approve / edit / reject; **edits persist before resume**; every action calls Mastra's resume API with the stored run ID; decision + editor identity logged on the touch row. UI shows daily-cap status + global kill-switch the touch workflow checks before `act`.
- **R7 · Data minimization.** Only public data needed for the touch: username, thread/issue URL, repo, matched excerpt. No emails, no profile scraping, no personal-data enrichment. Deletion-by-username script; purge raw unqualified signals past `SIGNAL_RETENTION_DAYS`.
- **R8 · All Mastra sketches are pseudocode until verified.** The API moves fast; step input/output schemas must line up (or use explicit `.map()`). Patterns in this file were reconciled against `@mastra/core` 1.41 — re-verify on any Mastra upgrade, including the Postgres/pgvector adapter setup.
- **R9 · Never present projected conversion as a target.** The original 5,000 → 500 → 200 funnel illustration implied a 40% signup→activation rate — generous for dev tools, and it quietly anchors expectations. Mark any funnel numbers loudly as shape-only or use conservative placeholders until VideoDB supplies a baseline.
- **R10 · Open questions live in `OPEN_QUESTIONS.md`.** Questions for VideoDB (reviewer identity, Day-14 "production" definition, scope policy, disclosure wording, cookbook guide, existing GitHub App) plus the verify-at-build-time list: current Mastra APIs (R8), Exa + Parallel pricing, the org's actual GitHub App limits (R4), and strategy search queries tested against GitHub's real search syntax — long phrase queries may need decomposing into shorter qualifier-based forms.

**One-line summary:** same thesis, sounder machine — un-block the human gate by splitting the workflow per candidate, stop generating code in favor of validated templates, disclose affiliation on every touch, budget GitHub search separately, and make experiments measurable.

---

## Commands

```bash
pnpm install
pnpm --filter agent dev          # mastra dev — local playground/server for agents & workflows
pnpm --filter dashboard dev      # Next.js dashboard
pnpm --filter agent build        # mastra build
pnpm --filter agent db:migrate   # apply db/migrations
pnpm test                        # unit tests (scorers, attribution join, strategy)
pnpm --filter agent loop         # trigger the discovery-workflow once (manual run)
```

---

## Environment variables

```bash
# AI models (provider-agnostic; provider/model form)
CHEAP_MODEL=             # e.g. anthropic/claude-haiku-4-5, ollama/qwen2.5-coder:7b
STRONG_MODEL=            # e.g. anthropic/claude-sonnet-4-6, deepseek/deepseek-chat
# Provider credentials (set those you use)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
MISTRAL_API_KEY=
DASHSCOPE_API_KEY=       # qwen/* hosted models
OPENROUTER_API_KEY=      # openrouter/* — one key, many models incl. :free tiers
OLLAMA_BASE_URL=         # default http://localhost:11434

# GitHub (App for read + higher limits)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_INSTALLATION_ID=
GITHUB_POST_AS=          # human account used for public replies

# Research / enrichment
EXA_API_KEY=
PARALLEL_API_KEY=

# VideoDB (snippet QA + product calls)
VIDEODB_API_KEY=

# Database (local Docker default)
DATABASE_URL=postgres://forge:forge@localhost:5432/forge

# Attribution / dashboard (VideoDB-provided)
UTM_BASE_URL=
DASHBOARD_URL=

# Metric strategy (strategy/registry.ts picks by id; default github-usage)
METRIC_STRATEGY=github-usage

# Safety limits / config
DAILY_TOUCH_CAP=20
QUALIFY_THRESHOLD=0.7
ATTRIBUTION_WINDOW_DAYS=21
MAX_CONCURRENT_TOUCHES=10      # R1: parallel touch-workflow runs cap
DISCOVERY_INTERVAL_MIN=20      # R4: per-query polling interval
DISCLOSURE_TEXT=               # R3: affiliation line appended to every touch
REVIEW_QUEUE_SECRET=           # R6: auth for the review queue + dashboard
KILL_SWITCH=false              # R6: global stop for all public actions
SIGNAL_RETENTION_DAYS=90       # R7: purge horizon for raw signals
TOUCHES_ENABLED=false          # final gate before any post-approval action runs
```

---

## Definition of done (Forge deliverables)

- `metric/` — the locked GitHub → Usage definition.
- `attribution/` — UTMs wired + dashboard live.
- `agent/` — in production by **Day 14** (definition pending — see `OPEN_QUESTIONS.md`).
- `experiments/` ≥ 3 · `loops/` ≥ 1 · `iterations/` ≥ 2 (data-driven).
- `submission/` — `architecture.md`, `walkthrough.mp4`, `live-links.txt`, `dashboard.url`, `spend-and-efficiency.csv`, `next-steps.md`.

---

## Build order (post-audit, replaces the original)

1. **Step 0 (R8):** read current Mastra docs; reconcile + patch this file.
2. Scaffold; `lib/models.ts` (provider-agnostic); `db/schema.ts` **including R5 experiment fields and R7 minimal-data shape**; migrations.
3. Strategy interface + `github-usage.ts` (**verify queries against real GitHub search — R10**).
4. `lib/github-client.ts` with **dual rate budgets (R4)**; `browse` tools; `lib/{retrieval,cost-meter}`.
5. **Snippet template library (R2)** + registry + render + the offline validation job.
6. Agents (triage / qualify / craft **with disclosure requirement — R3**) + scorers (guardrail **hard-fails missing disclosure**).
7. **`discovery-workflow.ts` + `touch-workflow.ts` + dispatcher (R1)**; wire `index.ts`.
8. **Review queue with auth + kill-switch (R6)**; resume integration.
9. Attribution join **grouped by experiment/variant (R5)**; dashboard.
10. Deploy + cron; run discovery read-only for 2–3 days before enabling any touches.

(Dashboard pulled forward in the execution plan: scaffold + live-data infra arrives at Phase B, before sense/agents; every later commit adds the panel for the module it ships. See `/Users/kal/.claude/plans/claude-md-videodb-polished-brook.md`.)

---

## Open / TBD

See `OPEN_QUESTIONS.md` for the live list, including R10 questions for VideoDB and the verify-at-build-time items (Mastra APIs, Exa+Parallel pricing, real GitHub App limits, strategy query effectiveness).
