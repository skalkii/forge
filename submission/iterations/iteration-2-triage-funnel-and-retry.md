# Iteration 2 — live triage funnel + LLM retry layer

Two changes driven by the first live discovery runs (read-only — no touches
posted; TOUCHES_ENABLED=false throughout).

## 1. What the live funnel showed

First real discovery cycles with the iteration-1 queries:

```
13 signals fetched
 └─ 1 clustered as near-duplicate (pgvector, cosine ≤ 0.15)
12 unique → triage (cheap model)
 └─ 11 dropped (rubric: already-solved / vendor / VideoDB-is-a-stretch)
 1 queued as a candidate
LLM spend for the whole cycle: $0.00 (free-tier routing)
```

Reading: an ~8% triage pass rate is *healthy*, not a bug — the queries are
deliberately recall-heavy (iteration 1) and triage is the cheap precision
filter. The thing to watch is the *cost* of dropping 11, and it was zero.
Money (Exa/Parallel, strong model) is only spent after this gate, so the
funnel shape confirms the cost architecture works.

## 2. Retry layer for observed LLM failures (commit `863c04d`)

Running triage against live OpenRouter free-tier models surfaced two real
transient failure modes that never appear in tests:

- empty responses (provider returned 200 with no content),
- structured-output schema validation throws.

Fix: `lib/generate.ts` — one shared wrapper around agent generation with
bounded retries on exactly those two failures, error-logged to the `errors`
table (visible on the dashboard /errors page) instead of killing the
workflow run.

## Why this is the loop working

Both changes came from running the system, not from speculation: the funnel
numbers validated the recall-then-filter design, and the retry layer exists
only because live traffic broke in ways the plan didn't predict.
