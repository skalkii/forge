# Attribution — touch → signup → first API call

## UTM scheme

Every link in every posted touch is tagged:

| Param | Value | Role |
|---|---|---|
| `utm_source` | `github` | channel |
| `utm_medium` | `agent-touch` | program |
| `utm_campaign` | **touch id (UUID)** | the join key — one per posted reply |
| `utm_content` | experiment variant (`A`/`B`), when one is running | R5 experiment dimension |

`utm_campaign` is *never* overloaded: it is the touch id and nothing else, so
the join is exact. The variant rides separately on `utm_content`.

Built in `agent/src/mastra/lib/attribution.ts#buildUtmLink` and appended by the
deterministic `act` step (post-approval only).

## The join

`attributeOnce()` (cron, hourly):

1. reads unprocessed rows from `signup_events`
   (**stub table until VideoDB provides the real signup/activation feed — open
   question R10**; the interface won't change, only the source),
2. matches `utm_campaign` → `touches.id` where `posted_at IS NOT NULL`,
3. enforces the window: `occurred_at` within 21 days **after** `posted_at`,
4. writes `outcomes (touch_id, event, occurred_at)` — unique on
   `(touch_id, event)`, so one signup + one activation per touch, ever,
5. marks the event processed with its resolution
   (`attributed` / `outside-window` / `unmatched`).

Idempotent twice over (processed flag + unique index); safe to re-run.

## Where to see it

- Dashboard **Overview** — headline KPI + funnel, live.
- Dashboard **/experiments** — outcomes grouped per experiment arm.
- `agent/src/mastra/lib/attribution.test.ts` — UTM invariants under test.

## Honesty constraints

- Lower bound only — no view-through or organic-arrival modeling.
- Events earlier than the post date or past the window are recorded but never
  counted.
