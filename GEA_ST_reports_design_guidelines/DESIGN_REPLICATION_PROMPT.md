# Replication Prompt — Warm Editorial Studio design system

Copy everything below the line into a fresh project (alongside the `DESIGN.md` file from
this repo) and give it to your coding agent. It scaffolds the design system from `DESIGN.md`
and explains how to re-theme it for a new brand.

> Prerequisite: place `DESIGN.md` in the new project root. If the `design.md` CLI is
> available, the agent can run `design.md export DESIGN.md --format tailwind` to generate the
> colour/font theme automatically; otherwise it transcribes the frontmatter tokens by hand.

---

## PROMPT

You are setting up the visual design system for this project. The file `DESIGN.md` in the
project root is the single source of truth — its YAML frontmatter holds the design tokens and
its prose explains how to apply them. **Read `DESIGN.md` fully before writing any code**, then
implement the system below. Do not invent new colours, fonts, sizes, or radii — use only what
the tokens define.

### 1. Theme tokens
- Load the three font families from the `typography` tokens (Google Fonts `@import` or, in
  Next.js, `next/font`). Use `font-display: swap`. Load only the weights in use: display
  serif 400/500 (+ italic 400), body sans 300/400/500/600, mono 400/500.
- Emit the `colors`, `rounded`, and `spacing` tokens as CSS custom properties **and** a
  Tailwind theme (or run `design.md export DESIGN.md --format tailwind` and merge the result).
  Keep the token *names* (`ink`, `paper`, `surface`, `rule`, `muted`, `accent`,
  `accent-soft`) — code should reference roles, not raw hex.
- Set `body` to `paper` background, `ink` text, the body sans font. Set `::selection` to
  `accent-soft` on `ink`. `html { scroll-behavior: smooth }`.

### 2. Typography roles
Implement the `typography` tokens as the only text styles. Map them by role:
display serif (400/500, never bold) for headings/hero text and italic captions; body sans for
all UI/copy/labels; mono with `tabular-nums` (`font-feature-settings: "tnum" 1`) for every
figure — prices, stats, quantities, dates, reference numbers. The **eyebrow** is the
signature: short uppercase `label-caps` in `muted` above headings and as status markers.
Fixed `rem` scale in product UI; `clamp()` only for marketing-page headings. Body ≥16px;
line length ~65–75ch.

### 3. Layout & spacing
- Centred `max-w-5xl` (64rem) containers on `paper`; sticky translucent paper header
  (`bg-paper/95` + backdrop blur) with back affordance, title, primary actions.
- Strict 4pt spacing scale from the `spacing` tokens; **56px between distinct sections**;
  tight grouping within. Use `gap`, not margins.
- **Section headings**: uppercase `label-caps` + a small mono count on the right, sitting on
  a 1px `rule` bottom border. **Preview/media grids**: give each item a fixed-height
  `surface` "stage" and centre the artwork so card footers align. Responsive card grids via
  `repeat(auto-fit, minmax(280px, 1fr))`.

### 4. Elevation & shapes
Flat and tonal — depth from tone + hairlines, not shadow: `paper` → `surface` → white/`paper`
cards with a **1px `rule`** border. `rounded-lg`/`rounded-md` on blocks/inputs/buttons; `full`
only on small chips — **never `rounded-full` on rectangular content**. Never use a thick
coloured side-border stripe as an accent.

### 5. Base components
Build these to the `components` tokens + the Components prose in `DESIGN.md`:
- **Card** — `paper`/white on a `surface` stage, 1px `rule` border, `rounded-lg`, 16–24px
  padding, optional `surface` header strip. Never nest cards.
- **Buttons** — primary = `ink` bg / `paper` text; ghost = transparent + 1px `rule` border /
  `ink` text. Not every button is primary.
- **Input** — 1px `rule` border, `paper` bg, `rounded-md`; `label-caps` labels in `muted`.
- **Segmented toggle** — `rule`-bordered group; active segment `ink`/`paper`.
- **Section heading** and **transparent brand badge** (no white chip; reversed/mono version
  if it must sit on a busy ground).
- **Interaction defaults for every interactive element**: hover = opacity/brightness shift
  (150–200ms, never colour-only); press = `scale(0.97)` ~100ms; focus = `ring-2` in `accent`
  + offset (never removed); disabled = opacity 0.4. Respect `prefers-reduced-motion`.
- **Motion**: one orchestrated page-load reveal (staggered `opacity`+`translateY` fade-ups,
  ~300ms ease-out). Animate only `transform`/`opacity`; no bounce/elastic.

### 6. Editorial media (for any generated/marketing surfaces)
If the project outputs marketing media (social images, flyers, posters, documents), follow
the **Editorial Media** section of `DESIGN.md`:
- **Photo ground**: full-bleed photo + ink gradient scrim from the foot; transparent badge
  top-left; tracked-caps eyebrow; short gold hairline; large tight Playfair headline;
  `Place — Region` in body; mono tracked stats; optional italic Playfair caption; small-caps
  footer. No pills, no heavy weights, no rounded corners on the artwork.
- **Paper ground (documents)**: `paper` page, Playfair headings, gold 1px hairline rules,
  mono `tabular-nums` figures, a single `ink` total bar with the figure in `accent`.

### 7. Re-theming for a NEW brand
This system is built to be re-skinned. To rebrand, change **only two things** in
`DESIGN.md`'s frontmatter, then regenerate tokens:
1. the `colors.*` hex values, and
2. the `typography.*.fontFamily` values.
Keep every token **name**, all typography **roles**, the spacing scale, the layout model,
the component recipes, and the Do's/Don'ts. When choosing new colours, prefer OKLCH, reduce
chroma toward the lightness extremes, tint neutrals slightly toward the brand hue, and keep a
single accent at ~10% visual weight. Update the prose colour/font descriptions to match.

### 8. Guardrails (Do NOT)
No pure black/white, generic gray borders, or SaaS blue. No gradient text /
`background-clip: text`. No thick coloured side-border accent stripes. No `rounded-full` on
rectangular content; no logo-in-a-white-chip. No identical icon+heading+text card grids
everywhere; no nested cards. Don't bold the display serif or set long passages in uppercase.
No heavy drop shadows. In dense functional UI, prioritise density and clarity over flourish —
save the editorial treatment for generated media and marketing pages.

### 9. Verify
- Run `design.md lint DESIGN.md` (expect 0 errors; advisory warnings are fine).
- Confirm WCAG AA contrast for text on its ground.
- Build one sample screen — sticky header + a hairline-anchored section heading + a card grid
  + one editorial-media tile — and confirm it reads as warm, quiet, and typography-forward,
  not like a generic SaaS dashboard.
