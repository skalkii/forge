# exp-3-capability-mix — draft

## Hypothesis

Transcribe+search touches activate at a higher rate than frame-extraction
touches, because search is harder to hand-roll and the native gap is bigger.

## Variable

`capability-mix` — which snippet capability the touch leads with. Unlike
exp-1/exp-2 this is *observational by capability* rather than a forced A/B:
the craft agent always picks the template that genuinely fits the problem
(value-first is non-negotiable), so arms are defined by the chosen template.

## Arms

| Variant | Capability (template family) |
|---|---|
| A | `transcribe-search` — transcription + keyword/semantic search inside video |
| B | `frame-extraction` — extract frames every n seconds / at timestamps |

(`scene-search` and `agent-vision` touches are recorded but out of scope for
this comparison.)

## Assignment & measurement

- The touch's `variant` is set from the rendered template's capability at
  dispatch; `utm_content` carries it.
- Primary: activation rate per capability (21d window).
- Confound to report honestly: discovery query mix drives which capability
  shows up more — report per-arm *volume* alongside rate, never rate alone.

## Decision rule

≥15 posted touches per capability. Outcome feeds the strategy file: if one
capability clearly activates better, its discovery queries get more of the
search budget (R4) in the next iteration.
