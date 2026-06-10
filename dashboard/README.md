# dashboard/

Next.js 15 app — review queue + live ops dashboard for the VideoDB Growth Agent.

```bash
# from repo root
pnpm install
pnpm --filter @forge/dashboard dev   # http://localhost:3000
```

Stack: App Router, Tailwind v4, shadcn/ui. Panels land module by module per the build plan —
auth gate (R6), SSE backbone (Postgres LISTEN/NOTIFY), signals feed, candidates, drafts review
queue, runs board, snippets, strategy, experiments, costs, errors, settings.

See `../CLAUDE.md` + `../HANDOVER.md` for the authoritative spec.
