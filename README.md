# VideoDB Growth Agent

Growth agent for the **VideoDB Forge** program.

**What it does.** Finds developers publicly stuck on problems VideoDB already solves (ffmpeg frame extraction, transcription + timestamp search, scene/visual search, agent vision), drafts a genuinely helpful reply with a runnable VideoDB snippet, gates every public touch behind human approval, and attributes downstream signups to a `first_successful_api_call` event so we can report **cost per activated developer**.

**Stack.** TypeScript · pnpm workspaces · Mastra (agents + workflows + scorers) · Vercel AI SDK (provider-agnostic — Ollama, DeepSeek, Qwen, Mistral, Anthropic, OpenAI) · Postgres + pgvector · Next.js 15 dashboard.

## Status

Day-by-day build toward the Forge submission. Commits follow the plan in `/Users/kal/.claude/plans/claude-md-videodb-polished-brook.md` (also tracked in conversation). Authoritative spec lives in [`CLAUDE.md`](./CLAUDE.md); [`HANDOVER.md`](./HANDOVER.md) overrides where they disagree.

## Quickstart (local-first)

```bash
# Prereqs: Node >=20, pnpm >=11, Docker.
pnpm install
make db-up            # postgres + pgvector via docker-compose
pnpm --filter agent dev      # Mastra playground :4111
pnpm --filter dashboard dev  # Next.js dashboard :3000
```

Env: copy `.env.example` to `.env` and fill the required keys. See `OPEN_QUESTIONS.md` for what's still pending from VideoDB.

## Layout

```
agent/         Mastra app (agents, workflows, scorers, tools, strategy, snippets)
dashboard/     Next.js 15 — review queue + live ops dashboard
packages/      shared types / utilities
docs/          architecture PDF + design notes
submission/    Forge deliverables — fills in across the build
```

## Non-negotiables

This is **not** a spam engine. Every public action is human-approved via a Mastra workflow `suspend()`. The disclosure constraint (R3 in `HANDOVER.md`) requires an affiliation line on every touch. The spam-guardrail scorer hard-fails any draft missing it.

## License

MIT — see [LICENSE](./LICENSE).
