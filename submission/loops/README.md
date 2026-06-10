# Loop — Sense → Qualify → Craft → [human gate] → Act → Observe → Learn

One loop, implemented as two workflows plus three cron jobs (R1). Everything
below is live code, not a diagram of intent.

## The cycle, end to end

```
discovery-workflow (cron, every DISCOVERY_INTERVAL_MIN — never suspends)
  searchStep      GitHub issue search per strategy query (dual rate budgets, R4)
  dedupStep       pgvector cosine clustering — same thread/person never twice
  triageStep      cheap-model agent: { score, reason } — is this real pain?
  branch          drop+log  |  enqueue → candidates table

dispatcher (cron, every 2 min)
  picks queued candidates, starts ONE touch-workflow per candidate,
  capped at MAX_CONCURRENT_TOUCHES; honors kill-switch + DAILY_TOUCH_CAP

touch-workflow (one run per candidate — exactly one suspend)
  enrich          Exa/Parallel via lib/retrieval.ts (budget-capped, cost-metered)
  qualify         strong-model agent: { fit, capability, reasons[] }
  craft           strong-model agent: { templateId ∈ registry, params, replyBody }
                  — select-and-fill from validated templates only (R2),
                    disclosure injected (R3)
  scorers         touch-quality (model) + spam-guardrail (deterministic hard-fail)
  human gate      suspend() — approve / edit / reject in the dashboard (R6)
  act             deterministic step posts the reply, UTM-tagged
                  (utm_campaign = touch id) — only after approval,
                  only if TOUCHES_ENABLED and kill-switch off
  observe         touch row updated with posted_at, permalink

attribution (cron, hourly)
  joins signup_events → touches on utm_campaign, 21-day window,
  writes outcomes (first_successful_api_call) — idempotent twice over

purge (cron, daily)  — R7 retention, unqualified signals only
```

## Where "Learn" happens

- **Outcomes → strategy**: per-capability activation (exp-3) decides which
  discovery queries get more of the search budget next iteration.
- **Gate decisions → prompts**: rejected/heavily-edited drafts are the
  feedback signal for craft instructions (edit rate is tracked per touch).
- **Triage outcomes → queries**: the false-positive rate per query drove
  iteration 1 (see `submission/iterations/`), replacing all four original
  queries with qualifier-form ones.

## Proof it runs

`pnpm --filter agent cron` boots all four jobs in one process; the dashboard
(Overview, /runs, /candidates, /drafts, /experiments, /costs, /errors)
renders every stage live from Postgres. Verified end-to-end with a seeded
candidate: discovery → triage → dispatch → suspend → dashboard approve →
(act withheld; TOUCHES_ENABLED=false) → stub signup → attribution → outcome
on the Overview funnel.
