# Iteration 1 — discovery query tuning (data-driven)

**What changed:** all four original strategy queries replaced with five
short, qualifier-form queries (commit `87f38b7`).

## The data that forced it

Audited the four locked queries from the original strategy against live
GitHub issue search:

| Original query | Live hits | Verdict |
|---|---|---|
| `ffmpeg extract frames "every n seconds" is:issue` | 18 | too narrow — exact-phrase match strangles recall |
| `whisper transcribe video timestamps in:title,body` | 684 | usable but noisy |
| `search inside video for moment OR scene state:open` | 17,933 | ~all false positives — `OR` exploded the match into unrelated repos |
| `"give my agent" vision screenshot frames in:body` | 0 | dead — nobody phrases it like this |

Long natural-language phrases behave badly in GitHub search: exact phrases
over-constrain, loose words under-constrain, and `OR` is a trap.

## The fix

Five qualifier-form queries (short keyword core + `is:issue is:open` +
`created:>` freshness), each scoped to one VideoDB capability:

| New query (core) | Live hits |
|---|---|
| ffmpeg extract frames interval | 377 |
| whisper video transcription search | 229 |
| semantic search video content | 51 |
| video scene detection timestamps | 87 |
| agent screenshot video frames | 191 |

Recall is real (hundreds, not tens), precision is recoverable (triage drops
the rest cheaply), and zero queries are dead.

## Why this is the loop working

The strategy file said queries were "starting points; verify against real
GitHub search syntax" (R10). The verification produced hard before/after
numbers, and the numbers — not taste — rewrote the strategy.
