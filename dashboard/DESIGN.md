# Forge Dashboard — Design System

The dashboard has two jobs: **be trustworthy** (every number is a real, live count) and **be understandable** (a non-engineer can read any screen). The design system serves both — a distinctive, colorful visual language plus a consistent *explanation layer* so no number is ever unlabeled.

---

## 1. Color — "Ember / Aubergine-Dusk"

A deliberately un-generic palette in OKLCH (perceptually even lightness), defined once as CSS custom properties in `app/globals.css` and exposed to Tailwind via `@theme inline`.

- **Light** — warm *ember-cream* paper with a faint peach tint, near-white cards.
- **Dark** — deep **aubergine-plum** (hue ~315, *not* neutral gray) for a unique identity.
- A subtle fixed **ambient wash** (warm top-left, cool top-right radial gradients) sits behind everything.

| Token | Role |
|---|---|
| `--background` / `--foreground` | page surface + body text (page also carries the ambient wash) |
| `--card` / `--card-foreground` | panels (`.surface`) |
| `--primary` | vivid coral/ember — actions, active nav, gradient accents |
| `--brand-2` (violet) / `--brand-3` (teal) | secondary/tertiary accents — links, charts, gradient ends (`bg-brand-2`, etc.) |
| `--muted` / `--muted-foreground` | secondary surfaces + captions (contrast pushed past WCAG AA) |
| `--border` / `--input` / `--ring` | hairlines, fields, focus rings (warm-tinted in light, plum-tinted in dark) |
| `--shadow-card` / `--shadow-pop` | tinted, present elevation (`shadow-[var(--shadow-card)]`) |

**Semantic status colors are fixed across the app** (never reassigned):

- **slate / muted** = pending / idle
- **sky / blue** = in progress (sense, running)
- **indigo / violet** = qualify / craft
- **amber** = awaiting human review (the gate)
- **emerald / teal** = approved · posted · activated · success
- **rose** = rejected · dropped · failed · error

These map 1:1 to `StatusPill`, `LoopStageChip`, and the runs board so a color always means the same thing.

## 2. Typography

A distinctive pairing (all self-hosted via `next/font/google`):

| Face | Variable | Use |
|---|---|---|
| **Bricolage Grotesque** (display) | `--font-heading` | page titles + section `h1/h2/h3` + big stat values — characterful, heavier weights (700–800) |
| **Hanken Grotesk** (sans) | `--font-sans` | all UI text and body copy — warm humanist grotesque |
| **JetBrains Mono** | `--font-mono` | numbers, IDs, code, source lines (`tabular-nums` for alignment) |

**Base size is 16px** (larger across the board). Scale: page title `~1.9rem` extrabold (gradient), section title `~0.95rem` semibold, stat value `2rem` display-weight, body `1rem`, caption/definition `0.875rem`, source lines `0.6875rem` mono. Headings are heavy (`700`) and tight (`-0.02em`).

## 3. Spacing, radius, elevation

- **Rhythm:** 4 / 8 / 12 / 16 / 24 px (Tailwind `1/2/3/4/6`). Page sections stack with `space-y-6`; main content is capped at `max-w-[1400px]`.
- **Radius:** base `--radius: 0.8rem`; cards use `rounded-xl`, chips/pills `rounded-full`, inline tags `rounded`.
- **Elevation:** present, tinted shadows — `--shadow-card` on every `.surface`, `--shadow-pop` for popovers/tooltips and the hover-lift on `.surface-interactive` (translateY −2px + primary-tinted border).

## 4. The explanation layer (the heart of this system)

Every screen is built from a small set of self-documenting components so the data is never mysterious.

| Component | What it guarantees |
|---|---|
| **`PageHeader`** | Every page opens with a **gradient display title**, a **loop-stage chip** (where it sits in Sense → … → Observe), a plain-English description, and the **DB tables the data comes from**. |
| **`SectionCard`** | Every panel has a gradient **accent bar**, a tinted header, a title **and a one-line description**. No unlabeled sections. |
| **`StatCard`** | Every KPI has a label (+ colored icon chip), a large display-weight value, a plain explanation, an optional **source line** (e.g. `Σ cost_events ÷ outcomes`), and an optional ⓘ definition. |
| **`InfoTip`** | A focusable ⓘ revealing a definition on hover/keyboard-focus. Built on **Base UI Tooltip → renders in a portal**, so it can never be clipped by a card's `overflow` or a scroll box. Pulls canonical text from the glossary. |
| **`LoopStageChip`** | Places any page/run on the six-stage loop with a consistent color + tooltip. |
| **`EmptyState`** | Empty panels explain *why* they're empty and *what* will fill them — never a bare "no rows". |
| **`ScrollList`** | Long lists/tables live in a fixed-height box that scrolls internally (Base UI ScrollArea), with sticky headers; reaching the limit hands off to the page scroll. |

**Single source of truth for definitions:** `lib/glossary.ts`. Every term the UI explains (cost-per-activated, signal, candidate, touch, triage, qualify, disclosure, guardrail, UTM, attribution, …) is defined once and reused by `InfoTip`/`StatCard`/`SectionCard`. The same word never gets two explanations, and the copy mirrors `docs/explained/*`.

**Shell:** a **collapsible `Sidebar`** (icon-only mode, persisted to `localStorage`, active-rail accent), a sticky header (page title + loop chip + kill-switch + Live badge + theme toggle), and a footer that renders the loop with the human gate highlighted.

## 5. Accessibility

- Body + muted text contrast pushed past **WCAG AA** in both themes.
- `InfoTip` is built on Base UI Tooltip: the trigger is a real focusable `<button>` with a visible focus ring; the panel is exposed as a tooltip and opens on hover **and** keyboard focus.
- Focus rings come from `--ring` and apply app-wide (`outline-ring/50`).
- Status is never conveyed by color alone — pills and chips always carry text labels.
- Theme-aware thin scrollbars; warm selection color; respects `display:swap` fonts.

## 6. Conventions (for future contributors)

1. **New page?** Start with `<PageHeader title stage description sources={[...]}>`. Add its `stage` + `description` to `components/nav-items.ts`.
2. **New panel?** Wrap it in `<SectionCard title description>`. Always write the description.
3. **Long list/table?** Wrap it in `<ScrollList maxH="max-h-[…]">` and keep column headers visible (sticky or outside the scroll body).
4. **New metric or jargon?** Add the definition to `lib/glossary.ts` and reference it with `<InfoTip term="…" />` — don't inline ad-hoc copy.
5. **Surfaces** use the `.surface` class; **numbers** use `tabular-nums`; **status** uses the fixed semantic colors above; gradient titles use `.heading-gradient`.
6. Keep primary (coral) and the gradient accents for genuine emphasis — overusing them flattens the hierarchy.

Result: a distinctive, legible, colorful interface where every figure says what it is, where it comes from, and where it sits in the loop — for engineers and non-engineers alike.
