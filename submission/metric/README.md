# Metric — GitHub → Usage (locked)

## Definition

**Cost per activated developer**, where an *activated developer* is a person who:

1. was found publicly stuck on GitHub on a problem VideoDB solves natively
   (frame extraction, transcription + search, scene/semantic video search,
   visual access for an agent),
2. received exactly one human-approved, affiliation-disclosed, genuinely
   helpful reply from us,
3. and subsequently made their **`first_successful_api_call`** to VideoDB
   within the attribution window (21 days), attributed via the UTM on the
   link in that reply.

```
cost per activated developer =
    total spend (LLM + research + infra-metered calls, from cost_events)
  ÷ developers reaching first_successful_api_call attributed to a touch
```

## Supporting metrics (reported daily)

| Metric | Definition | Why |
|---|---|---|
| Qualified-touch → activation rate | activated ÷ posted touches | efficiency of the craft+gate pipeline |
| Negative-signal rate | replies deleted / flagged / downvoted ÷ posted | the guardrail — must stay ~0 |
| Daily spend | sum of `cost_events.cost_usd` per UTC day | budget control |

## Where it's implemented

- Strategy (the only metric-specific code): `agent/src/mastra/strategy/strategies/github-usage.ts`
  — `successEvent: "first_successful_api_call"`, `attributionMap.windowDays: 21`.
- Spend metering: `agent/src/mastra/lib/cost-meter.ts` → `cost_events` table +
  `submission/spend-and-efficiency.csv`.
- Live headline: dashboard Overview page computes
  `SUM(cost_events.cost_usd) / COUNT(DISTINCT outcomes.touch_id WHERE event='first_successful_api_call')`
  from the production database — never a projection (audit revision R9).

## What we deliberately do not claim

Attribution is a **confident lower bound**: only signups carrying our UTM are
counted. Developers who read the reply, then arrived organically later, are
invisible to the join — reported as an unmeasured soft upside, never as a number.
