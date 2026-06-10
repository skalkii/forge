# exp-2-reply-length — draft

## Hypothesis

A short reply (problem → snippet → one doc link) activates more developers
than a long explainer, because stuck developers want working code, not prose.

## Variable

`reply-length` — the craft agent's reply-body instruction; the snippet
template and disclosure are identical across arms.

## Arms

| Variant | Shape |
|---|---|
| A | Short: 1-line restatement of the problem → validated snippet → one docs link. ≤120 words around the code. |
| B | Explainer: restate the problem, explain *why* the hand-rolled approach hurts, snippet, what the snippet does line-by-line, docs link. |

## Assignment & measurement

- Deterministic variant by candidate-id hash; logged on the touch row;
  `utm_content` carries the variant.
- Primary: activation rate per arm (`first_successful_api_call`, 21d window).
- Secondary: approval-edit rate at the human gate — if reviewers heavily edit
  one arm, the prompt is wrong even if conversion looks fine.

## Decision rule

≥20 posted touches per arm. Watch negative-signal rate especially on arm B
(longer replies read more promotional); a single flagged reply pauses the arm.
