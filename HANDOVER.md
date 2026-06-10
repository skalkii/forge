# HANDOVER — Plan Revisions from Architecture Audit

> **What this file is.** An audit of the original plan (`CLAUDE.md` + `docs/videodb-growth-agent-architecture.pdf`) found corrections and gaps. This file is the actionable changelist. **Where this file conflicts with `CLAUDE.md`, THIS FILE WINS.** Apply the changes marked `[CLAUDE.md]` directly into that file as you implement.
>
> Priority order: **R1 (workflow topology), R2 (snippet templates), R3 (disclosure)** — these change the build's shape. Do them before writing feature code. R4–R10 are applied along the way.

---

## R1 · Split the workflow: discovery vs per-candidate touch  `[CLAUDE.md: Architecture + growth-loop]`

**Problem found:** the original `growth-loop.ts` sketch is one linear workflow (`discover → triage → … → suspend → act`). `discover` returns a *batch* of candidates, but `suspend()` pauses the *entire run* — so the first candidate awaiting human review would block every other candidate behind it.

**Required design — two workflows:**

```
workflows/
├── discovery-workflow.ts   # cron-triggered. search → dedup → triage → enqueue
│                           # writes qualified candidates to `candidates` table. NEVER suspends.
└── touch-workflow.ts       # ONE RUN PER CANDIDATE. enrich → qualify → craft → QA →
                            # scorers → suspend(human gate) → act → observe
```

- A dispatcher (cron or queue consumer) starts one `touch-workflow` run per new qualified candidate.
- Each run has exactly **one** suspend point; the run ID is stored on the candidate/draft row so the review queue can resume the right run.
- Concurrency cap on simultaneous touch-workflow runs (env: `MAX_CONCURRENT_TOUCHES`, default 10).
- Acceptance check: 5 candidates pending review must mean 5 independently resumable runs — approving #3 must not affect #1.

---

## R2 · Replace free snippet generation with a validated template library  `[CLAUDE.md: tools + craft agent]`

**Problem found:** "craft agent generates code, snippet-runner QAs it live" has two flaws: (a) the app is TypeScript but the snippets devs need are Python — live-executing generated Python from TS means a sandboxed subprocess (real work, real risk); (b) LLM-generated code posted publicly under VideoDB's name is a brand hazard even with QA.

**Required design — select-and-fill, don't generate:**

```
src/snippets/
├── templates/
│   ├── transcribe-search.py.hbs     # transcription + spoken-word search
│   ├── scene-search.py.hbs          # visual/scene indexing + search
│   ├── frame-extraction.py.hbs      # frames every N seconds
│   └── agent-vision.py.hbs          # give an agent eyes on video
├── registry.ts                       # capability → template + param schema (Zod)
└── render.ts                         # fill params, return final snippet string
```

- The **craft agent selects a template + parameters** (structured output validated by the registry's Zod schema). It never writes code freeform.
- `snippet-runner` becomes a **nightly/CI template validation job**: render each template with fixture params, execute against the live VideoDB API (this job may be a small Python script — that's fine, it's offline tooling, not the request path), assert results.
- If no template fits a candidate's problem → route to "no touch" or to a cookbook-PR escalation. Do not improvise code.
- Templates are maintained by hand; reviewers learn them, which also speeds human review.

---

## R3 · Affiliation disclosure on every public touch  `[CLAUDE.md: constraints + scorers]`

**Problem found:** the anti-spam design covered consent mechanics (human gate, caps, value-first) but not **transparency**. A helpful reply recommending VideoDB *without disclosing the affiliation* is astroturfing by most community standards; being unmasked later is a worse brand event than never posting.

**Required:**

- **Add to the Non-negotiable constraints (#6):** every public touch MUST include a short, plain affiliation disclosure (e.g. "(I work with VideoDB — this is exactly the problem it's built for.)"). Exact wording configurable: env `DISCLOSURE_TEXT`.
- The **craft agent's instructions** require including the disclosure.
- The **spam-guardrail scorer** hard-fails any draft missing it (string/pattern check — deterministic, not model-judged).
- The human gate UI shows the disclosure visibly in the preview.
- Get VideoDB's preferred wording (see R10); ship with a sensible default, don't block.

---

## R4 · GitHub rate limits: search is its own, much smaller budget  `[CLAUDE.md: lib/github-client]`

**Correction:** the plan cited the GitHub App's ~15k req/hr core limit as if it covered discovery. The **Search API has a separate limit of roughly 30 requests/minute**, and search is exactly what Sense uses. Core-limit figures also vary by installation size — verify at runtime, don't assume.

**Required:**

- `lib/github-client.ts` maintains **two budgets** (search vs core), read live from GitHub's rate-limit endpoint/headers — not hardcoded constants.
- Discovery is a **low-frequency poller**: each strategy query every 15–30 min (env: `DISCOVERY_INTERVAL_MIN`), results cached and diffed against seen signals; only new items proceed.
- On secondary-rate-limit responses (`retry-after`), back off and honor it; never retry-hammer.
- All write operations (comment/PR) are serialized with ≥1s spacing.

---

## R5 · Instrument experiments end-to-end  `[CLAUDE.md: db schema + attribution]`

**Problem found:** the Forge requires ≥3 experiments, but the schema and UTM design had no variant dimension — results would be unmeasurable.

**Required:**

- `touches` table gains `experiment_id TEXT NULL` and `variant TEXT NULL`.
- Encode the variant in **`utm_content`** (keep `utm_campaign` = touch id, per the existing attribution map).
- `lib/attribution.ts` join outputs results **grouped by experiment/variant**.
- Add `experiments` table: `id, name, hypothesis, variable, status, started_at, ended_at` — this also feeds the `experiments/` submission folder.
- Candidate assignment to variants is deterministic (hash of candidate id), logged on the touch row.

---

## R6 · Scope the review queue properly — it is a security boundary  `[CLAUDE.md: review queue section]`

**Problem found:** "a small Next.js app" under-scoped the only path to public posting.

**Required:**

- **Auth is mandatory** (simplest: an access token / basic auth via env `REVIEW_QUEUE_SECRET`; better: GitHub OAuth allow-list). The queue must never be an open URL.
- Features: list pending drafts (candidate context + draft + disclosure + scorer results), **approve / edit / reject**, edit persists before resume, each action calls Mastra's resume API with the stored run ID, decision + editor identity logged on the touch row.
- Show daily-cap status and a **global kill-switch toggle** (env-or-DB flag the touch workflow checks before `act`).
- Budget honestly: this is ~1–2 days of the sprint. Build it right after the touch workflow exists.

---

## R7 · Data minimization for GitHub user data  `[CLAUDE.md: db schema]`

- Store only what's needed and already public: GitHub username, thread/issue URL, repo, the matched text excerpt. **No emails, no profile scraping, no enrichment of personal data.**
- Add a simple deletion path: a script/endpoint that removes all rows for a given GitHub username on request.
- Retention: raw unqualified signals older than 90 days are purged (env: `SIGNAL_RETENTION_DAYS`).

---

## R8 · Treat all Mastra snippets as pseudocode — verify against current docs  `[build step 0]`

The plan's Mastra sketches (`branch([[cond, step]])`, `resumeSchema`, `structuredOutput`, suspend/resume signatures) were written from research notes; Mastra's API moves fast and step input/output schemas must line up (or use explicit `.map()`).

**Required:** before writing feature code, read the current Mastra docs (workflows, suspend/resume, agents-as-steps, storage) and reconcile every pattern in `CLAUDE.md`. Fix `CLAUDE.md` where it disagrees with reality. Same for the Postgres/pgvector adapter setup.

---

## R9 · Tone down / caveat the illustrative funnel numbers  `[PDF + any VideoDB-facing doc]`

The 5,000 → 500 → 200 illustration implies a 40% signup→activation rate — generous for dev tools and it quietly anchors expectations. Either mark it more loudly as shape-only, or use conservative placeholders (e.g. 5,000 → 250 → 50). Never present a projected conversion rate as a target until VideoDB supplies a baseline.

---

## R10 · Open questions for VideoDB (additions to the existing list)  `[email/next sync]`

Beyond the attribution/UTM questions already sent:

1. **Who reviews/approves touches** — us, or their DevRel/founder? (Affects queue auth + SLA.)
2. **What does "agent in production by Day 14" mean to them?** Surface the tension early: our design is deliberately human-gated, not fully autonomous. Confirm this matches their expectation *before* Day 14.
3. **Scope policy:** any repos, orgs, or competitor threads that are off-limits?
4. **Disclosure wording** they're comfortable with (R3).
5. **Cookbook contribution guide** + who reviews PRs on their side.
6. Does a **GitHub App / bot identity already exist** under the VideoDB org we should reuse?

**Verify-at-build-time list (do not trust the plan's figures):** current Mastra APIs (R8); Exa + Parallel pricing/free tiers (plan's numbers are from June 2026 searches); the org's actual GitHub App limits (R4); and **test the strategy's search queries against GitHub's actual search syntax** — the examples in `github-usage.ts` were written for readability; long phrase queries may need decomposing into shorter qualifier-based forms (`in:title,body`, `label:`, `language:`) before they return good results.

---

## Updated env vars (add to `.env.example`)

```bash
MAX_CONCURRENT_TOUCHES=10      # R1: parallel touch-workflow runs cap
DISCOVERY_INTERVAL_MIN=20      # R4: per-query polling interval
DISCLOSURE_TEXT=               # R3: affiliation line appended to every touch
REVIEW_QUEUE_SECRET=           # R6: auth for the review queue
KILL_SWITCH=false              # R6: global stop for all public actions
SIGNAL_RETENTION_DAYS=90       # R7: purge horizon for raw signals
```

## Updated build order (replaces CLAUDE.md's)

1. **Step 0 (R8):** read current Mastra docs; reconcile + patch `CLAUDE.md` patterns.
2. Scaffold; `lib/models.ts`; `db/schema.ts` **including R5's experiment fields and R7's minimal-data shape**; migrations.
3. Strategy interface + `github-usage.ts` (**verify queries against real GitHub search — R10**).
4. `lib/github-client.ts` with **dual rate budgets (R4)**; `browse` tools; `lib/{retrieval,cost-meter}`.
5. **Snippet template library (R2)** + registry + render + the offline validation job.
6. Agents (triage / qualify / craft **with disclosure requirement — R3**) + scorers (guardrail **hard-fails missing disclosure**).
7. **`discovery-workflow.ts` + `touch-workflow.ts` + dispatcher (R1)**; wire `index.ts`.
8. **Review queue with auth + kill-switch (R6)**; resume integration.
9. Attribution join **grouped by experiment/variant (R5)**; dashboard.
10. Deploy + cron; run discovery read-only for 2–3 days before enabling any touches.

---

**One-line summary of this revision:** same thesis, sounder machine — un-block the human gate by splitting the workflow per candidate, stop generating code in favor of validated templates, disclose affiliation on every touch, budget GitHub search separately, and make experiments measurable.
