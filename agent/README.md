# agent/

The Mastra app for the VideoDB Growth Agent.

```bash
# from repo root
pnpm install
pnpm --filter @forge/agent dev   # mastra dev — playground at http://localhost:4111
```

Layout (filled in across the build per `/Users/kal/.claude/plans/claude-md-videodb-polished-brook.md`):

```
src/
├── mastra/
│   ├── index.ts                # new Mastra({ agents, workflows, scorers, storage })
│   ├── agents/                 # triage, qualify, craft (LLM-only)
│   ├── tools/{browse,research,operate}/
│   ├── workflows/              # discovery-workflow + touch-workflow (R1)
│   ├── scorers/                # touch-quality + spam-guardrail (R3 hard-fail)
│   ├── strategy/               # MetricStrategy interface + github-usage
│   └── lib/                    # models, github-client, retrieval, attribution, cost-meter
├── snippets/                   # R2 — validated template library
│   ├── templates/
│   ├── registry.ts
│   └── render.ts
└── (root)
scripts/validate-snippets.py    # offline VideoDB template QA
db/{schema.ts,migrations/}      # signals, candidates, experiments, touches, outcomes, audit_log
```

`@mastra/libsql` is the initial storage adapter from the scaffold; it gets swapped for `@mastra/pg` (PostgresStore + PgVector) in a later commit once the schema lands.

See `../CLAUDE.md` + `../HANDOVER.md` for the authoritative spec, and `../OPEN_QUESTIONS.md` for live unknowns.
