# OPEN_QUESTIONS

Live tracker for items pending VideoDB input and verify-at-build-time items the plan deliberately did not assume. Builds do not block on these — interfaces stub them and env vars expose them.

Update as items resolve: move resolved items to a dated **Resolved** section at the bottom, do not delete.

---

## For VideoDB — needs answer

| # | Item | Why it blocks | Default until answered |
|---|------|---------------|------------------------|
| 1 | Signup + `first_successful_api_call` event access + UTM capture | Whole attribution metric depends on it | `lib/attribution.ts` stubbed; reads from a local `signup_events` table; switch to VideoDB event source when delivered |
| 2 | UTM scheme + which dashboard to plug into | Final reporting target | Use `utm_source=github&utm_medium=agent-touch&utm_campaign={touchId}&utm_content={variant}`; `DASHBOARD_URL` env var |
| 3 | Attribution window length | Conversion accounting | 21 days (audit default), `ATTRIBUTION_WINDOW_DAYS` env |
| 4 | Baseline GitHub-sourced signup→first-call numbers | Calibration of qualified-touch → activation% | Report **lower bound** only until baseline lands; flag in dashboard copy |
| 5 | Who reviews/approves touches — us, VideoDB DevRel, or founder? | Queue auth model + SLA | Single shared `REVIEW_QUEUE_SECRET`; add GitHub OAuth allow-list when reviewers identified |
| 6 | "Agent in production by Day 14" definition — does human-gated count? | Misalignment risk pre-deadline | Our build is human-gated by design; flag this in the next VideoDB sync |
| 7 | Off-limits repos / orgs / competitor threads | Touch policy | Maintain a hand-curated denylist in `agent/src/mastra/strategy/strategies/github-usage.ts`; ship empty |
| 8 | Preferred affiliation disclosure wording (R3) | Brand voice | Default `DISCLOSURE_TEXT="(I work with VideoDB — this is exactly the problem it's built for.)"`; swap freely |
| 9 | Cookbook contribution guide + their PR reviewers | Cookbook PR template + target repo | Stub PR opener; configurable repo via `VIDEODB_COOKBOOK_REPO` env |
| 10 | Existing VideoDB GitHub App / bot identity to reuse? | Avoid duplicate App setup; reuse rate budget | Create our own App tied to `GITHUB_APP_ID/PRIVATE_KEY/INSTALLATION_ID`; swap if theirs exists |
| 11 | `docs/videodb-growth-agent-architecture.pdf` source file | Reference doc | Placeholder README in `docs/`; drop the file in when supplied |

---

## Verify at build time — do not trust the plan's figures

| # | Item | Where the assumption lives | How we will verify |
|---|------|----------------------------|---------------------|
| V1 | Current Mastra APIs (R8) — suspend/resume, agents-as-steps, storage, `createTool`, `createScorer`, branch/parallel/map | `CLAUDE.md` patterns; every workflow + agent file | Read current Mastra docs at commit 6 ("reconcile Mastra patterns") and again before each workflow commit; correct CLAUDE.md inline |
| V2 | Exa + Parallel pricing / free tiers | `lib/retrieval.ts` budget cap defaults | Cross-check vendor pricing pages before commit 22; capture in `submission/spend-and-efficiency.csv` header |
| V3 | Real GitHub App rate limits (R4) — search ≠ core; install-size variance | `lib/github-client.ts` budgets | Read live from response headers (`X-RateLimit-Limit/Remaining/Reset`); never hardcode |
| V4 | Strategy search-query effectiveness (R10) | `strategy/strategies/github-usage.ts` queries | Manual run of each query in real GitHub search at commit 20; decompose phrase queries into qualifier form (`in:title,body`, `language:`, `state:open`); log before/after false-positive counts in commit message |
| V5 | pgvector embedding choice + threshold | `lib/dedup.ts` (will land with commit 19) | Tune cosine threshold against held-out duplicate set before enabling discovery in production |

---

## Resolved

_(none yet)_
