# Forge Dashboard — Design System

The dashboard has two jobs: **be trustworthy** (every number is a real, live count) and **be understandable** (a non-engineer can read any screen). The design system serves both — a calm, warm visual language plus a consistent *explanation layer* so no number is ever unlabeled.

---

## 1. Color

Warm "paper" palette in OKLCH (perceptually even lightness). Ivory in light, warm charcoal in dark, a terracotta primary. Defined once as CSS custom properties in `app/globals.css` and exposed to Tailwind via `@theme inline`.

| Token | Role |
|---|---|
| `--background` / `--foreground` | page surface + body text |
| `--card` / `--card-foreground` | panels (`.surface`) |
| `--primary` | terracotta — actions, active nav, accents (used sparingly) |
| `--muted` / `--muted-foreground` | secondary surfaces + captions (tuned toward WCAG AA contrast) |
| `--border` / `--input` / `--ring` | hairlines, fields, focus rings |
| `--shadow-card` / `--shadow-pop` | soft, warm-tinted elevation (`shadow-[var(--shadow-card)]`) |

**Semantic status colors are fixed across the app** (never reassigned):

- **slate / muted** = pending / idle
- **sky / blue** = in progress (sense, running)
- **indigo / violet** = qualify / craft
- **amber** = awaiting human review (the gate)
- **emerald / teal** = approved · posted · activated · success
- **rose** = rejected · dropped · failed · error

These map 1:1 to `StatusPill`, `LoopStageChip`, and the runs board so a color always means the same thing.

## 2. Typography

| Face | Variable | Use |
|---|---|---|
| **Lora** (serif) | `--font-heading` | page titles + section `h1/h2/h3` — gives the product a calm, editorial voice |
| **Geist** (sans) | `--font-sans` | all UI text and body copy |
| **Geist Mono** | `--font-mono` | numbers, IDs, code, source lines (`tabular-nums` for alignment) |

Scale (Tailwind utilities): page title `text-2xl`, section title `text-sm font-medium`, body `text-sm`, caption/definition `text-xs`, micro-labels `text-[11px]`/`text-[10px]`. Headings are `tracking-tight`.

## 3. Spacing, radius, elevation

- **Rhythm:** 4 / 8 / 12 / 16 / 24 px (Tailwind `1/2/3/4/6`). Page sections stack with `space-y-6`; card padding is `p-4`/`py-3.5`.
- **Radius:** base `--radius: 0.625rem`; cards use `rounded-xl`, chips/pills `rounded-full`, inline tags `rounded`.
- **Elevation:** one soft shadow (`--shadow-card`) on the `.surface` class — never heavy drop-shadows. Popovers/tooltips use `--shadow-pop`.

## 4. The explanation layer (the heart of this system)

Every screen is built from a small set of self-documenting components so the data is never mysterious.

| Component | What it guarantees |
|---|---|
| **`PageHeader`** | Every page opens with a serif title, a **loop-stage chip** (where it sits in Sense → … → Observe), a plain-English description, and the **DB tables the data comes from**. |
| **`SectionCard`** | Every panel has a title **and a one-line description** of what it shows. No unlabeled sections. |
| **`StatCard`** | Every KPI has a label, big value, a plain explanation, an optional **source line** (e.g. `Σ cost_events ÷ outcomes`), and an optional ⓘ definition. |
| **`InfoTip`** | A focusable ⓘ revealing a definition on hover/keyboard-focus. Server-rendered, no JS. Pulls canonical text from the glossary. |
| **`LoopStageChip`** | Places any page/run on the six-stage loop with a consistent color + tooltip. |
| **`EmptyState`** | Empty panels explain *why* they're empty and *what* will fill them — never a bare "no rows". |

**Single source of truth for definitions:** `lib/glossary.ts`. Every term the UI explains (cost-per-activated, signal, candidate, touch, triage, qualify, disclosure, guardrail, UTM, attribution, …) is defined once and reused by `InfoTip`/`StatCard`/`SectionCard`. The same word never gets two explanations, and the copy mirrors `docs/explained/*`.

## 5. Accessibility

- Body + muted text tuned toward **WCAG AA** contrast (muted-foreground darkened in light mode).
- `InfoTip` triggers are real `<button>`s — **keyboard-focusable**, with visible focus rings; the panel is `role="tooltip"` and opens on `focus-within` as well as hover.
- Focus rings come from `--ring` and apply app-wide (`outline-ring/50`).
- Status is never conveyed by color alone — pills and chips always carry text labels.
- Theme-aware, thin scrollbars; warm selection color.

## 6. Conventions (for future contributors)

1. **New page?** Start with `<PageHeader title stage description sources={[...]}>`. Add its `stage` + `description` to `components/nav-items.ts`.
2. **New panel?** Wrap it in `<SectionCard title description>`. Always write the description.
3. **New metric or jargon?** Add the definition to `lib/glossary.ts` and reference it with `<InfoTip term="…" />` — don't inline ad-hoc copy.
4. **Surfaces** use the `.surface` class; **numbers** use `tabular-nums`; **status** uses the fixed semantic colors above.
5. Keep primary (terracotta) for genuine emphasis — overusing it flattens the hierarchy.

Result: a quiet, legible, warm interface where every figure says what it is, where it comes from, and where it sits in the loop — for engineers and non-engineers alike.
