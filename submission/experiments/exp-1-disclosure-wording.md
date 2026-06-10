# exp-1-disclosure-wording — running

## Hypothesis

A personal, first-person disclosure ("I work with the VideoDB team, so I'm
biased") converts better than a formal one, because it reads as a peer being
honest rather than a vendor pitching.

## Variable

`disclosure-wording` — the affiliation line appended to every public touch
(R3, always present in both arms; only the *wording* varies).

## Arms

| Variant | Disclosure line |
|---|---|
| A | "Disclosure: I work with the VideoDB team, so I'm biased — but this is genuinely the shortest path I know." |
| B | "Disclosure: I am affiliated with VideoDB, the product referenced in this reply." |

## Assignment & measurement

- Deterministic: `assignVariant(candidateId)` (hash → A/B), stamped on the
  touch row at dispatch.
- UTM: variant on `utm_content`; join key stays `utm_campaign` = touch id.
- Success: `first_successful_api_call` within 21 days, per arm.
- Guardrail: negative-signal rate per arm — if either arm draws
  deletions/flags, the experiment stops, not just the arm.

## Decision rule

Run until each arm has ≥20 posted touches (DAILY_TOUCH_CAP=20 ⇒ ≥2 weeks of
real volume). Report raw per-arm activation counts; promote a winner only on a
clear gap, otherwise keep the more conservative formal wording (B).
