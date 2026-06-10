# Experiments (R5)

Three experiments seeded by `agent/scripts/seed-experiments.ts`
(`pnpm --filter agent seed:experiments`, idempotent — `ON CONFLICT (name) DO
NOTHING`). Exactly one runs at a time; rotate by flipping `status` in the
`experiments` table.

## How a variant rides through the system

1. The dispatcher stamps each new touch with the **running** experiment's id
   and a **deterministic variant** — `assignVariant(candidateId)` hashes the
   candidate UUID to `A`/`B`, so re-runs never reshuffle arms.
2. Both are logged on the `touches` row (`experiment_id`, `variant`).
3. The UTM carries the variant on **`utm_content`** — `utm_campaign` stays the
   touch id, so attribution joins are never polluted by the experiment
   dimension.
4. The attribution join groups outcomes by `(experiment_id, variant)`; the
   dashboard **/experiments** page renders a 5-stage funnel per arm
   (drafted → approved → posted → signup → activated).

## Manifests

| File | Variable | Status |
|---|---|---|
| [exp-1-disclosure-wording.md](exp-1-disclosure-wording.md) | disclosure wording | **running** |
| [exp-2-reply-length.md](exp-2-reply-length.md) | reply length | draft |
| [exp-3-capability-mix.md](exp-3-capability-mix.md) | snippet capability | draft |

## Honesty constraints

- No experiment result is reported until both arms have posted touches;
  the dashboard shows raw per-arm counts, never extrapolated rates.
- Variants never weaken the guardrails: every arm still carries the
  affiliation disclosure (R3) and passes the same human gate.
