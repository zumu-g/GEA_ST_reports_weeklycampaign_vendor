---
version: alpha
name: Warm Editorial Studio
description: >-
  A warm, typography-forward design system for premium functional tools and the
  editorial marketing material they produce. The system (type roles, spacing,
  layout, components, motion) is brand-agnostic; the colours and font families
  are the theme layer to replace for a new brand.
colors:
  accent: "#C8A96E"
  accent-soft: "#E8D4A8"
  ink: "#1A1814"
  paper: "#FAF8F4"
  surface: "#F2EEE8"
  rule: "#E0DBD4"
  muted: "#8B8580"
typography:
  display-xl:
    fontFamily: Playfair Display
    fontSize: 68px
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: -0.01em
  display:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.01em
  display-italic:
    fontFamily: Playfair Display
    fontSize: 23px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  heading:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  subheading:
    fontFamily: DM Sans
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.1em
  mono-figure:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: '"tnum" 1'
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  section: 56px
components:
  # 1px `rule` borders, focus rings, and active/hover states are described in the
  # Components prose (the token schema has no border/focusRing sub-tokens).
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  card-stage:
    backgroundColor: "{colors.surface}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  segmented-toggle:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  section-heading:
    typography: "{typography.label-caps}"
    textColor: "{colors.muted}"
---

# Warm Editorial Studio — DESIGN.md

## Overview

Also known as Brand & Style.

This is the design language of a premium, **functional** product — a tool used by
focused, time-pressured professionals — and of the **editorial marketing material**
that tool generates. The feeling is *quiet confidence*: warm, considered, and
typography-forward, closer to a well-set printed document than a SaaS dashboard. It
never shouts. Photography and type do the work; decoration is minimal. Density and
clarity beat art direction in the product UI; the generated media is where the
editorial flourish lives.

Emotional register: trustworthy, calm, premium. Audience: practitioners who value
speed and legibility, and their clients, who should feel they are dealing with a
considered, high-end operator.

**Theming (read this first).** This document is a *re-themable system*. The reusable,
brand-agnostic core is everything structural: the **typography roles**, the **4pt
spacing scale**, the **layout model**, the **component recipes**, the **flat/tonal
elevation**, and the **motion defaults**. The **theme layer** is exactly two things:
the `colors.*` values and the `typography.*.fontFamily` values. To rebrand for a new
project, replace only those, keep every token *name* and every rule, and the system
holds together. The values below document the original "warm editorial" theme.

## Colors

A warm neutral foundation with a single restrained accent. Pure black and pure white
never appear — every neutral is tinted warm, which reads as printed matter rather than
screen.

- **Paper (#FAF8F4):** warm off-white. The page ground. Never `#fff`.
- **Surface (#F2EEE8):** a slightly deeper warm tone for elevated areas and the
  "stage" behind media previews.
- **Ink (#1A1814):** warm near-black for primary text and the primary button. Never
  `#000`.
- **Muted (#8B8580):** secondary text, captions, metadata.
- **Rule (#E0DBD4):** hairline borders and dividers. Use instead of any generic gray.
- **Accent (#C8A96E) / Accent-soft (#E8D4A8):** the *only* brand accent (a soft gold).
  Used sparingly — hairline emphasis, focus rings, selection, a single highlighted
  figure. Accent-soft is for `::selection` and hover/selected states on light grounds.

Apply the **60-30-10** rule by visual weight: ~60% paper/surface, ~30% ink/muted text
and rules, ~10% accent. The accent works *because* it is rare. When generating new
shades, prefer OKLCH and reduce chroma as lightness approaches the extremes; tint
neutrals very slightly toward the brand hue for subconscious cohesion.

Anti-patterns: no generic SaaS blue (`#3b82f6`, `#0070f3`); no pure black/white; never
more than one accent in a single view; status colours (if needed) should be cool-toned
so they don't compete with the warm accent.

## Typography

Three families, each with a clear job — the oldest editorial trick for instant
hierarchy without relying on size alone:

- **Display — Playfair Display** (a high-contrast serif): headings, hero addresses,
  and italic editorial captions. Expressive through letterform, so it stays at weight
  400–500 — never bolded. Large display is set tight (`line-height ~1.05`,
  `letter-spacing -0.01em`).
- **Body — DM Sans** (a humanist sans): all UI, body copy, labels, navigation. Weights
  300/400/500, plus 600 for the uppercase label/eyebrow role.
- **Figures — IBM Plex Mono**: prices, stats, quantities, dates, reference numbers —
  anything where precision and alignment matter. Always `tabular-nums`.

Roles → tokens: `display-xl`, `display`, `display-italic` (Playfair); `heading`,
`subheading`, `body`, `caption` (DM Sans); `label-caps` (DM Sans 600, uppercase,
`letter-spacing 0.1em` in UI — widen to 0.18–0.32em on large media); `mono-figure`
(IBM Plex Mono, tabular). Body is ≥16px. Use a **fixed `rem` scale in the product UI**
(spatial predictability for dense layouts); reserve fluid `clamp()` for marketing /
content-page headings only. Keep line length ~65–75ch.

The **eyebrow** pattern — short uppercase `label-caps` in `muted` above a heading or as
a status marker — is used throughout and is a signature of the system.

## Layout

Also known as Layout & Spacing.

Centred, contained, and rhythmic. Product pages use a **fixed max-width container**
(`max-width: 64rem` / `max-w-5xl`) centred on paper, with a **sticky translucent paper
header** (`bg-paper/95` + `backdrop-blur`) holding a back affordance, title, and
primary actions.

Spacing is a strict **4pt scale**: 4, 8, 12, 16, 24, 32, 48, with **56px between
distinct sections**. Group related elements tightly; separate sections generously —
rhythm, not uniform padding. Use `gap` for sibling spacing, not margins.

Signature layout devices:
- **Hairline-anchored section headings:** an uppercase `label-caps` heading with a
  small `mono-figure` count on the right, sitting on a 1px `rule` bottom border. This
  structures a dense page without boxing everything in cards.
- **Fixed-height preview stages:** when laying out a grid of differently-proportioned
  media previews, give every preview a *fixed-height* `surface` stage and centre the
  artwork inside, so card footers align into a clean grid.
- **Self-adjusting card grids:** `repeat(auto-fit, minmax(280px, 1fr))` for responsive
  card content without breakpoints.

## Elevation & Depth

Flat and tonal — depth comes from **tone and hairlines, not shadow**. The ladder is
`paper` (page) → `surface` (recessed stage / table head) → white-or-`paper` cards
outlined with a **1px `rule`** border. Shadows are avoided or kept extremely subtle;
they are never decorative. Hierarchy is achieved by tonal contrast, a hairline, and
space.

## Shapes

Soft-but-precise. Content blocks and cards use `rounded-lg` (16px) or `rounded-md`
(12px); inputs and buttons `rounded-md`. The `full` radius is reserved for **small
chips and round affordances only** — **never `rounded-full` on rectangular content
blocks**. Dividers and emphasis are **1px hairlines**; never use a thick coloured
left/right border stripe as an accent.

## Components

- **Card:** `paper`/white on a `surface` stage, 1px `rule` border, `rounded-lg`,
  generous internal padding (16–24px), an optional `surface` header strip divided by a
  `rule`. Never nest cards in cards.
- **Button — primary:** `ink` background, `paper` text, `rounded-md`.
  **Button — ghost/secondary:** transparent with a 1px `rule` border, `ink` text;
  hover darkens the border. Don't make every button primary.
- **Interaction defaults (all interactive elements):** hover = opacity/brightness
  shift (150–200ms), never colour-only; press/tap = `scale(0.97)` ~100ms; focus =
  visible `ring-2` in `accent` with offset (never remove it — accessibility matters);
  disabled = opacity 0.4, never hidden.
- **Input:** 1px `rule` border, `paper` background, `rounded-md`, focus ring in
  `accent`. Labels use `label-caps` in `muted`.
- **Segmented toggle:** a `rule`-bordered pill group; the active segment is `ink` with
  `paper` text, inactive segments `muted` text on white.
- **Section heading:** see Layout — uppercase `label-caps` + `mono-figure` count on a
  1px `rule` baseline.
- **Badge / wordmark:** the brand mark is rendered **transparent** (no background
  chip) and sits directly on photo or paper. If a logo must read on a busy/coloured
  ground, prefer a monochrome/reversed version over wrapping it in a white box.

Motion: orchestrate one tasteful page-load reveal (staggered `opacity`+`translateY`
fade-ups, ~300ms, ease-out) rather than scattering micro-animations. Animate only
`transform`/`opacity`. No bounce/elastic easing. Respect `prefers-reduced-motion`.

## Editorial Media

The marketing-material aesthetic for generated/exported surfaces (social posts,
flyers, signboards, documents). Two grounds:

**Photo ground (immersive):** full-bleed photograph with an **ink gradient scrim**
fading up from the foot (`linear-gradient(to top, rgba(ink,0.86), transparent ~58%)`)
for legible text. Over it: the **transparent brand badge** top-left; a small
tracked-caps eyebrow (status); a short **gold hairline**; the address in large tight
**Playfair** (`display-xl`); `Suburb — State` in body; the stats line in **mono,
tracked**; an optional **italic Playfair** caption; agency line in small caps at the
foot. Generous fixed margins (~64px on a 1080px canvas). No pills, no heavy weights,
no rounded corners on the artwork.

**Paper ground (documents):** warm `paper` page, `ink` text, **Playfair** headings,
gold **1px hairline** rules (header underline and footer divider), `mono` figures with
`tabular-nums` in tables and totals, a single `ink` total bar with the figure in
`accent`. The brand badge is transparent in the header beside a muted wordmark.

Representative implementations in the source project:
`components/templates/SocialSquare/SocialSquare.tsx`,
`components/templates/Signboard/Signboard.tsx`,
`app/(render)/templates/invoice/page.tsx`.

## Do's and Don'ts

**Do**
- Treat colours + font families as the only theme layer; keep all roles, scale, and
  rules when rebranding.
- Use the serif/sans/mono split for hierarchy; set figures in mono with `tabular-nums`.
- Anchor sections with an uppercase eyebrow on a 1px hairline; vary spacing for rhythm.
- Keep one accent, used sparingly; let warm neutrals and space carry the design.
- Render the brand mark transparent on its ground.

**Don't**
- Use pure black/white, generic gray borders, or SaaS blue.
- Use gradient text or `background-clip: text`.
- Use a thick coloured left/right border stripe as an accent on cards/callouts.
- Put `rounded-full` on rectangular content, or wrap the logo in a white chip.
- Use identical icon-+-heading-+-text card grids everywhere, or nest cards in cards.
- Bold the display serif, or set long passages in uppercase.
- Add heavy drop shadows; convey depth with tone and hairlines instead.
- Apply editorial flourish to dense functional UI — there, density and clarity win.
